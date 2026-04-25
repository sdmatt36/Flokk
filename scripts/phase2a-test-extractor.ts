/**
 * phase2a-test-extractor.ts
 *
 * One-shot migration + verification script for Phase 2A.
 * Calls writeFlightFromEmail() directly with real trip IDs.
 * Tests the FlightBooking dedup logic, per-leg Flight creation,
 * and idempotency across 6 fixtures.
 *
 * THIS SCRIPT IS NOT IDEMPOTENT FOR FIXTURES F5/F6.
 * F5 (null-code) and F6 (new round-trip) will create new rows each run.
 * Run once. Do not add to CI.
 *
 * dotenv note: writeFlightFromEmail imports defaultDb at module load time.
 * We always pass `db` (created below after dotenv.config) as the dbOverride,
 * so defaultDb is never exercised in this script context.
 *
 * Usage:
 *   npx tsx scripts/phase2a-test-extractor.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { writeFlightFromEmail, WriteFlightInput } from "../src/lib/flights/extract-and-write";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Trip IDs ─────────────────────────────────────────────────────────────────
const TRIP_SRI_LANKA = "cmmx09fra000004if78drj98m";
const TRIP_SEOUL     = "cmmx6428k000004jlxgel7s86";

// ── Fixtures ─────────────────────────────────────────────────────────────────

// F1 — Sri Lanka 3-leg booking (FHMI74, was collapsed to HND→LHR in Phase 1)
const F1: WriteFlightInput = {
  tripId: TRIP_SRI_LANKA,
  confirmationCode: "FHMI74",
  airline: "SriLankan Airlines",
  cabinClass: "economy",
  status: "booked",
  sortOrder: 0,
  seatNumbers: null,
  notes: null,
  legs: [
    {
      airline: "SriLankan Airlines",
      flightNumber: "UL895",
      fromAirport: "HND",
      fromCity: "Tokyo",
      toAirport: "SIN",
      toCity: "Singapore",
      departureDate: "2026-06-28",
      departureTime: "00:05",
      arrivalDate: "2026-06-28",
      arrivalTime: "06:10",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
    {
      airline: "SriLankan Airlines",
      flightNumber: "UL301",
      fromAirport: "SIN",
      fromCity: "Singapore",
      toAirport: "CMB",
      toCity: "Colombo",
      departureDate: "2026-06-28",
      departureTime: "09:45",
      arrivalDate: "2026-06-28",
      arrivalTime: "11:05",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
    {
      airline: "SriLankan Airlines",
      flightNumber: "UL504",
      fromAirport: "CMB",
      fromCity: "Colombo",
      toAirport: "LHR",
      toCity: "London",
      departureDate: "2026-07-04",
      departureTime: "13:10",
      arrivalDate: "2026-07-04",
      arrivalTime: "20:00",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
  ],
};

// F2 — Same email re-forwarded (idempotency check — must produce identical end state)
const F2: WriteFlightInput = { ...F1 };

// F3 — Seoul IPSZOJ (PDX→SAN, Alaska Airlines — single existing leg)
const F3: WriteFlightInput = {
  tripId: TRIP_SEOUL,
  confirmationCode: "IPSZOJ",
  airline: "Alaska Airlines",
  cabinClass: "economy",
  status: "booked",
  sortOrder: 0,
  seatNumbers: null,
  notes: null,
  legs: [
    {
      airline: "Alaska Airlines",
      flightNumber: "1122",
      fromAirport: "PDX",
      fromCity: "Portland",
      toAirport: "SAN",
      toCity: "San Diego",
      departureDate: "2025-08-08",
      departureTime: "17:30",
      arrivalDate: "2025-08-08",
      arrivalTime: "20:03",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
  ],
};

// F4 — Seoul DOAL4Z (ANA NH867, empty airports — existing empty-airport row)
const F4: WriteFlightInput = {
  tripId: TRIP_SEOUL,
  confirmationCode: "DOAL4Z",
  airline: "ANA",
  cabinClass: "economy",
  status: "booked",
  sortOrder: 0,
  seatNumbers: null,
  notes: null,
  legs: [
    {
      airline: "ANA",
      flightNumber: "NH867",
      fromAirport: "",
      fromCity: "",
      toAirport: "",
      toCity: "",
      departureDate: "2026-03-29",
      departureTime: "",
      arrivalDate: null,
      arrivalTime: null,
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
  ],
};

// F5 — Null-confirmation-code (no code → new FlightBooking created, cannot dedup)
const F5: WriteFlightInput = {
  tripId: TRIP_SEOUL,
  confirmationCode: null,
  airline: "ANA",
  cabinClass: "economy",
  status: "booked",
  sortOrder: 0,
  seatNumbers: null,
  notes: null,
  legs: [
    {
      airline: "ANA",
      flightNumber: "NH085",
      fromAirport: "NRT",
      fromCity: "Tokyo",
      toAirport: "ICN",
      toCity: "Seoul",
      departureDate: "2026-03-29",
      departureTime: "09:00",
      arrivalDate: "2026-03-29",
      arrivalTime: "11:30",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
  ],
};

// F6 — Round-trip 2-leg under a single confirmation code (new booking)
const F6: WriteFlightInput = {
  tripId: TRIP_SEOUL,
  confirmationCode: "PHASE2A-TEST-RT",
  airline: "ANA",
  cabinClass: "economy",
  status: "booked",
  sortOrder: 0,
  seatNumbers: null,
  notes: null,
  legs: [
    {
      airline: "ANA",
      flightNumber: "NH081",
      fromAirport: "NRT",
      fromCity: "Tokyo",
      toAirport: "ICN",
      toCity: "Seoul",
      departureDate: "2026-03-29",
      departureTime: "09:00",
      arrivalDate: "2026-03-29",
      arrivalTime: "11:30",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
    {
      airline: "ANA",
      flightNumber: "NH082",
      fromAirport: "ICN",
      fromCity: "Seoul",
      toAirport: "NRT",
      toCity: "Tokyo",
      departureDate: "2026-04-03",
      departureTime: "13:00",
      arrivalDate: "2026-04-03",
      arrivalTime: "15:00",
      duration: null,
      dayIndex: null,
      type: "outbound",
      notes: null,
    },
  ],
};

// ── Snapshot helpers ──────────────────────────────────────────────────────────

async function getBookingSnapshot(tripId: string, confirmationCode: string | null) {
  if (confirmationCode) {
    const booking = await db.flightBooking.findUnique({
      where: { unique_trip_confirmation: { tripId, confirmationCode } },
      select: { id: true },
    });
    if (!booking) return { bookingId: null as string | null, legCount: 0 };
    const legCount = await db.flight.count({ where: { flightBookingId: booking.id } });
    return { bookingId: booking.id, legCount };
  } else {
    const count = await db.flightBooking.count({ where: { tripId, confirmationCode: null } });
    return { bookingId: null as string | null, legCount: count };
  }
}

async function getGlobalCounts() {
  const flightCount   = await db.flight.count();
  const bookingCount  = await db.flightBooking.count();
  const orphanFlights = await db.flight.count({ where: { flightBookingId: null } });
  return { flightCount, bookingCount, orphanFlights };
}

// ── Test runner ───────────────────────────────────────────────────────────────

type FixtureResult = { name: string; pass: boolean; notes: string[] };

async function runFixture(
  name: string,
  fixture: WriteFlightInput,
  expected: { dedupAction: "created" | "replaced"; expectedLegCount: number }
): Promise<FixtureResult> {
  const notes: string[] = [];
  let pass = true;

  const pre = await getBookingSnapshot(fixture.tripId, fixture.confirmationCode);
  notes.push(`Pre:  bookingId=${pre.bookingId ?? "null"}, legCount=${pre.legCount}`);

  let result: { flightBookingId: string; legCount: number; dedupAction: string };
  try {
    result = await writeFlightFromEmail(fixture, db);
  } catch (e) {
    notes.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    return { name, pass: false, notes };
  }

  notes.push(`Result: dedupAction=${result.dedupAction}, legCount=${result.legCount}, bookingId=${result.flightBookingId}`);

  if (result.dedupAction !== expected.dedupAction) {
    notes.push(`FAIL dedupAction: got "${result.dedupAction}", expected "${expected.dedupAction}"`);
    pass = false;
  }

  const dbLegCount = await db.flight.count({ where: { flightBookingId: result.flightBookingId } });
  if (dbLegCount !== expected.expectedLegCount) {
    notes.push(`FAIL leg count: DB has ${dbLegCount}, expected ${expected.expectedLegCount}`);
    pass = false;
  }

  if (expected.dedupAction === "replaced" && pre.bookingId && result.flightBookingId !== pre.bookingId) {
    notes.push(`FAIL booking id changed on replace: was ${pre.bookingId}, now ${result.flightBookingId}`);
    pass = false;
  }

  if (expected.dedupAction === "created" && pre.bookingId && result.flightBookingId === pre.bookingId) {
    notes.push("FAIL expected new bookingId on create but got same id");
    pass = false;
  }

  if (pass) notes.push("PASS");
  return { name, pass, notes };
}

async function main() {
  console.log("=== PHASE 2A: writeFlightFromEmail test extractor ===\n");

  const globalPre = await getGlobalCounts();
  console.log(`Global pre-state: flights=${globalPre.flightCount}, bookings=${globalPre.bookingCount}, orphans=${globalPre.orphanFlights}\n`);

  const results: FixtureResult[] = [];

  results.push(await runFixture("F1 Sri Lanka FHMI74 (collapse→3 legs)", F1, {
    dedupAction: "replaced", expectedLegCount: 3,
  }));

  results.push(await runFixture("F2 Sri Lanka FHMI74 re-forward (idempotency)", F2, {
    dedupAction: "replaced", expectedLegCount: 3,
  }));

  results.push(await runFixture("F3 Seoul IPSZOJ (1 leg replace)", F3, {
    dedupAction: "replaced", expectedLegCount: 1,
  }));

  results.push(await runFixture("F4 Seoul DOAL4Z (empty airports replace)", F4, {
    dedupAction: "replaced", expectedLegCount: 1,
  }));

  results.push(await runFixture("F5 Seoul null-code (new booking)", F5, {
    dedupAction: "created", expectedLegCount: 1,
  }));

  results.push(await runFixture("F6 Seoul PHASE2A-TEST-RT (round-trip 2 legs)", F6, {
    dedupAction: "created", expectedLegCount: 2,
  }));

  const globalPost = await getGlobalCounts();
  console.log("\n=== GLOBAL STATE CHANGE ===");
  console.log(`Flights:  ${globalPre.flightCount} → ${globalPost.flightCount}  (delta=${globalPost.flightCount - globalPre.flightCount}, expected +5)`);
  console.log(`Bookings: ${globalPre.bookingCount} → ${globalPost.bookingCount}  (delta=${globalPost.bookingCount - globalPre.bookingCount}, expected +2)`);
  console.log(`Orphans:  ${globalPost.orphanFlights}  (expected 0)`);

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;

  console.log("\n=== FIXTURE RESULTS ===\n");
  console.log("| Fixture                                          | Result |");
  console.log("|--------------------------------------------------|--------|");
  for (const r of results) {
    const status = r.pass ? "PASS  " : "FAIL  ";
    console.log(`| ${r.name.padEnd(48)} | ${status} |`);
    for (const note of r.notes) {
      console.log(`|   ${note}`);
    }
    console.log("|");
  }

  console.log(`\nPHASE 2A: ${passCount} PASS, ${failCount} FAIL`);

  if (globalPost.orphanFlights > 0) {
    console.log(`\nWARN: ${globalPost.orphanFlights} orphan Flight rows — investigate before Phase 3.`);
  }

  if (failCount > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
