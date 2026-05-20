/**
 * Verification: budget fix + graderRanAt guarantee.
 * 5 x Rome/walking/family_kids/8hr (primary persona, was 50% 504)
 * 1 x Tokyo/walking/solo/1hr (fast 2-stop, regression control)
 * 1 x NYC/transit/adults/8hr (healthy 8-stop, regression control)
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
  // 5 primary-persona runs — was 50% 504 before fix
  { label: "Rome-1", body: { prompt: "parks and gelato with the kids", destinationCity: "Rome, Italy", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "family_kids", inputVibe: ["parks_play", "sweets"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
  { label: "Rome-2", body: { prompt: "parks and gelato with the kids", destinationCity: "Rome, Italy", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "family_kids", inputVibe: ["parks_play", "sweets"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
  { label: "Rome-3", body: { prompt: "parks and gelato with the kids", destinationCity: "Rome, Italy", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "family_kids", inputVibe: ["parks_play", "sweets"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
  { label: "Rome-4", body: { prompt: "parks and gelato with the kids", destinationCity: "Rome, Italy", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "family_kids", inputVibe: ["parks_play", "sweets"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
  { label: "Rome-5", body: { prompt: "parks and gelato with the kids", destinationCity: "Rome, Italy", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "family_kids", inputVibe: ["parks_play", "sweets"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
  // Regression: fast 2-stop (should pass normally, no budget skip)
  { label: "REG-Tokyo-1hr", body: { prompt: "best coffee in Tokyo", destinationCity: "Tokyo, Japan", transport: "Walking", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "solo", inputVibe: [], inputDurationHr: 1, inputStartPoint: null, durationLabel: "1 hour" } },
  // Regression: healthy 8-stop transit (should pass normally, no budget skip)
  { label: "REG-NYC-8hr", body: { prompt: "food markets and culture", destinationCity: "New York City, USA", transport: "Metro / Transit", familyProfileId: "cmmmv15y7000104jvocfz5kt6", inputGroup: "adults_only", inputVibe: ["food_markets", "culture"], inputDurationHr: 8, inputStartPoint: null, durationLabel: "Full day (8 hrs)" } },
];

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 2400 }),
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
const testStart = Date.now();

for (const tc of CASES) {
  const start = Date.now();
  console.log(`\nSTART label="${tc.label}" t=${new Date(start).toISOString()}`);
  try {
    const res = await fetch(`${BASE_URL}/api/tours/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieStr },
      body: JSON.stringify(tc.body),
      signal: AbortSignal.timeout(130_000),
    });
    const elapsed = Date.now() - start;
    const requestId = res.headers.get("x-vercel-id") ?? "?";
    if (!res.ok) {
      const text = await res.text();
      console.log(`ERROR label="${tc.label}" status=${res.status} elapsed=${elapsed}ms body=${text.slice(0, 200)}`);
      results.push({ label: tc.label, tourId: null, stops: "?", elapsed, httpStatus: res.status, requestId, error: true });
    } else {
      const data = await res.json();
      const stops = Array.isArray(data.stops) ? data.stops.length : "?";
      const tourId = data.tourId ?? "?";
      console.log(`DONE label="${tc.label}" tourId=${tourId} stops=${stops} elapsed=${elapsed}ms requestId=${requestId}`);
      results.push({ label: tc.label, tourId, stops, elapsed, httpStatus: 200, requestId, error: false });
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    console.log(`FETCH_ERROR label="${tc.label}" elapsed=${elapsed}ms msg="${e.message}"`);
    results.push({ label: tc.label, tourId: null, stops: "?", elapsed, httpStatus: "FETCH_ERR", requestId: "?", error: true });
  }
}

console.log("\n=== SUMMARY ===");
for (const r of results) {
  console.log(`${r.label}: tourId=${r.tourId ?? "null"} stops=${r.stops} elapsed=${r.elapsed}ms HTTP=${r.httpStatus}${r.error ? " ERROR" : ""}`);
}

// DB query IDs for post-run verification
const tourIds = results.filter(r => r.tourId && r.tourId !== "?").map(r => r.tourId);
console.log("\n=== TOUR IDs FOR DB VERIFICATION ===");
console.log(JSON.stringify(tourIds));
console.log(`TEST_WINDOW_START=${new Date(testStart).toISOString()}`);
console.log("ALL_DONE");
