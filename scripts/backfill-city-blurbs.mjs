// scripts/backfill-city-blurbs.mjs
//
// Regenerates City.blurb for all rows where blurb is null.
// Uses Claude Haiku with hard-banned terms and structural pattern restrictions.
// Idempotent: skips cities that already have a blurb.
// Concurrency: 5 parallel Haiku calls + 5s inter-batch sleep (stays under 50 RPM).
//
// Run modes:
//   DEMO=1 node scripts/backfill-city-blurbs.mjs   # 10 named cities only, prints violations
//   node scripts/backfill-city-blurbs.mjs           # full corpus (all null blurbs)
//   LIMIT=10 node scripts/backfill-city-blurbs.mjs  # first N alphabetically (testing)

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MODEL = "claude-haiku-4-5-20251001";
const CONCURRENCY = 5;
const STAGGER_MS = 100;
const BATCH_SLEEP_MS = 5000; // 5s between batches → ~40 RPM under the 50 RPM limit

const DEMO_MODE = process.env.DEMO === "1";
const DEMO_CITIES = ["Tokyo", "Kyoto", "Seoul", "Paris", "Bangkok", "Chiang Mai", "London", "Lisbon", "Marrakesh", "Dubai"];

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripQuotes(text) {
  return text.trim().replace(/^["']|["']$/g, "").trim();
}

// Returns array of violation strings, or [] if clean.
function checkViolations(blurb) {
  const v = [];
  if (/\bdiscover\b/i.test(blurb))         v.push("discover");
  if (/\bvibrant\b/i.test(blurb))           v.push("vibrant");
  if (/\bnestled\b/i.test(blurb))           v.push("nestled");
  if (/\bmagical\b/i.test(blurb))           v.push("magical");
  if (/\bstunning\b/i.test(blurb))          v.push("stunning");
  if (/world[- ]class/i.test(blurb))        v.push("world-class");
  if (/\bamazing\b/i.test(blurb))           v.push("amazing");
  if (/—/.test(blurb))                       v.push("em-dash");
  if (/!/.test(blurb))                       v.push("exclamation");
  if (/\bwhere\b.{1,30}\bmeets?\b/i.test(blurb)) v.push("where X meets Y");
  if (/\bfrom\b.{1,30}\bto\b/i.test(blurb))      v.push("from X to Y");
  if (/^where\b/i.test(blurb))              v.push("starts with Where");
  return v;
}

async function generateBlurb(cityName, countryName) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `Write a 1-2 sentence editorial blurb for ${cityName}, ${countryName} for families planning a trip. Maximum 25 words. Hard cap. If you can't fit the idea in 25 words, simplify the idea.

WHAT TO DO:
- Lead with a concrete sensory detail, a specific place, or a specific food/landmark
- Name something a family could actually see or do (a real museum, market, beach, dish, neighborhood)
- Active voice. Sound like a knowledgeable friend, not a brochure.

BANNED WORDS (never use any of these): discover, vibrant, nestled, magical, stunning, world-class, amazing.

BANNED STRUCTURES:
- Do not start any sentence with "Where"
- Do not use "where X meets Y" phrasing
- Do not use "from X to Y" phrasing
- No exclamation points. No em-dashes. No quote marks around your output.
- Do not use the city name at the start.

GOOD VOICE TARGETS (the register to match — concrete verbs, real places, no clichés):

Chiang Mai, Thailand: Ancient temples and misty mountains frame this northern gem, where families bond over elephant sanctuaries, night markets, and cooking classes that transform eager kids into confident chefs.

Galle, Sri Lanka: Wander through centuries-old ramparts, splash in golden-sand beaches, and feast on fresh seafood at this coastal fortress town where history and family fun blend perfectly.

BAD EXAMPLES (never write like this):
- Where ancient temples meet neon-lit streets, families discover...
- Discover vibrant markets and world-class shopping...
- Nestled along the river, this magical destination offers...

Reply with ONLY the blurb text. No preamble, no quotes, no explanation.`,
      },
    ],
  });

  const raw = msg.content?.[0]?.type === "text" ? msg.content[0].text : "";
  return stripQuotes(raw);
}

// --- DEMO MODE ---
if (DEMO_MODE) {
  console.log("=== DEMO MODE: 10 cities only ===");
  console.log("Model:", MODEL);
  console.log();

  const cities = await db.city.findMany({
    where: { name: { in: DEMO_CITIES } },
    select: { id: true, name: true, country: { select: { name: true } } },
  });

  // Sort to canonical DEMO_CITIES order
  const cityMap = Object.fromEntries(cities.map((c) => [c.name, c]));

  let clean = 0;
  let violated = 0;

  for (const name of DEMO_CITIES) {
    const city = cityMap[name];
    if (!city) {
      console.log(`${name}: [NOT FOUND IN DB]`);
      console.log();
      continue;
    }

    const blurb = await generateBlurb(city.name, city.country.name);
    if (!blurb) {
      console.log(`${city.name}, ${city.country.name}`);
      console.log("[EMPTY RESPONSE — API error]");
      console.log("Violations: N/A");
      console.log();
      continue;
    }

    // Write to DB (so demo cities get blurbs before full run)
    await db.city.update({ where: { id: city.id }, data: { blurb } });

    const violations = checkViolations(blurb);
    if (violations.length === 0) clean++; else violated++;

    console.log(`${city.name}, ${city.country.name}`);
    console.log(blurb);
    console.log(`Violations: ${violations.length === 0 ? "CLEAN" : violations.join(", ")}`);
    console.log();
  }

  console.log(`--- Demo summary: ${clean} CLEAN / ${violated} violated / ${DEMO_CITIES.length} total ---`);
  console.log();
  console.log("HALT — do not proceed to full corpus regen until Matt types 'approved' or 'go'.");

  await db.$disconnect();
  await pool.end();
  process.exit(0);
}

// --- FULL RUN MODE ---
const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

const cities = await db.city.findMany({
  where: { blurb: null },
  select: {
    id: true,
    name: true,
    country: { select: { name: true } },
  },
  orderBy: { name: "asc" },
  ...(limit ? { take: limit } : {}),
});

const total = cities.length;
console.log(`Cities to blurb: ${total}${limit ? ` (LIMIT=${limit})` : ""}`);
console.log(`Model: ${MODEL} | Concurrency: ${CONCURRENCY} | Batch sleep: ${BATCH_SLEEP_MS}ms`);
console.log();

let succeeded = 0;
let errors = 0;

for (let batchStart = 0; batchStart < cities.length; batchStart += CONCURRENCY) {
  const batch = cities.slice(batchStart, batchStart + CONCURRENCY);

  await Promise.all(
    batch.map(async (city, slotIndex) => {
      await sleep(slotIndex * STAGGER_MS);
      const i = batchStart + slotIndex;
      try {
        const blurb = await generateBlurb(city.name, city.country.name);
        if (!blurb) {
          errors++;
          console.error(`  ERR [${i + 1}/${total}] ${city.name} — empty response`);
          return;
        }
        await db.city.update({ where: { id: city.id }, data: { blurb } });
        succeeded++;
        console.log(`  OK  [${i + 1}/${total}] ${city.name}, ${city.country.name}`);
        console.log(`       "${blurb}"`);
      } catch (err) {
        errors++;
        console.error(`  ERR [${i + 1}/${total}] ${city.name}: ${err.message}`);
      }
    })
  );

  if ((batchStart / CONCURRENCY + 1) % 10 === 0) {
    console.log(`\n[Progress] ${Math.min(batchStart + CONCURRENCY, total)}/${total} processed — ${succeeded} ok, ${errors} errors\n`);
  }

  if (batchStart + CONCURRENCY < cities.length) await sleep(BATCH_SLEEP_MS);
}

await db.$disconnect();
await pool.end();

console.log();
console.log(`=== Done ===`);
console.log(`Processed: ${total} | Succeeded: ${succeeded} | Errors: ${errors}`);
