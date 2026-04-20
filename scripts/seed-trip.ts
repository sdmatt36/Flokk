import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  // Find all family profiles so we can seed for each account
  const profiles = await db.familyProfile.findMany({
    select: { id: true, familyName: true, userId: true },
  });

  if (profiles.length === 0) {
    console.log("No family profiles found. Complete onboarding first.");
    return;
  }

  console.log(`Found ${profiles.length} profile(s). Seeding trip for each...`);

  for (const profile of profiles) {
    // Skip if trip already exists
    const existing = await db.trip.findFirst({
      where: { familyProfileId: profile.id, title: "Okinawa May '25" },
    });

    if (existing) {
      console.log(`Profile ${profile.id}: trip already exists (${existing.id})`);
      continue;
    }

    const trip = await db.trip.create({
      data: {
        familyProfileId: profile.id,
        title: "Okinawa May '25",
        destinationCity: "Okinawa",
        destinationCountry: "Japan",
        startDate: new Date("2025-05-04"),
        endDate: new Date("2025-05-08"),
        status: "PLANNING",
        privacy: "PRIVATE",
        savedItems: {
          create: [
            {
              familyProfileId: profile.id,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "direct",
              sourceUrl: "https://churaumi.okinawa/en",
              rawTitle: "Churaumi Aquarium",
              rawDescription:
                "One of the world's largest aquariums — massive whale shark tank, manta ray lagoon, and deep-sea exhibits. Perfect for a family half-day.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: ["aquarium", "family", "kids"],
            },
            {
              familyProfileId: profile.id,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "google_maps",
              rawTitle: "Katsuren Castle Ruins",
              rawDescription:
                "UNESCO World Heritage site — 14th-century Ryukyu castle perched on a hill with panoramic ocean views. Stunning at golden hour.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: ["history", "culture", "heritage"],
            },
            {
              familyProfileId: profile.id,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "instagram",
              rawTitle: "Naha Kokusai-dori Street Food",
              rawDescription:
                "Okinawa's main strip — sata andagi doughnuts, taco rice, Orion beer, and Blue Seal ice cream. Walk it in the evening.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: ["food", "street food", "nightlife"],
            },
          ],
        },
      },
    });

    console.log(`Profile ${profile.id}: created trip ${trip.id}`);
  }
}

main()
  .then(() => console.log("Done."))
  .catch(console.error)
  .finally(() => db.$disconnect());
