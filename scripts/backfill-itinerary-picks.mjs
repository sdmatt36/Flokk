// Backfill: promote all isFlokkerExample SavedItems to CommunitySpot
// Run: node scripts/backfill-itinerary-picks.mjs
// Requires .env.local with CRON_SECRET set
import fs from "node:fs";

const envPath = new URL("../.env.local", import.meta.url).pathname;
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error("CRON_SECRET not found in .env.local");
  process.exit(1);
}

const BASE = "https://www.flokktravel.com";
const LOG_FILE = "/tmp/backfill-itinerary-picks.log";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

fs.writeFileSync(LOG_FILE, `Backfill itinerary picks — started ${new Date().toISOString()}\n\n`);
log("POSTing to /api/admin/backfill-itinerary-picks (maxDuration 300s)...");

const start = Date.now();
let body;
try {
  const res = await fetch(`${BASE}/api/admin/backfill-itinerary-picks`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
  });
  body = await res.json();
  if (res.status !== 200 || body.status !== "success") {
    log(`ERROR: HTTP ${res.status} — ${body.error ?? JSON.stringify(body).slice(0, 200)}`);
    process.exit(1);
  }
} catch (e) {
  log(`FATAL: ${e.message}`);
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

log(`Done in ${elapsed}s`);
log(`Total SavedItems processed : ${body.total}`);
log(`Created new CommunitySpots : ${body.created}`);
log(`Matched existing (dedup)   : ${body.matched}`);
log(`Skipped (missing name/city): ${body.skipped}`);
log(`Errors                     : ${body.errors}`);
log("");
log("Per-city breakdown (created / matched):");

const cities = Object.entries(body.perCity)
  .sort(([, a], [, b]) => (b.created + b.matched) - (a.created + a.matched));

for (const [city, counts] of cities) {
  log(`  ${city.padEnd(30)} created=${counts.created}  matched=${counts.matched}`);
}

log("");
log(`Full log: ${LOG_FILE}`);
