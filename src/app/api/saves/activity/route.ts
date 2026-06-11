import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getVenueImage } from "@/lib/destination-images";
import { enrichSavedItem } from "@/lib/enrich-save";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sourceItemId } = body as { sourceItemId: string };
    if (!sourceItemId) return NextResponse.json({ error: "Missing sourceItemId" }, { status: 400 });

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Look up the source item — must belong to a PUBLIC trip (or have no trip at all)
    const source = await db.savedItem.findUnique({
      where: { id: sourceItemId },
      include: { trip: true },
    });
    if (!source) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    // Items with tripId: null are from-share items not owned by any trip — allow them.
    // Items belonging to a trip must come from a PUBLIC trip to prevent scraping private trips.
    if (source.tripId !== null && source.trip?.privacy !== "PUBLIC") {
      return NextResponse.json({ error: "Item not found" }, { status: 403 });
    }

    // Idempotency guard: block saving the same place to the same scope (tripId null = unassigned) twice.
    // Match hierarchy: googlePlaceId > communitySpotId > lat/lng + title.
    // Saving to unassigned when the place already exists on a trip is a different scope — allowed.
    const placeFilters: object[] = [];
    if (source.googlePlaceId) {
      placeFilters.push({ googlePlaceId: source.googlePlaceId });
    }
    if (source.communitySpotId) {
      placeFilters.push({ communitySpotId: source.communitySpotId });
    }
    if (source.lat !== null && source.lng !== null && source.rawTitle) {
      placeFilters.push({
        AND: [
          { lat: { gte: source.lat - 0.0001, lte: source.lat + 0.0001 } },
          { lng: { gte: source.lng - 0.0001, lte: source.lng + 0.0001 } },
          { rawTitle: { equals: source.rawTitle, mode: "insensitive" } },
        ],
      });
    }
    if (placeFilters.length > 0) {
      const existing = await db.savedItem.findFirst({
        where: {
          familyProfileId: profileId,
          tripId: null,
          deletedAt: null,
          OR: placeFilters,
        },
        select: { id: true, rawTitle: true, destinationCity: true },
      });
      if (existing) {
        return NextResponse.json({
          duplicate: true,
          existingId: existing.id,
          existingTitle: existing.rawTitle,
          existingCity: existing.destinationCity,
        });
      }
    }

    const savedItem = await db.savedItem.create({
      data: {
        familyProfileId: profileId,
        sourceMethod: "IN_APP_SAVE",
        sourcePlatform: "direct",
        rawTitle: source.rawTitle,
        rawDescription: source.rawDescription,
        categoryTags: normalizeAndDedupeCategoryTags(source.categoryTags),
        lat: source.lat,
        lng: source.lng,
        sourceUrl: source.sourceUrl ?? null,
        mediaThumbnailUrl: source.mediaThumbnailUrl ?? null,
        placePhotoUrl: (source.rawTitle ? (getVenueImage(source.rawTitle) ?? null) : null) ?? source.placePhotoUrl ?? null,
        destinationCity: source.destinationCity ?? source.trip?.destinationCity ?? null,
        destinationCountry: source.destinationCountry ?? source.trip?.destinationCountry ?? null,
        extractionStatus: "PENDING",
        status: "UNORGANIZED",
      },
    });
    enrichSavedItem(savedItem.id).catch(e => console.error("[activity] enrichSavedItem failed:", e));

    return NextResponse.json({ savedItem });
  } catch (error) {
    console.error("Save activity error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
