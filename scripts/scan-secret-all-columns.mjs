/**
 * scan-secret-all-columns.mjs
 *
 * Secret-anchored scan: checks EVERY text/varchar column in EVERY table for
 * the literal API key, 'key=AIza', 'maps.google', or 'googleapis.com'.
 *
 * This is the Prompt D-FIX-2 STEP 0 enumeration tool. Run with:
 *   node scripts/scan-secret-all-columns.mjs
 *
 * Reports exact per-column counts for any nonzero match.
 * Catches staticmap, place/photo, streetview, geocode, embed — any Google URL family.
 */

import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(filename) {
  try {
    for (const line of readFileSync(join(root, filename), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* file missing */ }
}
loadEnv(".env.local");
loadEnv(".env.production");

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!API_KEY) { console.warn("WARNING: GOOGLE_MAPS_API_KEY not set — searching by pattern only"); }

// All table.column pairs from information_schema (text/varchar columns, public schema)
const COLUMNS = [
  ["Article","content"],["Article","coverImage"],["Article","excerpt"],["Article","sourceUrl"],["Article","thumbnailUrl"],["Article","title"],
  ["City","blurb"],["City","heroPhotoUrl"],["City","photoUrl"],
  ["CommunitySpot","description"],["CommunitySpot","photoUrl"],["CommunitySpot","websiteUrl"],
  ["CommunitySpot_backup_20260418","description"],["CommunitySpot_backup_20260418","photoUrl"],["CommunitySpot_backup_20260418","websiteUrl"],
  ["Continent","blurb"],["Continent","photoUrl"],
  ["Country","blurb"],["Country","photoCredit"],["Country","photoSearchQuery"],["Country","photoSourceUrl"],["Country","photoUrl"],
  ["Event","description"],["Event","imageUrl"],["Event","ticketUrl"],
  ["ExtractionLog","errorMessage"],["ExtractionLog","rawEmail"],["ExtractionLog","resolutionPath"],
  ["GeneratedTour","prompt"],["GeneratedTour","subtitle"],["GeneratedTour","title"],
  ["ItineraryItem","address"],["ItineraryItem","imageUrl"],["ItineraryItem","managementUrl"],["ItineraryItem","notes"],["ItineraryItem","venueUrl"],
  ["ManualActivity","address"],["ManualActivity","imageUrl"],["ManualActivity","notes"],["ManualActivity","website"],
  ["Message","body"],
  ["PlaceRating","notes"],
  ["Question","answer"],["Question","body"],
  ["RecommendedItem","affiliateUrl"],["RecommendedItem","description"],["RecommendedItem","heroImageUrl"],
  ["SavedItem","affiliateUrl"],["SavedItem","mapsUrl"],["SavedItem","mediaThumbnailUrl"],["SavedItem","notes"],["SavedItem","placePhotoUrl"],["SavedItem","rawDescription"],["SavedItem","sourceUrl"],["SavedItem","userNote"],["SavedItem","websiteUrl"],
  ["SavedItem_backup_20260419","affiliateUrl"],["SavedItem_backup_20260419","mediaThumbnailUrl"],["SavedItem_backup_20260419","notes"],["SavedItem_backup_20260419","placePhotoUrl"],["SavedItem_backup_20260419","rawDescription"],["SavedItem_backup_20260419","sourceUrl"],["SavedItem_backup_20260419","userNote"],["SavedItem_backup_20260419","websiteUrl"],
  ["TourStop","address"],["TourStop","imageUrl"],["TourStop","websiteUrl"],["TourStop","why"],
  ["TravelVideo","description"],["TravelVideo","thumbnailUrl"],["TravelVideo","videoUrl"],
  ["Trip","heroImageUrl"],["Trip","title"],
  ["TripContact","notes"],
  ["TripDocument","content"],["TripDocument","url"],
  ["TripKeyInfo","label"],["TripKeyInfo","value"],
  ["TripNote","id"],  // minimal — TripNote has no content column; checking id is a no-op pattern
  ["TripService","notes"],
  ["TripTip","content"],
];

// Also scan ALL columns (not just likely ones) — loop information_schema at runtime
async function getAllTextColumns(client) {
  const { rows } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying')
    ORDER BY table_name, column_name
  `);
  return rows.map(r => [r.table_name, r.column_name]);
}

async function main() {
  console.log("=== Flokk secret-anchored scan — ALL text columns ===");
  console.log(`Literal key: ${API_KEY ? API_KEY.slice(0,12) + "…" : "(not set)"}`);
  console.log(`Patterns: 'key=AIza' | '${API_KEY ? API_KEY.slice(0,20) : ""}…' | 'maps.google' | 'googleapis.com'\n`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const allCols = await getAllTextColumns(client);
    console.log(`Scanning ${allCols.length} columns across all tables...\n`);

    const hits = [];
    const BATCH = 30;

    for (let i = 0; i < allCols.length; i += BATCH) {
      const batch = allCols.slice(i, i + BATCH);
      const parts = batch.map(([tbl, col]) => {
        const conditions = [
          `"${col}" LIKE '%key=AIza%'`,
          `"${col}" LIKE '%maps.google%'`,
          `"${col}" LIKE '%googleapis.com%'`,
        ];
        if (API_KEY) conditions.push(`"${col}" = '${API_KEY}'`);
        return `SELECT '${tbl}.${col}' AS col, COUNT(*) AS cnt FROM "${tbl}" WHERE ${conditions.join(" OR ")}`;
      });
      const sql = parts.join("\nUNION ALL\n");

      const { rows } = await client.query(sql);
      for (const r of rows) {
        if (parseInt(r.cnt) > 0) {
          hits.push({ col: r.col, cnt: parseInt(r.cnt) });
          console.log(`  HIT: ${r.col} — ${r.cnt} rows`);
        }
      }
    }

    console.log("\n=== STEP 0 RESULT ===");
    if (hits.length === 0) {
      console.log("✓ ZERO hits — no secret or Google URL pattern found in any column");
    } else {
      console.log(`${hits.length} columns with hits:`);
      for (const h of hits) {
        console.log(`  ${h.col}: ${h.cnt}`);
      }
      console.log("\nCopy the column names above for STEP 1 remediation.");
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
