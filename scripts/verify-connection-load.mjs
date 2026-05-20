/**
 * Part 3 load verification for commit 03a0a0a (DB connection pool fix).
 * Fires 24 rapid authenticated requests across city/trip/spot routes.
 * Queries pg_stat_activity before, mid-burst, and after.
 * Reports all HTTP status codes and peak connection count.
 */
import { chromium } from "playwright";
import pg from "pg";
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

// ── Auth ──────────────────────────────────────────────────────────────────────
async function mintSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: GREENE_CLERK_USER_ID, expires_in_seconds: 300 }),
  });
  if (!res.ok) throw new Error(`Clerk mint failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.url) throw new Error(`No url: ${JSON.stringify(data)}`);
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

// ── Connection count query ────────────────────────────────────────────────────
async function getActiveConnections(client) {
  const r = await client.query(
    `SELECT count(*) AS n FROM pg_stat_activity WHERE state != 'idle' OR state IS NULL`
  );
  return parseInt(r.rows[0].n);
}

async function getAllConnections(client) {
  const r = await client.query(
    `SELECT count(*) AS n FROM pg_stat_activity`
  );
  return parseInt(r.rows[0].n);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("CREDENTIAL-LIVE: YES — minting Greene Clerk session against flokktravel.com");
const cookies = await getSessionCookies();
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
console.log("AUTH_OK\n");

const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
await dbClient.connect();

const baselineBefore = await getActiveConnections(dbClient);
const totalBefore = await getAllConnections(dbClient);
console.log(`Baseline before load: ${baselineBefore} active / ${totalBefore} total connections\n`);

// Build 24-request URL list
const urls = [
  // City pages — the primary leak site
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/seoul`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/tokyo`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/seoul`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/kyoto`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/seoul`,
  // Trip pages
  `${BASE_URL}/trips/cmmx6428k000004jlxgel7s86`,
  `${BASE_URL}/trips/cmmx6428k000004jlxgel7s86`,
  `${BASE_URL}/trips/cmmx6428k000004jlxgel7s86`,
  `${BASE_URL}/trips/cmmx6428k000004jlxgel7s86`,
  `${BASE_URL}/trips/cmmx6428k000004jlxgel7s86`,
  // Spot pages (public share token)
  `${BASE_URL}/spots/eJB6ckmLGNPN`,
  `${BASE_URL}/spots/vAfy9xyVR-WB`,
  `${BASE_URL}/spots/eJB6ckmLGNPN`,
  // More city hits to stress the fixed path
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/seoul`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/tokyo`,
  `${BASE_URL}/cities/paris`,
  `${BASE_URL}/cities/seoul`,
];

const results = [];
let peak = baselineBefore;
let emaxconnSeen = false;

console.log(`Firing ${urls.length} rapid sequential requests...\n`);
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const path = url.replace(BASE_URL, "");
  try {
    const res = await fetch(url, {
      headers: { Cookie: cookieStr },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const status = res.status;
    results.push({ path, status });
    const statusChar = status === 200 ? "." : `[${status}]`;
    process.stdout.write(statusChar);
    if (status === 500) {
      const body = await res.text().catch(() => "");
      if (body.includes("EMAXCONN") || body.includes("max client connections")) {
        emaxconnSeen = true;
        console.log(`\nEMAXCONN detected at request ${i + 1}: ${path}`);
      }
    }
  } catch (err) {
    results.push({ path, status: "ERR", error: err.message });
    process.stdout.write("E");
  }

  // Sample connection count at request 10 and 20
  if (i === 9 || i === 19) {
    const n = await getAllConnections(dbClient);
    if (n > peak) peak = n;
    console.log(`\n[req ${i + 1}] total connections: ${n}`);
  }
}

const peakFinal = await getAllConnections(dbClient);
if (peakFinal > peak) peak = peakFinal;
console.log(`\n\nPost-burst total connections: ${peakFinal}`);

await dbClient.end();

// ── Summary ───────────────────────────────────────────────────────────────────
const statusCounts = {};
for (const r of results) {
  statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
}

const total = results.length;
const ok200 = statusCounts[200] || 0;
const err500 = statusCounts[500] || 0;
const errOther = total - ok200 - (err500);

console.log("\n=== LOAD VERIFICATION SUMMARY ===");
console.log(`Requests: ${ok200}/${total} HTTP 200`);
console.log(`HTTP 500s: ${err500}`);
console.log(`Other (redirects/errors): ${errOther}`);
console.log(`Peak total connections: ${peak} (limit 200)`);
console.log(`EMAXCONN detected in responses: ${emaxconnSeen}`);
console.log(`Baseline before: ${baselineBefore} active / ${totalBefore} total`);

if (ok200 === total && !emaxconnSeen && peak < 50) {
  console.log(`\nVERIFIED: ${ok200}/${total} requests 200, peak connections ${peak} well under 200, zero EMAXCONN in responses.`);
} else {
  console.log(`\nNOT VERIFIED:`);
  if (ok200 < total) console.log(`  - ${total - ok200} non-200 responses: ${JSON.stringify(statusCounts)}`);
  if (emaxconnSeen) console.log(`  - EMAXCONN detected in responses`);
  if (peak >= 50) console.log(`  - Peak connections ${peak} higher than expected`);
  console.log("  Per-URL results:", results.filter(r => r.status !== 200));
}
