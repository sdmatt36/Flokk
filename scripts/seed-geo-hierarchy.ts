import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { COUNTRY_TO_CONTINENT } from "../src/lib/continents";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CityEntry {
  slug: string;
  name: string;
  countrySlug: string;
  tier: number;
  latitude?: number;
  longitude?: number;
  tags: string[];
}

const CONTINENTS = [
  {
    slug: "africa",
    name: "Africa",
    blurb:
      "Vast and varied, from Saharan dunes and Moroccan medinas to Cape Town vineyards and Serengeti plains. Built for slow, deliberate family travel.",
  },
  {
    slug: "antarctica",
    name: "Antarctica",
    blurb:
      "The seventh continent. Reachable only by expedition cruise, and unforgettable for the families that go.",
  },
  {
    slug: "asia",
    name: "Asia",
    blurb:
      "Ancient temples, megacities, and some of the most beloved family travel destinations on Earth, from Tokyo's neon to Bali's beaches to Bangkok's street food.",
  },
  {
    slug: "europe",
    name: "Europe",
    blurb:
      "Old-world capitals, alpine retreats, and Mediterranean coastlines. Europe packs centuries of culture into walkable cities and slow train journeys.",
  },
  {
    slug: "north-america",
    name: "North America",
    blurb:
      "From Banff's lakes to Tulum's cenotes to NYC's bagels. North America rewards road trips and city stays in equal measure.",
  },
  {
    slug: "oceania",
    name: "Oceania",
    blurb:
      "Beaches, reefs, and outback. Australia, New Zealand, and the Pacific islands offer some of the most family-friendly adventure travel anywhere.",
  },
  {
    slug: "south-america",
    name: "South America",
    blurb:
      "Patagonia's peaks, the Amazon, Andean villages, and Rio's beaches. South America is for families ready to travel slower and deeper.",
  },
];

async function main() {
  // ── 1. Upsert continents ───────────────────────────────────────────────────
  const continentIdMap = new Map<string, string>();
  for (const c of CONTINENTS) {
    const row = await db.continent.upsert({
      where: { slug: c.slug },
      update: { name: c.name, blurb: c.blurb },
      create: { slug: c.slug, name: c.name, blurb: c.blurb },
      select: { id: true },
    });
    continentIdMap.set(c.slug, row.id);
  }
  console.log(`Continents upserted: ${continentIdMap.size}`);

  // ── 2. Upsert countries ────────────────────────────────────────────────────
  const countryIdMap = new Map<string, string>();
  let countryCount = 0;
  let countrySkipped = 0;

  for (const [name, continent] of Object.entries(COUNTRY_TO_CONTINENT)) {
    const countrySlug = slugify(name);
    const continentSlug = slugify(continent);
    const continentId = continentIdMap.get(continentSlug);
    if (!continentId) {
      console.warn(`SKIP country "${name}": no continentId for slug "${continentSlug}"`);
      countrySkipped++;
      continue;
    }
    const row = await db.country.upsert({
      where: { slug: countrySlug },
      update: { name, continentId },
      create: { slug: countrySlug, name, continentId, code: null, blurb: null, photoUrl: null },
      select: { id: true },
    });
    countryIdMap.set(countrySlug, row.id);
    countryCount++;
  }
  console.log(`Countries upserted: ${countryCount}${countrySkipped ? `, skipped: ${countrySkipped}` : ""}`);

  // ── 3. Upsert cities ───────────────────────────────────────────────────────
  const seedPath = path.join(__dirname, "data", "cities-seed.json");
  const cities: CityEntry[] = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  let cityCount = 0;
  let citySkipped = 0;
  const skippedSlugs: string[] = [];

  for (const city of cities) {
    const countryId = countryIdMap.get(city.countrySlug);
    if (!countryId) {
      console.warn(`SKIP city "${city.slug}": no countryId for countrySlug "${city.countrySlug}"`);
      skippedSlugs.push(city.slug);
      citySkipped++;
      continue;
    }
    await db.city.upsert({
      where: { slug: city.slug },
      update: {
        name: city.name,
        countryId,
        latitude: city.latitude ?? null,
        longitude: city.longitude ?? null,
        tags: city.tags,
      },
      create: {
        slug: city.slug,
        name: city.name,
        countryId,
        latitude: city.latitude ?? null,
        longitude: city.longitude ?? null,
        tags: city.tags,
      },
    });
    cityCount++;
  }

  console.log(`Cities upserted: ${cityCount}${citySkipped ? `, skipped: ${citySkipped}` : ""}`);
  if (skippedSlugs.length > 0) {
    console.log(`Skipped city slugs (first 20): ${skippedSlugs.slice(0, 20).join(", ")}`);
  }

  console.log("\nSeed complete.");
  console.log(`  Continents: ${continentIdMap.size}`);
  console.log(`  Countries:  ${countryCount}`);
  console.log(`  Cities:     ${cityCount}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
