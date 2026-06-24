// Backfills GeneratedTour.cityId + GeneratedTour.destinationCountry for existing orphaned tours.
//
// Uses the SAME resolver as every write path — resolveCityAndCountry from src/lib/resolve-city.ts —
// so backfill and write-time never diverge. Match-only (never creates a City); idempotent (only
// scans rows where cityId IS null); logs unmatched rows for hand review.
//
// Run: npm run backfill:tour-cityid
//   (tsx --tsconfig tsconfig.scripts.json scripts/backfill-tour-cityid-v2.ts)

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// NOTE: @/lib/db reads process.env.DATABASE_URL at module-init time. ESM hoists static imports
// above the dotenv.config() call above, so we MUST import db (and the resolver, which imports db)
// dynamically inside main() — after env is loaded — or Prisma initializes with no DATABASE_URL and
// falls back to localhost (ECONNREFUSED). Mirrors scripts/test-account-deletion.ts.
async function main() {
  const { db } = await import("@/lib/db");
  const { resolveCityAndCountry } = await import("@/lib/resolve-city");

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
      await db.generatedTour.update({
        where: { id: tour.id },
        data: { cityId, destinationCountry },
      });
      console.log(`  CITY  "${tour.destinationCity}" → cityId ${cityId}, country: ${destinationCountry}`);
      linked++;
    } else if (destinationCountry && destinationCountry !== tour.destinationCountry) {
      // Resolver matched a country but no City — fill country only, leave cityId null.
      await db.generatedTour.update({
        where: { id: tour.id },
        data: { destinationCountry },
      });
      console.log(`  CTRY  "${tour.destinationCity}" → country only: ${destinationCountry}`);
      countryOnly++;
    } else {
      skipped++;
      skippedList.push({ id: tour.id, city: tour.destinationCity });
      console.log(`  SKIP  "${tour.destinationCity}" — no City match`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Processed: ${tours.length} | Linked to city: ${linked} | Country-only: ${countryOnly} | Skipped: ${skipped}`);

  if (skippedList.length > 0) {
    console.log(`\nSkipped (hand review needed):`);
    const unique = [...new Map(skippedList.map((s) => [s.city, s])).values()];
    for (const s of unique) console.log(`  id=${s.id} | "${s.city}"`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
