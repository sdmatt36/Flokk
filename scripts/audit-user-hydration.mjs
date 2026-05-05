// Diagnostic only — NO WRITES. Audits Clerk → DB (User + ProfileMember) → Loops hydration gaps.
// Usage: CLERK_SECRET_KEY=sk_live_... node scripts/audit-user-hydration.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createClerkClient } from "@clerk/backend";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const LOOPS_API_KEY    = process.env.LOOPS_API_KEY;
const DATABASE_URL     = process.env.DATABASE_URL;

if (!CLERK_SECRET_KEY) { console.error("ERROR: CLERK_SECRET_KEY not set. Pass it at runtime."); process.exit(1); }
if (!DATABASE_URL)     { console.error("ERROR: DATABASE_URL not set."); process.exit(1); }
if (!LOOPS_API_KEY)    { console.error("ERROR: LOOPS_API_KEY not set."); process.exit(1); }

const pool    = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const db      = new PrismaClient({ adapter });
const clerk   = createClerkClient({ secretKey: CLERK_SECRET_KEY });

const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 1. Paginate all Clerk users ──────────────────────────────────────────────
async function fetchAllClerkUsers() {
  const all = [];
  const limit = 100;
  let offset = 0;
  while (true) {
    const page = await clerk.users.getUserList({ limit, offset });
    all.push(...page.data);
    if (all.length >= page.totalCount || page.data.length === 0) break;
    offset += limit;
  }
  return all;
}

// ── 2. Loops contact lookup (GET /v1/contacts/find?email=) ───────────────────
async function findLoopsContact(email) {
  const res = await fetch(
    `https://app.loops.so/api/v1/contacts/find?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${LOOPS_API_KEY}` } }
  );
  if (res.status === 404) return { found: false, error: null };
  if (!res.ok) return { found: false, error: `HTTP ${res.status}` };
  const data = await res.json();
  // API returns an array; empty array means not found
  if (Array.isArray(data)) return { found: data.length > 0, error: null };
  // Some versions return an object directly
  return { found: !!data?.id, error: null };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const runAt = new Date().toISOString();

  // 1. Fetch all Clerk users
  const clerkUsers = await fetchAllClerkUsers();
  const activeCount = clerkUsers.filter(u => u.lastActiveAt && u.lastActiveAt >= THIRTY_DAYS_AGO).length;

  // 2. Batch-query DB for User rows and ProfileMember rows
  const clerkIds = clerkUsers.map(u => u.id);

  const [dbUsers, dbProfileMembers] = await Promise.all([
    db.user.findMany({
      where: { clerkId: { in: clerkIds } },
      select: { clerkId: true },
    }),
    db.profileMember.findMany({
      where: { clerkUserId: { in: clerkIds } },
      select: { clerkUserId: true },
    }),
  ]);

  const dbUserSet          = new Set(dbUsers.map(u => u.clerkId));
  const dbProfileMemberSet = new Set(dbProfileMembers.map(p => p.clerkUserId));

  // 3. Per-user Loops lookup with 50ms sleep
  const loopsResults = []; // { email, clerkUserId, found, error }
  for (const cu of clerkUsers) {
    const email = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress ?? null;
    if (!email) {
      loopsResults.push({ email: "(no email)", clerkUserId: cu.id, found: false, error: "no primary email on Clerk record" });
      continue;
    }
    try {
      const { found, error } = await findLoopsContact(email);
      loopsResults.push({ email, clerkUserId: cu.id, found, error });
    } catch (e) {
      loopsResults.push({ email, clerkUserId: cu.id, found: false, error: String(e?.message ?? e) });
    }
    await sleep(50);
  }

  // 4. Aggregate
  const missingUser          = clerkUsers.filter(cu => !dbUserSet.has(cu.id));
  const missingProfileMember = clerkUsers.filter(cu => !dbProfileMemberSet.has(cu.id));
  const partialOnly          = clerkUsers.filter(cu => dbUserSet.has(cu.id) && !dbProfileMemberSet.has(cu.id));
  const missingLoops         = loopsResults.filter(r => !r.found && !r.error);
  const loopsErrors          = loopsResults.filter(r => !!r.error);

  // ── Output ──────────────────────────────────────────────────────────────────
  const fmt = (cu) => {
    const email = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress ?? "(no email)";
    const created = new Date(cu.createdAt).toISOString().slice(0, 10);
    const lastActive = cu.lastActiveAt ? new Date(cu.lastActiveAt).toISOString().slice(0, 10) : "never";
    return `  - ${cu.id} | ${email} | created ${created} | last active ${lastActive}`;
  };

  console.log(`=== USER HYDRATION AUDIT ===`);
  console.log(`Run: ${runAt}`);
  console.log(``);
  console.log(`CLERK`);
  console.log(`  Total users: ${clerkUsers.length}`);
  console.log(`  Active last 30 days: ${activeCount}`);
  console.log(``);
  console.log(`DB`);
  console.log(`  With User row: ${dbUserSet.size}`);
  console.log(`  Missing User row: ${missingUser.length}`);
  console.log(`  With ProfileMember row: ${dbProfileMemberSet.size}`);
  console.log(`  Missing ProfileMember row: ${missingProfileMember.length}`);
  console.log(``);
  console.log(`LOOPS`);
  console.log(`  With Loops contact: ${loopsResults.filter(r => r.found).length}`);
  console.log(`  Missing Loops contact: ${missingLoops.length}`);
  console.log(`  Lookup errors: ${loopsErrors.length}`);
  console.log(``);
  console.log(`ORPHANED — Missing User row:`);
  if (missingUser.length === 0) {
    console.log(`  (none)`);
  } else {
    missingUser.forEach(cu => console.log(fmt(cu)));
  }
  console.log(``);
  console.log(`PARTIAL — User exists, missing ProfileMember:`);
  if (partialOnly.length === 0) {
    console.log(`  (none)`);
  } else {
    partialOnly.forEach(cu => {
      const email = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress ?? "(no email)";
      const created = new Date(cu.createdAt).toISOString().slice(0, 10);
      console.log(`  - ${cu.id} | ${email} | created ${created}`);
    });
  }
  console.log(``);
  console.log(`MISSING LOOPS CONTACTS:`);
  if (missingLoops.length === 0) {
    console.log(`  (none)`);
  } else {
    missingLoops.forEach(r => {
      const cu = clerkUsers.find(u => u.id === r.clerkUserId);
      const created = cu ? new Date(cu.createdAt).toISOString().slice(0, 10) : "unknown";
      console.log(`  - ${r.email} (Clerk userId ${r.clerkUserId}, created ${created})`);
    });
  }
  console.log(``);
  console.log(`LOOPS LOOKUP ERRORS:`);
  if (loopsErrors.length === 0) {
    console.log(`  (none)`);
  } else {
    loopsErrors.forEach(r => console.log(`  - ${r.email} — error: ${r.error}`));
  }

  await db.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
