// scripts/heal-broken-community-spots.mjs
//
// Backfills googlePlaceId + photoUrl on CommunitySpot rows that have a broken
// or missing photo. Targets two cases:
//   1. photoUrl IS NULL — spot was created with no photo at write-through time
//   2. photoUrl is an lh3.googleusercontent.com URL with googlePlaceId IS NULL —
//      photo URL has rotated/403'd and there's no placeId to refresh it
//
// Uses Google Places text search (name + city, fallback to name + country).
// Updates both googlePlaceId and photoUrl when a match is found.
// Idempotent: re-running only touches target rows again.
//
// Run:
//   node scripts/heal-broken-community-spots.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const DELAY_MS = 200;

if (!API_KEY) {
  console.error("ERROR: GOOGLE_MAPS_API_KEY is not set.");
  process.exit(1);
}

// Inline Places lookup — mirrors findPlaceByNameCity in src/lib/google-places.ts.
// Returns { placeId, photoUrl } or null.
async function findPlaceByNameCity(name, cityOrCountry) {
  if (!name?.trim()) return null;
  try {
    const query = [name.trim(), cityOrCountry?.trim()].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos&key=${API_KEY}`
    );
    if (!detailsRes.ok) return null;
    const detailsData = await detailsRes.json();
    const photoRef = detailsData.result?.photos?.[0]?.photo_reference ?? null;

    let photoUrl = null;
    if (photoRef) {
      const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${API_KEY}`;
      const photoRes = await fetch(photoApiUrl, { redirect: "follow" });
      if (photoRes.ok && photoRes.url && photoRes.url !== photoApiUrl) {
        photoUrl = photoRes.url;
      }
    }

    return { placeId, photoUrl };
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const spots = await db.$queryRaw`
  SELECT id, name, city, country FROM "CommunitySpot"
  WHERE "photoUrl" IS NULL
     OR ("photoUrl" LIKE '%lh3.googleusercontent.com%' AND "googlePlaceId" IS NULL)
  ORDER BY "createdAt" ASC
`;

const total = spots.length;
console.log(`Spots to heal: ${total}`);

let enriched = 0;
let noMatch = [];

for (let i = 0; i < spots.length; i++) {
  const spot = spots[i];
  const primary = spot.city?.trim() || spot.country?.trim() || "";
  const query = `${spot.name} ${primary}`.trim();

  let result = await findPlaceByNameCity(spot.name, spot.city?.trim() || null);

  // Fallback: if city empty or no result, try with country
  if (!result && spot.country?.trim() && spot.country !== spot.city) {
    result = await findPlaceByNameCity(spot.name, spot.country.trim());
  }

  if (result) {
    let photoStatus = "";
    try {
      // Try to update both placeId and photoUrl
      await db.communitySpot.update({
        where: { id: spot.id },
        data: {
          googlePlaceId: result.placeId,
          photoUrl: result.photoUrl,
          updatedAt: new Date(),
        },
      });
      photoStatus = result.photoUrl ? "photo+placeId" : "placeId only";
    } catch (e) {
      if (e?.code === "P2002") {
        // placeId already used by another spot — update photoUrl only
        if (result.photoUrl) {
          await db.communitySpot.update({
            where: { id: spot.id },
            data: { photoUrl: result.photoUrl, updatedAt: new Date() },
          });
          photoStatus = "photo only (placeId collision)";
        } else {
          noMatch.push(`${spot.name} (${spot.city || spot.country || "?"}) [placeId collision, no photo]`);
          console.log(`  SKIP [${i + 1}/${total}] ${spot.name} — placeId collision, no photo fallback`);
          if (i < spots.length - 1) await sleep(DELAY_MS);
          continue;
        }
      } else {
        throw e;
      }
    }
    enriched++;
    console.log(`  OK  [${i + 1}/${total}] ${spot.name} (${spot.city}) → ${photoStatus}`);
  } else {
    noMatch.push(`${spot.name} (${spot.city || spot.country || "?"})`);
    console.log(`  MISS [${i + 1}/${total}] ${spot.name} (${spot.city}) — query: "${query}"`);
  }

  if (i < spots.length - 1) await sleep(DELAY_MS);
}

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Processed: ${total} | Enriched: ${enriched} | No match: ${noMatch.length}`);
if (noMatch.length > 0) {
  console.log(`\nNo-match (manual review needed):`);
  for (const n of noMatch) console.log(`  - ${n}`);
}
