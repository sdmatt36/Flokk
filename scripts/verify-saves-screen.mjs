/**
 * Verify saves screen renders real photos for the Greene family profile.
 * Mints Clerk token for user_3B68dQIbRRU8GZnMcSaoJwBg9GS, loads /saves desktop+mobile,
 * screenshots, and counts real-photo vs blue-placeholder cards.
 * Also hits /api/saves directly to confirm status code.
 */
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
const GREENE_CLERK_USER_ID = "user_3B68dQIbRRU8GZnMcSaoJwBg9GS";
const BASE_URL = "https://www.flokktravel.com";
const OUT_DIR = "/tmp/flokk-saves-verify";

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: GREENE_CLERK_USER_ID, expires_in_seconds: 300 }),
  });
  if (!res.ok) throw new Error(`Clerk mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`No url in Clerk response: ${JSON.stringify(data)}`);
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
    try { await page.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 }); } catch {}
    await page.waitForTimeout(2000);
    const cookies = await ctx.cookies();
    if (!cookies.find(c => c.name === "__session")) throw new Error("No __session cookie");
    return cookies;
  } finally { await browser.close(); }
}

console.log(`Minting Clerk token for Greene user (${GREENE_CLERK_USER_ID})...`);
const cookies = await getSessionCookies();
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
console.log("AUTH_OK — Greene session established");

// Step 3: Hit /api/saves directly and report status
console.log("\n--- /api/saves direct hit ---");
const apiRes = await fetch(`${BASE_URL}/api/saves`, {
  headers: { Cookie: cookieStr },
  signal: AbortSignal.timeout(15000),
});
const apiStatus = apiRes.status;
let apiBody = null;
try { apiBody = await apiRes.json(); } catch { apiBody = await apiRes.text().catch(() => null); }
console.log(`/api/saves status: ${apiStatus}`);
if (apiStatus !== 200) {
  console.log(`/api/saves error body: ${JSON.stringify(apiBody)?.slice(0, 500)}`);
} else {
  const count = Array.isArray(apiBody) ? apiBody.length : (apiBody?.items?.length ?? apiBody?.saves?.length ?? "?");
  console.log(`/api/saves returned ${count} items`);
}

// Step 2: Screenshot saves at desktop and mobile
const VIEWPORTS = [
  { width: 1440, height: 900, suffix: "desktop" },
  { width: 390,  height: 844, suffix: "mobile"  },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const issues = [];
  page.on("response", r => { if (r.status() >= 400 && !r.url().includes("favicon")) issues.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(`${BASE_URL}/saves`, { waitUntil: "load", timeout: 30000 });
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes("Loading your saves"),
      { timeout: 15000 }
    );
  } catch {}
  await page.waitForTimeout(1500);

  // Count save cards and image rendering state
  const cardStats = await page.evaluate(() => {
    // SaveCard renders a card element — look for cards by common selectors
    const cards = document.querySelectorAll("[data-save-card], .save-card, [class*='SaveCard']");
    // Broader: any img inside card-like containers
    const allImgs = Array.from(document.querySelectorAll("img"));
    const imgStats = allImgs.map(img => ({
      src: img.src,
      naturalWidth: img.naturalWidth,
      complete: img.complete,
      isSvg: img.src.includes(".svg") || img.src.startsWith("data:"),
      isFallback: img.src.includes("/images/fallbacks/") || img.src.includes("data:"),
      isSupabase: img.src.includes("supabase.co"),
      isGoogleCDN: img.src.includes("googleusercontent") || img.src.includes("lh3."),
      isUnsplash: img.src.includes("unsplash.com"),
      isProxy: img.src.includes("/api/img"),
    }));
    return {
      cardCount: cards.length,
      totalImgs: allImgs.length,
      imgStats,
      bodyText: document.body.innerText.slice(0, 300),
    };
  });

  const realPhotoImgs = cardStats.imgStats.filter(i =>
    !i.isFallback && !i.isSvg && (i.isSupabase || i.isGoogleCDN || i.isUnsplash) && i.naturalWidth > 0
  );
  const fallbackImgs = cardStats.imgStats.filter(i => i.isFallback || i.isSvg);
  const proxyImgs = cardStats.imgStats.filter(i => i.isProxy);
  const brokenImgs = cardStats.imgStats.filter(i => !i.isFallback && !i.isSvg && !i.complete && i.naturalWidth === 0);

  console.log(`\n--- ${vp.suffix.toUpperCase()} saves screen ---`);
  console.log(`Total imgs on page: ${cardStats.totalImgs}`);
  console.log(`Real photos (supabase/google/unsplash, loaded): ${realPhotoImgs.length}`);
  console.log(`Fallback/SVG imgs: ${fallbackImgs.length}`);
  console.log(`Proxy (/api/img) imgs: ${proxyImgs.length}`);
  console.log(`Broken (not loaded, naturalWidth=0): ${brokenImgs.length}`);
  if (issues.length) console.log(`HTTP errors: ${issues.slice(0,5).join(", ")}`);
  console.log(`Page text snippet: "${cardStats.bodyText.slice(0, 200)}"`);

  const outPath = path.join(OUT_DIR, `saves-${vp.suffix}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Screenshot: ${outPath}`);

  await ctx.close();
}

await browser.close();
console.log("\nDONE");
