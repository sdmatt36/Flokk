import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { sendTripStolenEvent } from "@/lib/loops";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sourceId } = await params;
  const body = await req.json() as { targetTripId: string; dayIndexes: number[] };
  const { targetTripId, dayIndexes } = body;

  if (!targetTripId || !Array.isArray(dayIndexes) || dayIndexes.length === 0) {
    return NextResponse.json({ error: "targetTripId and dayIndexes required" }, { status: 400 });
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Verify source trip is publicly shared
  const sourceTrip = await db.trip.findUnique({
    where: { id: sourceId },
    select: { shareToken: true },
  });
  if (!sourceTrip?.shareToken) {
    return NextResponse.json({ error: "Trip not found or not shared" }, { status: 404 });
  }

  // Verify target trip belongs to this user
  const targetTrip = await db.trip.findUnique({
    where: { id: targetTripId },
    select: { familyProfileId: true, title: true },
  });
  if (!targetTrip || targetTrip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Target trip not found" }, { status: 404 });
  }

  // Get itinerary items from selected days — skip FLIGHT and LODGING
  const itineraryItems = await db.itineraryItem.findMany({
    where: {
      tripId: sourceId,
      dayIndex: { in: dayIndexes },
      type: { notIn: ["FLIGHT", "LODGING"] },
    },
    select: { title: true, type: true, notes: true, latitude: true, longitude: true, toCity: true },
  });

  // Get manual activities from selected days
  const manualActivities = await db.manualActivity.findMany({
    where: {
      tripId: sourceId,
      dayIndex: { in: dayIndexes },
    },
    select: { title: true, notes: true, lat: true, lng: true, website: true },
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
    sourceMethod: "SHARED_TRIP_IMPORT";
    sourcePlatform: "direct";
    categoryTags: string[];
  };

  const savedItems: SaveInput[] = [];

  for (const item of itineraryItems) {
    savedItems.push({
      familyProfileId: profileId,
      tripId: targetTripId,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.latitude ?? null,
      lng: item.longitude ?? null,
      destinationCity: item.toCity ?? null,
      sourceUrl: null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: [item.type.toLowerCase()],
    });
  }

  for (const item of manualActivities) {
    savedItems.push({
      familyProfileId: profileId,
      tripId: targetTripId,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      destinationCity: null,
      sourceUrl: item.website ?? null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: ["activity"],
    });
  }

  if (savedItems.length === 0) {
    return NextResponse.json({ error: "No copyable items in selected days" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.savedItem.createMany({ data: savedItems as any[] });

  // Loops: notify original trip owner that their trip was stolen
  try {
    const sourceTripOwner = await db.trip.findUnique({
      where: { id: sourceId },
      select: { familyProfile: { select: { user: { select: { email: true } } } }, destinationCity: true },
    });
    if (sourceTripOwner?.familyProfile?.user?.email) {
      await sendTripStolenEvent(sourceTripOwner.familyProfile.user.email, {
        tripDestination: sourceTripOwner.destinationCity ?? "your destination",
      });
    }
  } catch (e) { console.error("[loops] trip_stolen event error", e); }

  return NextResponse.json({
    copied: savedItems.length,
    tripName: targetTrip.title ?? "your trip",
  });
}
