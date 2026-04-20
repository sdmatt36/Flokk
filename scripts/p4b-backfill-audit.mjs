// =============================================================================
// p4b-backfill-audit.mjs  — Phase 5 value-remapping audit (read-only)
// Reads ALL SavedItem rows, classifies each as skip/remap/unknown,
// and reports distributions + samples + anomalies.
//
// USAGE:
//   node scripts/p4b-backfill-audit.mjs
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
// Constants
// =============================================================================

const CANONICAL_METHODS = new Set([
  "URL_PASTE", "EMAIL_FORWARD", "IN_APP_SAVE", "SHARED_TRIP_IMPORT",
]);

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

const REGISTERED_PLATFORMS = new Set(Object.values(DOMAIN_TO_PLATFORM));

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

// =============================================================================
// Remapping logic per spec table
// =============================================================================

function proposeRemap(sourceMethod, sourceUrl) {
  // Already canonical — skip
  if (CANONICAL_METHODS.has(sourceMethod)) {
    return { action: "skip", newMethod: sourceMethod, newPlatform: null };
  }

  switch (sourceMethod) {
    case "INSTAGRAM":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: "instagram" };
    case "TIKTOK":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: "tiktok" };
    case "YOUTUBE":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: "youtube" };
    case "GOOGLE_MAPS":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: "google_maps" };
    case "MANUAL":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: inferPlatformFromUrl(sourceUrl) };
    case "IN_APP":
      return { action: "remap", newMethod: "IN_APP_SAVE", newPlatform: "direct" };
    case "EMAIL_IMPORT":
      return { action: "remap", newMethod: "EMAIL_FORWARD", newPlatform: inferPlatformFromUrl(sourceUrl) };
    case "PHOTO_IMPORT":
      return { action: "remap", newMethod: "URL_PASTE", newPlatform: "direct" };
    default:
      return { action: "unknown", newMethod: null, newPlatform: null };
  }
}

// =============================================================================
// Anomaly detection
// =============================================================================

function detectAnomalies(row, proposal) {
  const anomalies = [];
  const { sourceMethod, sourceUrl, rawTitle } = row;

  if (sourceMethod === "EMAIL_IMPORT" && !sourceUrl) {
    anomalies.push("EMAIL_IMPORT but no sourceUrl — platform will be 'direct'");
  }
  if ((sourceMethod === "INSTAGRAM" || sourceMethod === "TIKTOK") && sourceUrl) {
    // Check if the URL actually matches the declared platform
    const platform = inferPlatformFromUrl(sourceUrl);
    if (platform !== sourceMethod.toLowerCase()) {
      anomalies.push(`Declared ${sourceMethod} but URL infers platform="${platform}" (url: ${sourceUrl})`);
    }
  }
  if (sourceMethod === "GOOGLE_MAPS" && sourceUrl) {
    const platform = inferPlatformFromUrl(sourceUrl);
    if (platform !== "google_maps") {
      anomalies.push(`Declared GOOGLE_MAPS but URL infers platform="${platform}" (url: ${sourceUrl})`);
    }
  }
  if ((sourceMethod === "INSTAGRAM" || sourceMethod === "TIKTOK" || sourceMethod === "YOUTUBE" || sourceMethod === "GOOGLE_MAPS") && !sourceUrl) {
    anomalies.push(`Declared ${sourceMethod} but no sourceUrl — platform hardcoded from legacy value`);
  }

  return anomalies;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, "sourceMethod", "sourcePlatform", "sourceUrl", "rawTitle"
       FROM "SavedItem"
       ORDER BY "savedAt" DESC`
    );

    const total = rows.length;

    // ── A. Current sourceMethod distribution ──────────────────────────────────
    const methodDist = {};
    for (const r of rows) {
      const v = r.sourceMethod ?? "(null)";
      methodDist[v] = (methodDist[v] ?? 0) + 1;
    }

    // ── B. Current sourcePlatform distribution ────────────────────────────────
    const platformDist = {};
    for (const r of rows) {
      const v = r.sourcePlatform ?? "(null)";
      platformDist[v] = (platformDist[v] ?? 0) + 1;
    }

    // ── C/D. Proposed remapping ───────────────────────────────────────────────
    const remapGroups = {};    // key: "OLD → NEW_METHOD / NEW_PLATFORM"
    const anomalies = [];
    const unknownDomains = {}; // bare-domain fallbacks (not in registry, not "direct")
    let skipCount = 0;
    let remapCount = 0;
    let unknownCount = 0;

    for (const row of rows) {
      const proposal = proposeRemap(row.sourceMethod, row.sourceUrl);

      if (proposal.action === "skip") {
        skipCount++;
        continue;
      }

      if (proposal.action === "unknown") {
        unknownCount++;
        anomalies.push({
          id: row.id,
          reason: `Unknown sourceMethod value: "${row.sourceMethod}"`,
          sourceUrl: row.sourceUrl,
          rawTitle: row.rawTitle,
        });
        continue;
      }

      // remap
      remapCount++;
      const key = `${row.sourceMethod} → ${proposal.newMethod} / ${proposal.newPlatform}`;
      if (!remapGroups[key]) remapGroups[key] = { samples: [], count: 0, newMethod: proposal.newMethod, newPlatform: proposal.newPlatform };
      remapGroups[key].count++;
      if (remapGroups[key].samples.length < 3) {
        remapGroups[key].samples.push({ id: row.id, sourceUrl: row.sourceUrl, rawTitle: row.rawTitle });
      }

      // Anomaly detection
      const rowAnomalies = detectAnomalies(row, proposal);
      for (const reason of rowAnomalies) {
        anomalies.push({ id: row.id, reason, sourceUrl: row.sourceUrl, rawTitle: row.rawTitle });
      }

      // Unknown domain tracking
      if (proposal.newPlatform && proposal.newPlatform !== "direct" && !REGISTERED_PLATFORMS.has(proposal.newPlatform)) {
        unknownDomains[proposal.newPlatform] = (unknownDomains[proposal.newPlatform] ?? 0) + 1;
      }
    }

    // ── PRINT ─────────────────────────────────────────────────────────────────

    console.log("=".repeat(70));
    console.log("P4B BACKFILL AUDIT — VALUE REMAPPING (READ ONLY)");
    console.log("=".repeat(70));
    console.log(`Total SavedItem rows: ${total}`);
    console.log(`  Already canonical (skip): ${skipCount}`);
    console.log(`  Need remapping:           ${remapCount}`);
    console.log(`  Unknown value (flag):     ${unknownCount}`);
    console.log("");

    // A. Current sourceMethod distribution
    console.log("A. CURRENT sourceMethod DISTRIBUTION");
    console.log("-".repeat(50));
    for (const [v, cnt] of Object.entries(methodDist).sort((a, b) => b[1] - a[1])) {
      const tag = CANONICAL_METHODS.has(v) ? " ✓ canonical" : v === "(null)" ? " — null" : " ← legacy";
      console.log(`  ${String(cnt).padStart(5)}  ${v}${tag}`);
    }
    console.log("");

    // B. Current sourcePlatform distribution
    console.log("B. CURRENT sourcePlatform DISTRIBUTION");
    console.log("-".repeat(50));
    for (const [v, cnt] of Object.entries(platformDist).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(cnt).padStart(5)}  ${v}`);
    }
    console.log("");

    // C. Proposed remapping grouped
    console.log("C. PROPOSED REMAPPING (grouped by old → new)");
    console.log("-".repeat(70));
    const sortedGroups = Object.entries(remapGroups).sort((a, b) => b[1].count - a[1].count);
    for (const [key, grp] of sortedGroups) {
      console.log(`  ${String(grp.count).padStart(5)}  ${key}`);
    }
    console.log(`  ${"-".repeat(5)}`);
    console.log(`  ${String(remapCount).padStart(5)}  TOTAL`);
    console.log("");

    // D. Sample rows per group
    console.log("D. SAMPLE ROWS PER GROUP (up to 3 each)");
    console.log("=".repeat(70));
    for (const [key, grp] of sortedGroups) {
      console.log(`\n[${key}]  (${grp.count} rows)`);
      for (const s of grp.samples) {
        const title = s.rawTitle ? s.rawTitle.slice(0, 40) : "(no title)";
        const url = s.sourceUrl
          ? (s.sourceUrl.length > 55 ? s.sourceUrl.slice(0, 52) + "..." : s.sourceUrl)
          : "(no sourceUrl)";
        console.log(`  ${s.id}`);
        console.log(`    title: ${title}`);
        console.log(`    url:   ${url}`);
      }
    }
    console.log("");

    // E. Anomalies
    console.log("E. ANOMALIES");
    console.log("=".repeat(70));
    if (anomalies.length === 0) {
      console.log("  None.");
    } else {
      for (const a of anomalies) {
        console.log(`  [${a.id}]`);
        console.log(`    reason:    ${a.reason}`);
        console.log(`    rawTitle:  ${a.rawTitle ? a.rawTitle.slice(0, 60) : "(null)"}`);
        console.log(`    sourceUrl: ${a.sourceUrl ?? "(null)"}`);
      }
    }
    console.log("");

    // F. Unknown domain list
    console.log("F. UNKNOWN DOMAINS (bare-hostname fallback — not in registry)");
    console.log("-".repeat(50));
    const unknownDomainEntries = Object.entries(unknownDomains).sort((a, b) => b[1] - a[1]);
    if (unknownDomainEntries.length === 0) {
      console.log("  None — all platforms resolved to registry entries or 'direct'.");
    } else {
      for (const [domain, cnt] of unknownDomainEntries) {
        console.log(`  ${String(cnt).padStart(5)}  ${domain}`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("AUDIT COMPLETE — no writes performed.");
    console.log("=".repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
