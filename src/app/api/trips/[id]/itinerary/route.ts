import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/trips/[id]/itinerary
// Returns all IN_APP SavedItems with a non-null dayIndex (items added from recommendations).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await db.savedItem.findMany({
    where: { tripId, dayIndex: { not: null } },
    orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }, { savedAt: "asc" }],
    select: {
      id: true,
      rawTitle: true,
      rawDescription: true,
      mediaThumbnailUrl: true,
      dayIndex: true,
      sortOrder: true,
      lat: true,
      lng: true,
      isBooked: true,
      startTime: true,
    },
  });

  return NextResponse.json({ items });
}

// POST /api/trips/[id]/itinerary
// Adds a recommended item to the trip itinerary by creating a SavedItem
// with the given dayIndex.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, location, imageUrl, dayIndex, lat, lng, categoryTags } = body as {
    title: string;
    location?: string;
    imageUrl?: string;
    dayIndex: number;
    lat?: number;
    lng?: number;
    categoryTags?: string[];
  };

  if (!title || dayIndex === undefined || dayIndex === null) {
    return NextResponse.json({ error: "title and dayIndex required" }, { status: 400 });
  }

  const item = await db.savedItem.create({
    data: {
      familyProfileId: user.familyProfile.id,
      tripId,
      sourceType: "IN_APP",
      rawTitle: title,
      rawDescription: location ?? null,
      mediaThumbnailUrl: imageUrl ?? null,
      dayIndex,
      lat: lat ?? null,
      lng: lng ?? null,
      categoryTags: categoryTags ?? [],
      status: "TRIP_ASSIGNED",
    },
  });

  return NextResponse.json({ item: { id: item.id, dayIndex: item.dayIndex } });
}
