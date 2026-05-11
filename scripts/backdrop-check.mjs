import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = "https://www.flokktravel.com";
const outDir = "/tmp/flokk-backdrop-check";
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const PAGES = [
  { name: "city-reykjavik",   path: "/cities/reykjavik" },
  { name: "city-paris",       path: "/cities/paris" },
  { name: "city-callao",      path: "/cities/callao" },
  { name: "city-marrakesh",   path: "/cities/marrakesh" },
  { name: "city-dubai",       path: "/cities/dubai" },
  { name: "city-talkeetna",   path: "/cities/talkeetna" },
  { name: "city-dongguan",    path: "/cities/dongguan" },
  { name: "city-ludhiana",    path: "/cities/ludhiana" },
  { name: "country-france",   path: "/countries/france" },
  { name: "city-seoul",       path: "/cities/seoul" },
  { name: "city-galle",       path: "/cities/galle" },
  { name: "country-iceland",  path: "/countries/iceland" },
];

const VIEWPORTS = [
  { width: 1440, height: 900, suffix: "desktop" },
  { width: 390,  height: 844, suffix: "mobile"  },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  for (const p of PAGES) {
    const url = baseUrl + p.path;
    const out = path.join(outDir, `${p.name}-${vp.suffix}.png`);
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  OK  ${p.name}-${vp.suffix}`);
    } catch (e) {
      console.log(`  FAIL ${p.name}-${vp.suffix}: ${e.message}`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\nDone — ${PAGES.length * VIEWPORTS.length} screenshots in ${outDir}`);
