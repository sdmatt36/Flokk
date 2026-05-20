/**
 * scripts/diagnose-grader-timing.mjs
 *
 * Generates 5 diverse tours to exercise the [grader-timing] instrumentation,
 * then fetches Vercel runtime logs for each invocation and parses the timing lines.
 *
 * Usage:
 *   VERCEL_TOKEN=<token> node scripts/diagnose-grader-timing.mjs
 */

import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const BASE_URL = "https://www.flokktravel.com";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

if (!CLERK_SECRET_KEY) { console.error("FATAL: CLERK_SECRET_KEY missing"); process.exit(1); }
if (!ADMIN_CLERK_USER_ID) { console.error("FATAL: ADMIN_CLERK_USER_ID missing"); process.exit(1); }
if (!VERCEL_TOKEN) { console.error("FATAL: VERCEL_TOKEN missing"); process.exit(1); }

const VERCEL_PROJECT_ID = "prj_fritx8awanGgtgzZROnJuvWma6NQ";
const VERCEL_TEAM_ID = "team_jHh2sKJcvDWsLcBc7Eil9YzM";

// ── 5 diverse cases ────────────────────────────────────────────────────────────
const CASES = [
  {
    label: "1-hour fast (2 stops, likely single-pass)",
    body: {
      prompt: "best coffee in Tokyo",
      destinationCity: "Tokyo, Japan",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "solo",
      inputVibe: [],
      inputDurationHr: 1,
      inputStartPoint: null,
      durationLabel: "1 hour",
    },
  },
  {
    label: "Half-day standard (6 stops, likely single-pass pass)",
    body: {
      prompt: "parks and gelato with the kids",
      destinationCity: "Rome, Italy",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "family_kids",
      inputVibe: ["parks_play", "sweets"],
      inputDurationHr: 4,
      inputStartPoint: null,
      durationLabel: "",
    },
  },
  {
    label: "Full day large city (8 stops, likely fill passes)",
    body: {
      prompt: "food markets, culture, and architecture",
      destinationCity: "New York City, USA",
      transport: "Metro / Transit",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "adults_only",
      inputVibe: ["food_markets", "culture"],
      inputDurationHr: 8,
      inputStartPoint: null,
      durationLabel: "Full day (8 hrs)",
    },
  },
  {
    label: "Regen-likely (conflict: vegetarian + ramen)",
    body: {
      prompt: "best ramen for vegetarians",
      destinationCity: "Tokyo, Japan",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "family_kids",
      inputVibe: [],
      inputDurationHr: null,
      inputStartPoint: null,
      durationLabel: "",
    },
  },
  {
    label: "Scotland car tour GEO-likely (triggers GEO_INCOHERENT check)",
    body: {
      prompt: "castles and whisky distilleries across the Highlands",
      destinationCity: "Scotland, UK",
      transport: "Car or Taxi",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "adults_only",
      inputVibe: ["culture"],
      inputDurationHr: 8,
      inputStartPoint: null,
      durationLabel: "Full day (8 hrs)",
    },
  },
];

// ── Auth ───────────────────────────────────────────────────────────────────────
async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 900 }),
  });
  if (!res.ok) throw new Error(`Clerk token mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`Missing url in Clerk response`);
  return data.url;
}

async function getSessionCookies() {
  console.log("  Minting Clerk sign-in token...");
  const ticketUrl = await mintSignInToken();
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  if (!clerkTicket) throw new Error(`No __clerk_ticket in: ${ticketUrl}`);

  const appSignInUrl = `${BASE_URL}/sign-in?__clerk_ticket=${clerkTicket}`;
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(appSignInUrl, { waitUntil: "load", timeout: 45000 });
    try { await page.waitForURL(url => !url.pathname.includes("/sign-in"), { timeout: 25000 }); } catch { }
    await page.waitForTimeout(2000);
    const cookies = await ctx.cookies();
    const sessionCookie = cookies.find(c => c.name === "__session");
    if (!sessionCookie) throw new Error(`__session cookie absent`);
    return cookies;
  } finally {
    await browser.close();
  }
}

function cookieHeader(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

// ── Generate ───────────────────────────────────────────────────────────────────
async function runGenerate(body, cookieStr) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/tours/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieStr },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const elapsed = Date.now() - start;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generate returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return { tourId: data.tourId, stops: Array.isArray(data.stops) ? data.stops.length : 0, elapsed };
}

// ── Vercel logs ────────────────────────────────────────────────────────────────
async function fetchVercelRuntimeLogs(since, until) {
  const url = new URL(`https://api.vercel.com/v1/projects/${VERCEL_PROJECT_ID}/deployments/current/logs`);
  url.searchParams.set("teamId", VERCEL_TEAM_ID);
  url.searchParams.set("since", String(since));
  url.searchParams.set("until", String(until));
  url.searchParams.set("limit", "500");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) {
    console.warn(`  [Vercel logs] ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.logs) ? data.logs : [];
}

function parseGraderTimingLines(logs, tourId) {
  const lines = logs
    .map(l => l.text ?? l.message ?? "")
    .filter(l => l.includes("[grader-timing]") && l.includes(tourId));
  const parsed = {};
  for (const line of lines) {
    const phase = line.match(/phase=(\S+)/)?.[1];
    if (!phase) continue;
    const ms = line.match(/\bms=(\d+)/)?.[1];
    const total = line.match(/total_elapsed_ms=(\d+)/)?.[1];
    const committed = line.match(/committed=(true|false)/)?.[1];
    const score = line.match(/\bscore=(\d+)/)?.[1];
    const regen = line.match(/regenerate=(true|false)/)?.[1];
    parsed[phase] = { ms: ms ? parseInt(ms) : null, total: total ? parseInt(total) : null, committed, score, regen };
  }
  const hasFunctionTimeout = logs.some(l => (l.text ?? l.message ?? "").includes("Task timed out") || (l.text ?? l.message ?? "").toLowerCase().includes("function timed out"));
  return { phases: parsed, hasFunctionTimeout };
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log("\n=== GRADER TIMING DIAGNOSIS ===\n");

let cookies;
try {
  cookies = await getSessionCookies();
  console.log("  Auth OK\n");
} catch (e) {
  console.error("Auth failed:", e.message);
  process.exit(1);
}

const cookieStr = cookieHeader(cookies);
const results = [];

for (const tc of CASES) {
  console.log(`\n── ${tc.label}`);
  const tBefore = Date.now();
  try {
    const { tourId, stops, elapsed } = await runGenerate(tc.body, cookieStr);
    const tAfter = Date.now();

    console.log(`   tourId=${tourId} stops=${stops} elapsed=${elapsed}ms`);

    // Wait 5s for fire-and-forget write to land
    console.log("   Waiting 5s for write to settle...");
    await new Promise(r => setTimeout(r, 5000));

    // Fetch Vercel logs from the request window (with buffer)
    const logs = await fetchVercelRuntimeLogs(tBefore - 5000, tAfter + 10000);
    const { phases, hasFunctionTimeout } = parseGraderTimingLines(logs, tourId);

    const writeCommitted = phases["write_committed"] ? "YES" : (phases["write_failed"] ? "NO" : "unknown");
    const handlerMs = phases["handler_returning"]?.total ?? null;
    const writeStartMs = phases["write_start"]?.total ?? null;
    const writeCommitMs = phases["write_committed"]?.total ?? null;
    const budgetAtWrite = writeStartMs !== null ? 120000 - writeStartMs : null;

    console.log(`   generation_ms=${phases["generation_complete"]?.ms ?? "?"} grade1_ms=${phases["grade1_complete"]?.ms ?? "?"} score=${phases["grade1_complete"]?.score ?? "?"} regenerate=${phases["grade1_complete"]?.regen ?? "?"}`);
    if (phases["regen_start"]) console.log(`   regen_ms=${phases["grade2_complete"]?.ms ?? "?"} grade2_score=${phases["grade2_complete"]?.score ?? "?"}`);
    console.log(`   write_committed=${writeCommitted} handler_ms=${handlerMs} write_start_ms=${writeStartMs} budget_at_write_ms=${budgetAtWrite}`);
    if (writeCommitMs && handlerMs) {
      const lag = writeCommitMs - handlerMs;
      console.log(`   write_vs_handler: write committed ${lag > 0 ? lag + "ms AFTER" : Math.abs(lag) + "ms before"} handler returned`);
    }
    if (hasFunctionTimeout) console.log("   *** Vercel: FUNCTION TIMEOUT DETECTED ***");

    results.push({ label: tc.label, tourId, stops, elapsed, phases, writeCommitted, budgetAtWrite, hasFunctionTimeout });
  } catch (e) {
    console.error(`   ERROR: ${e.message}`);
    results.push({ label: tc.label, error: e.message });
  }
}

// ── Summary table ───────────────────────────────────────────────────────────────
console.log("\n\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║              GRADER TIMING — DIAGNOSIS RESULTS                        ║");
console.log("╠══════════════════════════════════════════════════════════════════════════╣\n");
console.log(`${"Case".padEnd(45)} ${"TotalMs".padStart(8)} ${"GenMs".padStart(7)} ${"Grade1Ms".padStart(9)} ${"Regen?".padStart(7)} ${"Budget@Write".padStart(13)} ${"WriteOK?".padStart(9)}`);
console.log("─".repeat(110));

for (const r of results) {
  if (r.error) { console.log(`${r.label.padEnd(45)} ERROR: ${r.error}`); continue; }
  const { phases } = r;
  const row = [
    r.label.slice(0, 44).padEnd(45),
    String(r.elapsed).padStart(8),
    String(phases["generation_complete"]?.ms ?? "?").padStart(7),
    String(phases["grade1_complete"]?.ms ?? "?").padStart(9),
    (phases["regen_start"] ? "YES" : "no").padStart(7),
    String(r.budgetAtWrite !== null ? r.budgetAtWrite + "ms" : "?").padStart(13),
    r.writeCommitted.padStart(9),
  ];
  console.log(row.join(" "));
}
