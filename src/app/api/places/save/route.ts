import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getOrCreatePlacesLibrary } from "@/lib/places-library";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  const body = await request.json() as {
    name: string;
    address?: string | null;
    city: string;
    type: string;
    lat?: number | null;
    lng?: number | null;
    website?: string | null;
    notes?: string | null;
    rating?: number | null;
    ratingNote?: string | null;
  };

  if (!body.name?.trim() || !body.city?.trim() || !body.type?.trim()) {
    return NextResponse.json({ error: "name, city, and type are required" }, { status: 400 });
  }

  let tripId: string;
  try {
    tripId = await getOrCreatePlacesLibrary(profileId);
  } catch {
    return NextResponse.json({ error: "Failed to initialize Places Library" }, { status: 500 });
  }

  const activity = await db.manualActivity.create({
    data: {
      tripId,
      title: body.name.trim(),
      date: new Date().toISOString().split("T")[0],
      city: body.city.trim(),
      type: body.type.toLowerCase(),
      address: body.address?.trim() ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      website: body.website?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
      status: "interested",
      dayIndex: null,
      sortOrder: 0,
    },
  });

  if (body.rating && body.rating >= 1 && body.rating <= 5) {
    await db.placeRating.create({
      data: {
        familyProfileId: profileId,
        manualActivityId: activity.id,
        placeName: activity.title,
        placeType: activity.type!,
        destinationCity: activity.city,
        lat: activity.lat,
        lng: activity.lng,
        rating: body.rating,
        notes: body.ratingNote?.trim() ?? null,
      },
    });
  }

  return NextResponse.json({
    id: activity.id,
    name: activity.title,
    city: activity.city,
    type: activity.type,
  }, { status: 201 });
}
