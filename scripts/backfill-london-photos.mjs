/**
 * Backfill expired lh3 placePhotoUrls for 8 London trip SavedItems.
 * For each: fetch fresh photo via Places API → persist to Supabase Storage → update DB.
 * Sequential — never parallel.
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
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

const PLACES_INFRA = new Set([
  "REQUEST_DENIED",
  "OVER_QUERY_LIMIT",
  "OVER_DAILY_LIMIT",
  "UNKNOWN_ERROR",
]);

const TARGET_IDS = [
  "cmnrdhg4a000104la25txezhc",  // Borough Market
  "cmnrdhftq000004la3hqbhjys",  // British Museum
  "cmnrc2bmg000404ibgkzz5l26",  // Harry Potter Studio Tour
  "cmnrc27em000304ibg37ni0jg",  // Hyde Park Kensington
  "cmnu8rb48000104jrprw9o3u8",  // Leonardo Royal Hotel London City
  "cmnrc273y000204iblw54flxp",  // Natural History Museum
  "cmnrc249p000104ib0y1jyo19",  // Tower Bridge Walk
  "cmnrc23z0000004ibgf7gq9eu",  // Tower of London
];

// ── Supabase Storage helpers ──────────────────────────────────────────────────

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
  const objectKey = buildObjectKey(remoteUrl);
  const publicUrl = flokImgPublicUrl(objectKey);

  const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
  if (headRes.ok) return publicUrl;

  const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(10000) });
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);

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
    throw new Error(`Storage upload failed ${upRes.status}: ${body}`);
  }

  return publicUrl;
}

// ── Google Places helpers ─────────────────────────────────────────────────────

async function resolveGooglePhotoUrl(photoApiUrl) {
  const res = await fetch(photoApiUrl, { redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!res.ok || !res.url || res.url === photoApiUrl) return null;
  return res.url;
}

async function findPlaceId(title, city, country) {
  const query = `${title}, ${city}, ${country || "UK"}`;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json();
  if (PLACES_INFRA.has(data.status)) throw new Error(`Places API infra failure: ${data.status}`);
  return data.results?.[0]?.place_id ?? null;
}

async function getPhotoForPlaceId(placeId) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${GOOGLE_API_KEY}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json();
  if (PLACES_INFRA.has(data.status)) throw new Error(`Places API infra failure: ${data.status}`);
  const photoRef = data.result?.photos?.[0]?.photo_reference;
  if (!photoRef) return null;
  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${GOOGLE_API_KEY}`;
  return resolveGooglePhotoUrl(photoApiUrl);
}

// ── Pre-flight checks ─────────────────────────────────────────────────────────

if (!GOOGLE_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY not set");
if (!SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

console.log(`Backfilling ${TARGET_IDS.length} London SavedItems...\n`);

// ── Main loop ─────────────────────────────────────────────────────────────────

const results = [];

for (const id of TARGET_IDS) {
  const item = await db.savedItem.findUnique({
    where: { id },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      googlePlaceId: true,
    },
  });

  if (!item) {
    console.log(`${id} | - | SKIP-NOT-FOUND`);
    results.push({ id, status: "SKIP-NOT-FOUND" });
    continue;
  }

  const { rawTitle, destinationCity, destinationCountry, googlePlaceId } = item;
  let placeId = googlePlaceId;

  // Step 1: resolve placeId if missing
  if (!placeId) {
    try {
      placeId = await findPlaceId(rawTitle, destinationCity ?? "London", destinationCountry);
    } catch (err) {
      console.log(`${id} | ${rawTitle} | FAIL-PLACE-LOOKUP | ${err.message}`);
      results.push({ id, title: rawTitle, status: "FAIL-PLACE-LOOKUP", error: err.message });
      continue;
    }
    if (!placeId) {
      console.log(`${id} | ${rawTitle} | SKIP-NO-PLACE`);
      results.push({ id, title: rawTitle, status: "SKIP-NO-PLACE" });
      continue;
    }
  }

  // Step 2: get fresh lh3 URL via Places Photo API
  let freshLh3Url;
  try {
    freshLh3Url = await getPhotoForPlaceId(placeId);
  } catch (err) {
    console.log(`${id} | ${rawTitle} | FAIL-PHOTO-FETCH | ${err.message}`);
    results.push({ id, title: rawTitle, status: "FAIL-PHOTO-FETCH", error: err.message });
    continue;
  }
  if (!freshLh3Url) {
    console.log(`${id} | ${rawTitle} | SKIP-NO-PHOTO`);
    results.push({ id, title: rawTitle, status: "SKIP-NO-PHOTO" });
    continue;
  }

  // Step 3: persist to Supabase Storage
  let supabaseUrl;
  try {
    supabaseUrl = await persistRemoteImage(freshLh3Url);
  } catch (err) {
    console.log(`${id} | ${rawTitle} | FAIL-PERSIST | ${err.message}`);
    results.push({ id, title: rawTitle, status: "FAIL-PERSIST", error: err.message });
    continue;
  }
  if (!supabaseUrl) {
    console.log(`${id} | ${rawTitle} | FAIL-PERSIST | returned null`);
    results.push({ id, title: rawTitle, status: "FAIL-PERSIST" });
    continue;
  }

  // Step 4: write durable URL + resolved placeId back to DB
  await db.savedItem.update({
    where: { id },
    data: {
      placePhotoUrl: supabaseUrl,
      googlePlaceId: placeId,
    },
  });

  const host = new URL(supabaseUrl).host;
  console.log(`${id} | ${rawTitle} | OK | ${host}`);
  results.push({ id, title: rawTitle, status: "OK", supabaseUrl });
}

await db.$disconnect();
await pool.end();

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n=== BACKFILL SUMMARY ===");
const ok = results.filter(r => r.status === "OK");
const skip = results.filter(r => r.status.startsWith("SKIP"));
const fail = results.filter(r => r.status.startsWith("FAIL"));
console.log(`OK:   ${ok.length} / ${TARGET_IDS.length}`);
console.log(`SKIP: ${skip.length}`);
console.log(`FAIL: ${fail.length}`);

if (fail.length > 0) {
  console.log("\nFailed rows (do not commit until resolved):");
  for (const r of fail) {
    console.log(`  ${r.id} | ${r.title} | ${r.error ?? ""}`);
  }
  process.exit(1);
}

if (ok.length < TARGET_IDS.length) {
  console.log("\nNote: some rows skipped — verify manually before committing.");
}
