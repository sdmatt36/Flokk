/**
 * Verify two tour-generation fixes shipped in commit 8ca9d93:
 * 1. Start-point pinning: named start point must be Stop 1 after route optimization
 * 2. Kids stop-count cap: family_kids 8hr tour must have ≤ 6 stops
 *
 * Runs 3 live API calls against flokktravel.com (Greene profile).
 * Queries DB directly for graderStatus, stop count, stop names, bathroom mentions.
 */
import { chromium } from "playwright";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const GREENE_CLERK_USER_ID = "user_3B68dQIbRRU8GZnMcSaoJwBg9GS";
const BASE_URL = "https://www.flokktravel.com";
const SEOUL_TRIP_ID = "cmmx6428k000004jlxgel7s86";

// ── Auth ─────────────────────────────────────────────────────────────────────
async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: GREENE_CLERK_USER_ID, expires_in_seconds: 300 }),
  });
  if (!res.ok) throw new Error(`Clerk mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`No url in response: ${JSON.stringify(data)}`);
  return data.url;
}

async function getSessionCookies() {
  const ticketUrl = await mintSignInToken();
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${clerkTicket}`, { waitUntil: "load", timeout: 45000 });
    try { await page.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 }); } catch {}
    await page.waitForTimeout(2000);
    const cookies = await ctx.cookies();
    if (!cookies.find(c => c.name === "__session")) throw new Error("No __session cookie");
    return cookies;
  } finally { await browser.close(); }
}

// ── Generate ─────────────────────────────────────────────────────────────────
async function generateTour(cookieStr, params) {
  const res = await fetch(`${BASE_URL}/api/tours/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieStr },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(110_000),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── DB query ──────────────────────────────────────────────────────────────────
async function queryTour(client, tourId) {
  const tourRes = await client.query(
    `SELECT "graderStatus", "graderScore", "graderFlags" FROM "GeneratedTour" WHERE id = $1`,
    [tourId]
  );
  const stopsRes = await client.query(
    `SELECT name, "orderIndex", "familyNote" FROM "TourStop"
     WHERE "tourId" = $1 AND "deletedAt" IS NULL ORDER BY "orderIndex" ASC`,
    [tourId]
  );
  return { tour: tourRes.rows[0], stops: stopsRes.rows };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("Minting Greene Clerk session...");
const cookies = await getSessionCookies();
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
console.log("AUTH_OK\n");

const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
await dbClient.connect();

const results = [];

// ── Test 1: family_kids, 8hr, named start = "Gyeongbokgung Palace" ────────────
console.log("=== TEST 1: family_kids 8hr, start = Gyeongbokgung Palace ===");
const t1 = await generateTour(cookieStr, {
  prompt: "A full day of Seoul highlights for the family",
  destinationCity: "Seoul, South Korea",
  tripId: SEOUL_TRIP_ID,
  transport: "Walking",
  inputVibe: ["culture", "kids_and_family"],
  inputGroup: "family_kids",
  durationLabel: "Full day (8 hrs)",
  inputStartPoint: "Gyeongbokgung Palace",
});
console.log(`HTTP ${t1.status}`);

if (t1.status === 200 && t1.body?.tourId) {
  const { tour, stops } = await queryTour(dbClient, t1.body.tourId);
  const stop1 = stops[0];
  const bathroomRe = /restroom|bathroom|toilet|WC|facilities/i;
  const hasBathroom = stops.some(s => bathroomRe.test(s.familyNote ?? ""));
  const startMatch = stop1?.name?.toLowerCase().includes("gyeongbok") || "gyeongbokgung".includes((stop1?.name ?? "").toLowerCase().slice(0, 8));
  const namedStopIdx = stops.findIndex(s => s.name?.toLowerCase().includes("gyeongbok"));

  console.log(`tourId: ${t1.body.tourId}`);
  console.log(`Stop count: ${stops.length}`);
  console.log(`Stop 1 (orderIndex 0): "${stop1?.name}"`);
  console.log(`Named start point position: ${namedStopIdx === -1 ? "NOT FOUND" : `position ${namedStopIdx} (0-indexed)`}`);
  console.log(`graderStatus: ${tour?.graderStatus}`);
  console.log(`Bathroom mention present: ${hasBathroom}`);
  console.log(`All stops: ${stops.map((s, i) => `[${i}] ${s.name}`).join(", ")}`);
  results.push({ test: "TEST 1 (family_kids 8hr + start-point)", tourId: t1.body.tourId, stopCount: stops.length, stop1: stop1?.name, namedStopIdx, graderStatus: tour?.graderStatus, hasBathroom });
} else {
  console.log(`FAILED: ${JSON.stringify(t1.body)?.slice(0, 300)}`);
  results.push({ test: "TEST 1", error: t1.body });
}

console.log();

// ── Test 2: couple, 8hr (no start point) — regression check for non-kids ─────
console.log("=== TEST 2: couple 8hr, no start point (non-kids regression) ===");
const t2 = await generateTour(cookieStr, {
  prompt: "A full day exploring Seoul for two",
  destinationCity: "Seoul, South Korea",
  tripId: SEOUL_TRIP_ID,
  transport: "Walking",
  inputVibe: ["culture", "food_and_drink"],
  inputGroup: "couple",
  durationLabel: "Full day (8 hrs)",
});
console.log(`HTTP ${t2.status}`);

if (t2.status === 200 && t2.body?.tourId) {
  const { tour, stops } = await queryTour(dbClient, t2.body.tourId);
  console.log(`tourId: ${t2.body.tourId}`);
  console.log(`Stop count: ${stops.length} (expected ~8)`);
  console.log(`graderStatus: ${tour?.graderStatus}`);
  console.log(`All stops: ${stops.map((s, i) => `[${i}] ${s.name}`).join(", ")}`);
  results.push({ test: "TEST 2 (couple 8hr, no start)", tourId: t2.body.tourId, stopCount: stops.length, graderStatus: tour?.graderStatus });
} else {
  console.log(`FAILED: ${JSON.stringify(t2.body)?.slice(0, 300)}`);
  results.push({ test: "TEST 2", error: t2.body });
}

console.log();

// ── Test 3: family_kids, 8hr, start = "Namsan Tower" (second start-point check)
console.log("=== TEST 3: family_kids 8hr, start = Namsan Tower ===");
const t3 = await generateTour(cookieStr, {
  prompt: "Family fun day in Seoul with kids",
  destinationCity: "Seoul, South Korea",
  tripId: SEOUL_TRIP_ID,
  transport: "Walking",
  inputVibe: ["kids_and_family", "nature_and_outdoors"],
  inputGroup: "family_kids",
  durationLabel: "Full day (8 hrs)",
  inputStartPoint: "Namsan Tower",
});
console.log(`HTTP ${t3.status}`);

if (t3.status === 200 && t3.body?.tourId) {
  const { tour, stops } = await queryTour(dbClient, t3.body.tourId);
  const stop1 = stops[0];
  const namedStopIdx = stops.findIndex(s => s.name?.toLowerCase().includes("namsan"));
  const bathroomRe = /restroom|bathroom|toilet|WC|facilities/i;
  const hasBathroom = stops.some(s => bathroomRe.test(s.familyNote ?? ""));
  console.log(`tourId: ${t3.body.tourId}`);
  console.log(`Stop count: ${stops.length}`);
  console.log(`Stop 1 (orderIndex 0): "${stop1?.name}"`);
  console.log(`Named start point position: ${namedStopIdx === -1 ? "NOT FOUND" : `position ${namedStopIdx} (0-indexed)`}`);
  console.log(`graderStatus: ${tour?.graderStatus}`);
  console.log(`Bathroom mention present: ${hasBathroom}`);
  console.log(`All stops: ${stops.map((s, i) => `[${i}] ${s.name}`).join(", ")}`);
  results.push({ test: "TEST 3 (family_kids 8hr + Namsan start)", tourId: t3.body.tourId, stopCount: stops.length, stop1: stop1?.name, namedStopIdx, graderStatus: tour?.graderStatus, hasBathroom });
} else {
  console.log(`FAILED: ${JSON.stringify(t3.body)?.slice(0, 300)}`);
  results.push({ test: "TEST 3", error: t3.body });
}

await dbClient.end();

console.log("\n=== SUMMARY ===");
for (const r of results) {
  console.log(JSON.stringify(r, null, 2));
}
console.log("DONE");
