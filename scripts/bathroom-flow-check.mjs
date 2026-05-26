// scripts/bathroom-flow-check.mjs
// Captures 4 screenshots of the AddStopSheet bathroom flow.
// Usage: PREVIEW_URL=https://www.flokktravel.com node scripts/bathroom-flow-check.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_TEST_USER_ID = process.env.ADMIN_CLERK_USER_ID ?? process.env.CLERK_TEST_USER_ID;
const APP_BASE_URL = process.env.PREVIEW_URL ?? "https://www.flokktravel.com";
const TOUR_ID = "fcabf475-aee9-4c67-ac6d-92728aa35c82";
const OUT_DIR = "/tmp/flokk-screenshots";

if (!CLERK_SECRET_KEY || !CLERK_TEST_USER_ID) {
  console.error("FATAL: CLERK_SECRET_KEY and ADMIN_CLERK_USER_ID required.");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: CLERK_TEST_USER_ID, expires_in_seconds: 120 }),
  });
  if (!res.ok) throw new Error(`Clerk token mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`Clerk response missing url: ${JSON.stringify(data)}`);
  return data.url;
}

async function establishSession(browser) {
  console.log("Minting Clerk sign-in token...");
  const ticketUrl = await mintSignInToken();
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  if (!clerkTicket) throw new Error("No __clerk_ticket in Clerk response");

  const setupCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const setupPage = await setupCtx.newPage();
  const appSignInUrl = `${APP_BASE_URL}/sign-in?__clerk_ticket=${clerkTicket}`;
  console.log("Navigating to sign-in with Clerk ticket...");
  await setupPage.goto(appSignInUrl, { waitUntil: "networkidle", timeout: 30000 });
  await setupPage.waitForTimeout(2000);
  const cookies = await setupCtx.cookies();
  const sessionCookies = cookies.filter(c => c.name.startsWith("__"));
  console.log(`Session established. Cookies: ${sessionCookies.map(c => c.name).join(", ")}`);
  await setupCtx.close();
  return sessionCookies;
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const sessionCookies = await establishSession(browser);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addCookies(sessionCookies);
  const page = await ctx.newPage();

  const tourUrl = `${APP_BASE_URL}/tour?id=${TOUR_ID}`;
  console.log(`Navigating to: ${tourUrl}`);
  await page.goto(tourUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Debug: save initial page screenshot
  await page.screenshot({ path: path.join(OUT_DIR, "bathroom-0-debug.png"), fullPage: false });
  console.log("  Debug screenshot: bathroom-0-debug.png");

  // Wait for any "Add Stop" button — the text is "Add Stop" inside a dashed-border button
  console.log("Waiting for Add Stop button...");
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some(b => b.textContent?.includes("Add Stop")),
    { timeout: 15000 }
  );

  // Click the first Add Stop button
  const addStopBtn = page.locator("button", { hasText: "Add Stop" }).first();
  await addStopBtn.click();
  await page.waitForTimeout(600);

  // ── Screenshot 1: category list ───────────────────────────────────────────
  await page.screenshot({ path: path.join(OUT_DIR, "bathroom-1-category-list.png"), fullPage: false });
  console.log("  Screenshot 1: category list saved");

  // ── Screenshot 2: click Bathroom → loading state ─────────────────────────
  console.log("Clicking Bathroom row...");
  const bathroomBtn = page.locator("button", { hasText: "Bathroom" }).first();
  await bathroomBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "bathroom-2-loading.png"), fullPage: false });
  console.log("  Screenshot 2: loading state saved");

  // ── Screenshot 3: wait for preview ───────────────────────────────────────
  console.log("Waiting for preview state (up to 25s)...");
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some(b => b.textContent?.trim() === "Add to tour"),
    { timeout: 25000 }
  );
  // Wait for any candidate image to finish loading before screenshotting
  await page.waitForFunction(
    () => [...document.querySelectorAll("img")].every(img => img.complete),
    { timeout: 8000 }
  ).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "bathroom-3-preview.png"), fullPage: false });
  console.log("  Screenshot 3: preview state saved");

  // ── Screenshot 4: accept and capture result ───────────────────────────────
  console.log("Clicking 'Add to tour'...");
  const acceptBtn = page.locator("button", { hasText: "Add to tour" });
  await acceptBtn.click();
  // Wait for the dialog to close
  await page.waitForFunction(
    () => !document.querySelector("[role='dialog']"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "bathroom-4-post-accept.png"), fullPage: false });
  console.log("  Screenshot 4: post-accept tour stop list saved");

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT_DIR}`);
}

run().catch(err => {
  console.error("FAIL:", err);
  process.exit(1);
});
