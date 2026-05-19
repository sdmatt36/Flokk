import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_TEST_USER_ID = process.env.ADMIN_CLERK_USER_ID ?? process.env.CLERK_TEST_USER_ID;
const baseUrl = "https://www.flokktravel.com";
const outDir = "/tmp/flokk-screenshots";

const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ user_id: CLERK_TEST_USER_ID, expires_in_seconds: 120 }),
});
const data = await res.json();
const clerkTicket = new URL(data.url).searchParams.get("__clerk_ticket");

const setupBrowser = await chromium.launch({ channel: "chrome" });
const setupCtx = await setupBrowser.newContext();
const setupPage = await setupCtx.newPage();
await setupPage.goto(`${baseUrl}/sign-in?__clerk_ticket=${clerkTicket}`, { waitUntil: "load", timeout: 45000 });
try { await setupPage.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 }); } catch {}
await setupPage.waitForTimeout(2000);
const cookies = await setupCtx.cookies();
await setupBrowser.close();
console.log("Credential live: YES");

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll to the "Build a Tour" tile and back up slightly to show all 3
try {
  await page.locator("text=Build a Tour").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollBy(0, -100));
  await page.waitForTimeout(300);
} catch {
  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(500);
}
await page.screenshot({ path: path.join(outDir, "home-tiles-check.png"), fullPage: false });
console.log("Saved home-tiles-check.png");

await browser.close();
