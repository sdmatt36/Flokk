/**
 * scripts/verify-regen-loop.mjs
 *
 * Exercises the grader's regeneration loop against the live production endpoint.
 * Generates NEW tours (does NOT mutate baseline rows).
 * Reports a before/after table: original score+flags → regen score+flags → kept/status.
 *
 * Usage:
 *   node scripts/verify-regen-loop.mjs
 */

import { chromium } from "playwright";
import pg from "pg";
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
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLERK_SECRET_KEY) { console.error("FATAL: CLERK_SECRET_KEY missing"); process.exit(1); }
if (!ADMIN_CLERK_USER_ID) { console.error("FATAL: ADMIN_CLERK_USER_ID missing"); process.exit(1); }
if (!DATABASE_URL) { console.error("FATAL: DATABASE_URL missing"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// ── Baseline rows — NEVER mutated ─────────────────────────────────────────────
const BASELINES = [
  {
    label: "Scotland GEO_INCOHERENT",
    id: "de7dff8a-817c-476a-b46d-15bc085dac86",
    originalScore: 58,
    originalFlags: ["GEO_INCOHERENT/high: Stop 6→7 139.4km exceeds 50km for Car or Taxi"],
    expectedRegen: true,
    body: {
      prompt: "day trip from edinburgh and ending in Aberlour, where we'll be staying. find some fun spots to stop at along the way, lunch included",
      destinationCity: "Scotland, UK",
      transport: "Car or Taxi",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: null,
      inputVibe: [],
      inputDurationHr: null,
      inputStartPoint: null,
      durationLabel: "",
    },
  },
  {
    label: "Tokyo ramen vegetarian conflict",
    id: "c3fa9567-2a95-4044-bdad-f99370402737",
    originalScore: 50,
    originalFlags: ["(none — judgment-only fail)"],
    expectedRegen: true,
    body: {
      prompt: "best ramen for kids",
      destinationCity: "Tokyo, Japan",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: null,
      inputVibe: [],
      inputDurationHr: null,
      inputStartPoint: null,
      durationLabel: "",
    },
  },
  {
    label: "Tokyo bites DUP_STOP x2",
    id: "a4c0c93f-9571-4970-936c-0a943f005890",
    originalScore: 68,
    originalFlags: ["DUP_STOP/high: KITTE+IMT 35m apart overlapping types", "DUP_STOP/high: stops 5+8 share placeId"],
    expectedRegen: true,
    body: {
      prompt: "fun experiential day with the kids. Great food. Cool sculptures.",
      destinationCity: "Tokyo, Japan",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "family_kids",
      inputVibe: ["food_markets", "culture", "adventure", "sweets", "family_paced"],
      inputDurationHr: 8,
      inputStartPoint: "Tokyo Station",
      durationLabel: "8 hours",
    },
  },
];

// ── Auth ───────────────────────────────────────────────────────────────────────
async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 600 }),
  });
  if (!res.ok) throw new Error(`Clerk token mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`Missing url in Clerk response: ${JSON.stringify(data)}`);
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
    console.log("  Navigating browser to establish session...");
    await page.goto(appSignInUrl, { waitUntil: "load", timeout: 45000 });
    try {
      await page.waitForURL(url => !url.pathname.includes("/sign-in"), { timeout: 25000 });
    } catch { /* redirect may not fire */ }
    await page.waitForTimeout(2000);

    const cookies = await ctx.cookies();
    const sessionCookie = cookies.find(c => c.name === "__session");
    if (!sessionCookie) {
      const found = cookies.map(c => c.name).join(", ") || "(none)";
      throw new Error(`__session cookie absent. Cookies: ${found}`);
    }
    console.log(`  Session established. Clerk cookies: ${cookies.filter(c => c.name.startsWith("__")).map(c => c.name).join(", ")}`);
    return cookies;
  } finally {
    await browser.close();
  }
}

function cookieHeader(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

// ── Generate call ──────────────────────────────────────────────────────────────
async function runGenerate(body, cookieStr) {
  console.log(`  POST /api/tours/generate (prompt: "${body.prompt.slice(0, 60)}"...)`);
  const start = Date.now();

  const res = await fetch(`${BASE_URL}/api/tours/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStr,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generate returned ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const stopCount = Array.isArray(data.stops) ? data.stops.length : "?";
  const grader = data.graderResult ? `score=${data.graderResult.score} status=${data.graderResult.status}` : "no grader result";
  console.log(`  Generate complete in ${elapsed}s → tourId=${data.tourId} stops_in_response=${stopCount} ${grader}`);
  if (stopCount === 0 || stopCount === "?") {
    console.log(`  WARN: Response body: partial=${data.partial} walkViolations=${data.walkViolations}`);
    console.log(`  WARN: graderResult=${JSON.stringify(data.graderResult)}`);
  }
  return data.tourId;
}

// ── DB lookup ──────────────────────────────────────────────────────────────────
async function fetchGraderRow(tourId) {
  const { rows } = await pool.query(`
    SELECT "graderScore", "graderStatus", "graderFlags", "graderRanAt"
    FROM "GeneratedTour"
    WHERE id = $1
  `, [tourId]);
  return rows[0] ?? null;
}

async function fetchStops(tourId) {
  const { rows } = await pool.query(`
    SELECT name, "placeId", lat, lng
    FROM "TourStop"
    WHERE "tourId" = $1 AND "deletedAt" IS NULL
    ORDER BY "orderIndex"
  `, [tourId]);
  return rows;
}

// ── Main ───────────────────────────────────────────────────────────────────────
const results = [];

console.log("\n=== GRADER REGENERATION LOOP VERIFICATION ===\n");
console.log("Baseline IDs are preserved — generating NEW tours.\n");

let cookies;
try {
  cookies = await getSessionCookies();
} catch (e) {
  console.error("Auth failed:", e.message);
  process.exit(1);
}

const cookieStr = cookieHeader(cookies);

for (const tc of BASELINES) {
  console.log(`\n── Case: ${tc.label} ─────────────────────────────`);
  console.log(`   Baseline ID: ${tc.id} (score=${tc.originalScore}, regen expected=${tc.expectedRegen})`);

  try {
    // Confirm baseline row is untouched
    const baseline = await fetchGraderRow(tc.id);
    if (!baseline) {
      console.warn("   WARNING: baseline row not found in DB!");
    } else {
      console.log(`   Baseline confirmed: score=${baseline.graderScore} status=${baseline.graderStatus}`);
    }

    const newTourId = await runGenerate(tc.body, cookieStr);

    // Poll up to 10s for grader fields to be persisted (fire-and-forget write)
    let graderRow = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      graderRow = await fetchGraderRow(newTourId);
      if (graderRow?.graderStatus !== null) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!graderRow) {
      console.error("   ERROR: New tour row not found after generate");
      results.push({ label: tc.label, error: "row not found" });
      continue;
    }

    const stops = await fetchStops(newTourId);
    const flags = Array.isArray(graderRow.graderFlags) ? graderRow.graderFlags : [];
    const flagSummary = flags.length > 0
      ? flags.map(f => `${f.code}/${f.severity}`).join(", ")
      : "(none)";

    const regenFired = ["regenerated_pass", "low_confidence"].includes(graderRow.graderStatus) && tc.expectedRegen
      // low_confidence is used for both regen-kept-original and regen-kept-regen-but-low
      // we need the Vercel logs to distinguish, but status is the signal
      ? true
      : graderRow.graderStatus === "regenerated_pass";

    console.log(`   New tour: id=${newTourId}`);
    console.log(`   Stops (${stops.length}): ${stops.slice(0, 4).map(s => s.name).join(" → ")}...`);
    console.log(`   Grader: score=${graderRow.graderScore} status=${graderRow.graderStatus} flags=[${flagSummary}]`);

    results.push({
      label: tc.label,
      newTourId,
      originalScore: tc.originalScore,
      originalFlags: tc.originalFlags.join("; "),
      newScore: graderRow.graderScore,
      newStatus: graderRow.graderStatus,
      newFlags: flagSummary,
      stops: stops.length,
    });

  } catch (e) {
    console.error(`   ERROR: ${e.message}`);
    results.push({ label: tc.label, error: e.message });
  }
}

await pool.end();

// ── Print table ────────────────────────────────────────────────────────────────
console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════╗");
console.log("║              GRADER REGENERATION VERIFICATION — RESULTS                    ║");
console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
console.log(`\n${"Case".padEnd(35)} ${"Orig".padStart(5)} ${"New".padStart(5)}  ${"Final Status".padEnd(25)} ${"New Flags"}`);
console.log("─".repeat(110));

for (const r of results) {
  if (r.error) {
    console.log(`${r.label.padEnd(35)} ERROR: ${r.error}`);
    continue;
  }
  const origStr = String(r.originalScore).padStart(5);
  const newStr = String(r.newScore ?? "?").padStart(5);
  const statusStr = (r.newStatus ?? "?").padEnd(25);
  console.log(`${r.label.padEnd(35)} ${origStr} ${newStr}  ${statusStr} ${r.newFlags}`);
}

console.log("\n─".repeat(110));
console.log("\nNotes:");
console.log("  - 'regenerated_pass': regen fired, grade2 >= 70, regen kept");
console.log("  - 'low_confidence': regen fired; either grade2 < 70 or grade2 < grade1 (original restored)");
console.log("  - 'pass': grade1 >= 70, regen did NOT fire (unexpected for these cases)");
console.log("  - Loop bound: ONE regen max, enforced by code (no loop — single conditional block)");
console.log("\nBaseline row IDs were NOT mutated. Check with:");
console.log("  SELECT id, \"graderStatus\", \"graderScore\" FROM \"GeneratedTour\"");
console.log("    WHERE id IN ('de7dff8a-...', 'c3fa9567-...', 'a4c0c93f-...');");
