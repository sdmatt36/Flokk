// Backfills GeneratedTour.cityId and GeneratedTour.destinationCountry for all 33 existing tours.
// Strategy (in order):
//   1. If destinationCity contains comma: split, take first part, slugify, look up City by slug.
//      If matched: set cityId + derive destinationCountry from city.country.name.
//   2. If no comma: slugify the full value, look up Country by slug.
//      If matched: set destinationCountry only, leave cityId null.
//   3. No match in either table: skip + log for hand review.
//
// Idempotent: skips tours where cityId IS already set.
// Skip + log is preferred over guessing on ambiguous values.
//
// Run: node scripts/backfill-tour-cityid.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const tours = await db.generatedTour.findMany({
  where: { cityId: null },
  select: { id: true, destinationCity: true, destinationCountry: true },
  orderBy: { destinationCity: "asc" },
});

const total = tours.length;
console.log(`Tours to process (cityId=null): ${total}`);

let linkedToCity = 0;
let linkedCountryOnly = 0;
let skipped = 0;
const skippedList = [];

for (const tour of tours) {
  const raw = tour.destinationCity;
  const hasComma = raw.includes(",");

  if (hasComma) {
    // Strategy 1: split on first comma, treat left part as city name
    const cityName = raw.split(",")[0].trim();
    const citySlug = slugify(cityName);

    const city = await db.city.findUnique({
      where: { slug: citySlug },
      select: { id: true, country: { select: { name: true } } },
    });

    if (city) {
      await db.generatedTour.update({
        where: { id: tour.id },
        data: { cityId: city.id, destinationCountry: city.country.name },
      });
      console.log(`  CITY  "${raw}" → slug "${citySlug}" → cityId set, country: ${city.country.name}`);
      linkedToCity++;
    } else {
      skipped++;
      skippedList.push({ id: tour.id, original: raw, reason: `comma-city slug "${citySlug}" not in City table` });
      console.log(`  SKIP  "${raw}" → slug "${citySlug}" — no City match`);
    }
  } else {
    // Strategy 2: no comma, try Country lookup by slug
    const countrySlug = slugify(raw);

    const country = await db.country.findUnique({
      where: { slug: countrySlug },
      select: { name: true },
    });

    if (country) {
      await db.generatedTour.update({
        where: { id: tour.id },
        data: { destinationCountry: country.name },
      });
      console.log(`  CTRY  "${raw}" → slug "${countrySlug}" → country only: ${country.name}`);
      linkedCountryOnly++;
    } else {
      skipped++;
      skippedList.push({ id: tour.id, original: raw, reason: `no-comma slug "${countrySlug}" not in Country table` });
      console.log(`  SKIP  "${raw}" → slug "${countrySlug}" — no Country match`);
    }
  }
}

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Processed: ${total} | Linked to city: ${linkedToCity} | Country-only: ${linkedCountryOnly} | Skipped: ${skipped}`);

if (skippedList.length > 0) {
  console.log(`\nSkipped (hand review needed):`);
  for (const s of skippedList) {
    console.log(`  id=${s.id} | "${s.original}" | ${s.reason}`);
  }
}
