import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { classifyActivityType } from "../src/lib/activity-intelligence";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Backfill ManualActivity rows with null or generic type
  const manualActivities = await prisma.manualActivity.findMany({
    where: {
      OR: [
        { type: null },
        { type: "ACTIVITY" },
        { type: "" },
      ],
    },
    select: {
      id: true,
      title: true,
      venueName: true,
      address: true,
    },
  });

  console.log(`Backfilling ${manualActivities.length} ManualActivity rows...`);

  for (const act of manualActivities) {
    const type = await classifyActivityType(act.title, act.venueName, act.address);
    await prisma.manualActivity.update({
      where: { id: act.id },
      data: { type },
    });
    console.log(`  ${act.title} → ${type}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Backfill ItineraryItem rows that are not transport or lodging
  const itineraryItems = await prisma.itineraryItem.findMany({
    where: {
      type: {
        notIn: ["FLIGHT", "TRAIN", "LODGING", "TRANSIT"],
      },
    },
    select: {
      id: true,
      title: true,
      type: true,
    },
  });

  const toReclassify = itineraryItems.filter(
    ii => !ii.type || ii.type === "ACTIVITY"
  );

  console.log(`Backfilling ${toReclassify.length} ItineraryItem rows...`);

  for (const item of toReclassify) {
    const type = await classifyActivityType(item.title, null, null);
    await prisma.itineraryItem.update({
      where: { id: item.id },
      data: { type },
    });
    console.log(`  ${item.title} → ${type}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("Backfill complete.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
