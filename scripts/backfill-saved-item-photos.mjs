#!/usr/bin/env node
// One-time backfill: for SavedItems with communitySpotId set and null/empty placePhotoUrl,
// copy the linked CommunitySpot.photoUrl. Idempotent — safe to rerun.
// Run: node scripts/backfill-saved-item-photos.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const candidates = await db.savedItem.findMany({
  where: {
    communitySpotId: { not: null },
    OR: [{ placePhotoUrl: null }, { placePhotoUrl: "" }],
  },
  select: { id: true, communitySpotId: true },
});
console.log(`Found ${candidates.length} candidates`);

let updated = 0;
for (const s of candidates) {
  const spot = await db.communitySpot.findUnique({
    where: { id: s.communitySpotId },
    select: { photoUrl: true },
  });
  if (spot?.photoUrl) {
    await db.savedItem.update({
      where: { id: s.id },
      data: { placePhotoUrl: spot.photoUrl },
    });
    updated++;
  }
}
console.log(`Updated ${updated} SavedItems`);
await db.$disconnect();
await pool.end();
