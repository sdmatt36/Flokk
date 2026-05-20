/**
 * Latency diagnosis: 6 tours spanning short/multi-pass/regen range.
 * Captures tourIds for Vercel log pull.
 */
import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });

const BASE_URL = "https://www.flokktravel.com";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID;

const CASES = [
  // ── SHORT / SINGLE-PASS (targetStops=2, durationHr=1) ──────────────────
  {
    label: "A: short-1hr Tokyo coffee solo",
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
    label: "B: short-1hr Lisbon pastéis solo",
    body: {
      prompt: "best pastéis de nata and coffee in Lisbon",
      destinationCity: "Lisbon, Portugal",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "couple",
      inputVibe: ["sweets"],
      inputDurationHr: 1,
      inputStartPoint: null,
      durationLabel: "1 hour",
    },
  },
  // ── MULTI-PASS FILL (targetStops=8, durationHr=8) ────────────────────────
  {
    label: "C: full-day-8hr NYC food+culture transit",
    body: {
      prompt: "food markets and culture",
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
    label: "D: full-day-8hr Rome parks+gelato family",
    body: {
      prompt: "parks and gelato with the kids",
      destinationCity: "Rome, Italy",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "family_kids",
      inputVibe: ["parks_play", "sweets"],
      inputDurationHr: 8,
      inputStartPoint: null,
      durationLabel: "Full day (8 hrs)",
    },
  },
  // ── REGEN-LIKELY ──────────────────────────────────────────────────────────
  {
    label: "E: regen-likely vegetarian ramen kids Tokyo",
    body: {
      prompt: "best ramen for vegetarians with kids",
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
    label: "F: regen-likely Scotland castles+whisky car 8hr",
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

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 1800 }),
  });
  const data = await res.json();
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
    try { await page.waitForURL(url => !url.pathname.includes("/sign-in"), { timeout: 25000 }); } catch { }
    await page.waitForTimeout(2000);
    const cookies = await ctx.cookies();
    if (!cookies.find(c => c.name === "__session")) throw new Error("no __session cookie");
    return cookies;
  } finally { await browser.close(); }
}

const cookies = await getSessionCookies();
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
console.log("AUTH_OK");

const results = [];

for (const tc of CASES) {
  const start = Date.now();
  console.log(`\nCASE_START label="${tc.label}" t=${new Date(start).toISOString()}`);
  try {
    const res = await fetch(`${BASE_URL}/api/tours/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieStr },
      body: JSON.stringify(tc.body),
      signal: AbortSignal.timeout(220_000),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      console.log(`CASE_ERROR label="${tc.label}" status=${res.status} elapsed=${elapsed}ms body=${text.slice(0, 200)}`);
      results.push({ label: tc.label, tourId: null, stops: "?", elapsed, error: true });
      continue;
    }
    const requestId = res.headers.get("x-vercel-id") ?? res.headers.get("x-request-id") ?? "?";
    const data = await res.json();
    const stops = Array.isArray(data.stops) ? data.stops.length : "?";
    const tourId = data.tourId ?? "?";
    console.log(`CASE_DONE label="${tc.label}" tourId=${tourId} stops=${stops} elapsed=${elapsed}ms requestId=${requestId}`);
    results.push({ label: tc.label, tourId, stops, elapsed, requestId });
  } catch (e) {
    const elapsed = Date.now() - start;
    console.log(`CASE_ERROR label="${tc.label}" error="${e.message}" elapsed=${elapsed}ms`);
    results.push({ label: tc.label, tourId: null, stops: "?", elapsed, error: true });
  }
}

console.log("\n=== TOUR ID SUMMARY ===");
for (const r of results) {
  console.log(`${r.label}: tourId=${r.tourId} stops=${r.stops} elapsed=${r.elapsed}ms requestId=${r.requestId ?? "?"}${r.error ? " ERROR" : ""}`);
}
console.log("ALL_DONE");
