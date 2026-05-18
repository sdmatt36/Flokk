/**
 * backfill-google-to-storage.mjs
 *
 * One-shot resumable sweep: migrate Google URLs → Flokk Supabase Storage
 * across SavedItem, CommunitySpot, TourStop, ManualActivity.
 *
 * Resumable: WHERE clause only targets Google URLs — already-healed rows are
 * never selected again. Re-running after interruption processes remaining rows.
 *
 * Per-row logic:
 *   1. persistRemoteImage(stored_url)  → Flokk URL if image still alive
 *   2. If null AND placeId present → Places Details API → new photo_reference
 *      → resolveGooglePhotoUrl → persist
 *   3. If null AND no placeId → leave row (proxy will serve branded placeholder)
 *
 * NEVER writes a raw Google URL back under any branch.
 */

import { createHash } from "node:crypto";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── env ────────────────────────────────────────────────────────────────────
const envPath = join(__dirname, "..", ".env.local");
const envVars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) envVars[m[1]] = m[2];
}

const DATABASE_URL = envVars.DATABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = envVars.GOOGLE_MAPS_API_KEY;

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!GOOGLE_MAPS_API_KEY) { console.error("Missing GOOGLE_MAPS_API_KEY"); process.exit(1); }

// ── storage ────────────────────────────────────────────────────────────────
const PROJECT_REF = "egnvlwgngyrkhhbxtlqa";
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1`;
const BUCKET = "place-photos";

function buildObjectKey(url) {
  const stripped = url
    .replace(/[?&](maxwidth|maxheight|width|height|w|h)=\d+/gi, "")
    .replace(/=s\d+(-w\d+)?(-h\d+)?(-k-no)?/g, "");
  const hash = createHash("sha256").update(stripped).digest("hex").slice(0, 40);
  return `photos/${hash}.jpg`;
}

function flokPublicUrl(objectKey) {
  return `${STORAGE_BASE}/object/public/${BUCKET}/${objectKey}`;
}

async function persistRemoteImage(remoteUrl) {
  if (!remoteUrl) return null;
  try {
    const objectKey = buildObjectKey(remoteUrl);
    const publicUrl = flokPublicUrl(objectKey);

    // Idempotency: HEAD the CDN URL — 200 means already stored
    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (headRes.ok) return publicUrl;

    // Fetch the remote image (follows 302 redirects from maps.googleapis.com)
    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = await imgRes.arrayBuffer();
    if (bytes.byteLength < 1000) return null; // not real image bytes

    const upRes = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(30000),
    });

    if (!upRes.ok) {
      const body = await upRes.text().catch(() => "");
      if (body.toLowerCase().includes("already exist")) return publicUrl;
      return null;
    }
    return publicUrl;
  } catch {
    return null;
  }
}

// ── Google Places re-resolve ────────────────────────────────────────────────
const PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";

async function resolveViaPlaceId(placeId) {
  if (!placeId) return null;
  try {
    const url = `${PLACES_DETAILS}?place_id=${encodeURIComponent(placeId)}&fields=photos&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const photoRef = data?.result?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
    // Follow redirect to CDN URL, then persist
    const photoRes = await fetch(photoApiUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!photoRes.ok || !photoRes.url || photoRes.url === photoApiUrl) return null;
    return persistRemoteImage(photoRes.url);
  } catch {
    return null;
  }
}

// ── concurrency helpers ────────────────────────────────────────────────────
async function pLimit(concurrency, tasks) {
  const results = [];
  const running = [];
  for (const task of tasks) {
    const p = task().then((r) => { running.splice(running.indexOf(p), 1); return r; });
    running.push(p);
    results.push(p);
    if (running.length >= concurrency) await Promise.race(running);
  }
  return Promise.all(results);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── per-table backfill ─────────────────────────────────────────────────────
const BATCH_SIZE = 50;
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 600;

async function backfillTable({ client, tableName, urlCol, placeIdCol, deletedAtGuard }) {
  const stats = { healed: 0, reresolved: 0, unrecoverable: 0, skipped: 0, errors: 0 };
  let cursor = ""; // start before first row
  let batchNum = 0;

  const deletedFilter = deletedAtGuard ? `AND "deletedAt" IS NULL` : "";
  const placeIdSelect = placeIdCol ? `, "${placeIdCol}"` : "";

  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${tableName}] Starting backfill (url column: ${urlCol}${placeIdCol ? `, placeId: ${placeIdCol}` : ""})`);

  while (true) {
    const { rows } = await client.query(
      `SELECT id, "${urlCol}"${placeIdSelect}
       FROM "${tableName}"
       WHERE (
         "${urlCol}" LIKE '%googleusercontent.com%'
         OR "${urlCol}" LIKE '%maps.googleapis.com%'
       )
       AND "${urlCol}" NOT LIKE '%supabase.co/storage%'
       ${deletedFilter}
       AND id > $1
       ORDER BY id
       LIMIT $2`,
      [cursor, BATCH_SIZE]
    );

    if (rows.length === 0) break;
    batchNum++;
    cursor = rows[rows.length - 1].id;

    const batchStats = { healed: 0, reresolved: 0, unrecoverable: 0, errors: 0 };

    await pLimit(CONCURRENCY, rows.map((row) => async () => {
      const storedUrl = row[urlCol];
      const placeId = placeIdCol ? row[placeIdCol] : null;

      try {
        // Branch 1: try to persist the stored URL directly
        let flokUrl = await persistRemoteImage(storedUrl);
        let wasReresolved = false;

        // Branch 2: expired URL + placeId → re-resolve via Places API
        if (!flokUrl && placeId) {
          flokUrl = await resolveViaPlaceId(placeId);
          wasReresolved = !!flokUrl;
        }

        if (flokUrl) {
          // Safety: never write a Google URL back
          if (flokUrl.includes("googleusercontent.com") || flokUrl.includes("maps.googleapis.com")) {
            console.warn(`  [SAFETY BLOCK] row ${row.id}: resolved to Google URL, skipping`);
            batchStats.errors++;
            return;
          }
          await client.query(
            `UPDATE "${tableName}" SET "${urlCol}" = $1 WHERE id = $2`,
            [flokUrl, row.id]
          );
          batchStats.healed++;
          if (wasReresolved) batchStats.reresolved++;
        } else {
          // Branch 3: unrecoverable — leave row as-is
          batchStats.unrecoverable++;
        }
      } catch (err) {
        console.error(`  [ERROR] row ${row.id}: ${err.message}`);
        batchStats.errors++;
      }
    }));

    stats.healed += batchStats.healed;
    stats.reresolved += batchStats.reresolved;
    stats.unrecoverable += batchStats.unrecoverable;
    stats.errors += batchStats.errors;

    console.log(
      `[${tableName}] batch ${batchNum} (${rows.length} rows) → ` +
      `healed: ${batchStats.healed}, re-resolved: ${batchStats.reresolved}, ` +
      `unrecoverable: ${batchStats.unrecoverable}, errors: ${batchStats.errors}`
    );

    if (rows.length < BATCH_SIZE) break; // last page
    await sleep(BATCH_DELAY_MS);
  }

  console.log(
    `[${tableName}] DONE → ` +
    `healed: ${stats.healed} (${stats.reresolved} via re-resolve), ` +
    `unrecoverable: ${stats.unrecoverable}, errors: ${stats.errors}`
  );
  return stats;
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Flokk Google → Storage backfill ===");
  console.log(`Credential check: SUPABASE_SERVICE_ROLE_KEY present: ${SUPABASE_SERVICE_ROLE_KEY.length > 0}`);
  console.log(`Credential check: GOOGLE_MAPS_API_KEY present: ${GOOGLE_MAPS_API_KEY.length > 0}`);
  console.log();

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const tables = [
      { tableName: "SavedItem",      urlCol: "placePhotoUrl", placeIdCol: "googlePlaceId", deletedAtGuard: true  },
      { tableName: "CommunitySpot",  urlCol: "photoUrl",      placeIdCol: "googlePlaceId", deletedAtGuard: false },
      { tableName: "TourStop",       urlCol: "imageUrl",      placeIdCol: "placeId",        deletedAtGuard: true  },
      { tableName: "ManualActivity", urlCol: "imageUrl",      placeIdCol: null,             deletedAtGuard: true  },
    ];

    const totals = { healed: 0, reresolved: 0, unrecoverable: 0, errors: 0 };

    for (const t of tables) {
      const s = await backfillTable({ client, ...t });
      totals.healed += s.healed;
      totals.reresolved += s.reresolved;
      totals.unrecoverable += s.unrecoverable;
      totals.errors += s.errors;
    }

    console.log("\n=== FINAL TOTALS ===");
    console.log(`Healed:        ${totals.healed} (${totals.reresolved} via Places re-resolve)`);
    console.log(`Unrecoverable: ${totals.unrecoverable} (expired URL, no placeId — proxy serves placeholder)`);
    console.log(`Errors:        ${totals.errors}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
