/**
 * 2026-04-28-url-rule-backfill.ts
 *
 * Closes the Universal URL Rule arc (Operating Discipline #5).
 * Populates null URLs across three target sets using resolveCanonicalUrl.
 *
 * Sweep 1 — ManualActivity.website (12 rows)
 * Sweep 2 — ItineraryItem.venueUrl WHERE type = 'ACTIVITY' (16 rows)
 * Sweep 3 — ItineraryItem.venueUrl WHERE type = 'LODGING' (68 rows, 7 skipped)
 *
 * Idempotent: WHERE url IS NULL on every UPDATE. Safe to rerun.
 * Skip list: 7 rows whose title is a platform name (Booking.com / Airbnb).
 *
 * EXECUTION NOTE (Chat 40, 2026-04-28): Supabase direct connection (port 5432)
 * and pgbouncer pooler (port 6543) were both unreachable from localhost. URLs
 * were computed using the resolver logic inline and applied via Supabase MCP
 * execute_sql. Results: 89 rows updated (12 + 16 + 61), 7 skipped, 0 null remaining.
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/backfills/2026-04-28-url-rule-backfill.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveCanonicalUrl } from "../../src/lib/url-resolver";

// Use DIRECT_URL for scripts — pgbouncer transaction mode not reachable from localhost
const connString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const pool = new Pool({ connectionString: connString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Rows whose title is a platform name — searching for "Booking.com" returns the
// platform homepage, not a property. These cannot produce a useful URL.
const SKIP_IDS = new Set([
  "cmnqwcds4001204k3exkr6lzu", // Check-in: Booking.com
  "cmnqwce2r001304k3eu1zy81w", // Check-out: Booking.com
  "cmo17ksrw000004l0qf3o27gx", // Check-in: Booking.com
  "cmo17kt36000104l0y0t94s1l", // Check-out: Booking.com
  "cmo17mg1p000u04l09009ywvs", // Check-in: Booking.com
  "cmo17mghj000v04l0wqhccwe0", // Check-out: Booking.com
  "cmoezsesw000204l4mnoxihnl", // Check-in: Airbnb
]);

type PriorityHit = 1 | 2 | 3;

function derivePriority(url: string): PriorityHit {
  if (url.startsWith("https://www.google.com/maps/place")) return 2;
  if (url.startsWith("https://www.google.com/search")) return 3;
  return 1;
}

function stripVenuePrefixes(title: string): string {
  return title.replace(/^check-in:\s*/i, "").replace(/^check-out:\s*/i, "").trim();
}

interface RowLog {
  table: string;
  id: string;
  name: string;
  beforeUrl: null;
  afterUrl: string;
  priorityHit: PriorityHit;
}

async function main() {
  const logs: RowLog[] = [];
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const priorityCounts: Record<PriorityHit, number> = { 1: 0, 2: 0, 3: 0 };

  // ─── SWEEP 1: ManualActivity.website ─────────────────────────────────────

  console.log("\n── Sweep 1: ManualActivity.website ─────────────────────────────");

  const manualRows = await db.manualActivity.findMany({
    where: { website: null, deletedAt: null },
    select: { id: true, title: true, city: true },
  });

  console.log(`  Found ${manualRows.length} rows with null website.`);
  totalScanned += manualRows.length;

  for (const row of manualRows) {
    if (SKIP_IDS.has(row.id)) {
      console.log(`  SKIP  [${row.id}] "${row.title}" — on skip list`);
      totalSkipped++;
      continue;
    }

    const url = resolveCanonicalUrl({
      name: row.title,
      city: row.city ?? "",
    });

    await db.manualActivity.update({
      where: { id: row.id, website: null },
      data: { website: url },
    });

    const priority = derivePriority(url);
    priorityCounts[priority]++;
    totalUpdated++;

    const log: RowLog = { table: "ManualActivity", id: row.id, name: row.title, beforeUrl: null, afterUrl: url, priorityHit: priority };
    logs.push(log);
    console.log(`  ✓ P${priority} [${row.id}] "${row.title}" → ${url}`);
  }

  // ─── SWEEP 2: ItineraryItem.venueUrl ACTIVITY ─────────────────────────────

  console.log("\n── Sweep 2: ItineraryItem.venueUrl (ACTIVITY) ────────────────────");

  const activityRows = await db.itineraryItem.findMany({
    where: { venueUrl: null, type: "ACTIVITY" },
    select: { id: true, title: true, fromCity: true, toCity: true },
  });

  console.log(`  Found ${activityRows.length} rows with null venueUrl.`);
  totalScanned += activityRows.length;

  for (const row of activityRows) {
    if (SKIP_IDS.has(row.id)) {
      console.log(`  SKIP  [${row.id}] "${row.title}" — on skip list`);
      totalSkipped++;
      continue;
    }

    const city = row.fromCity ?? row.toCity ?? "";

    const url = resolveCanonicalUrl({
      name: row.title,
      city,
    });

    await db.itineraryItem.update({
      where: { id: row.id, venueUrl: null },
      data: { venueUrl: url },
    });

    const priority = derivePriority(url);
    priorityCounts[priority]++;
    totalUpdated++;

    const log: RowLog = { table: "ItineraryItem/ACTIVITY", id: row.id, name: row.title, beforeUrl: null, afterUrl: url, priorityHit: priority };
    logs.push(log);
    const shortTitle = row.title.length > 70 ? row.title.slice(0, 70) + "…" : row.title;
    console.log(`  ✓ P${priority} [${row.id}] "${shortTitle}" → ${url}`);
  }

  // ─── SWEEP 3: ItineraryItem.venueUrl LODGING ─────────────────────────────

  console.log("\n── Sweep 3: ItineraryItem.venueUrl (LODGING) ─────────────────────");

  const lodgingRows = await db.itineraryItem.findMany({
    where: { venueUrl: null, type: "LODGING" },
    select: { id: true, title: true, fromCity: true, toCity: true },
  });

  console.log(`  Found ${lodgingRows.length} rows with null venueUrl.`);
  totalScanned += lodgingRows.length;

  for (const row of lodgingRows) {
    if (SKIP_IDS.has(row.id)) {
      console.log(`  SKIP  [${row.id}] "${row.title}" — title is platform name`);
      totalSkipped++;
      continue;
    }

    // Strip Check-in/Check-out prefix so the search targets the property name
    const propertyName = stripVenuePrefixes(row.title);
    const city = row.toCity ?? row.fromCity ?? "";

    const url = resolveCanonicalUrl({
      name: propertyName,
      city,
    });

    await db.itineraryItem.update({
      where: { id: row.id, venueUrl: null },
      data: { venueUrl: url },
    });

    const priority = derivePriority(url);
    priorityCounts[priority]++;
    totalUpdated++;

    const log: RowLog = { table: "ItineraryItem/LODGING", id: row.id, name: row.title, beforeUrl: null, afterUrl: url, priorityHit: priority };
    logs.push(log);
    const shortTitle = row.title.length > 70 ? row.title.slice(0, 70) + "…" : row.title;
    console.log(`  ✓ P${priority} [${row.id}] "${shortTitle}" → ${url}`);
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  URL RULE BACKFILL SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`  Rows scanned:  ${totalScanned}`);
  console.log(`  Rows updated:  ${totalUpdated}`);
  console.log(`  Rows skipped:  ${totalSkipped}`);
  console.log(`  Priority dist: P1=${priorityCounts[1]}  P2=${priorityCounts[2]}  P3=${priorityCounts[3]}`);

  const manualUpdated = logs.filter(l => l.table === "ManualActivity").length;
  const activityUpdated = logs.filter(l => l.table === "ItineraryItem/ACTIVITY").length;
  const lodgingUpdated = logs.filter(l => l.table === "ItineraryItem/LODGING").length;

  const manualP = (t: PriorityHit) => logs.filter(l => l.table === "ManualActivity" && l.priorityHit === t).length;
  const actP = (t: PriorityHit) => logs.filter(l => l.table === "ItineraryItem/ACTIVITY" && l.priorityHit === t).length;
  const lodP = (t: PriorityHit) => logs.filter(l => l.table === "ItineraryItem/LODGING" && l.priorityHit === t).length;

  console.log(`\n  ManualActivity:         ${manualUpdated} rows (P1:${manualP(1)} P2:${manualP(2)} P3:${manualP(3)})`);
  console.log(`  ItineraryItem ACTIVITY: ${activityUpdated} rows (P1:${actP(1)} P2:${actP(2)} P3:${actP(3)})`);
  console.log(`  ItineraryItem LODGING:  ${lodgingUpdated} rows (P1:${lodP(1)} P2:${lodP(2)} P3:${lodP(3)})`);

  if (totalSkipped > 0) {
    console.log(`\n  Skipped (${totalSkipped} rows — title is platform name, no useful URL derivable):`);
    for (const id of SKIP_IDS) {
      console.log(`    ${id}`);
    }
  }

  console.log("══════════════════════════════════════════════════════════════════\n");

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
