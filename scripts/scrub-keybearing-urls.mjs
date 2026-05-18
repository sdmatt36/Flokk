/**
 * scrub-keybearing-urls.mjs
 *
 * One-shot: find every maps.googleapis.com URL in SavedItem.placePhotoUrl and
 * CommunitySpot.photoUrl, follow the redirect to get the actual CDN image,
 * persist it to Flokk Supabase Storage, and write the Flokk URL back.
 *
 * If the redirect fails or the image is unrecoverable, sets the column to NULL.
 * NEVER writes a maps.googleapis.com URL back under any branch.
 */

import { createHash } from "node:crypto";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "..", ".env.local");
const envVars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) envVars[m[1]] = m[2];
}

const DATABASE_URL = envVars.DATABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

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

    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (headRes.ok) return publicUrl;

    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = await imgRes.arrayBuffer();
    if (bytes.byteLength < 1000) return null;

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

async function resolveAndPersist(mapsUrl) {
  // Follow redirect from maps.googleapis.com → lh3.googleusercontent.com CDN URL
  try {
    const res = await fetch(mapsUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    if (!res.url || res.url === mapsUrl) return null; // no redirect happened
    if (res.url.includes("maps.googleapis.com")) return null; // safety: redirect stayed on Google
    return persistRemoteImage(res.url);
  } catch {
    return null;
  }
}

async function scrubTable({ client, tableName, urlCol, deletedAtGuard }) {
  const stats = { persisted: 0, nulled: 0, errors: 0 };
  const deletedFilter = deletedAtGuard ? `AND "deletedAt" IS NULL` : "";

  const { rows } = await client.query(
    `SELECT id, "${urlCol}" FROM "${tableName}"
     WHERE "${urlCol}" LIKE '%maps.googleapis.com%'
     ${deletedFilter}
     ORDER BY id`
  );

  console.log(`\n[${tableName}.${urlCol}] ${rows.length} key-bearing rows to scrub`);

  for (const row of rows) {
    const storedUrl = row[urlCol];
    try {
      const flokUrl = await resolveAndPersist(storedUrl);

      if (flokUrl) {
        // Safety gate: never write a Google URL back
        if (flokUrl.includes("googleapis.com") || flokUrl.includes("googleusercontent.com")) {
          console.warn(`  [SAFETY BLOCK] ${row.id}: resolved to Google URL, nulling instead`);
          await client.query(`UPDATE "${tableName}" SET "${urlCol}" = NULL WHERE id = $1`, [row.id]);
          stats.nulled++;
        } else {
          await client.query(`UPDATE "${tableName}" SET "${urlCol}" = $1 WHERE id = $2`, [flokUrl, row.id]);
          stats.persisted++;
          console.log(`  ✓ ${row.id} → ${flokUrl.slice(-24)}`);
        }
      } else {
        await client.query(`UPDATE "${tableName}" SET "${urlCol}" = NULL WHERE id = $1`, [row.id]);
        stats.nulled++;
        console.log(`  ✗ ${row.id} → NULL (redirect failed or image expired)`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${row.id}: ${err.message}`);
      stats.errors++;
    }
  }

  console.log(`[${tableName}.${urlCol}] DONE → persisted: ${stats.persisted}, nulled: ${stats.nulled}, errors: ${stats.errors}`);
  return stats;
}

async function main() {
  console.log("=== Flokk key-bearing URL scrub ===");
  console.log(`SUPABASE_SERVICE_ROLE_KEY present: ${SUPABASE_SERVICE_ROLE_KEY.length > 0}`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const tables = [
      { tableName: "SavedItem",     urlCol: "placePhotoUrl", deletedAtGuard: true  },
      { tableName: "CommunitySpot", urlCol: "photoUrl",      deletedAtGuard: false },
    ];

    const totals = { persisted: 0, nulled: 0, errors: 0 };

    for (const t of tables) {
      const s = await scrubTable({ client, ...t });
      totals.persisted += s.persisted;
      totals.nulled    += s.nulled;
      totals.errors    += s.errors;
    }

    console.log("\n=== FINAL TOTALS ===");
    console.log(`Persisted to Flokk Storage: ${totals.persisted}`);
    console.log(`Nulled (expired/unrecoverable): ${totals.nulled}`);
    console.log(`Errors: ${totals.errors}`);

    // Verification: confirm zero maps.googleapis.com rows remain
    console.log("\n=== Verification ===");
    const { rows: remaining } = await client.query(`
      SELECT 'SavedItem.placePhotoUrl' AS col, COUNT(*) AS cnt FROM "SavedItem" WHERE "placePhotoUrl" LIKE '%maps.googleapis.com%' AND "deletedAt" IS NULL
      UNION ALL
      SELECT 'CommunitySpot.photoUrl', COUNT(*) FROM "CommunitySpot" WHERE "photoUrl" LIKE '%maps.googleapis.com%'
    `);
    for (const r of remaining) {
      console.log(`  ${r.col}: ${r.cnt} remaining`);
    }
    const anyLeft = remaining.some(r => parseInt(r.cnt) > 0);
    if (anyLeft) {
      console.error("  *** FAIL: key-bearing URLs still present ***");
      process.exit(1);
    } else {
      console.log("  ✓ Zero key-bearing URLs remain in all columns");
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
