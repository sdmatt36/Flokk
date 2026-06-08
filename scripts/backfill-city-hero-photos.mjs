// Backfills City.heroPhotoUrl and City.heroPhotoAttribution from Unsplash.
// Mirrors backfill-country-photos.mjs exactly; only the query construction,
// DB fields written, and attribution format differ.
//
// Query: "<city name>, <country name>" — country disambiguates cities that
// share a name (e.g. Antigua, Guatemala vs Antigua, Antigua and Barbuda).
//
// heroPhotoAttribution is stored as JSON matching the shape CityHero.tsx
// parseAttribution() expects:
//   { photographerName, photographerUrl, photoUrl, source: "unsplash" }
// where photographerUrl includes Unsplash utm params and photoUrl is the
// Unsplash photo-page URL (result.links.html), not the image URL.
//
// heroPhotoUrl stores result.urls.regular — same URL shape as London/Paris/
// Barcelona/Rome (crop=entropy&cs=tinysrgb&fit=max&fm=jpg...).
//
// Guard: only writes rows where heroPhotoUrl IS NULL.
//        Never overwrites a non-null heroPhotoUrl.
//        Never creates City rows.
//
// Rate limit: Unsplash free tier = 50 req/hour.
//   Sample (<= 20 cities): DELAY_MS default = 5 000ms  (safe well under 50/h)
//   Full run (1,839 cities): set DELAY_MS=75000          (75s → ~48/h)
//
// Run modes:
//   # Sample — exact city|country pairs, "|" separator (comma separates pairs)
//   node scripts/backfill-city-hero-photos.mjs \
//     --pairs "New York City|United States,Paris|France"
//
//   # Full run — all cities with null heroPhotoUrl, ordered featured-first
//   DELAY_MS=75000 node scripts/backfill-city-hero-photos.mjs
//
//   # First N only
//   LIMIT=10 DELAY_MS=75000 node scripts/backfill-city-hero-photos.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? "";
const DELAY_MS = process.env.DELAY_MS ? parseInt(process.env.DELAY_MS, 10) : 5_000;

if (!UNSPLASH_KEY) {
  console.error("ERROR: NEXT_PUBLIC_UNSPLASH_ACCESS_KEY is not set in .env.local");
  process.exit(1);
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const pairsArgRaw =
  args.find((a) => a.startsWith("--pairs="))?.slice(8) ??
  (args.indexOf("--pairs") !== -1 ? args[args.indexOf("--pairs") + 1] : null);
const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

// ── DB setup ──────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Resolve target city rows ──────────────────────────────────────────────────

let targets; // Array of { id, name, countryName }

if (pairsArgRaw) {
  // --pairs mode: exact "CityName|CountryName" tuples; comma-separated
  const pairs = pairsArgRaw.split(",").map((s) => {
    const idx = s.indexOf("|");
    return { cityName: s.slice(0, idx).trim(), countryName: s.slice(idx + 1).trim() };
  });

  targets = [];
  for (const { cityName, countryName } of pairs) {
    const city = await db.city.findFirst({
      where: { name: cityName, country: { name: countryName } },
      select: { id: true, name: true, heroPhotoUrl: true, country: { select: { name: true } } },
    });
    if (!city) {
      console.warn(`  SKIP (not in DB): "${cityName}" / "${countryName}"`);
      continue;
    }
    if (city.heroPhotoUrl !== null) {
      console.log(`  SKIP (heroPhotoUrl set): ${city.name} (${city.country.name})`);
      continue;
    }
    targets.push({ id: city.id, name: city.name, countryName: city.country.name });
  }
} else {
  // Full / LIMIT mode: all cities with null heroPhotoUrl, featured-first
  const rows = await db.city.findMany({
    where: { heroPhotoUrl: null },
    select: { id: true, name: true, country: { select: { name: true } } },
    orderBy: [{ featured: "desc" }, { priorityRank: "asc" }, { name: "asc" }],
    ...(limit ? { take: limit } : {}),
  });
  targets = rows.map((r) => ({ id: r.id, name: r.name, countryName: r.country.name }));
}

const total = targets.length;
if (total === 0) {
  console.log("No cities to process.");
  await db.$disconnect();
  await pool.end();
  process.exit(0);
}

console.log(`Cities to process: ${total}${pairsArgRaw ? " (--pairs)" : ""}${limit ? ` (LIMIT=${limit})` : ""}`);
console.log(`Delay between calls: ${DELAY_MS}ms\n`);

// ── Unsplash fetch ────────────────────────────────────────────────────────────
// Mirrors backfill-country-photos.mjs fetchUnsplashPhoto() exactly.
// Note: Unsplash download-trigger endpoint is not called here (consistent with
// the country backfill script, which also omits it).

async function fetchUnsplashPhoto(query) {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    // heroPhotoUrl: stable images.unsplash.com URL (urls.regular gives
    // crop=entropy&cs=tinysrgb&fit=max&fm=jpg param shape matching existing heroes)
    heroPhotoUrl: result.urls.regular,
    // heroPhotoAttribution: JSON parsed by CityHero.tsx parseAttribution()
    heroPhotoAttribution: JSON.stringify({
      photographerName: result.user.name,
      photographerUrl: `${result.user.links.html}?utm_source=flokk&utm_medium=referral`,
      photoUrl: result.links.html, // Unsplash photo page, not the image URL
      source: "unsplash",
    }),
    photographerName: result.user.name,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let succeeded = 0;
let nulls = 0;
let errors = 0;

for (let i = 0; i < targets.length; i++) {
  const { id, name, countryName } = targets[i];
  const query = `${name}, ${countryName}`;

  try {
    const photo = await fetchUnsplashPhoto(query);
    if (photo) {
      await db.city.update({
        where: { id },
        data: {
          heroPhotoUrl: photo.heroPhotoUrl,
          heroPhotoAttribution: photo.heroPhotoAttribution,
        },
      });
      succeeded++;
      console.log(`  OK  [${i + 1}/${total}] ${name} (${countryName})`);
      console.log(`       query:  "${query}"`);
      console.log(`       url:    ${photo.heroPhotoUrl.slice(0, 90)}...`);
      console.log(`       credit: ${photo.photographerName}`);
    } else {
      nulls++;
      console.log(`  NULL [${i + 1}/${total}] ${name} (${countryName}) — no Unsplash result for "${query}"`);
    }
  } catch (err) {
    errors++;
    console.error(`  ERR  [${i + 1}/${total}] ${name} (${countryName}): ${err.message}`);
  }

  if ((i + 1) % 10 === 0) {
    console.log(`\n[${i + 1}/${total}] checkpoint — ${succeeded} OK, ${nulls} null, ${errors} errors\n`);
  }

  if (i < targets.length - 1) await sleep(DELAY_MS);
}

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Processed: ${total} | Succeeded: ${succeeded} | Null: ${nulls} | Errors: ${errors}`);
