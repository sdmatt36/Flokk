import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        familyProfileId: profileId,
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
              familyProfileId: profileId,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "direct",
              sourceUrl: "https://www.okinawatravelinfo.com",
              rawTitle: "Churaumi Aquarium",
              rawDescription: "One of the world's largest aquariums — massive whale shark tank, manta ray lagoon, and deep-sea exhibits. Perfect for a family half-day.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: normalizeAndDedupeCategoryTags(["aquarium", "family", "kids"]),
            },
            {
              familyProfileId: profileId,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "google_maps",
              sourceUrl: "https://maps.google.com/?q=Katsuren+Castle",
              rawTitle: "Katsuren Castle Ruins",
              rawDescription: "UNESCO World Heritage site — 14th-century Ryukyu castle perched on a hill with panoramic ocean views. Stunning at golden hour.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: normalizeAndDedupeCategoryTags(["history", "culture", "outdoors"]),
            },
            {
              familyProfileId: profileId,
              sourceMethod: "URL_PASTE",
              sourcePlatform: "instagram",
              sourceUrl: "https://www.instagram.com/p/example",
              rawTitle: "Naha Kokusai-dori Street Food",
              rawDescription: "Okinawa's main strip — sata andagi doughnuts, taco rice, Orion beer, and Blue Seal ice cream. Walk it in the evening.",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: normalizeAndDedupeCategoryTags(["food", "street food", "nightlife"]),
            },
          ],
        },
      },
    });
    await tx.tripCollaborator.create({
      data: {
        tripId: created.id,
        familyProfileId: profileId,
        role: "OWNER",
        invitedById: profileId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
    return created;
  });

  return NextResponse.json({ success: true, tripId: trip.id });
}
