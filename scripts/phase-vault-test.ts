/**
 * phase-vault-test.ts
 *
 * One-shot verification script for Phase Vault.
 * Calls synthesizeVaultDocuments() directly and asserts expected output.
 *
 * Read-only — makes no DB writes.
 *
 * Usage:
 *   npx tsx scripts/phase-vault-test.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { synthesizeVaultDocuments, type VaultDocument } from "../src/lib/vault/synthesize-booking";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Trip IDs ──────────────────────────────────────────────────────────────────
const TRIP_SRI_LANKA = "cmmx09fra000004if78drj98m";
const TRIP_SEOUL     = "cmmx6428k000004jlxgel7s86";

type CheckResult = { name: string; pass: boolean; notes: string[] };

function check(name: string, condition: boolean, notes: string[]): CheckResult {
  if (!condition) notes.push(`FAIL: ${name}`);
  return { name, pass: condition, notes };
}

// ── Sri Lanka flight checks ───────────────────────────────────────────────────

async function checkSriLankaFlight(): Promise<CheckResult[]> {
  const docs = await synthesizeVaultDocuments(TRIP_SRI_LANKA, db);
  const results: CheckResult[] = [];

  const flightDocs = docs.filter(d => d.type === "booking" && (() => {
    try { return (JSON.parse(d.content) as Record<string, unknown>).type === "flight"; } catch { return false; }
  })());

  const notes1: string[] = [];
  notes1.push(`Found ${flightDocs.length} flight booking document(s) for Sri Lanka`);
  results.push(check("SL-1: exactly 1 flight booking doc returned", flightDocs.length === 1, notes1));

  if (flightDocs.length === 0) return results;

  const doc = flightDocs[0];
  const c = JSON.parse(doc.content) as Record<string, unknown>;

  const notes2: string[] = [];
  notes2.push(`id = ${doc.id} (starts with manual-activity: ${doc.id.startsWith("manual-activity:")})`);
  results.push(check("SL-2: id is TripDocument id (not manual-activity prefix)", !doc.id.startsWith("manual-activity:"), notes2));

  const notes3: string[] = [];
  notes3.push(`confirmationCode = ${c.confirmationCode}`);
  results.push(check("SL-3: confirmationCode is FHMI74", c.confirmationCode === "FHMI74", notes3));

  const notes4: string[] = [];
  notes4.push(`fromCity = ${c.fromCity}, toCity = ${c.toCity}`);
  results.push(check("SL-4: fromCity=Tokyo toCity=London", c.fromCity === "Tokyo" && c.toCity === "London", notes4));

  const notes5: string[] = [];
  notes5.push(`departureDate = ${c.departureDate}, departureTime = ${c.departureTime}`);
  results.push(check("SL-5: departureTime=00:05 (first leg HND→SIN UL895)", c.departureTime === "00:05", notes5));

  const notes6: string[] = [];
  notes6.push(`arrivalDate = ${c.arrivalDate}, arrivalTime = ${c.arrivalTime}`);
  results.push(check("SL-6: arrivalDate=2026-07-04 arrivalTime=20:00 (last leg CMB→LHR)", c.arrivalDate === "2026-07-04" && c.arrivalTime === "20:00", notes6));

  const legs = c.legs as unknown[] | null | undefined;
  const notes7: string[] = [];
  notes7.push(`legs.length = ${Array.isArray(legs) ? legs.length : "not an array"}`);
  results.push(check("SL-7: legs[] has 3 entries", Array.isArray(legs) && legs.length === 3, notes7));

  const notes8: string[] = [];
  notes8.push(`totalCost = ${c.totalCost}`);
  results.push(check("SL-8: totalCost=206390 (from TripDocument blob fallback)", c.totalCost === 206390, notes8));

  const notes9: string[] = [];
  notes9.push(`fromAirport = ${c.fromAirport}, toAirport = ${c.toAirport}`);
  results.push(check("SL-9: fromAirport=HND toAirport=LHR", c.fromAirport === "HND" && c.toAirport === "LHR", notes9));

  return results;
}

// ── Hotel checks (find first trip with a hotel TripDocument) ──────────────────

async function checkHotelDoc(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Find a trip with a hotel booking TripDocument
  const hotelDoc = await db.$queryRaw<{ tripId: string; id: string; label: string; content: string }[]>`
    SELECT "tripId", id, label, content FROM "TripDocument"
    WHERE type = 'booking' AND content::jsonb->>'type' = 'hotel'
    LIMIT 1
  `;

  const notes0: string[] = [];
  if (hotelDoc.length === 0) {
    notes0.push("No hotel TripDocument found in DB — skipping hotel checks");
    results.push({ name: "HOTEL-0: hotel doc found", pass: true, notes: notes0 });
    return results;
  }

  const { tripId, label } = hotelDoc[0];
  notes0.push(`tripId=${tripId}, label=${label}`);
  results.push(check("HOTEL-0: found a hotel TripDocument", true, notes0));

  const docs = await synthesizeVaultDocuments(tripId, db);
  const hDocs = docs.filter(d => {
    try { return (JSON.parse(d.content) as Record<string, unknown>).type === "hotel"; } catch { return false; }
  });

  const notes1: string[] = [];
  notes1.push(`hotel docs returned: ${hDocs.length}`);
  results.push(check("HOTEL-1: at least 1 hotel booking doc returned", hDocs.length >= 1, notes1));

  if (hDocs.length === 0) return results;

  const hDoc = hDocs[0];
  const c = JSON.parse(hDoc.content) as Record<string, unknown>;

  const notes2: string[] = [];
  notes2.push(`content.type = ${c.type}, checkIn = ${c.checkIn}, checkOut = ${c.checkOut}`);
  results.push(check("HOTEL-2: content.type is hotel", c.type === "hotel", notes2));

  const notes3: string[] = [];
  notes3.push(`content.checkIn present = ${!!c.checkIn}`);
  results.push(check("HOTEL-3: checkIn field present", !!c.checkIn, notes3));

  return results;
}

// ── Activity checks (find first trip with an activity TripDocument) ────────────

async function checkActivityDoc(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const actDoc = await db.$queryRaw<{ tripId: string; id: string; label: string }[]>`
    SELECT "tripId", id, label FROM "TripDocument"
    WHERE type = 'booking' AND content::jsonb->>'type' = 'activity'
    LIMIT 1
  `;

  const notes0: string[] = [];
  if (actDoc.length === 0) {
    notes0.push("No activity TripDocument found — skipping activity checks");
    results.push({ name: "ACT-0: activity doc found", pass: true, notes: notes0 });
    return results;
  }

  const { tripId, label } = actDoc[0];
  notes0.push(`tripId=${tripId}, label=${label}`);
  results.push(check("ACT-0: found an activity TripDocument", true, notes0));

  const docs = await synthesizeVaultDocuments(tripId, db);
  const aDocs = docs.filter(d => {
    try {
      const c = JSON.parse(d.content) as Record<string, unknown>;
      return c.type === "activity" && !d.id.startsWith("manual-activity:");
    } catch { return false; }
  });

  const notes1: string[] = [];
  notes1.push(`activity docs returned (TripDocument-sourced): ${aDocs.length}`);
  results.push(check("ACT-1: at least 1 TripDocument-sourced activity returned", aDocs.length >= 1, notes1));

  if (aDocs.length > 0) {
    const c = JSON.parse(aDocs[0].content) as Record<string, unknown>;
    const notes2: string[] = [];
    notes2.push(`content.type = ${c.type}`);
    results.push(check("ACT-2: content.type is activity", c.type === "activity", notes2));
  }

  return results;
}

// ── Manual activity checks (Seoul trip) ──────────────────────────────────────

async function checkManualActivities(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const docs = await synthesizeVaultDocuments(TRIP_SEOUL, db);
  const maDocs = docs.filter(d => d.id.startsWith("manual-activity:"));

  const notes1: string[] = [];
  notes1.push(`manual-activity docs returned: ${maDocs.length}`);
  results.push(check("MA-1: at least 1 manual-activity doc returned for Seoul", maDocs.length >= 1, notes1));

  if (maDocs.length === 0) return results;

  const ma = maDocs[0];
  const c = JSON.parse(ma.content) as Record<string, unknown>;

  const notes2: string[] = [];
  notes2.push(`id=${ma.id}, type=${ma.type}, content._source=${c._source}`);
  results.push(check("MA-2: id has manual-activity: prefix", ma.id.startsWith("manual-activity:"), notes2));

  const notes3: string[] = [];
  notes3.push(`content._source = ${c._source}`);
  results.push(check("MA-3: content._source is manual-activity", c._source === "manual-activity", notes3));

  const notes4: string[] = [];
  notes4.push(`type = ${ma.type}`);
  results.push(check("MA-4: type is booking", ma.type === "booking", notes4));

  const notes5: string[] = [];
  notes5.push(`activityName = ${c.activityName}`);
  results.push(check("MA-5: activityName is present", !!c.activityName, notes5));

  return results;
}

// ── Non-booking doc passthrough check ────────────────────────────────────────

async function checkNonBookingPassthrough(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Find a trip with a non-booking TripDocument
  const nonBooking = await db.$queryRaw<{ tripId: string; type: string; id: string }[]>`
    SELECT "tripId", type, id FROM "TripDocument"
    WHERE type != 'booking'
    LIMIT 1
  `;

  if (nonBooking.length === 0) {
    results.push({ name: "NB-0: non-booking doc passthrough", pass: true, notes: ["No non-booking docs found — skipping"] });
    return results;
  }

  const { tripId, type, id } = nonBooking[0];
  const docs = await synthesizeVaultDocuments(tripId, db);
  const found = docs.find(d => d.id === id);

  const notes: string[] = [];
  notes.push(`Looking for non-booking doc id=${id} type=${type} in synthesized output`);
  notes.push(`Found: ${!!found}, returned type: ${found?.type}`);
  results.push(check("NB-1: non-booking TripDocument passes through with correct type", !!found && found.type === type, notes));

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== PHASE VAULT: synthesize-booking verification ===\n");

  const allResults: CheckResult[] = [
    ...(await checkSriLankaFlight()),
    ...(await checkHotelDoc()),
    ...(await checkActivityDoc()),
    ...(await checkManualActivities()),
    ...(await checkNonBookingPassthrough()),
  ];

  const passCount = allResults.filter(r => r.pass).length;
  const failCount = allResults.filter(r => !r.pass).length;

  console.log("| Check                                                    | Result |");
  console.log("|----------------------------------------------------------|--------|");
  for (const r of allResults) {
    const status = r.pass ? "PASS  " : "FAIL  ";
    console.log(`| ${r.name.padEnd(56)} | ${status} |`);
    for (const note of r.notes) {
      console.log(`|   ${note}`);
    }
    console.log("|");
  }

  console.log(`\nPHASE VAULT: ${passCount} PASS, ${failCount} FAIL`);

  if (failCount > 0) process.exit(1);
}

main()
  .catch(e => {
    console.error("\nFATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
