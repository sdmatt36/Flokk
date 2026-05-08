// Generates one silhouette SVG per country into public/svg/countries/.
// Black fill, transparent background, single path, viewBox 0 0 800 600.
// Used as CSS mask sources by CountryCard component.
// To re-run: npm install --no-save world-atlas d3-geo topojson-client @prisma/adapter-pg pg && node scripts/gen-country-svgs.mjs
import fs from "node:fs";
import path from "node:path";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const require = createRequire(import.meta.url);
const topology = require("world-atlas/countries-110m.json");
const allGeoms = topology.objects.countries.geometries;

const VIEW_W = 800, VIEW_H = 600, PAD = 20;

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Build atlas lookup: atlasSlug → geometry
const atlasLookup = new Map();
for (const g of allGeoms) {
  const name = g.properties?.name;
  if (name) {
    atlasLookup.set(slugify(name), g);
  }
}

// Known name divergences between world-atlas and DB slugs.
// Key: DB slug  Value: slugify(atlas name)
const OVERRIDES = new Map([
  ["united-states",                    "united-states-of-america"],
  ["democratic-republic-of-the-congo", "dem-rep-congo"],
  ["republic-of-the-congo",            "congo"],
  ["dominican-republic",               "dominican-rep"],
  ["bosnia-and-herzegovina",           "bosnia-and-herz"],
  ["central-african-republic",         "central-african-rep"],
  ["equatorial-guinea",                "eq-guinea"],
  ["south-sudan",                      "s-sudan"],
  ["western-sahara",                   "w-sahara"],
  ["north-macedonia",                  "macedonia"],
  ["czech-republic",                   "czechia"],
  ["falkland-islands",                 "falkland-is"],
  ["solomon-islands",                  "solomon-is"],
]);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const outDir = path.resolve("public/svg/countries");
fs.mkdirSync(outDir, { recursive: true });

const countries = await db.country.findMany({
  select: { slug: true, name: true },
  orderBy: { name: "asc" },
});

let matched = 0;
const unmatched = [];

for (const country of countries) {
  const atlasSlug = OVERRIDES.get(country.slug) ?? country.slug;
  const geom = atlasLookup.get(atlasSlug);

  if (!geom) {
    unmatched.push(`${country.name} (${country.slug})`);
    continue;
  }

  const f = feature(topology, geom);
  const projection = geoMercator();
  projection.fitExtent([[PAD, PAD], [VIEW_W - PAD, VIEW_H - PAD]], f);
  const d = geoPath(projection)(f);

  if (!d) {
    process.stderr.write(`WARN no path for ${country.name}\n`);
    unmatched.push(`${country.name} (${country.slug}) — empty path`);
    continue;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}">\n  <path d="${d}" fill="#000000"/>\n</svg>`;
  fs.writeFileSync(path.join(outDir, `${country.slug}.svg`), svg);
  matched++;
  process.stdout.write(`OK  ${country.name}\n`);
}

await db.$disconnect();
await pool.end();

console.log(`\nMatched: ${matched}/${countries.length}`);
if (unmatched.length > 0) {
  process.stderr.write(`\nUnmatched (${unmatched.length}):\n`);
  for (const u of unmatched) {
    process.stderr.write(`  - ${u}\n`);
  }
}
