import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getVenueImage } from "@/lib/destination-images";

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

    const savedItem = await db.savedItem.create({
      data: {
        familyProfileId: profileId,
        sourceType: "IN_APP",
        rawTitle: source.rawTitle,
        rawDescription: source.rawDescription,
        categoryTags: source.categoryTags,
        lat: source.lat,
        lng: source.lng,
        sourceUrl: source.sourceUrl ?? null,
        mediaThumbnailUrl: source.mediaThumbnailUrl ?? null,
        placePhotoUrl: (source.rawTitle ? (getVenueImage(source.rawTitle) ?? null) : null) ?? source.placePhotoUrl ?? null,
        destinationCity: source.destinationCity ?? source.trip?.destinationCity ?? null,
        destinationCountry: source.destinationCountry ?? source.trip?.destinationCountry ?? null,
        extractionStatus: "ENRICHED",
        status: "UNORGANIZED",
      },
    });

    return NextResponse.json({ savedItem });
  } catch (error) {
    console.error("Save activity error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
