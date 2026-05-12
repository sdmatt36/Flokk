// Wave 2 retry — 9 cities that errored or were never attempted in the original batch
// Run: node scripts/run-wave-2-retry.mjs
// Requires .env.local with CRON_SECRET set
import fs from "node:fs";

// Load .env.local manually (dotenv ESM compat)
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
  console.error("CRON_SECRET not found in .env.local — cannot authenticate");
  process.exit(1);
}

const BASE = "https://www.flokktravel.com";
const LOG_FILE = "/tmp/wave-2-retry.log";
const SLEEP_MS = 60_000;

const CITIES = [
  { slug: "iguazu-falls", reason: "errored" },
  { slug: "santiago",     reason: "errored" },
  { slug: "bogota",       reason: "errored" },
  { slug: "lima",         reason: "never attempted" },
  { slug: "quito",        reason: "never attempted" },
  { slug: "toronto",      reason: "never attempted" },
  { slug: "vancouver",    reason: "never attempted" },
  { slug: "montreal",     reason: "never attempted" },
  { slug: "quebec-city",  reason: "never attempted" },
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

fs.writeFileSync(LOG_FILE, `Wave 2 Retry — started ${new Date().toISOString()}\nCities: ${CITIES.length}\n\n`);
log(`Starting Wave 2 retry: ${CITIES.length} cities, ${SLEEP_MS / 1000}s sleep between each`);
log(`Estimated duration: ~${Math.round((CITIES.length * (60 + SLEEP_MS / 1000)) / 60)} minutes`);
log(`Endpoint: ${BASE}/api/admin/generate-city-itinerary/{slug}`);
log("");

const results = [];
const batchStart = Date.now();

for (let i = 0; i < CITIES.length; i++) {
  const { slug, reason } = CITIES[i];
  const cityStart = Date.now();

  log(`[${i + 1}/${CITIES.length}] ${slug} (${reason})`);

  let httpStatus = 0;
  let body = {};
  try {
    const res = await fetch(`${BASE}/api/admin/generate-city-itinerary/${slug}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });
    httpStatus = res.status;
    body = await res.json();
  } catch (e) {
    body = { status: "error", error: e.message, tripId: null };
  }

  const elapsedSec = ((Date.now() - cityStart) / 1000).toFixed(1);
  const result = { slug, reason, httpStatus, elapsedSec, ...body };
  results.push(result);

  if (httpStatus === 200 && body.status === "success") {
    log(`  ✓ success | tripId=${body.tripId} | items=${body.savedItemCount} | enriched=${body.enrichedCount}/${body.savedItemCount} | hero=${!!body.heroImageUrl} | ${elapsedSec}s`);
  } else if (httpStatus === 200 && body.status === "skipped") {
    log(`  — skipped | ${body.skipReason} | tripId=${body.tripId}`);
  } else if (httpStatus === 401) {
    log(`  ✗ AUTH FAILED — CRON_SECRET rejected`);
  } else {
    log(`  ✗ error   | HTTP ${httpStatus} | ${body.error ?? JSON.stringify(body).slice(0, 100)}`);
  }

  // Watchdog: halt on 3 consecutive errors
  if (results.length >= 3) {
    const last3 = results.slice(-3);
    const allBad = last3.every((r) => r.status !== "success" && r.status !== "skipped");
    if (allBad) {
      log("");
      log("WATCHDOG: 3 consecutive errors — halting. Investigate before resuming.");
      log(`Last 3: ${last3.map((r) => `${r.slug}(HTTP ${r.httpStatus}):${r.error ?? r.status}`).join(" | ")}`);
      break;
    }
  }

  if (i < CITIES.length - 1) {
    log(`  sleeping ${SLEEP_MS / 1000}s...`);
    await sleep(SLEEP_MS);
  }
}

// Summary
const totalMinutes = ((Date.now() - batchStart) / 1000 / 60).toFixed(1);
const success = results.filter((r) => r.status === "success");
const skipped = results.filter((r) => r.status === "skipped");
const errored = results.filter((r) => r.status !== "success" && r.status !== "skipped");

log("");
log("═".repeat(64));
log("WAVE 2 RETRY COMPLETE");
log("═".repeat(64));
log(`Attempted : ${results.length} / ${CITIES.length}`);
log(`Success   : ${success.length}`);
log(`Skipped   : ${skipped.length}`);
log(`Errors    : ${errored.length}`);
log(`Elapsed   : ${totalMinutes} min`);
log("");
log("Per-city results:");
for (const r of results) {
  if (r.status === "success") {
    log(`  ✓ ${r.slug.padEnd(22)} tripId=${r.tripId}`);
  } else if (r.status === "skipped") {
    log(`  — ${r.slug.padEnd(22)} ${r.skipReason ?? "already exists"}`);
  } else {
    log(`  ✗ ${r.slug.padEnd(22)} HTTP ${r.httpStatus} — ${r.error ?? "unknown"}`);
  }
}

if (errored.length > 0) {
  log("");
  log("Errors requiring attention:");
  for (const r of errored) {
    log(`  ${r.slug}: HTTP ${r.httpStatus} — ${r.error}`);
  }
}

log("");
log(`Full log: ${LOG_FILE}`);
