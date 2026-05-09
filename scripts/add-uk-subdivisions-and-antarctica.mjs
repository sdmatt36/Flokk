// Adds Scotland, Wales, Northern Ireland (siblings of United Kingdom in Europe)
// and enriches the existing Antarctica country with code and blurb.
// Idempotent: upserts countries by slug, creates cities only if absent (update: {}).
//
// Phase 1 audit found:
//   - Antarctica continent and country already exist in DB
//   - Scotland, Wales, Northern Ireland do not exist
//   - Edinburgh already exists under United Kingdom — NOT moved per constraint
//     "DO NOT touch the United Kingdom row or its existing cities"
//   - Europe has 51 countries, Antarctica continent has 1 (Antarctica)
//
// Run: node scripts/add-uk-subdivisions-and-antarctica.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Resolve continents ──────────────────────────────────────────────────────

const europeCont = await db.continent.findUnique({ where: { slug: "europe" } });
if (!europeCont) throw new Error("Europe continent not found — cannot proceed");

const antarcticaCont = await db.continent.findUnique({ where: { slug: "antarctica" } });
if (!antarcticaCont) throw new Error("Antarctica continent not found — cannot proceed");

console.log(`Europe continent id:    ${europeCont.id}`);
console.log(`Antarctica continent id: ${antarcticaCont.id}`);

// ── Upsert countries ────────────────────────────────────────────────────────

const countryDefs = [
  {
    slug: "scotland",
    name: "Scotland",
    code: "SCT",
    continentId: europeCont.id,
    blurb: "Highlands, lochs, and ancient cities.",
  },
  {
    slug: "wales",
    name: "Wales",
    code: "WLS",
    continentId: europeCont.id,
    blurb: "Castles, coastline, and mountains.",
  },
  {
    slug: "northern-ireland",
    name: "Northern Ireland",
    code: "NIR",
    continentId: europeCont.id,
    blurb: "Coastal cliffs and the Belfast renaissance.",
  },
  {
    slug: "antarctica",
    name: "Antarctica",
    code: "AQ",
    continentId: antarcticaCont.id,
    blurb: "The bottom of the world.",
  },
];

const countryIds = {};
let countriesCreated = 0;
let countriesUpdated = 0;

for (const def of countryDefs) {
  const existing = await db.country.findUnique({ where: { slug: def.slug } });
  if (existing) {
    // Update blurb and code if null (enrichment only — not destructive)
    await db.country.update({
      where: { slug: def.slug },
      data: {
        code: existing.code ?? def.code,
        blurb: existing.blurb ?? def.blurb,
      },
    });
    countryIds[def.slug] = existing.id;
    countriesUpdated++;
    console.log(`  EXIST country  "${def.name}" (${def.slug}) — enriched code/blurb if null`);
  } else {
    const created = await db.country.create({
      data: {
        slug: def.slug,
        name: def.name,
        code: def.code,
        continentId: def.continentId,
        blurb: def.blurb,
      },
    });
    countryIds[def.slug] = created.id;
    countriesCreated++;
    console.log(`  NEW   country  "${def.name}" (${def.slug}) → id: ${created.id}`);
  }
}

// ── Upsert cities ───────────────────────────────────────────────────────────
// update: {} means: create if absent, leave untouched if present.
// Edinburgh already exists under United Kingdom — NOT moved.

const cityDefs = [
  // Scotland
  { slug: "edinburgh",  name: "Edinburgh",  country: "scotland" },
  { slug: "glasgow",    name: "Glasgow",    country: "scotland" },
  { slug: "inverness",  name: "Inverness",  country: "scotland" },
  { slug: "aberdeen",   name: "Aberdeen",   country: "scotland" },
  { slug: "st-andrews", name: "St Andrews", country: "scotland" },
  // Wales
  { slug: "cardiff",    name: "Cardiff",    country: "wales" },
  { slug: "swansea",    name: "Swansea",    country: "wales" },
  // Northern Ireland
  { slug: "belfast",    name: "Belfast",    country: "northern-ireland" },
];

let citiesCreated = 0;
let citiesSkipped = 0;

for (const def of cityDefs) {
  const countryId = countryIds[def.country];
  if (!countryId) {
    console.warn(`  WARN  no countryId for "${def.country}" — skipping ${def.slug}`);
    continue;
  }

  const result = await db.city.upsert({
    where: { slug: def.slug },
    create: {
      slug: def.slug,
      name: def.name,
      countryId,
    },
    update: {},  // leave existing rows untouched
  });

  const existing = await db.city.findUnique({
    where: { slug: def.slug },
    select: { countryId: true },
  });

  if (existing && existing.countryId !== countryId) {
    citiesSkipped++;
    console.log(`  SKIP  city "${def.name}" (${def.slug}) — already exists under different country (left untouched)`);
  } else {
    citiesCreated++;
    console.log(`  OK    city "${def.name}" (${def.slug})`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────

const europeCount = await db.country.count({ where: { continentId: europeCont.id } });
const antCount = await db.country.count({ where: { continentId: antarcticaCont.id } });
const scotlandCount = await db.city.count({ where: { countryId: countryIds["scotland"] } });

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Countries created: ${countriesCreated} | enriched/skipped: ${countriesUpdated}`);
console.log(`Cities created: ${citiesCreated} | skipped (already existed): ${citiesSkipped}`);
console.log(`Europe country count now: ${europeCount}`);
console.log(`Antarctica country count now: ${antCount}`);
console.log(`Scotland cities now: ${scotlandCount}`);
console.log(`\nNote: Edinburgh already existed under United Kingdom and was NOT moved to Scotland.`);
console.log(`      Strategic decision needed: keep Edinburgh under UK, or update countryId to Scotland.`);
