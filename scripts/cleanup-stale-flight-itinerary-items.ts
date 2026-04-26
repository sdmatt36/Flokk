/**
 * cleanup-stale-flight-itinerary-items.ts
 *
 * One-time cleanup for stale FLIGHT ItineraryItem rows created before the
 * deleteMany-before-write fix was added to email-inbound/route.ts.
 *
 * A stale row is a FLIGHT ItineraryItem whose (fromAirport, toAirport) pair does
 * not match any Flight row on the same FlightBooking + same departure date.
 * These accumulate when an airport code is corrected on re-forward (e.g. NRT→HND),
 * because the upsert key includes fromAirport/toAirport.
 *
 * Strategy:
 *   1. For each trip that has a FlightBooking, load the canonical Flight legs.
 *   2. Load all FLIGHT ItineraryItems that share the same confirmationCode.
 *   3. Any ItineraryItem whose (fromAirport, toAirport) does NOT match a canonical
 *      Flight leg is considered stale.
 *   4. Dry-run by default. Pass --execute to actually delete.
 *
 * Usage:
 *   npx tsx scripts/cleanup-stale-flight-itinerary-items.ts           # dry run
 *   npx tsx scripts/cleanup-stale-flight-itinerary-items.ts --execute # live delete
 *
 * Read-only unless --execute is passed.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const EXECUTE = process.argv.includes("--execute");

async function main() {
  console.log(`=== cleanup-stale-flight-itinerary-items (${EXECUTE ? "LIVE" : "DRY RUN"}) ===\n`);

  // Load all FlightBookings with their canonical Flight legs
  const bookings = await db.flightBooking.findMany({
    select: {
      id: true,
      tripId: true,
      confirmationCode: true,
      flights: {
        select: {
          fromAirport: true,
          toAirport: true,
          departureDate: true,
        },
      },
    },
  });

  console.log(`FlightBookings found: ${bookings.length}`);

  let totalStale = 0;
  const staleIds: string[] = [];

  for (const booking of bookings) {
    const { tripId, confirmationCode, flights } = booking;
    if (!confirmationCode) continue;

    // Build a set of canonical (fromAirport|toAirport|departureDate) keys
    const canonicalKeys = new Set(
      flights.map((f) => `${f.fromAirport}|${f.toAirport}|${f.departureDate ?? ""}`)
    );

    // Load all FLIGHT ItineraryItems for this trip + confirmation code
    const items = await db.itineraryItem.findMany({
      where: { tripId, confirmationCode, type: "FLIGHT" },
      select: {
        id: true,
        fromAirport: true,
        toAirport: true,
        scheduledDate: true,
        title: true,
      },
    });

    for (const item of items) {
      const key = `${item.fromAirport ?? ""}|${item.toAirport ?? ""}|${item.scheduledDate ?? ""}`;
      if (!canonicalKeys.has(key)) {
        console.log(
          `  STALE  tripId=${tripId}  conf=${confirmationCode}  id=${item.id}  "${item.title ?? ""}"  ` +
          `from=${item.fromAirport ?? "?"} to=${item.toAirport ?? "?"} date=${item.scheduledDate ?? "?"}`
        );
        staleIds.push(item.id);
        totalStale++;
      }
    }
  }

  console.log(`\nTotal stale rows: ${totalStale}`);

  if (totalStale === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!EXECUTE) {
    console.log("\nDry run — pass --execute to delete these rows.");
    return;
  }

  const result = await db.itineraryItem.deleteMany({
    where: { id: { in: staleIds } },
  });

  console.log(`\nDeleted ${result.count} stale FLIGHT ItineraryItem row(s).`);
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
