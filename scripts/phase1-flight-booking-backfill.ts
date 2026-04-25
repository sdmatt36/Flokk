/**
 * phase1-flight-booking-backfill.ts
 *
 * Backfill script for Phase 1 of the Flight schema migration.
 * Creates FlightBooking rows from existing Flight rows, deduplicates
 * repeated imports, and links every surviving Flight to its booking.
 *
 * Usage:
 *   npx tsx scripts/phase1-flight-booking-backfill.ts --dry-run   (default, no writes)
 *   npx tsx scripts/phase1-flight-booking-backfill.ts --apply     (executes writes)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const isDryRun = !process.argv.includes("--apply");
const isApply = process.argv.includes("--apply");

if (isDryRun && !isApply) {
  console.log("=== DRY-RUN MODE — no writes will be performed ===\n");
} else {
  console.log("=== APPLY MODE — writes will be executed in a transaction ===\n");
}

// Guard: throw if a write is attempted in dry-run mode
function assertApply(op: string): void {
  if (isDryRun) {
    throw new Error(`DRY-RUN GUARD: attempted write operation "${op}" in dry-run mode`);
  }
}

type FlightRow = {
  id: string;
  tripId: string;
  confirmationCode: string | null;
  airline: string;
  cabinClass: string;
  seatNumbers: string | null;
  notes: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
};

async function main() {
  // ── PRE-FLIGHT ──────────────────────────────────────────────────────────────

  const totalFlights = await db.flight.count();
  console.log(`PRE-FLIGHT: total Flight rows = ${totalFlights}`);

  const nullCodeCount = await db.flight.count({
    where: { OR: [{ confirmationCode: null }, { confirmationCode: "" }] },
  });
  console.log(`PRE-FLIGHT: Flight rows with null/empty confirmationCode = ${nullCodeCount}`);

  // Find duplicate groups: (tripId, confirmationCode) with count > 1
  const dupGroups = await db.$queryRaw<
    { tripId: string; confirmationCode: string; cnt: bigint }[]
  >`
    SELECT "tripId", "confirmationCode", COUNT(*) AS cnt
    FROM "Flight"
    WHERE "confirmationCode" IS NOT NULL AND "confirmationCode" != ''
    GROUP BY "tripId", "confirmationCode"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `;

  if (dupGroups.length === 0) {
    console.log("PRE-FLIGHT: no duplicate groups found");
  } else {
    console.log(`PRE-FLIGHT: ${dupGroups.length} duplicate group(s):`);
    for (const g of dupGroups) {
      console.log(`  tripId=${g.tripId}  confirmationCode=${g.confirmationCode}  count=${g.cnt}`);
    }
  }

  console.log("");

  // ── COLLECT ALL FLIGHTS ──────────────────────────────────────────────────────

  const allFlights: FlightRow[] = await db.flight.findMany({
    select: {
      id: true,
      tripId: true,
      confirmationCode: true,
      airline: true,
      cabinClass: true,
      seatNumbers: true,
      notes: true,
      status: true,
      sortOrder: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  // ── GROUP BY (tripId, normalizedCode) ────────────────────────────────────────

  type GroupKey = string;
  const groups = new Map<GroupKey, FlightRow[]>();

  for (const f of allFlights) {
    const code = f.confirmationCode?.trim() || null;
    const key: GroupKey = code
      ? `${f.tripId}::${code}`
      : `${f.tripId}::NULL::${f.id}`; // each null-code flight is its own group
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  console.log(`GROUPING: ${groups.size} distinct booking group(s) across ${totalFlights} Flight row(s)\n`);

  // ── PLAN ─────────────────────────────────────────────────────────────────────

  type Plan = {
    key: GroupKey;
    keepFlight: FlightRow;
    deleteFlights: FlightRow[];
    isNullCode: boolean;
  };

  const plans: Plan[] = [];

  for (const [key, rows] of groups) {
    // Rows are already ordered desc by createdAt, id — first is most recent
    const [keep, ...deleteRows] = rows;
    const isNullCode = !keep.confirmationCode?.trim();
    plans.push({ key, keepFlight: keep, deleteFlights: deleteRows, isNullCode });
  }

  const totalBookingsToCreate = plans.length;
  const totalFlightsToDelete = plans.reduce((sum, p) => sum + p.deleteFlights.length, 0);
  const totalFlightsToUpdate = plans.length; // one flightBookingId update per kept row

  console.log("PLAN SUMMARY:");
  console.log(`  FlightBooking rows to create : ${totalBookingsToCreate}`);
  console.log(`  Flight rows to hard-delete   : ${totalFlightsToDelete}`);
  console.log(`  Flight rows to update        : ${totalFlightsToUpdate}`);
  console.log("");

  // ── PER-GROUP LOGGING ────────────────────────────────────────────────────────

  for (const plan of plans) {
    const code = plan.keepFlight.confirmationCode?.trim() || null;
    const label = plan.isNullCode
      ? `null code (tripId=${plan.keepFlight.tripId})`
      : `code=${code} tripId=${plan.keepFlight.tripId}`;

    if (plan.deleteFlights.length > 0) {
      console.log(
        `PASS 1 [DUP] ${label}\n` +
        `  WOULD create FlightBooking — source flight id=${plan.keepFlight.id}  createdAt=${plan.keepFlight.createdAt.toISOString()}\n` +
        `  WOULD delete ${plan.deleteFlights.length} older Flight(s): [${plan.deleteFlights.map((f) => f.id).join(", ")}]`
      );
    } else if (!plan.isNullCode) {
      console.log(
        `PASS 2 [SINGLE] ${label}\n` +
        `  WOULD create FlightBooking — source flight id=${plan.keepFlight.id}`
      );
    } else {
      console.log(
        `PASS 3 [NULL CODE] ${label}\n` +
        `  WOULD create FlightBooking (null confirmationCode) — source flight id=${plan.keepFlight.id}`
      );
    }
  }

  console.log("");

  // ── APPLY ────────────────────────────────────────────────────────────────────

  if (isDryRun) {
    console.log("=== DRY-RUN COMPLETE ===");
    console.log(`Would create ${totalBookingsToCreate} FlightBooking rows`);
    console.log(`Would delete ${totalFlightsToDelete} duplicate Flight rows`);
    console.log(`Would update ${totalFlightsToUpdate} Flight rows with flightBookingId`);
    console.log("\nReview output above and run with --apply to execute.");
    return;
  }

  // APPLY MODE — wrap everything in a transaction
  assertApply("transaction start");

  console.log("Executing transaction...");

  await db.$transaction(async (tx) => {
    for (const plan of plans) {
      assertApply("FlightBooking.create");

      const booking = await tx.flightBooking.create({
        data: {
          tripId: plan.keepFlight.tripId,
          confirmationCode: plan.keepFlight.confirmationCode?.trim() || null,
          airline: plan.keepFlight.airline || null,
          cabinClass: plan.keepFlight.cabinClass ?? "economy",
          seatNumbers: plan.keepFlight.seatNumbers ?? null,
          notes: plan.keepFlight.notes ?? null,
          status: plan.keepFlight.status ?? "saved",
          sortOrder: plan.keepFlight.sortOrder ?? 0,
        },
      });

      assertApply("Flight.update flightBookingId");
      await tx.flight.update({
        where: { id: plan.keepFlight.id },
        data: { flightBookingId: booking.id },
      });

      if (plan.deleteFlights.length > 0) {
        assertApply("Flight.deleteMany duplicates");
        await tx.flight.deleteMany({
          where: { id: { in: plan.deleteFlights.map((f) => f.id) } },
        });
        console.log(
          `  Created FlightBooking ${booking.id} (code=${booking.confirmationCode ?? "null"}) — deleted ${plan.deleteFlights.length} duplicate(s)`
        );
      } else {
        console.log(
          `  Created FlightBooking ${booking.id} (code=${booking.confirmationCode ?? "null"})`
        );
      }
    }
  });

  console.log("\nTransaction committed.");

  // ── POST-APPLY VERIFICATION ──────────────────────────────────────────────────

  const finalBookingCount = await db.flightBooking.count();
  const finalFlightCount = await db.flight.count();
  const orphanCount = await db.flight.count({ where: { flightBookingId: null } });

  console.log("\nPOST-APPLY VERIFICATION:");
  console.log(`  FlightBooking rows : ${finalBookingCount}  (expected ${totalBookingsToCreate})`);
  console.log(`  Flight rows        : ${finalFlightCount}  (expected ${totalFlights - totalFlightsToDelete})`);
  console.log(`  Orphan Flight rows : ${orphanCount}  (expected 0)`);

  const bookingOk = finalBookingCount === totalBookingsToCreate;
  const flightOk = finalFlightCount === totalFlights - totalFlightsToDelete;
  const orphanOk = orphanCount === 0;

  if (bookingOk && flightOk && orphanOk) {
    console.log("\n✓ PASS — all counts match expectations, zero orphans");
  } else {
    console.log("\n✗ FAIL — count mismatch:");
    if (!bookingOk) console.log(`  FlightBooking: got ${finalBookingCount}, expected ${totalBookingsToCreate}`);
    if (!flightOk) console.log(`  Flight: got ${finalFlightCount}, expected ${totalFlights - totalFlightsToDelete}`);
    if (!orphanOk) console.log(`  Orphans: got ${orphanCount}, expected 0`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("\nFATAL ERROR:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
