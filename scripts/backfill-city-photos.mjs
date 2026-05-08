// Backfills City.photoUrl for all rows where photoUrl is null.
// Uses textSearchPhoto from src/lib/google-places.ts (same primitive
// that resolves community spot photos). Idempotent: skips cities with
// non-null photoUrl, safe to re-run as new cities are seeded.
// Rate limited to ~10 calls/sec to stay under Places quotas.
// Cost: ~$0.039 per city. Full backfill of ~1,201 nulls is ~$47.
//
// Run:
//   LIMIT=10 node scripts/backfill-city-photos.mjs   # smoke test
//   node scripts/backfill-city-photos.mjs            # full run

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const COST_PER_CITY = 0.039;
const DELAY_MS = 100; // ~10 calls/sec
// Exponential backoff delays for transient error retries (3 attempts after first)
const RETRY_DELAYS_MS = [200, 800, 3200];

if (!GOOGLE_MAPS_API_KEY) {
  console.error("ERROR: GOOGLE_MAPS_API_KEY is not set.");
  process.exit(1);
}

// Throws on network errors so the retry wrapper can catch and retry them.
// Returns null on a genuine API null (no photo_reference in Places).
async function textSearchPhoto(query) {
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
  );
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference;
  if (!photoRef) return null;

  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
  const photoRes = await fetch(photoApiUrl, { redirect: "follow" });
  if (!photoRes.ok || !photoRes.url || photoRes.url === photoApiUrl) return null;
  return photoRes.url;
}

// Wraps textSearchPhoto with exponential-backoff retry.
// Returns { url, error }:
//   url non-null  → city photo resolved, write to DB
//   url null + error null  → genuine API null, city has no photo in Places
//   url null + error non-null  → all retries exhausted, city NOT written
async function textSearchPhotoWithRetry(query) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const url = await textSearchPhoto(query);
      return { url, error: null };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  return { url: null, error: lastErr };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

const cities = await db.city.findMany({
  where: { photoUrl: null },
  select: {
    id: true,
    slug: true,
    name: true,
    country: { select: { name: true } },
  },
  orderBy: { name: "asc" },
  ...(limit ? { take: limit } : {}),
});

const total = cities.length;
console.log(`Cities to process: ${total}${limit ? ` (LIMIT=${limit})` : ""}`);

let succeeded = 0;
let nulls = 0;
let errors = 0;
let callCount = 0;

for (let i = 0; i < cities.length; i++) {
  const city = cities[i];
  const query = `${city.name}, ${city.country.name}`;

  try {
    callCount++;
    const { url: photoUrl, error: fetchErr } = await textSearchPhotoWithRetry(query);

    if (fetchErr) {
      errors++;
      console.error(`  ERR [${i + 1}/${total}] ${city.name}: ${fetchErr.message}`);
    } else if (photoUrl) {
      await db.city.update({ where: { id: city.id }, data: { photoUrl } });
      succeeded++;
      console.log(`  OK  [${i + 1}/${total}] ${city.name} → ${photoUrl.slice(0, 80)}...`);
    } else {
      nulls++;
    }
  } catch (err) {
    // DB write error — city photo was found but update failed
    errors++;
    console.error(`  ERR [${i + 1}/${total}] ${city.name}: ${err.message}`);
  }

  if ((i + 1) % 50 === 0) {
    console.log(`\n[${i + 1}/${total}] processed — ${succeeded} succeeded, ${nulls} null, ${errors} errors\n`);
  }

  if (i < cities.length - 1) await sleep(DELAY_MS);
}

await db.$disconnect();
await pool.end();

const cost = (callCount * COST_PER_CITY).toFixed(2);
console.log(`\n=== Done ===`);
console.log(`Processed: ${total} | Succeeded: ${succeeded} | Null: ${nulls} | Errors: ${errors}`);
console.log(`API calls: ${callCount} | Estimated cost: $${cost}`);
console.log(`Cities skipped due to errors: ${errors}`);
