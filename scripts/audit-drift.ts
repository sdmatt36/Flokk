import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { isSaveableBooking } from "../src/lib/booking-saved-item";

// Aggregator names that carry no place-identity signal — excluded from I1.
// Mirrors SKIP_VENDOR_NAMES in scripts/chat34-arc2-plan.ts and Arc 2 logic.
const SKIP_VENDOR_NAMES = new Set(["booking.com", "expedia", "airbnb", "viator", "getyourguide", "agoda"]);

// Transit/logistics tags excluded from I2 — not "places" in Community Picks sense.
// Mirrors TRANSIT_TAGS in scripts/chat34-rating-drift-fix.ts.
const TRANSIT_TAGS = new Set(["train", "flight", "bus", "transit", "car_rental", "rental"]);

type Violation = { invariant: string; detail: string; id: string };

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const violations: Violation[] = [];

  console.log("=== Flokk Write Architecture Drift Audit ===\n");

  // ============================================================
  // I1: Every saveable booking has a SavedItem twin.
  // ============================================================
  console.log("I1: Saveable booking TripDocuments must have savedItemId populated");
  const bookingDocs = await db.tripDocument.findMany({
    where: { type: "booking" },
    select: { id: true, label: true, content: true, savedItemId: true },
  });
  let i1Violations = 0;
  for (const doc of bookingDocs) {
    let parsed: any = null;
    try { parsed = doc.content ? JSON.parse(doc.content as string) : null; } catch {}
    const contentType = parsed?.type ?? null;
    const vendorName = (parsed?.vendorName ?? "").trim().toLowerCase();
    if (SKIP_VENDOR_NAMES.has(vendorName)) continue;
    if (!isSaveableBooking(contentType, doc.label)) continue;
    if (doc.savedItemId) continue;
    i1Violations++;
    if (i1Violations <= 10) {
      violations.push({ invariant: "I1", detail: `${doc.label} (type: ${contentType})`, id: doc.id });
    }
  }
  console.log(`  Violations: ${i1Violations}${i1Violations > 10 ? " (showing first 10)" : ""}`);
  for (const v of violations.filter(v => v.invariant === "I1")) {
    console.log(`    - ${v.detail} [${v.id}]`);
  }
  console.log();

  // ============================================================
  // I2: Every userRating has a PlaceRating twin.
  // ============================================================
  console.log("I2: SavedItems with userRating must have at least one PlaceRating row");
  const rated = await db.savedItem.findMany({
    where: { userRating: { not: null } },
    select: { id: true, rawTitle: true, userRating: true, destinationCity: true, categoryTags: true },
  });
  let i2Violations = 0;
  for (const s of rated) {
    const tagsLower = (s.categoryTags ?? []).map((t: string) => t.toLowerCase());
    const isTransit = tagsLower.some((t: string) => TRANSIT_TAGS.has(t));
    if (isTransit) continue;
    const prCount = await db.placeRating.count({ where: { savedItemId: s.id } });
    if (prCount > 0) continue;
    i2Violations++;
    if (i2Violations <= 10) {
      violations.push({
        invariant: "I2",
        detail: `${s.rawTitle} (${s.destinationCity ?? "?"}) rating=${s.userRating}`,
        id: s.id,
      });
    }
  }
  console.log(`  Violations: ${i2Violations}${i2Violations > 10 ? " (showing first 10)" : ""}`);
  for (const v of violations.filter(v => v.invariant === "I2")) {
    console.log(`    - ${v.detail} [${v.id}]`);
  }
  console.log();

  // ============================================================
  // I2b: Inverse — every PlaceRating should have a SavedItem.
  // ============================================================
  console.log("I2b: PlaceRating rows with savedItemId set must reference a valid SavedItem");
  const allRatings = await db.placeRating.findMany({
    where: { savedItemId: { not: null } },
    select: { id: true, savedItemId: true, placeName: true, rating: true },
  });
  let i2bViolations = 0;
  for (const r of allRatings) {
    if (!r.savedItemId) continue;
    const exists = await db.savedItem.findUnique({ where: { id: r.savedItemId }, select: { id: true } });
    if (exists) continue;
    i2bViolations++;
    if (i2bViolations <= 10) {
      violations.push({
        invariant: "I2b",
        detail: `${r.placeName} rating=${r.rating} → savedItemId=${r.savedItemId} NOT FOUND`,
        id: r.id,
      });
    }
  }
  console.log(`  Violations: ${i2bViolations}${i2bViolations > 10 ? " (showing first 10)" : ""}`);
  for (const v of violations.filter(v => v.invariant === "I2b")) {
    console.log(`    - ${v.detail} [${v.id}]`);
  }
  console.log();

  // ============================================================
  // I2c: Clearing invariant — SavedItem with userRating=null should have NO PlaceRating rows
  // ============================================================
  console.log("I2c: SavedItems with userRating=null must have no PlaceRating rows");
  const unrated = await db.savedItem.findMany({
    where: { userRating: null },
    select: { id: true, rawTitle: true },
  });
  let i2cViolations = 0;
  for (const s of unrated) {
    const prCount = await db.placeRating.count({ where: { savedItemId: s.id } });
    if (prCount === 0) continue;
    i2cViolations++;
    if (i2cViolations <= 10) {
      violations.push({ invariant: "I2c", detail: `${s.rawTitle} has ${prCount} stale PlaceRating rows`, id: s.id });
    }
  }
  console.log(`  Violations: ${i2cViolations}${i2cViolations > 10 ? " (showing first 10)" : ""}`);
  for (const v of violations.filter(v => v.invariant === "I2c")) {
    console.log(`    - ${v.detail} [${v.id}]`);
  }
  console.log();

  // ============================================================
  // I3: UI-observable (edit propagation). Not checkable in DB.
  // ============================================================
  console.log("I3: Edit Booking modal triple-write propagation");
  console.log("  (UI-observable invariant — not checkable from DB state alone)");
  console.log("  Manual verification: edit a vault hotel card, confirm Community Picks reflects the new name.");
  console.log();

  // ============================================================
  // I4: Orphan migration — also not checkable post-hoc.
  // ============================================================
  console.log("I4: Orphan migration data preservation");
  console.log("  (Script-time invariant — checkable only when orphan migration is in progress)");
  console.log("  Enforcement is at script-design time per WRITE_ARCHITECTURE.md.");
  console.log();

  // ============================================================
  // I5: UI-observable (family name attribution). Not in DB.
  // ============================================================
  console.log("I5: Attribution lives on containers, not atoms");
  console.log("  (UI-observable invariant — not checkable from DB state)");
  console.log("  Manual verification: no Community Picks card displays a family name.");
  console.log();

  // ============================================================
  // I-extra: Duplicate PlaceRating per SavedItem
  // ============================================================
  console.log("I-extra: No SavedItem should have more than one PlaceRating row (convention-only today, future DB constraint)");
  const dupCounts = await db.$queryRaw<Array<{ savedItemId: string; count: bigint }>>`
    SELECT "savedItemId", COUNT(*) AS count
    FROM "PlaceRating"
    WHERE "savedItemId" IS NOT NULL
    GROUP BY "savedItemId"
    HAVING COUNT(*) > 1
  `;
  let iExtraViolations = dupCounts.length;
  console.log(`  Violations: ${iExtraViolations}${iExtraViolations > 10 ? " (showing first 10)" : ""}`);
  for (const d of dupCounts.slice(0, 10)) {
    violations.push({ invariant: "I-extra", detail: `savedItemId=${d.savedItemId} has ${d.count} PlaceRating rows`, id: d.savedItemId });
    console.log(`    - savedItemId=${d.savedItemId} → ${d.count} rows`);
  }
  console.log();

  // ============================================================
  // Summary
  // ============================================================
  console.log("=== Summary ===");
  const totalViolations = i1Violations + i2Violations + i2bViolations + i2cViolations + iExtraViolations;
  console.log(`  I1 (booking without savedItemId): ${i1Violations}`);
  console.log(`  I2 (userRating without PlaceRating): ${i2Violations}`);
  console.log(`  I2b (orphan PlaceRating): ${i2bViolations}`);
  console.log(`  I2c (stale PlaceRating on cleared rating): ${i2cViolations}`);
  console.log(`  I-extra (multiple PlaceRatings per SavedItem): ${iExtraViolations}`);
  console.log(`  TOTAL: ${totalViolations}`);
  console.log();

  await pool.end();

  if (totalViolations > 0) {
    console.log(`Drift detected. See docs/WRITE_ARCHITECTURE.md for invariant definitions and fix guidance.`);
    process.exit(1);
  } else {
    console.log(`No drift detected. All checkable invariants hold.`);
    process.exit(0);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
