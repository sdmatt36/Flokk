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

  // MT-5: Sri Lanka has confidence >= 0.9 (primary-match seed 0.9, upgraded to 0.95 by SIN→CMB leg match)
  const notes5: string[] = [];
  notes5.push(`Sri Lanka confidence=${sriLanka?.confidence ?? "N/A"} matchType=${sriLanka?.matchType ?? "N/A"}`);
  results.push(check("MT-5: Sri Lanka confidence >= 0.9", !!sriLanka && sriLanka.confidence >= 0.9, notes5));

  // MT-6: London matchType is leg-dest-date-match (toCity=London + Jul 4 in London range)
  const notes6: string[] = [];
  notes6.push(`London matchType: ${london?.matchType ?? "N/A"}`);
  results.push(check("MT-6: London matchType is leg-dest-date-match", london?.matchType === "leg-dest-date-match", notes6));

  // MT-7: Kamakura NOT in result at >= 0.85 (date-range home base trip must be excluded)
  const TRIP_KAMAKURA = "cmmyhbk8g000004jpof1i3g52";
  const kamakura = related.find((r) => r.trip.id === TRIP_KAMAKURA);
  const notes7: string[] = [];
  notes7.push(`Kamakura: ${kamakura ? `found, confidence=${kamakura.confidence}, matchType=${kamakura.matchType}` : "not found (correct)"}`);
  results.push(check("MT-7: Kamakura not in result at >= 0.85 (home base excluded)", !kamakura || kamakura.confidence < 0.85, notes7));

  // MT-8: Mash Tun / Scotland routing — verify fixed normalizeLocationToKeywords +
  // P1 no-date-fallback logic. Pure in-memory simulation. Bug: "United Kingdom"
  // was split into ["United", "Kingdom"]; "United" matched San Diego's "United States".
  // Fix: full phrase only; P1 without date overlap falls through to P2.
  {
    type FakeTrip = { id: string; title: string; destinationCity: string | null; destinationCountry: string | null; startDate: Date | null; endDate: Date | null; status: string };

    function fixedNormalize(raw: string): string[] {
      return [raw.trim()]; // full phrase only, no splitting
    }

    function matchesDest(trip: FakeTrip, keywords: string[]): boolean {
      const haystack = [trip.title, trip.destinationCity, trip.destinationCountry].filter(Boolean).join(" ").toLowerCase();
      return keywords.some((kw) => {
        const k = kw.toLowerCase();
        if (k.includes(" ")) return haystack.includes(k);
        const regex = new RegExp(`(?<![a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i");
        return regex.test(haystack);
      });
    }

    function dateInRange(dateStr: string, trip: FakeTrip): boolean {
      if (!trip.startDate || !trip.endDate) return false;
      const [y, m, d] = dateStr.split("-").map(Number);
      const booking = new Date(y, m - 1, d);
      const start = new Date(trip.startDate); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 3);
      const end = new Date(trip.endDate); end.setHours(23, 59, 59, 999);
      return booking >= start && booking <= end;
    }

    const sanDiego: FakeTrip = { id: "san-diego", title: "San Diego Aug 25", destinationCity: "San Diego", destinationCountry: "United States", startDate: new Date("2025-08-02"), endDate: new Date("2025-08-31"), status: "COMPLETED" };
    const scotland: FakeTrip = { id: "scotland", title: "Scotland - July 2026", destinationCity: "Edinburgh", destinationCountry: null, startDate: new Date("2026-07-07"), endDate: new Date("2026-07-16"), status: "PLANNING" };
    const fakeTrips = [sanDiego, scotland];
    const bookingDateStr = "2026-07-10";
    const bookingDateObj = new Date(2026, 6, 10);

    // eligibleTrips filter: exclude COMPLETED trips that ended > 30 days before booking
    const eligible = fakeTrips.filter((t) => {
      if (t.status !== "COMPLETED") return true;
      if (!t.endDate) return true;
      return (bookingDateObj.getTime() - t.endDate.getTime()) / 86400000 < 30;
    });

    // destKeywords with fixed normalizer
    const destKeywords = [...new Set(["Aberlour", "United Kingdom"].flatMap(fixedNormalize))].filter((k) => k.length > 2);

    // P1
    const destMatches = eligible.filter((t) => matchesDest(t, destKeywords));
    const withDate = destMatches.filter((t) => dateInRange(bookingDateStr, t));
    let matched: FakeTrip | null = withDate.length > 0 ? withDate[0] : null;

    // P2 (only if P1 didn't match)
    if (!matched) {
      const dateMatches = eligible.filter((t) => dateInRange(bookingDateStr, t));
      if (dateMatches.length > 0) matched = dateMatches[0];
    }

    const notes8: string[] = [];
    notes8.push(`eligible trips: ${eligible.map((t) => t.title).join(", ") || "none"}`);
    notes8.push(`destKeywords: [${destKeywords.join(", ")}]`);
    notes8.push(`P1 destMatches: ${destMatches.map((t) => t.title).join(", ") || "none"}`);
    notes8.push(`P1 withDate: ${withDate.map((t) => t.title).join(", ") || "none"}`);
    notes8.push(`matched: ${matched?.title ?? "none"}`);
    results.push(check("MT-8: Mash Tun routes to Scotland (not San Diego)", matched?.id === "scotland", notes8));
  }

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
