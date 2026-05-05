// One-shot recovery: creates User rows for Clerk orphans, backfills Loops contacts for all missing.
// Idempotent: re-running skips rows/contacts that already exist.
// Usage: CLERK_SECRET_KEY=sk_live_... node scripts/recover-orphans-and-backfill-loops.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createClerkClient } from "@clerk/backend";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const LOOPS_API_KEY    = process.env.LOOPS_API_KEY;
const DATABASE_URL     = process.env.DATABASE_URL;

if (!CLERK_SECRET_KEY) { console.error("ERROR: CLERK_SECRET_KEY not set."); process.exit(1); }
if (!DATABASE_URL)     { console.error("ERROR: DATABASE_URL not set."); process.exit(1); }
if (!LOOPS_API_KEY)    { console.error("ERROR: LOOPS_API_KEY not set."); process.exit(1); }

const pool    = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const db      = new PrismaClient({ adapter });
const clerk   = createClerkClient({ secretKey: CLERK_SECRET_KEY });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function resolveEmail(cu) {
  return cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
    ?? cu.emailAddresses[0]?.emailAddress
    ?? null;
}

async function findLoopsContact(email) {
  const res = await fetch(
    `https://app.loops.so/api/v1/contacts/find?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${LOOPS_API_KEY}` } }
  );
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`find HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return { found: data.length > 0 };
  return { found: !!data?.id };
}

async function createLoopsContact(email, firstName, lastName, wasOrphaned) {
  const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOOPS_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      firstName,
      lastName,
      source: "backfill_2026_05",
      wasOrphaned,
      userGroup: "beta",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`create HTTP ${res.status}: ${body}`);
  }
  return true;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const runAt = new Date().toISOString();
  const errors = []; // { email, operation, message }

  // 1. Fetch all Clerk users
  const clerkUsers = await fetchAllClerkUsers();

  // 2. Batch-query DB pre-recovery
  const clerkIds = clerkUsers.map(u => u.id);
  const preDbUsers = await db.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { clerkId: true },
  });
  const preDbUserSet = new Set(preDbUsers.map(u => u.clerkId));
  const preExistingCount = preDbUserSet.size;

  // 3. Identify orphans (no User row) and flag them
  const orphanClerkIds = new Set(
    clerkUsers.filter(cu => !preDbUserSet.has(cu.id)).map(cu => cu.id)
  );

  // 4. ORPHAN RECOVERY
  let recoveredCount = 0;
  const recoveredUsers = [];
  const orphanRecoveryErrors = [];

  for (const cu of clerkUsers) {
    if (!orphanClerkIds.has(cu.id)) continue;
    const email = resolveEmail(cu);
    if (!email) {
      const msg = "no resolvable email";
      errors.push({ email: "(none)", operation: "user.upsert", message: msg });
      orphanRecoveryErrors.push({ cu, message: msg });
      continue;
    }
    try {
      await db.user.upsert({
        where:  { email },
        update: { clerkId: cu.id },
        create: { clerkId: cu.id, email },
      });
      recoveredCount++;
      recoveredUsers.push({ cu, email });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ email, operation: "user.upsert", message: msg });
      orphanRecoveryErrors.push({ cu, message: msg });
    }
  }

  // 5. LOOPS BACKFILL — check + create for all Clerk users
  let loopsPreExisting = 0;
  let loopsCreated = 0;
  let loopsSkipped = 0;
  const loopsBackfilled = [];
  const loopsErrors = [];

  for (const cu of clerkUsers) {
    const email = resolveEmail(cu);
    if (!email) {
      errors.push({ email: "(none)", operation: "loops.find", message: `Clerk user ${cu.id} has no email` });
      loopsErrors.push({ email: "(none)", clerkId: cu.id, message: "no resolvable email" });
      continue;
    }

    const wasOrphaned = orphanClerkIds.has(cu.id);

    // Check if contact exists
    let found = false;
    try {
      ({ found } = await findLoopsContact(email));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ email, operation: "loops.find", message: msg });
      loopsErrors.push({ email, clerkId: cu.id, message: msg });
      continue;
    }

    if (found) {
      loopsPreExisting++;
      loopsSkipped++;
      continue;
    }

    // Not found — create
    const firstName = cu.firstName ?? "";
    const lastName  = cu.lastName  ?? "";
    try {
      await createLoopsContact(email, firstName, lastName, wasOrphaned);
      loopsCreated++;
      loopsBackfilled.push({ email, wasOrphaned });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ email, operation: "loops.create", message: msg });
      loopsErrors.push({ email, clerkId: cu.id, message: msg });
    }

    await sleep(100); // rate-limit buffer between writes
  }

  // ── Output ──────────────────────────────────────────────────────────────────
  console.log(`=== ORPHAN RECOVERY + LOOPS BACKFILL ===`);
  console.log(`Run: ${runAt}`);
  console.log(``);
  console.log(`CLERK`);
  console.log(`  Total users: ${clerkUsers.length}`);
  console.log(``);
  console.log(`ORPHAN RECOVERY`);
  console.log(`  Pre-existing User rows:  ${preExistingCount}`);
  console.log(`  Created in this run:     ${recoveredCount}`);
  console.log(`  Errors:                  ${orphanRecoveryErrors.length}`);
  console.log(``);
  console.log(`  Recovered users:`);
  if (recoveredUsers.length === 0) {
    console.log(`    (none)`);
  } else {
    for (const { cu, email } of recoveredUsers) {
      const created = new Date(cu.createdAt).toISOString().slice(0, 10);
      console.log(`    - ${cu.id} | ${email} (signed up ${created})`);
    }
  }
  console.log(``);
  console.log(`LOOPS BACKFILL`);
  console.log(`  Pre-existing Loops contacts: ${loopsPreExisting}`);
  console.log(`  Created in this run:         ${loopsCreated}`);
  console.log(`  Skipped (already exist):     ${loopsSkipped}`);
  console.log(`  Errors:                      ${loopsErrors.length}`);
  console.log(``);
  console.log(`  Backfilled contacts:`);
  if (loopsBackfilled.length === 0) {
    console.log(`    (none)`);
  } else {
    for (const { email, wasOrphaned } of loopsBackfilled) {
      console.log(`    - ${email} (wasOrphaned: ${wasOrphaned})`);
    }
  }
  console.log(``);
  console.log(`ERRORS:`);
  if (errors.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const { email, operation, message } of errors) {
      console.log(`  - ${email} — ${operation} — ${message}`);
    }
  }

  await db.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
