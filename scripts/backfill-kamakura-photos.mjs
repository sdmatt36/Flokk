// One-shot backfill: fetch venue photos + websites for the 3 Kamakura maps_import rows.
// Run: node scripts/backfill-kamakura-photos.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";

if (!API_KEY) {
  console.error("GOOGLE_MAPS_API_KEY not set in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function fetchPlaceDetailsById(placeId) {
  const detailsRes = await fetch(
    `${PLACES_DETAILS}?place_id=${placeId}&fields=website,photos&key=${API_KEY}`
  );
  if (!detailsRes.ok) return null;
  const data = await detailsRes.json();
  const websiteUrl = data.result?.website ?? null;
  const photoRef = data.result?.photos?.[0]?.photo_reference ?? null;
  let photoUrl = null;
  if (photoRef) {
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${API_KEY}`;
    const photoRes = await fetch(photoApiUrl, { redirect: "follow" });
    if (photoRes.ok && photoRes.url && photoRes.url !== photoApiUrl) {
      photoUrl = photoRes.url;
    }
  }
  return { photoUrl, websiteUrl };
}

async function findPlaceByNameCity(name, city) {
  const query = [name, city].filter(Boolean).join(" ");
  const searchRes = await fetch(
    `${PLACES_TEXT_SEARCH}?query=${encodeURIComponent(query)}&key=${API_KEY}`
  );
  const searchData = await searchRes.json();
  const placeId = searchData.results?.[0]?.place_id;
  if (!placeId) return null;
  const details = await fetchPlaceDetailsById(placeId);
  return { placeId, ...details };
}

const rows = await db.savedItem.findMany({
  where: {
    familyProfileId: "cmmmv15y7000104jvocfz5kt6",
    sourceMethod: "maps_import",
    deletedAt: null,
  },
  select: { id: true, rawTitle: true, destinationCity: true, websiteUrl: true, mapsUrl: true },
});

console.log(`Found ${rows.length} maps_import rows to backfill`);

for (const row of rows) {
  console.log(`\nProcessing: ${row.rawTitle} (${row.destinationCity})`);
  const result = await findPlaceByNameCity(row.rawTitle, row.destinationCity);
  if (!result) {
    console.log(`  SKIP — findPlaceByNameCity returned null`);
    continue;
  }
  // Move current websiteUrl (Maps deep link) to mapsUrl if mapsUrl not already set
  const mapsUrl = row.mapsUrl ?? row.websiteUrl ?? null;
  await db.savedItem.update({
    where: { id: row.id },
    data: {
      googlePlaceId: result.placeId,
      placePhotoUrl: result.photoUrl,
      websiteUrl: result.websiteUrl,
      mapsUrl,
    },
  });
  console.log(`  placeId:  ${result.placeId}`);
  console.log(`  photoUrl: ${result.photoUrl ?? "null"}`);
  console.log(`  website:  ${result.websiteUrl ?? "null"}`);
  console.log(`  mapsUrl:  ${mapsUrl ?? "null"}`);
}

await db.$disconnect();
console.log("\nBackfill complete.");
