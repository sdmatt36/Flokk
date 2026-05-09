// scripts/visual-check.mjs
// Visual regression screenshot tool. Captures 9 canonical surfaces at desktop and
// mobile viewports, logs console errors and HTTP failures, saves PNGs to
// /tmp/flokk-screenshots/. Run before declaring visual work complete.
//
// Public routes render full content. Auth-gated routes (/discover, /saves, /trips/...)
// will show AUTH WALL unless FLOKK_TEST_USER_TOKEN is set (see below).
//
// To capture an authenticated session for visual checks:
//   1. Log into https://flokktravel.com as the Greene profile
//   2. Open DevTools → Application → Cookies → flokktravel.com
//   3. Copy the value of the __session cookie
//   4. Export it before running this script:
//        export FLOKK_TEST_USER_TOKEN="<paste-value>"
//        node scripts/visual-check.mjs
//
// Usage:
//   node scripts/visual-check.mjs                              # localhost (no auth)
//   PREVIEW_URL=https://flokktravel.com node scripts/visual-check.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const authToken = process.env.FLOKK_TEST_USER_TOKEN ?? null;
if (!authToken) {
  console.log("FLOKK_TEST_USER_TOKEN not set — auth-gated surfaces will show AUTH WALL");
}

// Canonical 9-surface set — Discipline 4.65.
// Do NOT remove surfaces from this list. Add new ones as new shared components ship.
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

const outDir = "/tmp/flokk-screenshots";
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const baseUrl = (process.env.PREVIEW_URL || "http://localhost:3000").replace(/\/$/, "");
console.log(`Screenshotting against: ${baseUrl}`);

const browser = await chromium.launch();
const allIssues = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

  // Inject Clerk session cookie for auth-gated surfaces when token is available.
  if (authToken) {
    await ctx.addCookies([{
      name: "__session",
      value: authToken,
      domain: ".flokktravel.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }]);
  }

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
