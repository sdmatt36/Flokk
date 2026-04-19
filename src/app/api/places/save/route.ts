import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getOrCreatePlacesLibrary } from "@/lib/places-library";
import { writeThroughCommunitySpot } from "@/lib/community-write-through";
import { ensureSavedItemForRating } from "@/lib/ensure-saved-item-for-rating";
import { normalizePlaceName } from "@/lib/google-places";

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
    imageUrl?: string | null;
    alsoAddToTripId?: string | null;
    alsoAddToDayIndex?: number | null;
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

  const activity = await db.$transaction(async (tx) => {
    const created = await tx.manualActivity.create({
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
        imageUrl: body.imageUrl?.trim() ?? null,
        status: "interested",
        dayIndex: null,
        sortOrder: 0,
      },
    });

    if (body.rating && body.rating >= 1 && body.rating <= 5) {
      await tx.placeRating.create({
        data: {
          familyProfileId: profileId,
          manualActivityId: created.id,
          placeName: created.title,
          placeType: created.type!,
          destinationCity: created.city,
          lat: created.lat,
          lng: created.lng,
          rating: body.rating,
          notes: body.ratingNote?.trim() ?? null,
        },
      });

      const spotId = await writeThroughCommunitySpot(tx, {
        name: created.title,
        city: created.city ?? "",
        country: null,
        lat: created.lat ?? null,
        lng: created.lng ?? null,
        photoUrl: created.imageUrl ?? null,
        websiteUrl: created.website ?? null,
        description: body.ratingNote ?? null,
        category: created.type ?? null,
        googlePlaceId: null,
        authorProfileId: profileId,
        familyProfileId: profileId,
        rating: body.rating,
        note: body.ratingNote ?? null,
      });

      if (spotId) {
        await ensureSavedItemForRating(tx, {
          familyProfileId: profileId,
          communitySpotId: spotId,
          placeName: normalizePlaceName(created.title),
          city: created.city ?? "",
          country: null,
          lat: created.lat ?? null,
          lng: created.lng ?? null,
          photoUrl: created.imageUrl ?? null,
          websiteUrl: created.website ?? null,
          category: created.type ?? null,
          googlePlaceId: null,
          rating: body.rating ?? null,
          note: body.ratingNote ?? null,
        });
      }
    }

    return created;
  }, { timeout: 10000 });

  let addedToTrip = false;
  if (body.alsoAddToTripId) {
    const targetTrip = await db.trip.findFirst({
      where: { id: body.alsoAddToTripId, familyProfileId: profileId },
      select: { id: true, startDate: true },
    });
    if (targetTrip) {
      const dayOffset = body.alsoAddToDayIndex ?? 0;
      let date: string;
      if (targetTrip.startDate) {
        const tripStart = new Date(targetTrip.startDate.toISOString().split("T")[0] + "T12:00:00");
        tripStart.setDate(tripStart.getDate() + dayOffset);
        date = tripStart.toISOString().split("T")[0];
      } else {
        date = new Date().toISOString().split("T")[0];
      }
      await db.manualActivity.create({
        data: {
          tripId: body.alsoAddToTripId,
          title: body.name.trim(),
          date,
          city: body.city.trim(),
          type: body.type.toLowerCase(),
          address: body.address?.trim() ?? null,
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          website: body.website?.trim() ?? null,
          notes: body.notes?.trim() ?? null,
          status: "interested",
          dayIndex: dayOffset,
          sortOrder: 0,
        },
      });
      addedToTrip = true;
    }
  }

  return NextResponse.json({
    id: activity.id,
    name: activity.title,
    city: activity.city,
    type: activity.type,
    addedToTrip,
  }, { status: 201 });
}
