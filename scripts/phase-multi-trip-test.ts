/**
 * phase-multi-trip-test.ts
 *
 * Verifies that findAllRelatedTrips correctly identifies all trips a multi-leg
 * flight booking relates to, by leg date range.
 *
 * Fixture: FHMI74 — 3-leg booking spanning Sri Lanka + London
 *   Leg 1: HND → SIN  departure 2026-06-28T00:05  arrival 2026-06-28T06:00
 *   Leg 2: SIN → CMB  departure 2026-06-28T09:30  arrival 2026-06-28T11:00
 *   Leg 3: CMB → LHR  departure 2026-07-04T13:10  arrival 2026-07-04T20:00
 *
 * Expected:
 *   Sri Lanka (cmmx09fra, Jun 28–Jul 4): Legs 1+2+3 all within range → MATCH
 *   London    (cmnhgoflq, Jul 4–Jul 7):  Leg 3 dep Jul 4 within range  → MATCH
 *   Seoul     (cmmx6428k, Mar 29–Apr 6): No legs match                 → NO MATCH
 *
 * Read-only — makes no DB writes.
 *
 * Usage:
 *   npx tsx scripts/phase-multi-trip-test.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { findAllRelatedTrips, type TripRecord } from "../src/lib/flights/find-related-trips";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Constants ─────────────────────────────────────────────────────────────────
const PROFILE_ID    = "cmmmv15y7000104jvocfz5kt6";
const TRIP_SRI_LANKA = "cmmx09fra000004if78drj98m";
const TRIP_LONDON    = "cmnhgoflq000004l4403jm4mx";
const TRIP_SEOUL     = "cmmx6428k000004jlxgel7s86";

// ── FHMI74 synthetic extracted object (3 legs, raw Claude format) ─────────────
const FHMI74_EXTRACTED: Record<string, unknown> = {
  type: "flight",
  confirmationCode: "FHMI74",
  airline: "SriLankan Airlines",
  flightNumber: "UL895",
  fromAirport: "HND",
  fromCity: "Tokyo",
  toAirport: "LHR",
  toCity: "London",
  departureDate: "2026-06-28",
  departureTime: "00:05",
  arrivalDate: "2026-07-04",
  arrivalTime: "20:00",
  confidence: 0.95,
  legs: [
    {
      from: "HND",
      to: "SIN",
      fromCity: "Tokyo",
      toCity: "Singapore",
      departure: "2026-06-28T00:05",
      arrival: "2026-06-28T06:00",
      flightNumber: "UL895",
      airline: "SriLankan Airlines",
    },
    {
      from: "SIN",
      to: "CMB",
      fromCity: "Singapore",
      toCity: "Colombo",
      departure: "2026-06-28T09:30",
      arrival: "2026-06-28T11:00",
      flightNumber: "UL307",
      airline: "SriLankan Airlines",
    },
    {
      from: "CMB",
      to: "LHR",
      fromCity: "Colombo",
      toCity: "London",
      departure: "2026-07-04T13:10",
      arrival: "2026-07-04T20:00",
      flightNumber: "UL503",
      airline: "SriLankan Airlines",
    },
  ],
};

// ── Check helpers ─────────────────────────────────────────────────────────────
type CheckResult = { name: string; pass: boolean; notes: string[] };

function check(name: string, condition: boolean, notes: string[]): CheckResult {
  if (!condition) notes.push(`FAIL: ${name}`);
  return { name, pass: condition, notes };
}

// ── Main test ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== PHASE MULTI-TRIP: findAllRelatedTrips verification ===\n");

  // Fetch all trips for this profile (same query as email-inbound route)
  const trips = await db.trip.findMany({
    where: { familyProfileId: PROFILE_ID },
    select: { id: true, title: true, startDate: true, endDate: true, destinationCity: true, destinationCountry: true },
  });

  console.log(`Trips fetched: ${trips.length}`);
  for (const t of trips) {
    const start = t.startDate ? t.startDate.toISOString().slice(0, 10) : "null";
    const end   = t.endDate   ? t.endDate.toISOString().slice(0, 10)   : "null";
    console.log(`  "${t.title}" id=${t.id} range=${start}–${end}`);
  }
  console.log();

  // Call findAllRelatedTrips with Sri Lanka as primary (it's the P1/P2 match for HND→CMB)
  const related = findAllRelatedTrips(
    FHMI74_EXTRACTED,
    trips as unknown as TripRecord[],
    TRIP_SRI_LANKA,
  );

  console.log(`Related trips returned: ${related.length}`);
  for (const r of related) {
    console.log(`  "${r.trip.title ?? r.trip.id}" confidence=${r.confidence} matchType=${r.matchType}`);
  }
  console.log();

  const results: CheckResult[] = [];

  // MT-1: At least 2 trips in result
  const notes1: string[] = [];
  notes1.push(`Total related trips: ${related.length}`);
  results.push(check("MT-1: at least 2 trips in result", related.length >= 2, notes1));

  // MT-2: Sri Lanka in result with confidence >= 0.85
  const sriLanka = related.find((r) => r.trip.id === TRIP_SRI_LANKA);
  const notes2: string[] = [];
  notes2.push(`Sri Lanka: ${sriLanka ? `found, confidence=${sriLanka.confidence}, matchType=${sriLanka.matchType}` : "NOT FOUND"}`);
  results.push(check("MT-2: Sri Lanka in result (confidence >= 0.85)", !!sriLanka && sriLanka.confidence >= 0.85, notes2));

  // MT-3: London in result with confidence >= 0.85
  const london = related.find((r) => r.trip.id === TRIP_LONDON);
  const notes3: string[] = [];
  notes3.push(`London: ${london ? `found, confidence=${london.confidence}, matchType=${london.matchType}` : "NOT FOUND"}`);
  results.push(check("MT-3: London in result (confidence >= 0.85)", !!london && london.confidence >= 0.85, notes3));

  // MT-4: Seoul NOT in result (or below 0.85 confidence)
  const seoul = related.find((r) => r.trip.id === TRIP_SEOUL);
  const notes4: string[] = [];
  notes4.push(`Seoul: ${seoul ? `found, confidence=${seoul.confidence}` : "not found (correct)"}`);
  results.push(check("MT-4: Seoul not in result (or confidence < 0.85)", !seoul || seoul.confidence < 0.85, notes4));

  // MT-5: Sri Lanka is the primary match (matchType="primary-match")
  const notes5: string[] = [];
  notes5.push(`Sri Lanka matchType: ${sriLanka?.matchType ?? "N/A"}`);
  results.push(check("MT-5: Sri Lanka matchType is primary-match", sriLanka?.matchType === "primary-match", notes5));

  // MT-6: London matchType is leg-date-match (CMB→LHR Jul 4 falls within London Jul 4–Jul 7)
  const notes6: string[] = [];
  notes6.push(`London matchType: ${london?.matchType ?? "N/A"}`);
  results.push(check("MT-6: London matchType is leg-date-match", london?.matchType === "leg-date-match", notes6));

  // ── Output ──────────────────────────────────────────────────────────────────
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;

  console.log("| Check                                                    | Result |");
  console.log("|----------------------------------------------------------|--------|");
  for (const r of results) {
    const status = r.pass ? "PASS  " : "FAIL  ";
    console.log(`| ${r.name.padEnd(56)} | ${status} |`);
    for (const note of r.notes) {
      console.log(`|   ${note}`);
    }
    console.log("|");
  }

  console.log(`\nPHASE MULTI-TRIP: ${passCount} PASS, ${failCount} FAIL`);
  if (failCount > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
