/**
 * Backfill all SavedItem rows with lh3.googleusercontent.com placePhotoUrls
 * to durable supabase.co URLs via toDurableImageUrl / persistRemoteImage.
 * Sequential, 250ms between rows, retry with exponential backoff.
 * Inner halt gate: >5 failures in any 20-row window → stop.
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = "egnvlwgngyrkhhbxtlqa";
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1`;
const BUCKET = "place-photos";
const DELAY_MS = 250;
const LOG_FILE = "/tmp/backfill-all-lh3.log";

const PLACES_INFRA = new Set([
  "REQUEST_DENIED", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT", "UNKNOWN_ERROR",
]);

// ── Logging ───────────────────────────────────────────────────────────────────

const logStream = createWriteStream(LOG_FILE, { flags: "w" });
function log(...args) {
  const line = args.join(" ");
  console.log(line);
  logStream.write(line + "\n");
}

// ── Storage helpers (inlined from imageStore.ts) ──────────────────────────────

function buildObjectKey(url) {
  const stripped = url
    .replace(/[?&](maxwidth|maxheight|width|height|w|h)=\d+/gi, "")
    .replace(/=s\d+(-w\d+)?(-h\d+)?(-k-no)?/g, "");
  const hash = createHash("sha256").update(stripped).digest("hex").slice(0, 40);
  return `photos/${hash}.jpg`;
}

function flokImgPublicUrl(objectKey) {
  return `${STORAGE_BASE}/object/public/${BUCKET}/${objectKey}`;
}

async function persistRemoteImage(remoteUrl) {
  if (!SUPABASE_SERVICE_KEY) return null;
  try {
    const objectKey = buildObjectKey(remoteUrl);
    const publicUrl = flokImgPublicUrl(objectKey);
    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (headRes.ok) return publicUrl;
    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = await imgRes.arrayBuffer();
    const upRes = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(20000),
    });
    if (!upRes.ok) {
      const body = await upRes.text().catch(() => "");
      if (body.toLowerCase().includes("already exist")) return publicUrl;
      return null;
    }
    return publicUrl;
  } catch { return null; }
}

async function toDurableImageUrl(url) {
  if (!url) return null;
  try {
    const persisted = await persistRemoteImage(url);
    return persisted ?? url;
  } catch { return url; }
}

// ── Places helpers ────────────────────────────────────────────────────────────

async function resolveGooglePhotoUrl(photoApiUrl) {
  const res = await fetch(photoApiUrl, { redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!res.ok || !res.url || res.url === photoApiUrl) return null;
  return res.url;
}

async function findPlaceId(title, city, country) {
  const parts = [title, city, country].filter(Boolean);
  const query = parts.join(", ");
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`textsearch HTTP ${res.status}`);
  const data = await res.json();
  if (PLACES_INFRA.has(data.status)) throw new Error(`Places infra: ${data.status}`);
  return data.results?.[0]?.place_id ?? null;
}

async function getPlaceDetails(placeId) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos,formatted_address&key=${GOOGLE_API_KEY}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`details HTTP ${res.status}`);
  const data = await res.json();
  if (PLACES_INFRA.has(data.status)) throw new Error(`Places infra: ${data.status}`);
  const photoRef = data.result?.photos?.[0]?.photo_reference ?? null;
  const formattedAddress = data.result?.formatted_address ?? null;
  let photoUrl = null;
  if (photoRef) {
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${GOOGLE_API_KEY}`;
    photoUrl = await resolveGooglePhotoUrl(photoApiUrl);
  }
  return { photoUrl, formattedAddress };
}

function isAmbiguous(formattedAddress, city, country) {
  // Only flags if we have a reference AND the address contains neither city nor country
  if (!formattedAddress) return false;
  if (!city && !country) return false;
  const addr = formattedAddress.toLowerCase();
  if (city && addr.includes(city.toLowerCase())) return false;
  if (country && addr.includes(country.toLowerCase())) return false;
  return true;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry(fn, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message ?? "";
      const isTransient =
        msg.includes("timeout") || msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET") || msg.includes("429") ||
        msg.includes("503") || msg.includes("502") ||
        err?.name === "AbortError";
      if (!isTransient || attempt === maxAttempts - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

// ── Inner halt gate ───────────────────────────────────────────────────────────

function checkHaltGate(recentResults, windowSize = 20, maxFails = 5) {
  if (recentResults.length < windowSize) return false;
  const window = recentResults.slice(-windowSize);
  const fails = window.filter(r => r.startsWith("FAIL")).length;
  return fails > maxFails;
}

// ── Row processor ─────────────────────────────────────────────────────────────

async function processRow(db, row) {
  const { id, rawTitle, destinationCity, destinationCountry, googlePlaceId: existingPlaceId } = row;
  const title = rawTitle ?? "(no title)";

  // Idempotency: re-query current placePhotoUrl
  const current = await db.savedItem.findUnique({
    where: { id },
    select: { placePhotoUrl: true },
  });
  if (current?.placePhotoUrl?.includes("supabase.co")) {
    return { status: "SKIP-ALREADY-MIGRATED", detail: "" };
  }

  let placeId = existingPlaceId;

  // Resolve placeId if missing
  if (!placeId) {
    placeId = await withRetry(() => findPlaceId(title, destinationCity, destinationCountry));
    if (!placeId) return { status: "SKIP-NO-PLACE", detail: "" };
  }

  // Fetch photo + address
  const { photoUrl: freshLh3, formattedAddress } = await withRetry(() => getPlaceDetails(placeId));

  // Ambiguity check
  if (isAmbiguous(formattedAddress, destinationCity, destinationCountry)) {
    return {
      status: "SKIP-AMBIGUOUS",
      detail: `addr="${formattedAddress}" vs city="${destinationCity}" country="${destinationCountry}"`,
    };
  }

  if (!freshLh3) return { status: "SKIP-NO-PHOTO", detail: "" };

  // Persist to Supabase Storage
  const durableUrl = await toDurableImageUrl(freshLh3);

  if (!durableUrl || durableUrl.includes("lh3.googleusercontent.com")) {
    return { status: "FAIL-PERSIST", detail: "toDurableImageUrl returned lh3 or null" };
  }

  // Write durable URL back to DB
  await db.savedItem.update({
    where: { id },
    data: {
      placePhotoUrl: durableUrl,
      googlePlaceId: placeId,
    },
  });

  const host = new URL(durableUrl).host;
  return { status: "OK", detail: host };
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!GOOGLE_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY not set");
if (!SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

log(`[${new Date().toISOString()}] Starting backfill-all-lh3-photos`);

const rows = await db.savedItem.findMany({
  where: {
    placePhotoUrl: { contains: "lh3.googleusercontent.com" },
    deletedAt: null,
  },
  select: {
    id: true,
    rawTitle: true,
    destinationCity: true,
    destinationCountry: true,
    sourceMethod: true,
    googlePlaceId: true,
  },
  orderBy: { savedAt: "asc" },
});

const total = rows.length;
log(`Found ${total} lh3 rows to process\n`);

const stats = {
  OK: 0,
  "SKIP-ALREADY-MIGRATED": 0,
  "SKIP-NO-PLACE": 0,
  "SKIP-NO-PHOTO": 0,
  "SKIP-AMBIGUOUS": 0,
  "FAIL-PERSIST": 0,
  "FAIL-OTHER": 0,
};

const recentResults = [];
let haltTriggered = false;

for (let i = 0; i < total; i++) {
  if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

  const row = rows[i];
  const title = row.rawTitle ?? "(no title)";
  const rowNum = i + 1;
  let status, detail;

  try {
    ({ status, detail } = await processRow(db, row));
  } catch (err) {
    status = "FAIL-OTHER";
    detail = err.message ?? String(err);
  }

  stats[status]++;
  recentResults.push(status);

  const detailStr = detail ? ` | ${detail}` : "";
  log(`${row.id} | ${title} | ${status}${detailStr}`);

  if (rowNum % 10 === 0) {
    const totalSkip = stats["SKIP-ALREADY-MIGRATED"] + stats["SKIP-NO-PLACE"] +
                      stats["SKIP-NO-PHOTO"] + stats["SKIP-AMBIGUOUS"];
    const totalFail = stats["FAIL-PERSIST"] + stats["FAIL-OTHER"];
    log(`[progress] ${rowNum}/${total} | OK=${stats.OK} SKIP=${totalSkip} FAIL=${totalFail}`);
  }

  if (status.startsWith("FAIL") && checkHaltGate(recentResults)) {
    const window = recentResults.slice(-20);
    const fails = window.filter(r => r.startsWith("FAIL")).length;
    log(`\n[INNER HALT GATE] ${fails}/20 failures in rows ${rowNum - 19}–${rowNum}. Stopping.`);
    log(`Window: ${window.join(", ")}`);
    haltTriggered = true;
    break;
  }
}

await db.$disconnect();
await pool.end();
logStream.end();

// ── Summary ───────────────────────────────────────────────────────────────────
const totalSkip = stats["SKIP-ALREADY-MIGRATED"] + stats["SKIP-NO-PLACE"] +
                  stats["SKIP-NO-PHOTO"] + stats["SKIP-AMBIGUOUS"];
const totalFail = stats["FAIL-PERSIST"] + stats["FAIL-OTHER"];
const processed = Object.values(stats).reduce((a, b) => a + b, 0);

console.log("\n=== BACKFILL SUMMARY ===");
console.log(`Total input rows:        ${total}`);
console.log(`Processed:               ${processed}`);
console.log(`OK:                      ${stats.OK}`);
console.log(`SKIP-ALREADY-MIGRATED:   ${stats["SKIP-ALREADY-MIGRATED"]}`);
console.log(`SKIP-NO-PLACE:           ${stats["SKIP-NO-PLACE"]}`);
console.log(`SKIP-NO-PHOTO:           ${stats["SKIP-NO-PHOTO"]}`);
console.log(`SKIP-AMBIGUOUS:          ${stats["SKIP-AMBIGUOUS"]}`);
console.log(`FAIL-PERSIST:            ${stats["FAIL-PERSIST"]}`);
console.log(`FAIL-OTHER:              ${stats["FAIL-OTHER"]}`);
console.log(`Log:                     ${LOG_FILE}`);

if (haltTriggered) {
  console.log("\nSTATUS: HALTED by inner halt gate. Investigate FAIL cluster before resuming.");
  process.exit(1);
} else if (totalFail > 0) {
  console.log("\nSTATUS: Completed with failures. Review log before committing.");
} else {
  console.log("\nSTATUS: Clean run.");
}
