// Backfills CommunitySpot.shareToken and sets isPublic=true on all rows.
// Idempotent: skips rows that already have shareToken set.
// Token: nanoid(12) — matches Trip/SavedItem/GeneratedTour pattern.
//
// Run: node scripts/backfill-spot-sharing.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import { nanoid } from "nanoid";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const spots = await db.communitySpot.findMany({
  select: { id: true, shareToken: true },
  orderBy: { createdAt: "asc" },
});

const total = spots.length;
let generated = 0;
let skipped = 0;
let errors = 0;

console.log(`CommunitySpot rows: ${total}`);

for (const spot of spots) {
  if (spot.shareToken) {
    skipped++;
    continue;
  }
  try {
    await db.communitySpot.update({
      where: { id: spot.id },
      data: { shareToken: nanoid(12), isPublic: true },
    });
    generated++;
  } catch (err) {
    errors++;
    console.error(`  ERR ${spot.id}: ${err.message}`);
  }
}

// Verify all rows now have isPublic=true
const { rows } = await pool.query(
  `SELECT COUNT(*) AS total, COUNT("shareToken") AS with_token, SUM(CASE WHEN "isPublic" THEN 1 ELSE 0 END) AS public_count FROM "CommunitySpot"`
);
const stats = rows[0];

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Total: ${total} | Generated: ${generated} | Skipped (already had token): ${skipped} | Errors: ${errors}`);
console.log(`DB verify — with shareToken: ${stats.with_token}/${stats.total} | isPublic=true: ${stats.public_count}/${stats.total}`);
