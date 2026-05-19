// Minimal script: mint Clerk session → POST enrich-all-saves → capture response
import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = "/Users/sdmatt36/Projects/travelapp";

dotenv.config({ path: path.join(projectDir, ".env.local") });
dotenv.config({ path: path.join(projectDir, ".env.production") });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_TEST_USER_ID = process.env.ADMIN_CLERK_USER_ID;
const BASE_URL = "https://www.flokktravel.com";

async function mintToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: CLERK_TEST_USER_ID, expires_in_seconds: 120 }),
  });
  const data = await res.json();
  return data.url;
}

async function getSessionCookies() {
  const ticketUrl = await mintToken();
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  const signInUrl = `${BASE_URL}/sign-in?__clerk_ticket=${clerkTicket}`;
  
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  await page.goto(signInUrl, { waitUntil: "load", timeout: 45000 });
  try { await page.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 }); } catch {}
  await page.waitForTimeout(2000);
  
  const cookies = await ctx.cookies();
  await browser.close();
  return cookies;
}

async function main() {
  console.log("Establishing Clerk session...");
  const cookies = await getSessionCookies();
  const sessionCookie = cookies.find(c => c.name === "__session");
  if (!sessionCookie) throw new Error("No __session cookie");
  console.log("Session established.");

  // Build cookie header string
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

  console.log("Calling POST /api/admin/enrich-all-saves ...");
  const res = await fetch(`${BASE_URL}/api/admin/enrich-all-saves`, {
    method: "POST",
    headers: { "Cookie": cookieHeader },
  });

  const body = await res.json();
  console.log(`Status: ${res.status}`);
  console.log("Response:", JSON.stringify(body, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
