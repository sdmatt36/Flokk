/**
 * verify-places-suggest.mjs
 *
 * Mints a Clerk session, hits /api/places-suggest on the live production URL,
 * captures the full JSON response body, and grepping it for key-bearing patterns.
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(filename) {
  try {
    for (const line of readFileSync(join(root, filename), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* file missing — skip */ }
}

loadEnv(".env.local");
loadEnv(".env.production");

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID;
const BASE_URL = process.env.PREVIEW_URL || "https://flokktravel.com";

if (!CLERK_SECRET_KEY) { console.error("FATAL: CLERK_SECRET_KEY not found"); process.exit(1); }
if (!ADMIN_CLERK_USER_ID) { console.error("FATAL: ADMIN_CLERK_USER_ID not found"); process.exit(1); }

async function mintToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: ADMIN_CLERK_USER_ID, expires_in_seconds: 120 }),
  });
  const data = await res.json();
  if (!data.url) throw new Error(`Token mint failed: ${JSON.stringify(data)}`);
  return data.url;
}

async function main() {
  console.log(`Target: ${BASE_URL}/api/places-suggest`);
  console.log("Minting Clerk token...");
  const signInUrl = await mintToken();
  console.log("Token minted. Establishing session via Playwright...");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Navigate to app sign-in with the clerk ticket to establish session
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${new URL(signInUrl).searchParams.get("__clerk_ticket")}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find(c => c.name === "__session");
  if (!sessionCookie) {
    console.error("No __session cookie after sign-in. Cookies found:", cookies.map(c => c.name).join(", "));
    await browser.close();
    process.exit(1);
  }
  console.log(`Session established. Cookies: ${cookies.map(c => c.name).join(", ")}`);

  // Hit places-suggest using the request context (cookies included automatically)
  console.log("\nPOST /api/places-suggest { query: 'ICHIRAN', city: 'Tokyo', country: 'Japan' }");
  const apiResponse = await ctx.request.post(`${BASE_URL}/api/places-suggest`, {
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ query: "ICHIRAN", city: "Tokyo", country: "Japan" }),
  });
  const response = { status: apiResponse.status(), body: await apiResponse.text() };

  console.log(`\nHTTP status: ${response.status}`);
  console.log(`Response body:\n${response.body}`);

  // Grep checks
  const body = response.body;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
  const hasGoogleUrl = body.includes("maps.googleapis.com");
  const hasKeyParam = body.includes("key=");
  const hasActualKey = GOOGLE_MAPS_API_KEY && body.includes(GOOGLE_MAPS_API_KEY);

  console.log("\n--- Grep results ---");
  console.log(`maps.googleapis.com present: ${hasGoogleUrl ? "YES *** FAIL ***" : "NO ✓"}`);
  console.log(`'key=' present:              ${hasKeyParam  ? "YES *** FAIL ***" : "NO ✓"}`);
  console.log(`actual API key present:      ${hasActualKey ? "YES *** FAIL ***" : "NO ✓"}`);

  if (hasGoogleUrl || hasKeyParam || hasActualKey) {
    console.error("\nVERIFICATION FAILED — key-bearing URL in response body");
    process.exit(1);
  } else {
    console.log("\nVERIFICATION PASSED — no key-bearing URL in response body");
  }

  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
