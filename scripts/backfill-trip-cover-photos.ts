/**
 * backfill-trip-cover-photos.ts
 *
 * One-time backfill: for all Trip rows with null heroImageUrl, attempt to
 * resolve a cover photo via:
 *   1. DESTINATION_IMAGES manual map (in case entries were added since trip creation)
 *   2. Google Places textSearchPhoto (city + country query)
 *
 * Admin-set URLs (crop=entropy pattern) are untouched — WHERE clause targets null only.
 *
 * Usage:
 *   npx tsx scripts/backfill-trip-cover-photos.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { getTripCoverImage, DEFAULT_COVER } from "../src/lib/destination-images";
import { textSearchPhoto } from "../src/lib/google-places";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("=== Backfill trip cover photos ===\n");

  const trips = await db.trip.findMany({
    where: { heroImageUrl: null },
    select: { id: true, title: true, destinationCity: true, destinationCountry: true },
  });

  console.log(`Found ${trips.length} trips with null heroImageUrl.\n`);

  let mapHit = 0, placesHit = 0, miss = 0;

  for (const trip of trips) {
    const city = trip.destinationCity ?? "";
    const country = trip.destinationCountry ?? "";

    const mapResolved = getTripCoverImage(city, country);

    let resolvedUrl: string | null = null;
    let source = "miss";

    if (mapResolved !== DEFAULT_COVER) {
      resolvedUrl = mapResolved;
      source = "map";
      mapHit++;
    } else {
      const query = city && country ? `${city} ${country}` : (city || country);
      if (query) {
        try {
          const photo = await textSearchPhoto(query);
          if (photo) {
            resolvedUrl = photo;
            source = "places";
            placesHit++;
          } else {
            miss++;
          }
        } catch (err) {
          console.error(`  [error] ${trip.title}: ${err instanceof Error ? err.message : err}`);
          miss++;
        }
      } else {
        miss++;
      }
    }

    if (resolvedUrl) {
      await db.trip.update({
        where: { id: trip.id },
        data: { heroImageUrl: resolvedUrl },
      });
      console.log(`  [${source}] ${trip.title} (${city || "?"}, ${country || "?"})`);
    } else {
      console.log(`  [skip] ${trip.title} (${city || "?"}, ${country || "?"}) — no resolution`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone. map=${mapHit}, places=${placesHit}, miss=${miss}.`);
}

main()
  .catch(e => { console.error("\nFATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
