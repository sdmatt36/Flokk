// Verify SavesScreen pill import flow post-extraction.
// Exercises: modal open → file select → import → success state → list refresh (no reload).
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
const baseUrl = "https://www.flokktravel.com";
const outDir = "/tmp/flokk-screenshots";
fs.mkdirSync(outDir, { recursive: true });

async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: CLERK_TEST_USER_ID, expires_in_seconds: 120 }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(`Clerk token failed ${res.status}: ${JSON.stringify(data)}`);
  return data.url;
}

async function establishSession() {
  const ticketUrl = await mintSignInToken();
  const clerkTicket = new URL(ticketUrl).searchParams.get("__clerk_ticket");
  const appSignInUrl = `${baseUrl}/sign-in?__clerk_ticket=${clerkTicket}`;
  const setupBrowser = await chromium.launch({ channel: "chrome" });
  const setupCtx = await setupBrowser.newContext();
  const setupPage = await setupCtx.newPage();
  await setupPage.goto(appSignInUrl, { waitUntil: "load", timeout: 45000 });
  try { await setupPage.waitForURL(url => !url.includes("/sign-in"), { timeout: 25000 }); } catch {}
  await setupPage.waitForTimeout(2000);
  const cookies = await setupCtx.cookies();
  const sessionCookie = cookies.find(c => c.name === "__session");
  if (!sessionCookie) throw new Error("No __session cookie — auth failed");
  await setupBrowser.close();
  console.log("Credential live: YES");
  return cookies;
}

const cookies = await establishSession();
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

// ── Navigate to /saves and wait for it to fully load ─────────────────────────
console.log("\nNavigating to /saves...");
await page.goto(`${baseUrl}/saves`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Snapshot the saves count BEFORE import — read from the tab bar
const saveCountBefore = await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll("button"));
  const unassignedTab = tabs.find(b => b.textContent?.includes("Unassigned"));
  return unassignedTab?.textContent?.trim() ?? "(could not read)";
});
console.log(`Tab state before import: ${saveCountBefore}`);

// Screenshot the saves list before import — scroll down to see card grid
await page.screenshot({ path: path.join(outDir, "saves-before-import.png"), fullPage: false });
console.log("Saved saves-before-import.png");

// ── Open the Import from Maps pill ───────────────────────────────────────────
console.log("\nClicking Import from Maps pill...");
const pill = page.locator("button").filter({ hasText: "Import from Maps" }).first();
const pillCount = await pill.count();
if (pillCount === 0) { console.log("FATAL: pill not found"); process.exit(1); }

await pill.evaluate(el => el.click());
await page.waitForTimeout(1500);

// Confirm modal is open
const modalOpen = await page.locator("text=Import from Google Maps").count();
console.log(`Modal open: ${modalOpen > 0}`);

// ── Upload a CSV with a unique place not likely to be in saves ────────────────
// Use a specific named place in Chiang Rai, Thailand (obscure enough)
const csvContent = `Title,Note,URL
Wat Rong Khun Verification Test,,https://maps.google.com/?q=19.8244,99.7634`;
const tmpCsv = path.join(outDir, "saves-test-import.csv");
fs.writeFileSync(tmpCsv, csvContent);

const fileInput = page.locator("input[type='file']");
await fileInput.setInputFiles(tmpCsv);
await page.waitForTimeout(800);

const fileSelected = await page.locator("text=saves-test-import.csv").count();
console.log(`File selected in picker: ${fileSelected > 0}`);

// ── Click Import Places ───────────────────────────────────────────────────────
console.log("Clicking Import Places...");
const importBtn = page.locator("button").filter({ hasText: "Import Places" }).first();
await importBtn.evaluate(el => el.click());

// Wait for the API call to complete — import + onImported fresh fetch both need time
console.log("Waiting for import API + onImported fresh fetch...");
await page.waitForSelector("text=Import complete", { timeout: 30000 });
console.log("Success state appeared.");

// Give the onImported async fetch extra time to complete and re-render
await page.waitForTimeout(4000);

// ── Screenshot: success state (modal still open, list refreshing behind it) ───
await page.screenshot({ path: path.join(outDir, "saves-import-success-state.png"), fullPage: false });
console.log("Saved saves-import-success-state.png");

// Read the import result from the page
const importedCount = await page.evaluate(() => {
  const el = document.querySelector("p strong");
  return el?.textContent ?? "(not found)";
});
const skippedText = await page.locator("text=already existed").count();
console.log(`Imported count in success state: ${importedCount}, skipped message shown: ${skippedText > 0}`);

// ── Close modal via "Done" — stays on /saves so we can observe the refreshed list ──
const doneBtn = page.locator("button").filter({ hasText: "Done" }).first();
if (await doneBtn.count() > 0) {
  await doneBtn.evaluate(el => el.click());
} else {
  // Fall back to onClose (backdrop click)
  await page.keyboard.press("Escape");
}
await page.waitForTimeout(2000);

// Confirm we are still on /saves (no navigation)
console.log(`URL after close: ${page.url()}`);

// ── Screenshot: saves list post-close, no manual reload ──────────────────────
// Scroll to Unassigned/Imported area to see if the imported place appears
const importedTab = page.locator("button").filter({ hasText: "Imported" }).first();
if (await importedTab.count() > 0) {
  await importedTab.evaluate(el => el.click());
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: path.join(outDir, "saves-after-import-refreshed.png"), fullPage: false });
console.log("Saved saves-after-import-refreshed.png");

// Check if the imported place title appears in the DOM
const watRongVisible = await page.locator("text=Wat Rong Khun").count();
console.log(`Imported place "Wat Rong Khun" visible in list: ${watRongVisible > 0}`);

const saveCountAfter = await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll("button"));
  const importedTab = tabs.find(b => b.textContent?.includes("Imported"));
  return importedTab?.textContent?.trim() ?? "(could not read)";
});
console.log(`Imported tab state after: ${saveCountAfter}`);

fs.unlinkSync(tmpCsv);
await browser.close();
console.log("\nDone.");
