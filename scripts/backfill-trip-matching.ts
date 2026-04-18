import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Inlined matching logic using the script's prisma instance (avoids the shared db singleton / dotenv ordering issue)
async function findBestTrip(
  familyProfileId: string,
  city: string
): Promise<{ id: string; title: string } | null> {
  const now = new Date();
  const trips = await prisma.trip.findMany({
    where: {
      familyProfileId,
      destinationCity: { equals: city, mode: "insensitive" },
      isPlacesLibrary: false,
    },
    select: { id: true, title: true, startDate: true, endDate: true },
  });
  if (trips.length === 0) return null;
  const upcoming = trips.filter(t => t.endDate && t.endDate.getTime() >= now.getTime());
  const past = trips.filter(t => !t.endDate || t.endDate.getTime() < now.getTime());
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity));
    return upcoming[0];
  }
  past.sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0));
  return past[0];
}

async function main() {
  // Idempotent: only process items where tripId IS NULL and destinationCity is set
  const candidates = await prisma.savedItem.findMany({
    where: {
      tripId: null,
      destinationCity: { not: null },
      status: { not: "TRIP_ASSIGNED" },
    },
    select: { id: true, rawTitle: true, destinationCity: true, familyProfileId: true },
    orderBy: { savedAt: "asc" },
  });

  console.log(`Found ${candidates.length} SavedItem rows to process`);

  let matched = 0;
  let noMatch = 0;
  let errors = 0;

  for (const item of candidates) {
    try {
      const trip = await findBestTrip(item.familyProfileId, item.destinationCity!);
      if (trip) {
        await prisma.savedItem.update({
          where: { id: item.id },
          data: { tripId: trip.id, status: "TRIP_ASSIGNED" },
        });
        console.log(`  MATCHED: "${item.rawTitle ?? item.id}" city=${item.destinationCity} → "${trip.title}"`);
        matched++;
      } else {
        console.log(`  NO MATCH: "${item.rawTitle ?? item.id}" city=${item.destinationCity}`);
        noMatch++;
      }
    } catch (e) {
      console.error(`  ERROR: "${item.rawTitle ?? item.id}" city=${item.destinationCity}`, e);
      errors++;
    }
  }

  console.log(`\nDone. Matched: ${matched}, No match: ${noMatch}, Errors: ${errors}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
