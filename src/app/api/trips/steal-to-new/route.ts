import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { getTripAccess } from "@/lib/trip-permissions";

export const maxDuration = 60;

function getCategoryTags(title: string, notes: string | null): string[] {
  const text = (title + " " + (notes ?? "")).toLowerCase();
  if (/restaurant|cafe|coffee|bar|food|eat|lunch|dinner|breakfast|bbq|burger|pizza|ramen|sushi/.test(text)) return ["food"];
  if (/museum|palace|temple|village|park|garden|monument|castle|shrine/.test(text)) return ["culture"];
  if (/beach|hike|outdoor|mountain|lake|river|nature|surf/.test(text)) return ["outdoor"];
  if (/shop|market|mall|store|boutique/.test(text)) return ["shopping"];
  if (/cable car|sky|observation|tower|view|baseball|game|sport|stadium|arena/.test(text)) return ["activity"];
  return ["activity"];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shareToken } = await req.json() as { shareToken: string };

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Find source trip — shareToken is sufficient authorization
  const sourceTrip = await db.trip.findFirst({
    where: { shareToken },
    include: {
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

  // Only carry dates forward if they are in the future — past dates are not useful to the new owner
  const now = new Date();
  const startDate = sourceTrip.startDate && sourceTrip.startDate > now ? sourceTrip.startDate.toISOString().substring(0, 10) : null;
  const endDate = sourceTrip.endDate && sourceTrip.endDate > now ? sourceTrip.endDate.toISOString().substring(0, 10) : null;

  const builtData = await buildTripFromExtraction({
    cities: sourceTrip.cities.length > 0 ? sourceTrip.cities : (sourceTrip.destinationCity ? [sourceTrip.destinationCity] : []),
    country: sourceTrip.country ?? sourceTrip.destinationCountry ?? null,
    countries: sourceTrip.countries.length > 0 ? sourceTrip.countries : undefined,
    startDate,
    endDate,
    isAnonymous: true,
  });

  // Create new trip for this user
  const newTrip = await db.trip.create({
    data: { ...builtData, familyProfileId: profileId },
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
    status: "UNORGANIZED";
    sourceMethod: "SHARED_TRIP_IMPORT";
    sourcePlatform: "direct";
    categoryTags: string[];
    extractionStatus: "ENRICHED";
  };

  const savedItems: SaveInput[] = [];

  // Itinerary items — skip FLIGHT and LODGING
  for (const item of sourceTrip.itineraryItems) {
    if (item.type === "FLIGHT" || item.type === "LODGING") continue;
    savedItems.push({
      familyProfileId: profileId,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.latitude ?? null,
      lng: item.longitude ?? null,
      destinationCity: item.toCity ?? sourceTrip.destinationCity ?? null,
      sourceUrl: null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: normalizeAndDedupeCategoryTags(getCategoryTags(item.title, item.notes ?? null)),
      extractionStatus: "ENRICHED",
    });
  }

  // Manual activities — include all
  for (const item of sourceTrip.manualActivities) {
    savedItems.push({
      familyProfileId: profileId,
      tripId: newTrip.id,
      rawTitle: item.title,
      rawDescription: item.notes ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      destinationCity: sourceTrip.destinationCity ?? null,
      sourceUrl: item.website ?? null,
      mediaThumbnailUrl: null,
      placePhotoUrl: null,
      status: "UNORGANIZED",
      sourceMethod: "SHARED_TRIP_IMPORT",
      sourcePlatform: "direct",
      categoryTags: normalizeAndDedupeCategoryTags(getCategoryTags(item.title, item.notes ?? null)),
      extractionStatus: "ENRICHED",
    });
  }

  if (savedItems.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.savedItem.createMany({ data: savedItems as any[] });
  }

  // Enrich images for stolen saves via Google Places
  const newSaves = await db.savedItem.findMany({
    where: {
      familyProfileId: profileId,
      tripId: newTrip.id,
      placePhotoUrl: null,
    },
    select: { id: true, rawTitle: true, destinationCity: true },
  });

  const toEnrich = newSaves.slice(0, 20);
  for (const save of toEnrich) {
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
        await db.savedItem.update({
          where: { id: save.id },
          data: { placePhotoUrl: finalUrl },
        });
      }
    } catch { continue; }
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({
    tripId: newTrip.id,
    tripTitle: newTrip.title,
    copied: savedItems.length,
  });
}
