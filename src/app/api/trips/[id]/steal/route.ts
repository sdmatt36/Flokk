import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { canEditTripContent } from "@/lib/trip-permissions";
import { computeStatus } from "@/lib/saved-item-types";

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

  const targetTrip = await db.trip.findUnique({
    where: { id: targetTripId },
    select: { title: true },
  });
  if (!targetTrip || !(await canEditTripContent(profileId, targetTripId))) {
    return NextResponse.json({ error: "Target trip not found" }, { status: 404 });
  }

  // Get itinerary items from selected days — skip FLIGHT and LODGING
  const itineraryItems = await db.itineraryItem.findMany({
    where: {
      tripId: sourceId,
      dayIndex: { in: dayIndexes },
      type: { notIn: ["FLIGHT", "LODGING"] },
      cancelledAt: null,
    },
    select: { title: true, type: true, notes: true, latitude: true, longitude: true, toCity: true },
  });

  // Get manual activities from selected days
  const manualActivities = await db.manualActivity.findMany({
    where: {
      tripId: sourceId,
      dayIndex: { in: dayIndexes },
      deletedAt: null,
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
    dayIndex: number | null;
    status: ReturnType<typeof computeStatus>;
    sourceMethod: "SHARED_TRIP_IMPORT";
    sourcePlatform: "direct";
    categoryTags: string[];
  };

  // Stolen items land in the target trip unscheduled (no dayIndex). Status is derived from
  // computeStatus, never hardcoded: tripId set + dayIndex null → TRIP_ASSIGNED (the 149-class fix).
  const stolenStatus = computeStatus(targetTripId, null, null);

  // Idempotent dedupe: skip any item whose title is already on the target trip, so re-stealing the
  // same days does not duplicate. Source rows here are ItineraryItem/ManualActivity (no
  // googlePlaceId / source-save id), so the stable key is the normalized title.
  const existingTargetSaves = await db.savedItem.findMany({
    where: { tripId: targetTripId, deletedAt: null },
    select: { rawTitle: true },
  });
  const seenTitles = new Set(
    existingTargetSaves.map((s) => (s.rawTitle ?? "").trim().toLowerCase()).filter(Boolean)
  );

  const savedItems: SaveInput[] = [];

  for (const item of itineraryItems) {
    const key = (item.title ?? "").trim().toLowerCase();
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
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
      dayIndex: null,
      status: stolenStatus,
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: normalizeAndDedupeCategoryTags([item.type.toLowerCase()]),
    });
  }

  for (const item of manualActivities) {
    const key = (item.title ?? "").trim().toLowerCase();
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
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
      dayIndex: null,
      status: stolenStatus,
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: normalizeAndDedupeCategoryTags(["activity"]),
    });
  }

  // Genuinely empty source days → 400. All items already present (deduped) → idempotent no-op.
  if (itineraryItems.length === 0 && manualActivities.length === 0) {
    return NextResponse.json({ error: "No copyable items in selected days" }, { status: 400 });
  }
  if (savedItems.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.savedItem.createMany({ data: savedItems as any[] });
  }

  return NextResponse.json({
    copied: savedItems.length,
    tripName: targetTrip.title ?? "your trip",
  });
}
