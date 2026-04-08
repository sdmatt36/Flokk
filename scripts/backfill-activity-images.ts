import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { enrichActivityImage } from "../src/lib/activity-intelligence";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const activities = await prisma.manualActivity.findMany({
    where: { imageUrl: null },
    select: {
      id: true,
      title: true,
      city: true,
      type: true,
    },
  });

  console.log(`Enriching images for ${activities.length} ManualActivity rows...`);

  for (const act of activities) {
    const imageUrl = await enrichActivityImage(act.title, act.city, act.type);
    if (imageUrl) {
      await prisma.manualActivity.update({
        where: { id: act.id },
        data: { imageUrl },
      });
      console.log(`  ✓ ${act.title} → ${imageUrl.slice(0, 60)}...`);
    } else {
      console.log(`  ✗ ${act.title} → no image found`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("Image backfill complete.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
