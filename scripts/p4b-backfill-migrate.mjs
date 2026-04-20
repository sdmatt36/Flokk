// =============================================================================
// p4b-backfill-migrate.mjs  — Phase 6 live backfill
// Reads all SavedItem rows with legacy sourceMethod values, writes
// new sourceMethod, sourcePlatform, and status using the same logic
// as the audit script (p4b-backfill-audit.mjs).
//
// USAGE:
//   node scripts/p4b-backfill-migrate.mjs
// =============================================================================

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =============================================================================
// Registry — must match src/lib/saved-item-types.ts exactly
// =============================================================================

const DOMAIN_TO_PLATFORM = {
  "instagram.com":        "instagram",
  "www.instagram.com":    "instagram",
  "tiktok.com":           "tiktok",
  "www.tiktok.com":       "tiktok",
  "vm.tiktok.com":        "tiktok",
  "youtube.com":          "youtube",
  "www.youtube.com":      "youtube",
  "youtu.be":             "youtube",
  "maps.google.com":      "google_maps",
  "maps.app.goo.gl":      "google_maps",
  "goo.gl":               "google_maps",
  "airbnb.com":           "airbnb",
  "www.airbnb.com":       "airbnb",
  "airbnb.co.jp":         "airbnb",
  "tripadvisor.com":      "tripadvisor",
  "www.tripadvisor.com":  "tripadvisor",
  "getyourguide.com":     "getyourguide",
  "www.getyourguide.com": "getyourguide",
  "viator.com":           "viator",
  "www.viator.com":       "viator",
  "klook.com":            "klook",
  "www.klook.com":        "klook",
  "booking.com":          "booking",
  "www.booking.com":      "booking",
  "hotels.com":           "hotels",
  "www.hotels.com":       "hotels",
  "expedia.com":          "expedia",
  "www.expedia.com":      "expedia",
  "yelp.com":             "yelp",
  "www.yelp.com":         "yelp",
  "tabelog.com":          "tabelog",
  "www.tabelog.com":      "tabelog",
  "gurunavi.com":         "gurunavi",
  "www.gurunavi.com":     "gurunavi",
  "hotpepper.jp":         "hotpepper",
  "www.hotpepper.jp":     "hotpepper",
  "jalan.net":            "jalan",
  "www.jalan.net":        "jalan",
  "share.google":         "google_maps",
  "google.com":           "google_maps",
  "flokk.app":            "direct",
  "flokktravel.com":      "direct",
  "example.com":          "direct",
};

const CANONICAL_METHODS = new Set([
  "URL_PASTE", "EMAIL_FORWARD", "IN_APP_SAVE", "SHARED_TRIP_IMPORT",
]);

function inferPlatformFromUrl(url) {
  if (!url) return "direct";
  try {
    const raw = new URL(url).hostname;
    const hostname = raw.replace(/^(www\.|m\.)/, "");
    return DOMAIN_TO_PLATFORM[raw] ?? DOMAIN_TO_PLATFORM[hostname] ?? "direct_website";
  } catch {
    return "direct";
  }
}

function proposeRemap(sourceMethod, sourceUrl) {
  if (CANONICAL_METHODS.has(sourceMethod)) return null; // skip
  switch (sourceMethod) {
    case "INSTAGRAM":    return { newMethod: "URL_PASTE",      newPlatform: "instagram" };
    case "TIKTOK":       return { newMethod: "URL_PASTE",      newPlatform: "tiktok" };
    case "YOUTUBE":      return { newMethod: "URL_PASTE",      newPlatform: "youtube" };
    case "GOOGLE_MAPS":  return { newMethod: "URL_PASTE",      newPlatform: "google_maps" };
    case "MANUAL":       return { newMethod: "URL_PASTE",      newPlatform: inferPlatformFromUrl(sourceUrl) };
    case "IN_APP":       return { newMethod: "IN_APP_SAVE",    newPlatform: "direct" };
    case "EMAIL_IMPORT": return { newMethod: "EMAIL_FORWARD",  newPlatform: inferPlatformFromUrl(sourceUrl) };
    case "PHOTO_IMPORT": return { newMethod: "URL_PASTE",      newPlatform: "direct" };
    default:             return { newMethod: "URL_PASTE",      newPlatform: "direct" };
  }
}

function computeStatus(tripId, dayIndex, startTime) {
  if (!tripId) return "UNORGANIZED";
  if (dayIndex == null) return "TRIP_ASSIGNED";
  if (startTime) return "SCHEDULED";
  return "TRIP_ASSIGNED";
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, "sourceMethod", "sourceUrl", "tripId", "dayIndex", "startTime"
       FROM "SavedItem"
       ORDER BY "savedAt" DESC`
    );

    const total = rows.length;
    let skipped = 0;
    let updated = 0;
    let errors = 0;

    console.log("=".repeat(70));
    console.log("P4B BACKFILL MIGRATE — LIVE WRITES");
    console.log("=".repeat(70));
    console.log(`Total rows to evaluate: ${total}`);
    console.log("");

    for (const row of rows) {
      const proposal = proposeRemap(row.sourceMethod, row.sourceUrl);
      if (!proposal) {
        skipped++;
        continue;
      }

      const newStatus = computeStatus(row.tripId, row.dayIndex, row.startTime);

      try {
        await client.query(
          `UPDATE "SavedItem"
           SET "sourceMethod" = $1, "sourcePlatform" = $2, "status" = $3
           WHERE id = $4`,
          [proposal.newMethod, proposal.newPlatform, newStatus, row.id]
        );
        updated++;
      } catch (err) {
        errors++;
        console.error(`  ERROR updating ${row.id}: ${err.message}`);
      }
    }

    console.log(`Rows skipped (already canonical): ${skipped}`);
    console.log(`Rows updated:                     ${updated}`);
    console.log(`Errors:                           ${errors}`);
    console.log("");

    // ==========================================================================
    // Verification
    // ==========================================================================

    console.log("=".repeat(70));
    console.log("VERIFICATION");
    console.log("=".repeat(70));

    // 1. Confirm zero legacy values remain
    const legacyValues = ["INSTAGRAM","TIKTOK","YOUTUBE","GOOGLE_MAPS","MANUAL","IN_APP","EMAIL_IMPORT","PHOTO_IMPORT"];
    const placeholders = legacyValues.map((_, i) => `$${i + 1}`).join(", ");
    const legacyRes = await client.query(
      `SELECT "sourceMethod", COUNT(*) AS cnt
       FROM "SavedItem"
       WHERE "sourceMethod" IN (${placeholders})
       GROUP BY "sourceMethod"`,
      legacyValues
    );
    if (legacyRes.rows.length === 0) {
      console.log("✓ Zero legacy sourceMethod values remaining.");
    } else {
      console.log("✗ LEGACY VALUES STILL PRESENT:");
      for (const r of legacyRes.rows) {
        console.log(`    ${r.cnt}  ${r.sourceMethod}`);
      }
    }
    console.log("");

    // 2. Final sourceMethod distribution
    const methodRes = await client.query(
      `SELECT "sourceMethod", COUNT(*) AS cnt FROM "SavedItem"
       GROUP BY "sourceMethod" ORDER BY cnt DESC`
    );
    console.log("FINAL sourceMethod DISTRIBUTION");
    console.log("-".repeat(50));
    for (const r of methodRes.rows) {
      console.log(`  ${String(r.cnt).padStart(5)}  ${r.sourceMethod ?? "(null)"}`);
    }
    console.log("");

    // 3. Final sourcePlatform distribution
    const platformRes = await client.query(
      `SELECT "sourcePlatform", COUNT(*) AS cnt FROM "SavedItem"
       GROUP BY "sourcePlatform" ORDER BY cnt DESC`
    );
    console.log("FINAL sourcePlatform DISTRIBUTION");
    console.log("-".repeat(50));
    for (const r of platformRes.rows) {
      console.log(`  ${String(r.cnt).padStart(5)}  ${r.sourcePlatform ?? "(null)"}`);
    }
    console.log("");

    // 4. Final status distribution
    const statusRes = await client.query(
      `SELECT "status", COUNT(*) AS cnt FROM "SavedItem"
       GROUP BY "status" ORDER BY cnt DESC`
    );
    console.log("FINAL status DISTRIBUTION");
    console.log("-".repeat(50));
    for (const r of statusRes.rows) {
      console.log(`  ${String(r.cnt).padStart(5)}  ${r.status ?? "(null)"}`);
    }
    console.log("");

    // 5. Sample 3 rows per sourcePlatform bucket
    console.log("SAMPLE ROWS PER sourcePlatform BUCKET (3 each)");
    console.log("=".repeat(70));
    for (const pr of platformRes.rows) {
      const plat = pr.sourcePlatform;
      const sampleRes = await client.query(
        `SELECT id, "sourceMethod", "sourcePlatform", "rawTitle", "sourceUrl"
         FROM "SavedItem"
         WHERE "sourcePlatform" = $1
         LIMIT 3`,
        [plat]
      );
      console.log(`\n[${plat}]  (${pr.cnt} rows)`);
      for (const s of sampleRes.rows) {
        const title = (s.rawTitle ?? "(no title)").slice(0, 45);
        const url = s.sourceUrl
          ? (s.sourceUrl.length > 55 ? s.sourceUrl.slice(0, 52) + "..." : s.sourceUrl)
          : "(no sourceUrl)";
        console.log(`  ${s.id}  ${s.sourceMethod}`);
        console.log(`    title: ${title}`);
        console.log(`    url:   ${url}`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("MIGRATE COMPLETE.");
    console.log("=".repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migrate failed:", err);
  process.exit(1);
});
