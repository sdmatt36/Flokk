import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    lat?: number | null;
    lng?: number | null;
    destinationCity?: string | null;
    tripDestination?: string | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { familyProfile: { select: { id: true } } },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  // Dedup by title within this family's saves
  const existing = await db.savedItem.findFirst({
    where: {
      familyProfileId: user.familyProfile.id,
      rawTitle: { equals: body.title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ duplicate: true, existingId: existing.id });
  }

  // Look up an existing PLANNING trip for this destination
  let matchingTrip: { id: string; title: string } | null = null;
  if (body.tripDestination) {
    matchingTrip = await db.trip.findFirst({
      where: {
        familyProfileId: user.familyProfile.id,
        status: "PLANNING",
        destinationCity: { contains: body.tripDestination, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });
  }

  const saved = await db.savedItem.create({
    data: {
      familyProfileId: user.familyProfile.id,
      tripId: matchingTrip?.id ?? null,
      rawTitle: body.title.trim(),
      rawDescription: body.description ?? null,
      mediaThumbnailUrl: body.thumbnailUrl ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      destinationCity: body.destinationCity ?? null,
      sourceType: "IN_APP",
      status: matchingTrip ? "TRIP_ASSIGNED" : "UNORGANIZED",
      categoryTags: [],
      extractionStatus: "ENRICHED",
    },
  });

  return NextResponse.json(
    { savedId: saved.id, tripTitle: matchingTrip?.title ?? null },
    { status: 201 }
  );
}
