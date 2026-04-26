/**
 * audit-legacy-flight-bookings.ts
 *
 * READ-ONLY audit script. DO NOT auto-repair.
 *
 * Purpose: Find FlightBookings where the number of Flight rows is less than
 * the number of old-era TripDocument rows sharing the same confirmationCode
 * on the same trip. These represent legacy migrations that didn't backfill
 * all legs into the Flight table.
 *
 * Architecture context:
 * - Old extractor (pre-Phase-2A): created one TripDocument per flight leg.
 * - Phase-2A extractor: creates one FlightBooking + one Flight row per leg.
 * - When Phase-2A re-extracts an old booking, it may only write the leg(s)
 *   present in the email, leaving outbound/return legs as orphaned TripDocuments.
 *
 * Output: table of FlightBookings with missing Flight rows, sorted by gap DESC.
 * Repair is per-user, per-trip, after manual review.
 *
 * REPAIR NOTE (learned from Okinawa trip fix, 2026-04-26):
 * When inserting a missing Flight row, also insert a corresponding ItineraryItem
 * of type FLIGHT. Critically, set dayIndex correctly — do NOT leave it null.
 * Compute dayIndex from scheduledDate relative to trip startDate:
 *   dayIndex = Math.round((new Date(scheduledDate) - new Date(tripStartDate)) / 86400000)
 * The day view filter (TripTabContent.tsx buildUnifiedDayItems) uses strict equality
 * `it.dayIndex === targetDayIndex`, so null rows are silently excluded from every day.
 *
 * Run: npx tsx scripts/audit-legacy-flight-bookings.ts
 */

import { db } from "../src/lib/db";

async function main() {
  console.log("Auditing legacy flight bookings for missing Flight rows...\n");

  const allBookings = await db.flightBooking.findMany({
    include: {
      flights: {
        select: {
          id: true,
          flightNumber: true,
          fromAirport: true,
          toAirport: true,
          departureDate: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const results: {
    bookingId: string;
    confirmationCode: string | null;
    tripId: string;
    flightCount: number;
    tripDocCount: number;
    missing: number;
    tripDocs: { id: string; label: string; fromAirport: string | null; toAirport: string | null; departureDate: string | null }[];
  }[] = [];

  for (const booking of allBookings) {
    if (!booking.confirmationCode) continue;

    // Find TripDocument rows on the same trip with the same confirmationCode
    const tripDocs = await db.tripDocument.findMany({
      where: { tripId: booking.tripId },
      select: { id: true, label: true, content: true },
    });

    // Filter to docs whose content.confirmationCode matches this booking
    const matchingDocs = tripDocs.filter((doc) => {
      try {
        const c = JSON.parse(doc.content ?? "{}") as Record<string, unknown>;
        return (
          (c.type as string | undefined)?.toLowerCase() === "flight" &&
          c.confirmationCode === booking.confirmationCode
        );
      } catch {
        return false;
      }
    });

    const flightCount = booking.flights.length;
    const tripDocCount = matchingDocs.length;
    const missing = tripDocCount - flightCount;

    if (missing > 0) {
      results.push({
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        tripId: booking.tripId,
        flightCount,
        tripDocCount,
        missing,
        tripDocs: matchingDocs.map((doc) => {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(doc.content ?? "{}") as Record<string, unknown>; } catch { /* ignore */ }
          return {
            id: doc.id,
            label: doc.label,
            fromAirport: (parsed.fromAirport as string | null) ?? null,
            toAirport: (parsed.toAirport as string | null) ?? null,
            departureDate: (parsed.departureDate as string | null) ?? null,
          };
        }),
      });
    }
  }

  results.sort((a, b) => b.missing - a.missing);

  if (results.length === 0) {
    console.log("No FlightBookings with missing Flight rows found.\n");
  } else {
    console.log(`Found ${results.length} FlightBooking(s) with missing Flight rows:\n`);
    for (const r of results) {
      console.log(`  bookingId:       ${r.bookingId}`);
      console.log(`  confirmationCode: ${r.confirmationCode}`);
      console.log(`  tripId:           ${r.tripId}`);
      console.log(`  flightCount:      ${r.flightCount}  (Flight rows)`);
      console.log(`  tripDocCount:     ${r.tripDocCount}  (TripDocument rows)`);
      console.log(`  missing:          ${r.missing}`);
      console.log(`  tripDocs:`);
      for (const td of r.tripDocs) {
        console.log(`    - ${td.id}  "${td.label}"  ${td.fromAirport ?? "?"}→${td.toAirport ?? "?"}  ${td.departureDate ?? "?"}`);
      }
      console.log();
    }
  }

  console.log("READ-ONLY audit complete. No data was modified.");
  console.log("Repair manually via targeted SQL per user/trip after review.");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
