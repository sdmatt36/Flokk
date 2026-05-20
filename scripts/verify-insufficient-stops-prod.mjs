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
  {
    label: "DEGENERATE — ramen for kids, null duration",
    body: {
      prompt: "best ramen for kids",
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
    label: "HEALTHY — best coffee in Tokyo, 4hr",
    body: {
      prompt: "best coffee in Tokyo",
      destinationCity: "Tokyo, Japan",
      transport: "Walking",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "solo",
      inputVibe: [],
      inputDurationHr: 4,
      inputStartPoint: null,
      durationLabel: "4 hours",
    },
  },
];

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 1200 }),
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
  console.log(`\nCASE_START label="${tc.label}"`);
  try {
    const res = await fetch(`${BASE_URL}/api/tours/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieStr },
      body: JSON.stringify(tc.body),
      signal: AbortSignal.timeout(200_000),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      console.log(`CASE_ERROR label="${tc.label}" status=${res.status} elapsed=${elapsed}ms body=${text.slice(0, 300)}`);
      results.push({ label: tc.label, tourId: null, stops: "?", flags: "?", score: "?", status: "HTTP_ERROR" });
      continue;
    }
    const data = await res.json();
    const stops = Array.isArray(data.stops) ? data.stops.length : "?";
    const tourId = data.tourId ?? data.id ?? "?";
    console.log(`CASE_DONE label="${tc.label}" tourId=${tourId} stops=${stops} elapsed=${elapsed}ms`);
    results.push({ label: tc.label, tourId, stops, elapsed });
  } catch (e) {
    console.log(`CASE_ERROR label="${tc.label}" error=${e.message}`);
    results.push({ label: tc.label, tourId: null, stops: "?", flags: "?", score: "?", status: "FETCH_ERROR" });
  }
}

console.log("\n=== TOUR IDs for DB query ===");
for (const r of results) {
  console.log(`${r.label}: tourId=${r.tourId} stops=${r.stops}`);
}
console.log("ALL_DONE");
