import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { getTripAccess } from "@/lib/trip-permissions";
import { buildClonedItem, computeScheduledDate } from "@/lib/clone-saved-items";

export const maxDuration = 60;

function inferCategoryTags(title: string, notes: string | null): string[] {
  const text = (title + " " + (notes ?? "")).toLowerCase();
  if (/restaurant|cafe|coffee|bar|food|eat|lunch|dinner|breakfast|bbq|burger|pizza|ramen|sushi/.test(text)) return ["food"];
  if (/museum|palace|temple|village|park|garden|monument|castle|shrine/.test(text)) return ["culture"];
  if (/beach|hike|outdoor|mountain|lake|river|nature|surf/.test(text)) return ["outdoor"];
  if (/shop|market|mall|store|boutique/.test(text)) return ["shopping"];
  if (/cable car|sky|observation|tower|view|baseball|game|sport|stadium|arena/.test(text)) return ["activity"];
  return ["activity"];
}

// Source trips use 1-based dayIndex (Day 1 = 1). TripTabContent uses 0-based (Day 1 = 0).
// Subtract 1 to convert — null stays null (unassigned).
function convertDayIndex(sourceDayIndex: number | null): number | null {
  if (sourceDayIndex == null || sourceDayIndex <= 0) return null;
  return sourceDayIndex - 1;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shareToken, startDate } = await req.json() as { shareToken: string; startDate?: string };

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Find source trip — shareToken is sufficient authorization
  const sourceTrip = await db.trip.findFirst({
    where: { shareToken },
    include: {
      // SavedItems are the primary content source (especially seeded Flokker examples)
      savedItems: {
        where: { dayIndex: { gt: 0 }, deletedAt: null },
        orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }],
      },
      itineraryItems: true,
      manualActivities: true,
    },
  });
  if (!sourceTrip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Prevent stealing a trip you already own or collaborate on
  if (await getTripAccess(profileId, sourceTrip.id) !== null) {
    return NextResponse.json({ error: "Cannot steal your own trip" }, { status: 400 });
  }

  // Determine trip duration from max dayIndex across all sources
  const allDayIndices = [
    ...sourceTrip.savedItems.map(s => s.dayIndex ?? 0),
    ...sourceTrip.itineraryItems.map(i => i.dayIndex ?? 0),
    ...sourceTrip.manualActivities.map(m => m.dayIndex ?? 0),
  ];
  const maxSourceDayIndex = allDayIndices.length > 0 ? Math.max(...allDayIndices) : 0;

  // Date handling: use provided startDate or null; compute endDate from source duration
  const tripStartDate = startDate ?? null;
  const tripEndDate = tripStartDate && maxSourceDayIndex > 0
    ? computeScheduledDate(tripStartDate, maxSourceDayIndex)
    : null;

  const builtData = await buildTripFromExtraction({
    cities: sourceTrip.cities.length > 0 ? sourceTrip.cities : (sourceTrip.destinationCity ? [sourceTrip.destinationCity] : []),
    country: sourceTrip.country ?? sourceTrip.destinationCountry ?? null,
    countries: sourceTrip.countries.length > 0 ? sourceTrip.countries : undefined,
    startDate: tripStartDate,
    endDate: tripEndDate,
    isAnonymous: true,
  });

  // Create new trip for this user, record source lineage
  const newTrip = await db.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        ...builtData,
        familyProfileId: profileId,
        sourceTripId: sourceTrip.id,
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
    // Increment clone count on source trip
    await tx.trip.update({
      where: { id: sourceTrip.id },
      data: { cloneCount: { increment: 1 } },
    });
    return created;
  });

  const savedItemsToCreate = [];

  // Primary source: SavedItems with dayIndex > 0 (covers seeded Flokker examples)
  // Convert 1-based source dayIndex to 0-based for TripTabContent compatibility
  for (const item of sourceTrip.savedItems) {
    if (!item.rawTitle) continue;
    const dayIndex = convertDayIndex(item.dayIndex);
    savedItemsToCreate.push(buildClonedItem({
      familyProfileId: profileId,
      tripId: newTrip.id,
      rawTitle: item.rawTitle,
      rawDescription: item.rawDescription ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      destinationCity: item.destinationCity ?? sourceTrip.destinationCity ?? null,
      destinationCountry: item.destinationCountry ?? sourceTrip.destinationCountry ?? null,
      placePhotoUrl: item.placePhotoUrl ?? null,
      websiteUrl: item.websiteUrl ?? null,
      categoryTags: item.categoryTags.length > 0 ? item.categoryTags : inferCategoryTags(item.rawTitle, item.rawDescription ?? null),
      dayIndex,
    }));
  }

  // Secondary source: ItineraryItems (email-imported bookings for user trips)
  // Skip FLIGHT and LODGING; skip if a SavedItem covers the same day+title
  const savedTitlesInDay = new Set(
    savedItemsToCreate.map(s => `${s.dayIndex}|${s.rawTitle?.toLowerCase()}`)
  );
  for (const item of sourceTrip.itineraryItems) {
    if (item.type === "FLIGHT" || item.type === "LODGING") continue;
    const dayIndex = convertDayIndex(item.dayIndex);
    const key = `${dayIndex}|${item.title.toLowerCase()}`;
    if (savedTitlesInDay.has(key)) continue;
    savedItemsToCreate.push(buildClonedItem({
      familyProfileId: profileId,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.latitude ?? null,
      lng: item.longitude ?? null,
      destinationCity: item.toCity ?? sourceTrip.destinationCity ?? null,
      categoryTags: inferCategoryTags(item.title, item.notes ?? null),
      dayIndex,
    }));
  }

  // Manual activities — include all
  for (const item of sourceTrip.manualActivities) {
    const dayIndex = convertDayIndex(item.dayIndex);
    savedItemsToCreate.push(buildClonedItem({
      familyProfileId: profileId,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      destinationCity: sourceTrip.destinationCity ?? null,
      placePhotoUrl: null,
      websiteUrl: item.website ?? null,
      categoryTags: inferCategoryTags(item.title, item.notes ?? null),
      dayIndex,
    }));
  }

  if (savedItemsToCreate.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.savedItem.createMany({ data: savedItemsToCreate as any[] });
  }

  // Enrich images for stolen saves via Google Places (up to 20 items)
  const newSaves = await db.savedItem.findMany({
    where: { familyProfileId: profileId, tripId: newTrip.id, placePhotoUrl: null },
    select: { id: true, rawTitle: true, destinationCity: true },
  });

  for (const save of newSaves.slice(0, 20)) {
    try {
      const query = encodeURIComponent(`${save.rawTitle} ${save.destinationCity ?? ""}`);
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const searchData = await searchRes.json() as { results?: { place_id: string }[] };
      const placeId = searchData.results?.[0]?.place_id;
      if (!placeId) continue;

      const detailRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const detailData = await detailRes.json() as { result?: { photos?: { photo_reference: string }[] } };
      const photoRef = detailData.result?.photos?.[0]?.photo_reference;
      if (!photoRef) continue;

      const redirectUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const photoRes = await fetch(redirectUrl, { redirect: "follow" });
      const finalUrl = photoRes.url;
      if (finalUrl && finalUrl !== redirectUrl) {
        await db.savedItem.update({ where: { id: save.id }, data: { placePhotoUrl: finalUrl } });
      }
    } catch { continue; }
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({
    tripId: newTrip.id,
    tripTitle: newTrip.title,
    copied: savedItemsToCreate.length,
  });
}
