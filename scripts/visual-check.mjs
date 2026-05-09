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

// Clerk v7 middleware requires __client_uat (Unix timestamp) alongside __session.
// Without it the middleware triggers a handshake that dumps headless browsers to sign-in.
// Derive it from the JWT's iat claim so no extra env var is needed.
function jwtIat(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return String(decoded.iat ?? Math.floor(Date.now() / 1000));
  } catch {
    return String(Math.floor(Date.now() / 1000));
  }
}
const clientUat = authToken ? jwtIat(authToken) : null;

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

// flokktravel.com (root) 307-redirects to www.flokktravel.com for every route.
// Navigate directly to www to avoid the redirect so cookies are sent to the right origin.
const rawUrl = (process.env.PREVIEW_URL || "http://localhost:3000").replace(/\/$/, "");
const baseUrl = rawUrl.replace("https://flokktravel.com", "https://www.flokktravel.com");
if (rawUrl !== baseUrl) console.log(`Resolved ${rawUrl} → ${baseUrl} (www redirect)`);
console.log(`Screenshotting against: ${baseUrl}`);

const browser = await chromium.launch();
const allIssues = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

  // Inject Clerk v7 session cookies for auth-gated surfaces when token is available.
  // Clerk v7 requires both __session (JWT) and __client_uat (iat timestamp) or the
  // middleware triggers a handshake that redirects headless browsers to the sign-in page.
  // Inject for both www and root domains; we navigate to www directly to skip the 307.
  if (authToken && clientUat) {
    const cookieBase = { path: "/", httpOnly: true, secure: true, sameSite: "Lax" };
    await ctx.addCookies([
      { name: "__session",    value: authToken,  domain: "www.flokktravel.com", ...cookieBase },
      { name: "__client_uat", value: clientUat,  domain: "www.flokktravel.com", ...cookieBase },
      { name: "__session",    value: authToken,  domain: "flokktravel.com",     ...cookieBase },
      { name: "__client_uat", value: clientUat,  domain: "flokktravel.com",     ...cookieBase },
    ]);
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
