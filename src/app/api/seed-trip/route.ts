import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.trip.create({
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
            sourceType: "MANUAL",
            sourceUrl: "https://www.okinawatravelinfo.com",
            rawTitle: "Churaumi Aquarium",
            rawDescription: "One of the world's largest aquariums — massive whale shark tank, manta ray lagoon, and deep-sea exhibits. Perfect for a family half-day.",
            extractionStatus: "ENRICHED",
            status: "TRIP_ASSIGNED",
            categoryTags: ["aquarium", "family", "kids"],
          },
          {
            familyProfileId: profileId,
            sourceType: "GOOGLE_MAPS",
            sourceUrl: "https://maps.google.com/?q=Katsuren+Castle",
            rawTitle: "Katsuren Castle Ruins",
            rawDescription: "UNESCO World Heritage site — 14th-century Ryukyu castle perched on a hill with panoramic ocean views. Stunning at golden hour.",
            extractionStatus: "ENRICHED",
            status: "TRIP_ASSIGNED",
            categoryTags: ["history", "culture", "outdoors"],
          },
          {
            familyProfileId: profileId,
            sourceType: "INSTAGRAM",
            sourceUrl: "https://www.instagram.com/p/example",
            rawTitle: "Naha Kokusai-dori Street Food",
            rawDescription: "Okinawa's main strip — sata andagi doughnuts, taco rice, Orion beer, and Blue Seal ice cream. Walk it in the evening.",
            extractionStatus: "ENRICHED",
            status: "TRIP_ASSIGNED",
            categoryTags: ["food", "street food", "nightlife"],
          },
        ],
      },
    },
  });

  return NextResponse.json({ success: true, tripId: trip.id });
}
