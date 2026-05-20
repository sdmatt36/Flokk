/**
 * 504 diagnosis: 4x family+walking+full-day (8hr) Rome tour runs.
 * Captures tourIds and elapsed for post-run DB + log analysis.
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

const BODY = {
  prompt: "parks and gelato with the kids",
  destinationCity: "Rome, Italy",
  transport: "Walking",
  familyProfileId: "cmmmv15y7000104jvocfz5kt6",
  inputGroup: "family_kids",
  inputVibe: ["parks_play", "sweets"],
  inputDurationHr: 8,
  inputStartPoint: null,
  durationLabel: "Full day (8 hrs)",
};

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

for (let run = 1; run <= 4; run++) {
  const start = Date.now();
  console.log(`\nRUN ${run}/4 START t=${new Date(start).toISOString()}`);
  try {
    const res = await fetch(`${BASE_URL}/api/tours/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieStr },
      body: JSON.stringify(BODY),
      signal: AbortSignal.timeout(130_000),
    });
    const elapsed = Date.now() - start;
    const requestId = res.headers.get("x-vercel-id") ?? res.headers.get("x-request-id") ?? "?";
    if (!res.ok) {
      const text = await res.text();
      console.log(`RUN ${run} ERROR status=${res.status} elapsed=${elapsed}ms requestId=${requestId} body=${text.slice(0, 300)}`);
      results.push({ run, tourId: null, stops: "?", elapsed, status: res.status, requestId, error: true });
    } else {
      const data = await res.json();
      const stops = Array.isArray(data.stops) ? data.stops.length : "?";
      const tourId = data.tourId ?? "?";
      console.log(`RUN ${run} DONE tourId=${tourId} stops=${stops} elapsed=${elapsed}ms requestId=${requestId}`);
      results.push({ run, tourId, stops, elapsed, requestId, error: false });
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    const is504 = e.message?.includes("504") || e.message?.includes("timeout") || elapsed >= 120000;
    console.log(`RUN ${run} FETCH_ERROR elapsed=${elapsed}ms msg="${e.message}" likely504=${is504}`);
    results.push({ run, tourId: null, stops: "?", elapsed, error: true, likely504: is504, msg: e.message });
  }
}

console.log("\n=== 504 DIAGNOSIS SUMMARY ===");
for (const r of results) {
  const status = r.error ? (r.likely504 ? "LIKELY_504" : `HTTP_${r.status ?? "ERR"}`) : "OK";
  console.log(`Run ${r.run}: tourId=${r.tourId ?? "null"} stops=${r.stops} elapsed=${r.elapsed}ms status=${status} requestId=${r.requestId ?? "?"}`);
}
console.log("ALL_DONE");
