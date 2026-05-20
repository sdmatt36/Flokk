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

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 600 }),
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

const start = Date.now();
console.log(`CASE_START t=${new Date(start).toISOString()}`);
try {
  const res = await fetch(`${BASE_URL}/api/tours/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieStr },
    body: JSON.stringify({
      prompt: "castles and whisky distilleries across the Highlands",
      destinationCity: "Scotland, UK",
      transport: "Car or Taxi",
      familyProfileId: "cmmmv15y7000104jvocfz5kt6",
      inputGroup: "adults_only",
      inputVibe: ["culture"],
      inputDurationHr: 8,
      inputStartPoint: null,
      durationLabel: "Full day (8 hrs)",
    }),
    signal: AbortSignal.timeout(220_000),
  });
  const elapsed = Date.now() - start;
  const requestId = res.headers.get("x-vercel-id") ?? "?";
  if (!res.ok) {
    const text = await res.text();
    console.log(`ERROR status=${res.status} elapsed=${elapsed}ms requestId=${requestId} body=${text.slice(0, 200)}`);
  } else {
    const data = await res.json();
    console.log(`DONE tourId=${data.tourId} stops=${Array.isArray(data.stops) ? data.stops.length : "?"} elapsed=${elapsed}ms requestId=${requestId}`);
  }
} catch (e) {
  console.log(`ERROR ${e.message} elapsed=${Date.now() - start}ms`);
}
