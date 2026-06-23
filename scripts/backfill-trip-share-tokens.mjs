// One-off backfill: set Trip.shareToken for every Trip where it IS NULL, using the SAME
// generator as entity share tokens (nanoid(12), per getOrCreateShareToken). Only fills
// nulls — never overwrites an existing token. Idempotent; safe to re-run.
//
// Usage: DATABASE_URL=... node scripts/backfill-trip-share-tokens.mjs
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const db = new PrismaClient();

async function mintUnique() {
  for (let i = 0; i < 5; i++) {
    const token = nanoid(12);
    const existing = await db.trip.findFirst({ where: { shareToken: token }, select: { id: true } });
    if (!existing) return token;
  }
  return nanoid(16);
}

async function main() {
  const nulls = await db.trip.findMany({ where: { shareToken: null }, select: { id: true } });
  let updated = 0;
  for (const t of nulls) {
    const token = await mintUnique();
    // Guard the WHERE on shareToken: null so a concurrent writer can't be overwritten.
    const res = await db.trip.updateMany({ where: { id: t.id, shareToken: null }, data: { shareToken: token } });
    updated += res.count;
  }
  const remaining = await db.trip.count({ where: { shareToken: null } });
  console.log(`backfilled ${updated} trips; remaining null = ${remaining}`);
}

main().finally(() => db.$disconnect());
