import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizeAndDedupeCategoryTags } from "../src/lib/category-tags";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all Places Library trips
  const placeTrips = await prisma.trip.findMany({
    where: { isPlacesLibrary: true },
    select: { id: true, familyProfileId: true, title: true },
  });

  console.log(`Found ${placeTrips.length} Places Library trip(s)`);

  for (const trip of placeTrips) {
    const activities = await prisma.manualActivity.findMany({
      where: { tripId: trip.id },
      orderBy: { createdAt: "asc" },
    });

    console.log(`\nTrip "${trip.title}" (${trip.id}) — ${activities.length} activities`);

    for (const act of activities) {
      // Idempotency: skip if a SavedItem with same rawTitle + destinationCity already exists for this profile
      const existing = await prisma.savedItem.findFirst({
        where: {
          familyProfileId: trip.familyProfileId,
          rawTitle: act.title,
          destinationCity: act.city ?? undefined,
        },
      });

      if (existing) {
        console.log(`  SKIP (already exists): "${act.title}" (${act.city ?? "no city"})`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.savedItem.create({
          data: {
            familyProfileId: trip.familyProfileId,
            rawTitle: act.title,
            destinationCity: act.city ?? null,
            categoryTags: normalizeAndDedupeCategoryTags(act.type ? [act.type] : []),
            notes: act.notes ?? null,
            placePhotoUrl: act.imageUrl ?? null,
            lat: act.lat ?? null,
            lng: act.lng ?? null,
            websiteUrl: act.website ?? null,
            sourceMethod: "IN_APP_SAVE",
            sourcePlatform: "direct",
            status: "UNORGANIZED",
            extractionStatus: "ENRICHED",
            savedAt: act.createdAt,
          },
        });

        await tx.manualActivity.delete({ where: { id: act.id } });
      });

      console.log(`  MIGRATED: "${act.title}" (${act.city ?? "no city"})`);
    }
  }

  // Verify: count remaining ManualActivity rows in all Places Library trips
  const remaining = await prisma.manualActivity.count({
    where: { trip: { isPlacesLibrary: true } },
  });
  console.log(`\nDone. ManualActivity rows remaining in Places Library trips: ${remaining}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
