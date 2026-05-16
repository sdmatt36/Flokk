// scripts/visual-check.mjs
// Visual regression screenshot tool. Captures 9 canonical surfaces at desktop and
// mobile viewports, logs console errors and HTTP failures, saves PNGs to
// /tmp/flokk-screenshots/.
//
// Auth: automatically establishes a Clerk session via sign-in token (Clerk backend API).
// Requires CLERK_SECRET_KEY and ADMIN_CLERK_USER_ID in .env.local — both are already there.
// A fresh token is minted on every run. No manual cookie paste. No expiry issues.
//
// Usage:
//   PREVIEW_URL=https://flokktravel.com node scripts/visual-check.mjs
//
// Auth works only when PREVIEW_URL targets www.flokktravel.com. Localhost runs
// will still capture non-auth surfaces; auth-gated pages will show AUTH WALL.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load env files in Next.js priority order: .env.local overrides .env.production overrides .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ─── Required credentials ─────────────────────────────────────────────────────

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_TEST_USER_ID = process.env.ADMIN_CLERK_USER_ID ?? process.env.CLERK_TEST_USER_ID;

if (!CLERK_SECRET_KEY) {
  console.error("FATAL: CLERK_SECRET_KEY not found in .env.local — cannot mint Clerk session token.");
  process.exit(1);
}
if (!CLERK_TEST_USER_ID) {
  console.error("FATAL: ADMIN_CLERK_USER_ID not found in .env.local — cannot identify test user.");
  process.exit(1);
}

// ─── Clerk session establishment ──────────────────────────────────────────────

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: CLERK_TEST_USER_ID, expires_in_seconds: 120 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk token mint failed ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (!data.url) throw new Error(`Clerk sign-in token response missing url: ${JSON.stringify(data)}`);
  return data.url;
}

// Navigate a throwaway Playwright context to the app's sign-in page with the
// Clerk ticket as a query param. The app's /sign-in page (Next.js, Vercel-hosted)
// embeds the Clerk <SignIn> component which processes the ticket, sets session
// cookies on www.flokktravel.com, and redirects to /home.
// Using real Chrome (channel: "chrome") avoids headless-browser detection on
// Clerk's accounts.flokktravel.com domain, which is Cloudflare-protected.
async function establishSession(appBaseUrl) {
  console.log("Minting Clerk sign-in token...");
  const ticketUrl = await mintSignInToken();

  // Extract the raw __clerk_ticket value and build the app-domain sign-in URL.
  // The returned url points to accounts.flokktravel.com (Cloudflare-protected).
  // The app's own /sign-in page processes the same ticket without bot-detection risk.
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  if (!clerkTicket) throw new Error(`No __clerk_ticket in Clerk API url: ${ticketUrl}`);
  const appSignInUrl = `${appBaseUrl}/sign-in?__clerk_ticket=${clerkTicket}`;

  // Use real Chrome to avoid any headless fingerprinting issues.
  const setupBrowser = await chromium.launch({ channel: "chrome" });
  const setupCtx = await setupBrowser.newContext();
  const setupPage = await setupCtx.newPage();

  try {
    console.log(`Navigating to app sign-in with ticket (${appBaseUrl}/sign-in?__clerk_ticket=...)`);
    await setupPage.goto(appSignInUrl, { waitUntil: "load", timeout: 45000 });

    // Clerk <SignIn> component processes the ticket and redirects to /home.
    // Wait up to 25s for the URL to move off the /sign-in path.
    try {
      await setupPage.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 });
    } catch {
      // Redirect may not fire — still try to extract cookies.
    }

    // Brief pause to let Clerk JS finish writing cookies after redirect settles.
    await setupPage.waitForTimeout(2000);

    const cookies = await setupCtx.cookies();
    const sessionCookie = cookies.find(c => c.name === "__session");

    if (!sessionCookie) {
      const found = cookies.map(c => c.name).join(", ") || "(none)";
      throw new Error(`__session cookie absent after ticket navigation. Cookies present: ${found}`);
    }

    const clerkCookieNames = cookies.filter(c => c.name.startsWith("__")).map(c => c.name);
    console.log(`Session established. Clerk cookies: ${clerkCookieNames.join(", ")}`);
    return cookies;
  } finally {
    await setupBrowser.close();
  }
}

// ─── Canonical surfaces — Discipline 4.65 ────────────────────────────────────
// Do NOT remove surfaces. Add new ones as shared components ship.

const PAGES = [
  { name: "discover",           path: "/discover" },
  { name: "continents-index",   path: "/continents" },
  { name: "continent-asia",     path: "/continents/asia" },
  { name: "country-japan",      path: "/countries/japan" },
  { name: "country-france",     path: "/countries/france" },
  { name: "city-tokyo",         path: "/cities/tokyo" },
  { name: "saves",              path: "/saves" },
  { name: "spot-detail",        path: "/spots/4dZcax0d4ct0" },    // Sky Cab, Seoul
  { name: "trip-detail",        path: "/trips/cmmycshfj000004jpyadzdp8y" }, // Greene Tokyo
];

const VIEWPORTS = [
  { width: 1440, height: 900, suffix: "desktop" },
  { width: 390,  height: 844, suffix: "mobile"  },
];

// ─── Setup ────────────────────────────────────────────────────────────────────

const outDir = "/tmp/flokk-screenshots";
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

// flokktravel.com root 307-redirects to www — navigate directly to www.
const rawUrl = (process.env.PREVIEW_URL || "http://localhost:3000").replace(/\/$/, "");
const baseUrl = rawUrl.replace("https://flokktravel.com", "https://www.flokktravel.com");
if (rawUrl !== baseUrl) console.log(`Resolved ${rawUrl} → ${baseUrl} (www redirect)`);
console.log(`Screenshotting against: ${baseUrl}`);

// Establish auth session once; inject cookies into every capture context.
const sessionCookies = await establishSession(baseUrl);

// ─── Capture loop ─────────────────────────────────────────────────────────────

const browser = await chromium.launch();
const allIssues = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

  // Inject the established Clerk session into this context.
  // Cookies carry their own domain from the ticket redirect (www.flokktravel.com).
  // They will be sent automatically when the browser navigates to matching pages.
  await ctx.addCookies(sessionCookies);

  const page = await ctx.newPage();

  for (const p of PAGES) {
    const issues = [];
    page.removeAllListeners();
    page.on("pageerror", e => issues.push(`PAGEERR ${e.message}`));
    page.on("console", m => { if (m.type() === "error") issues.push(`CONSOLE ${m.text()}`); });
    page.on("response", r => { if (r.status() >= 400 && !r.url().includes("favicon")) issues.push(`HTTP ${r.status()} ${r.url()}`); });

    const url = baseUrl + p.path;
    const out = path.join(outDir, `${p.name}-${vp.suffix}.png`);
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(800);

      // Saves page fires parallel API calls after mount; wait for the loading state to clear.
      if (p.path === "/saves") {
        try {
          await page.waitForFunction(
            () => !document.body.innerText.includes("Loading your saves"),
            { timeout: 15000 }
          );
          await page.waitForTimeout(400);
        } catch { /* proceed with whatever rendered */ }
      }

      const isAuthWall = await page.evaluate(() => {
        const t = (document.body.innerText || "").toLowerCase();
        const hasClerkMarkers = !!document.querySelector("[class*='cl-'], [data-clerk-element], iframe[src*='clerk']");
        const hasSignInText = /(sign in|continue with|create account|log in to)/i.test(t);
        return hasClerkMarkers && hasSignInText;
      });
      if (isAuthWall) issues.push("AUTH WALL — captured sign-in modal, not page content");

      await page.screenshot({ path: out, fullPage: false });
      const status = issues.length === 0 ? "OK" : `WARN(${issues.length})`;
      console.log(`  ${status.padEnd(10)} ${p.name}-${vp.suffix}`);
      for (const i of issues.slice(0, 3)) console.log(`             ${i}`);
      if (issues.length > 3) console.log(`             ... +${issues.length - 3} more`);
      allIssues.push(...issues.map(i => `[${p.name}-${vp.suffix}] ${i}`));
    } catch (e) {
      console.log(`  FAIL       ${p.name}-${vp.suffix}: ${e.message}`);
      allIssues.push(`[${p.name}-${vp.suffix}] NAV ${e.message}`);
    }
  }
  await ctx.close();
}

await browser.close();

console.log(`\nDone. ${PAGES.length * VIEWPORTS.length} screenshots (${PAGES.length} surfaces × ${VIEWPORTS.length} viewports) in ${outDir}`);
if (allIssues.length > 0) console.log(`Issues found: ${allIssues.length}. Review before commit.`);
