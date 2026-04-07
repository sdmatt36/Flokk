import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shareToken } = await req.json() as { shareToken: string };

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Find source trip
  const sourceTrip = await db.trip.findFirst({
    where: { shareToken, isPublic: true },
    include: {
      itineraryItems: true,
      manualActivities: true,
    },
  });
  if (!sourceTrip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Prevent stealing your own trip
  if (sourceTrip.familyProfileId === user.familyProfile.id) {
    return NextResponse.json({ error: "Cannot steal your own trip" }, { status: 400 });
  }

  const destinationCity = sourceTrip.destinationCity ?? "New";

  // Create new trip for this user
  const newTrip = await db.trip.create({
    data: {
      familyProfileId: user.familyProfile.id,
      title: `${destinationCity} Trip`,
      destinationCity: sourceTrip.destinationCity,
      destinationCountry: sourceTrip.destinationCountry,
      status: "PLANNING",
      shareToken: generateToken(),
      isPublic: false,
      isAnonymous: true,
    },
  });

  type SaveInput = {
    familyProfileId: string;
    tripId: string;
    rawTitle: string;
    rawDescription: string | null;
    lat: number | null;
    lng: number | null;
    destinationCity: string | null;
    sourceUrl: string | null;
    mediaThumbnailUrl: string | null;
    placePhotoUrl: string | null;
    status: "UNORGANIZED";
    sourceType: "IN_APP";
    categoryTags: string[];
    extractionStatus: "ENRICHED";
  };

  const savedItems: SaveInput[] = [];

  // Itinerary items — skip FLIGHT and LODGING
  for (const item of sourceTrip.itineraryItems) {
    if (item.type === "FLIGHT" || item.type === "LODGING") continue;
    savedItems.push({
      familyProfileId: user.familyProfile.id,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.latitude ?? null,
      lng: item.longitude ?? null,
      destinationCity: item.toCity ?? sourceTrip.destinationCity ?? null,
      sourceUrl: null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceType: "IN_APP",
      categoryTags: [item.type.toLowerCase()],
      extractionStatus: "ENRICHED",
    });
  }

  // Manual activities — include all
  for (const item of sourceTrip.manualActivities) {
    savedItems.push({
      familyProfileId: user.familyProfile.id,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      destinationCity: sourceTrip.destinationCity ?? null,
      sourceUrl: item.website ?? null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceType: "IN_APP",
      categoryTags: ["activity"],
      extractionStatus: "ENRICHED",
    });
  }

  if (savedItems.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.savedItem.createMany({ data: savedItems as any[] });
  }

  return NextResponse.json({
    tripId: newTrip.id,
    tripTitle: newTrip.title,
    copied: savedItems.length,
  });
}
