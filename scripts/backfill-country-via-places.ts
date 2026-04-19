// Chat 27 Prompt 7 — Backfill SavedItem.destinationCountry and CommunitySpot.country
// via Google Places text search + address_components.
//
// Rules:
//   - Only processes rows where country IS NULL AND city IS NOT NULL.
//   - Skips junk place names.
//   - 300ms delay between Places API calls (standard rate-limit pattern).
//   - Idempotent — safe to re-run. Already-populated rows are skipped.
//   - Dry-run outputs counts and sample rows only. No API calls made in dry-run.
//
// Usage:
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfill-country-via-places.ts
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfill-country-via-places.ts --live

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveCountry, isJunkPlaceName, normalizePlaceName } from "../src/lib/google-places";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const LIVE = process.argv.includes("--live");
const DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`[country-backfill] Mode: ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log(`[country-backfill] Started: ${new Date().toISOString()}\n`);

  // ── SavedItem rows needing country ─────────────────────────────────────────

  const savedItems = await db.savedItem.findMany({
    where: {
      destinationCountry: null,
      destinationCity: { not: null },
      rawTitle: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
    },
  });

  // Filter out junk names
  const eligibleSavedItems = savedItems.filter((s) =>
    !isJunkPlaceName(normalizePlaceName(s.rawTitle!))
  );
  const junkSavedItems = savedItems.length - eligibleSavedItems.length;

  console.log(`[country-backfill] SavedItem rows with null country + non-null city: ${savedItems.length}`);
  console.log(`[country-backfill]   Junk names skipped:      ${junkSavedItems}`);
  console.log(`[country-backfill]   Eligible for API lookup: ${eligibleSavedItems.length}`);
  if (eligibleSavedItems.length > 0) {
    console.log(`[country-backfill]   Sample (first 5):`);
    eligibleSavedItems.slice(0, 5).forEach((s) =>
      console.log(`    "${s.rawTitle}" / ${s.destinationCity}`)
    );
  }

  // ── CommunitySpot rows needing country ─────────────────────────────────────

  const spots = await db.communitySpot.findMany({
    where: {
      country: null,
    },
    select: {
      id: true,
      name: true,
      city: true,
    },
  });

  const eligibleSpots = spots.filter((s) =>
    !isJunkPlaceName(normalizePlaceName(s.name))
  );
  const junkSpots = spots.length - eligibleSpots.length;

  console.log(`\n[country-backfill] CommunitySpot rows with null country + non-null city: ${spots.length}`);
  console.log(`[country-backfill]   Junk names skipped:      ${junkSpots}`);
  console.log(`[country-backfill]   Eligible for API lookup: ${eligibleSpots.length}`);
  if (eligibleSpots.length > 0) {
    console.log(`[country-backfill]   Sample (first 5):`);
    eligibleSpots.slice(0, 5).forEach((s) =>
      console.log(`    "${s.name}" / ${s.city}`)
    );
  }

  const totalApiCalls = eligibleSavedItems.length + eligibleSpots.length;
  const estimatedMinutes = Math.ceil((totalApiCalls * DELAY_MS) / 60000);

  console.log(`\n[country-backfill] ── SUMMARY ──────────────────────────────────`);
  console.log(`[country-backfill] Total Places API calls if run live: ${totalApiCalls}`);
  console.log(`[country-backfill] Estimated runtime at 300ms spacing: ~${estimatedMinutes} min`);
  console.log(`[country-backfill] ─────────────────────────────────────────────`);

  if (!LIVE) {
    console.log(`\n[country-backfill] DRY RUN complete. Re-run with --live to apply.`);
    await db.$disconnect();
    await pool.end();
    return;
  }

  // ── LIVE: process SavedItems ───────────────────────────────────────────────

  console.log(`\n[country-backfill] Processing SavedItems...`);
  let siResolved = 0;
  let siMissed = 0;
  let siErrors = 0;

  for (let i = 0; i < eligibleSavedItems.length; i++) {
    const item = eligibleSavedItems[i];
    try {
      const country = await resolveCountry(item.rawTitle!, item.destinationCity!);
      if (country) {
        await db.savedItem.update({
          where: { id: item.id },
          data: { destinationCountry: country },
        });
        siResolved += 1;
        if (i < 10 || i % 50 === 0) {
          console.log(`  [SI] "${item.rawTitle}" / ${item.destinationCity} → ${country}`);
        }
      } else {
        siMissed += 1;
      }
    } catch (e) {
      siErrors += 1;
      console.error(`  [SI] ERROR on ${item.id} (${item.rawTitle}):`, e);
    }
    if (i % 10 === 9) {
      console.log(`  [SI] Progress: ${i + 1}/${eligibleSavedItems.length} (resolved=${siResolved} missed=${siMissed})`);
    }
    await sleep(DELAY_MS);
  }

  // ── LIVE: process CommunitySpots ──────────────────────────────────────────

  console.log(`\n[country-backfill] Processing CommunitySpots...`);
  let csResolved = 0;
  let csMissed = 0;
  let csErrors = 0;

  for (let i = 0; i < eligibleSpots.length; i++) {
    const spot = eligibleSpots[i];
    try {
      const country = await resolveCountry(spot.name, spot.city);
      if (country) {
        await db.communitySpot.update({
          where: { id: spot.id },
          data: { country },
        });
        csResolved += 1;
        if (i < 10 || i % 50 === 0) {
          console.log(`  [CS] "${spot.name}" / ${spot.city} → ${country}`);
        }
      } else {
        csMissed += 1;
      }
    } catch (e) {
      csErrors += 1;
      console.error(`  [CS] ERROR on ${spot.id} (${spot.name}):`, e);
    }
    if (i % 10 === 9) {
      console.log(`  [CS] Progress: ${i + 1}/${eligibleSpots.length} (resolved=${csResolved} missed=${csMissed})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[country-backfill] ── FINAL RESULTS ────────────────────────────`);
  console.log(`[country-backfill] SavedItem:      resolved=${siResolved} missed=${siMissed} errors=${siErrors}`);
  console.log(`[country-backfill] CommunitySpot:  resolved=${csResolved} missed=${csMissed} errors=${csErrors}`);
  console.log(`[country-backfill] Finished: ${new Date().toISOString()}`);

  await db.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("[country-backfill] FATAL:", e);
  await db.$disconnect();
  await pool.end();
  process.exit(1);
});
