// One-time backfill: normalize CommunitySpot.category to canonical slug.
// Transport categories (train/flight/etc.) are left unchanged.
// Idempotent — safe to rerun.
// Run: npx tsx scripts/normalize-community-spot-categories.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizeCategorySlug, TRANSPORT_CATEGORIES } from "../src/lib/categories";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const spots = await db.communitySpot.findMany({ select: { id: true, category: true } });
  console.log(`Total spots: ${spots.length}`);

  let changed = 0, unchanged = 0, skipped = 0;

  for (const s of spots) {
    const raw = s.category;

    // Null/empty → "other"
    if (!raw || raw.trim() === "") {
      await db.communitySpot.update({ where: { id: s.id }, data: { category: "other" } });
      changed++;
      continue;
    }

    // Transport markers → leave unchanged
    if ((TRANSPORT_CATEGORIES as readonly string[]).includes(raw.toLowerCase())) {
      unchanged++;
      continue;
    }

    const normalized = normalizeCategorySlug(raw);
    if (normalized === null) {
      console.warn(`  UNMAPPED: "${raw}" (id=${s.id}) — skipped`);
      skipped++;
      continue;
    }

    if (normalized !== raw) {
      await db.communitySpot.update({ where: { id: s.id }, data: { category: normalized } });
      changed++;
    } else {
      unchanged++;
    }
  }

  console.log(`Changed: ${changed} | Unchanged: ${unchanged} | Skipped (unmapped): ${skipped}`);
}

main().finally(async () => {
  await db.$disconnect();
  await pool.end();
});
