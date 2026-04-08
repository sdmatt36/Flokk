import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

console.log("NOTE: If DATABASE_URL is missing, re-add from .env.production before running");

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const activities = await prisma.manualActivity.findMany({
    where: { imageUrl: { not: null } },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      trip: { select: { familyProfileId: true } },
    },
  });

  console.log(`Checking ${activities.length} ManualActivity rows with imageUrl...`);

  let count = 0;

  for (const act of activities) {
    const savedItems = await prisma.savedItem.findMany({
      where: {
        familyProfileId: act.trip.familyProfileId,
        rawTitle: { contains: act.title, mode: "insensitive" },
      },
      select: { id: true, rawTitle: true, placePhotoUrl: true },
    });

    for (const item of savedItems) {
      if (item.placePhotoUrl !== act.imageUrl) {
        await prisma.savedItem.update({
          where: { id: item.id },
          data: { placePhotoUrl: act.imageUrl },
        });
        console.log(`Updated SavedItem [${item.id}]: ${item.rawTitle} → ${act.imageUrl}`);
        count++;
      }
    }
  }

  console.log(`Done. Updated ${count} SavedItem rows.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
