import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function calcDayIndex(tripStartDate: Date, scheduledDate: string): number {
  const rawStart = new Date(tripStartDate);
  const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
  const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
  const [y, m, d] = scheduledDate.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

async function main() {
  const seoulTrips = await db.trip.findMany({
    where: {
      OR: [
        { destinationCity: { contains: "Seoul", mode: "insensitive" } },
        { title: { contains: "Seoul", mode: "insensitive" } },
      ],
    },
    include: { itineraryItems: true },
  });

  if (seoulTrips.length === 0) {
    console.log("[fix-dayindex] no Seoul trips found");
    return;
  }

  for (const trip of seoulTrips) {
    console.log(`[fix-dayindex] trip: "${trip.title}" (${trip.id}) startDate: ${trip.startDate}`);

    if (!trip.startDate) {
      console.log("[fix-dayindex] trip has no startDate — skipping");
      continue;
    }

    const duration = trip.endDate
      ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const broken = trip.itineraryItems.filter(item => item.dayIndex === null || item.dayIndex === undefined);
    console.log(`[fix-dayindex] ${broken.length} items with null dayIndex out of ${trip.itineraryItems.length} total`);

    for (const item of broken) {
      const dateStr = item.scheduledDate;
      if (!dateStr) {
        console.log(`[fix-dayindex] skipping "${item.title}" — no scheduledDate`);
        continue;
      }

      let idx = calcDayIndex(trip.startDate, dateStr);
      if (idx < 0 || idx > duration) idx = 0;

      await db.itineraryItem.update({
        where: { id: item.id },
        data: { dayIndex: idx },
      });

      console.log(`[fix-dayindex] fixed: "${item.title}" → dayIndex ${idx}`);
    }
  }

  console.log("[fix-dayindex] done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
