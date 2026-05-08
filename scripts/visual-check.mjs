// scripts/visual-check.mjs
// Visual regression screenshot tool. Captures key pages at desktop and
// mobile viewports, logs console errors and HTTP failures, saves PNGs to
// /tmp/flokk-screenshots/. Run before declaring visual work complete.
//
// Usage:
//   node scripts/visual-check.mjs                              # localhost
//   PREVIEW_URL=https://flokktravel.com node scripts/visual-check.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const PAGES = [
  { name: "discover",         path: "/discover" },
  { name: "continent-asia",   path: "/continents/asia" },
  { name: "continent-europe", path: "/continents/europe" },
  { name: "continent-africa", path: "/continents/africa" },
  { name: "country-japan",    path: "/countries/japan" },
  { name: "country-france",   path: "/countries/france" },
  { name: "country-uae",      path: "/countries/united-arab-emirates" },
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
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(500);
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

console.log(`\nDone. ${PAGES.length * VIEWPORTS.length} screenshots in ${outDir}`);
if (allIssues.length > 0) console.log(`Issues found: ${allIssues.length}. Review before commit.`);
