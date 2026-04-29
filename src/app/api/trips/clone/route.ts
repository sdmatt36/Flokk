import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getVenueImage } from "@/lib/destination-images";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sourceTripId, title, startDate, endDate, importActivities } = body as {
      sourceTripId: string;
      title: string;
      startDate?: string;
      endDate?: string;
      importActivities?: boolean;
    };

    if (!sourceTripId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Source trip must be PUBLIC
    const source = await db.trip.findUnique({
      where: { id: sourceTripId },
      include: {
        savedItems: {
          where: { dayIndex: { gt: 0 } },
          orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }],
        },
      },
    });
    if (!source || source.privacy !== "PUBLIC") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const builtData = await buildTripFromExtraction({
      cities: source.cities.length > 0 ? source.cities : (source.destinationCity ? [source.destinationCity] : []),
      country: source.country ?? source.destinationCountry ?? null,
      countries: source.countries.length > 0 ? source.countries : undefined,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      statusOverride: "PLANNING",
      isAnonymous: true,
    });

    const newTrip = await db.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          ...builtData,
          title: title.trim(),
          heroImageUrl: source.heroImageUrl ?? builtData.heroImageUrl,
          familyProfileId: profileId,
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

    if (importActivities && source.savedItems.length > 0) {
      await db.savedItem.createMany({
        data: source.savedItems.map((item) => ({
          familyProfileId: profileId,
          tripId: newTrip.id,
          sourceMethod: "SHARED_TRIP_IMPORT" as const,
          sourcePlatform: "direct",
          rawTitle: item.rawTitle,
          rawDescription: item.rawDescription,
          categoryTags: normalizeAndDedupeCategoryTags(item.categoryTags),
          lat: item.lat,
          lng: item.lng,
          destinationCity: item.destinationCity ?? source.destinationCity ?? null,
          destinationCountry: item.destinationCountry ?? source.destinationCountry ?? null,
          dayIndex: item.dayIndex,
          placePhotoUrl: (item.rawTitle ? (getVenueImage(item.rawTitle) ?? null) : null) ?? item.placePhotoUrl ?? null,
          extractionStatus: "ENRICHED" as const,
          status: "TRIP_ASSIGNED" as const,
        })),
      });
    }

    // Increment clone count on source trip
    await db.trip.update({
      where: { id: sourceTripId },
      data: { cloneCount: { increment: 1 } },
    });

    return NextResponse.json({ tripId: newTrip.id });
  } catch (error) {
    console.error("Clone trip error:", error);
    return NextResponse.json({ error: "Failed to clone trip" }, { status: 500 });
  }
}
