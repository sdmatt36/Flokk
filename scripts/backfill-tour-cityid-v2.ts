// Backfills GeneratedTour.cityId + GeneratedTour.destinationCountry for existing orphaned tours.
//
// Uses the SAME resolver as every write path — resolveCityAndCountry from src/lib/resolve-city.ts —
// so backfill and write-time never diverge. Match-only (never creates a City/Country).
//
// DRY-RUN BY DEFAULT. Pass --live to actually write.
//   npm run backfill:tour-cityid            (dry-run: logs what WOULD change, writes nothing)
//   npm run backfill:tour-cityid -- --live  (writes)
//
// Idempotent: scans only rows where cityId IS null; the country-only fill skips rows that
// already have destinationCountry set. Logs matched/unmatched.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const LIVE = process.argv.includes("--live");

// NOTE: @/lib/db reads process.env.DATABASE_URL at module-init time. ESM hoists static imports
// above the dotenv.config() call above, so we MUST import db (and the resolver, which imports db)
// dynamically inside main() — after env is loaded — or Prisma initializes with no DATABASE_URL and
// falls back to localhost (ECONNREFUSED). Mirrors scripts/test-account-deletion.ts.
async function main() {
  const { db } = await import("@/lib/db");
  const { resolveCityAndCountry } = await import("@/lib/resolve-city");

  console.log(LIVE ? "MODE: --live (writing)\n" : "MODE: dry-run (no writes — pass --live to apply)\n");

  const tours = await db.generatedTour.findMany({
    where: { cityId: null },
    select: { id: true, destinationCity: true, destinationCountry: true },
    orderBy: { destinationCity: "asc" },
  });

  console.log(`Tours to process (cityId=null): ${tours.length}`);

  let linked = 0;
  let countryOnly = 0;
  let skipped = 0;
  const skippedList: Array<{ id: string; city: string }> = [];

  for (const tour of tours) {
    const { cityId, destinationCountry } = await resolveCityAndCountry(tour.destinationCity);

    if (cityId) {
      if (LIVE) {
        await db.generatedTour.update({
          where: { id: tour.id },
          data: { cityId, destinationCountry },
        });
      }
      console.log(`  CITY  "${tour.destinationCity}" → cityId ${cityId}, country: ${destinationCountry}${LIVE ? "" : " [dry-run]"}`);
      linked++;
    } else if (destinationCountry && !tour.destinationCountry) {
      // Resolver matched a country but no City — fill country only, leave cityId null.
      // Idempotent: skip rows that already have a destinationCountry set.
      if (LIVE) {
        await db.generatedTour.update({
          where: { id: tour.id },
          data: { destinationCountry },
        });
      }
      console.log(`  CTRY  "${tour.destinationCity}" → country only: ${destinationCountry}${LIVE ? "" : " [dry-run]"}`);
      countryOnly++;
    } else if (destinationCountry && tour.destinationCountry) {
      // Already has a country; nothing to do (idempotent skip).
      skipped++;
      skippedList.push({ id: tour.id, city: tour.destinationCity });
    } else {
      skipped++;
      skippedList.push({ id: tour.id, city: tour.destinationCity });
      console.log(`  SKIP  "${tour.destinationCity}" — no City or Country match`);
    }
  }

  console.log(`\n=== Done (${LIVE ? "live" : "dry-run"}) ===`);
  console.log(`Processed: ${tours.length} | Linked to city: ${linked} | Country-only: ${countryOnly} | Skipped: ${skipped}`);

  if (skippedList.length > 0) {
    console.log(`\nUnmatched / already-set (no change):`);
    const unique = [...new Map(skippedList.map((s) => [s.city, s])).values()];
    for (const s of unique) console.log(`  id=${s.id} | "${s.city}"`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
