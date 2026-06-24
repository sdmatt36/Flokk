import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveShareToken } from "@/lib/share-token";
import { PLATFORM_FLOKK_TOURS } from "@/lib/saved-item-types";
import { mapPlaceTypesToCanonicalSlugs } from "@/lib/categories";
import { resolveCityAndCountry } from "@/lib/resolve-city";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const entity = await resolveShareToken(token);
  if (!entity || entity.entityType !== "generated_tour" || !entity.generatedTour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  const src = entity.generatedTour;

  // Carry the source tour's City linkage forward when present; otherwise resolve it from the
  // copied destinationCity so the clone is never orphaned from the City hierarchy.
  const cityLinkage = src.cityId
    ? { cityId: src.cityId, destinationCountry: src.destinationCountry ?? null }
    : await resolveCityAndCountry(src.destinationCity);

  // Create a cloned tour owned by the requesting profile
  const newTourId = nanoid();
  await db.$transaction(async (tx) => {
    await tx.generatedTour.create({
      data: {
        id: newTourId,
        familyProfileId: profileId,
        title: src.title,
        destinationCity: src.destinationCity,
        cityId: cityLinkage.cityId,
        destinationCountry: cityLinkage.destinationCountry,
        prompt: src.prompt,
        durationLabel: src.durationLabel,
        transport: src.transport,
        categoryTags: src.categoryTags,
        isPublic: false,
        originalTargetStops: src.stops.length,
      },
    });

    for (const stop of src.stops) {
      // One SavedItem per stop, in the recipient's LIBRARY (tripId null, UNORGANIZED),
      // linked to the cloned tour. Public-safe fields only — never the sharer's private
      // why/familyNote or identity. Mirrors the SavedItem shape in /api/tours/save.
      const savedItem = await tx.savedItem.create({
        data: {
          familyProfileId: profileId,
          tripId: null,
          tourId: newTourId,
          sourceMethod: "IN_APP_SAVE",
          sourcePlatform: PLATFORM_FLOKK_TOURS,
          rawTitle: stop.name,
          destinationCity: src.destinationCity,
          destinationCountry: src.destinationCountry ?? null,
          lat: stop.lat ?? null,
          lng: stop.lng ?? null,
          placePhotoUrl: stop.imageUrl ?? null,
          websiteUrl: stop.websiteUrl ?? null,
          categoryTags: mapPlaceTypesToCanonicalSlugs(stop.placeTypes ?? []),
          status: "UNORGANIZED",
          extractionStatus: "ENRICHED",
        },
      });

      await tx.tourStop.create({
        data: {
          id: nanoid(),
          tourId: newTourId,
          orderIndex: stop.orderIndex,
          name: stop.name,
          address: stop.address ?? null,
          lat: stop.lat ?? null,
          lng: stop.lng ?? null,
          durationMin: stop.durationMin ?? null,
          travelTimeMin: stop.travelTimeMin ?? null,
          why: stop.why ?? null,
          familyNote: stop.familyNote ?? null,
          imageUrl: stop.imageUrl ?? null,
          websiteUrl: stop.websiteUrl ?? null,
          ticketRequired: stop.ticketRequired ?? null,
          placeTypes: stop.placeTypes,
          savedItemId: savedItem.id,
        },
      });
    }
  });

  return NextResponse.json({ saved: true, tourId: newTourId }, { status: 201 });
}
