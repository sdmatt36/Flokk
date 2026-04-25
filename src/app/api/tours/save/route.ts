import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { haversineMeters } from "@/lib/geo";
import { PLATFORM_FLOKK_TOURS } from "@/lib/saved-item-types";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TourStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
}

interface TourMeta {
  prompt: string;
  destinationCity: string;
  destinationCountry: string | null;
  durationLabel: string;
  transport: string;
  categoryTags?: string[];
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    tourMeta: TourMeta;
    stops?: TourStop[];
    tourId?: string;
    tripId: string;
    dayIndex: number;
  };

  const { tourMeta, tripId, dayIndex } = body;
  const stops = body.stops ?? [];

  if (!tourMeta?.prompt || !tourMeta?.destinationCity || !tripId || dayIndex == null) {
    return NextResponse.json({ error: "tourMeta, tripId, and dayIndex are required" }, { status: 400 });
  }
  if (!body.tourId && !stops.length) {
    return NextResponse.json({ error: "either tourId or stops is required" }, { status: 400 });
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Fetch trip once — needed for date calculation and city fallback
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true, destinationCity: true, destinationCountry: true },
  });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  // Derive date string from trip startDate + dayIndex
  let date: string;
  if (trip.startDate) {
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const startUTC = new Date(Date.UTC(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate()));
    const targetUTC = new Date(startUTC.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    date = targetUTC.toISOString().split("T")[0];
  } else {
    date = new Date().toISOString().split("T")[0];
  }

  const tripCity = trip.destinationCity ?? tourMeta.destinationCity;
  const tripCountry = trip.destinationCountry ?? tourMeta.destinationCountry ?? null;

  const tourStopIds: string[] = [];
  const savedItemIds: string[] = [];

  // Determine effective tourId and stop list
  // Case A: tour was pre-created at generate time — fetch its stops from DB
  // Case B: no pre-existing tour — create GeneratedTour + TourStop now (old path)
  let tourId: string;

  type LoopStop = {
    id: string;        // TourStop DB id
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    why: string | null;
  };

  let loopStops: LoopStop[];

  if (body.tourId) {
    // Case A: verify ownership and fetch existing stops
    const existingTour = await db.generatedTour.findUnique({
      where: { id: body.tourId },
      include: { stops: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" } } },
    });
    if (!existingTour || existingTour.familyProfileId !== profileId) {
      return NextResponse.json({ error: "Tour not found" }, { status: 404 });
    }
    tourId = body.tourId;
    loopStops = existingTour.stops.map(s => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      why: s.why,
    }));
  } else {
    // Case B: create GeneratedTour + TourStop
    tourId = crypto.randomUUID();
    const tourTitle = tourMeta.prompt.trim().length <= 10
      ? `${tourMeta.destinationCity} tour`
      : tourMeta.prompt.trim().slice(0, 60);

    await db.generatedTour.create({
      data: {
        id: tourId,
        title: tourTitle,
        destinationCity: tourMeta.destinationCity,
        destinationCountry: tourMeta.destinationCountry ?? null,
        prompt: tourMeta.prompt,
        durationLabel: tourMeta.durationLabel,
        transport: tourMeta.transport,
        familyProfileId: profileId,
        categoryTags: normalizeAndDedupeCategoryTags(tourMeta.categoryTags ?? []),
      },
    });

    loopStops = [];
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const stopId = crypto.randomUUID();
      await db.tourStop.create({
        data: {
          id: stopId,
          tourId,
          orderIndex: i,
          name: stop.name,
          address: stop.address || null,
          lat: stop.lat || null,
          lng: stop.lng || null,
          durationMin: stop.duration || null,
          travelTimeMin: stop.travelTime || null,
          why: stop.why || null,
          familyNote: stop.familyNote || null,
        },
      });
      loopStops.push({ id: stopId, name: stop.name, address: stop.address || null, lat: stop.lat || null, lng: stop.lng || null, why: stop.why || null });
    }
  }

  // Process each stop: dedupe SavedItem, create ManualActivity, link TourStop → SavedItem
  for (const stop of loopStops) {
    const lat: number | null = stop.lat || null;
    const lng: number | null = stop.lng || null;

    tourStopIds.push(stop.id);

    // SavedItem dedupe — 50m coordinate match first, then normalized title+city fallback
    let matchedSavedItemId: string | null = null;

    if (lat != null && lng != null) {
      const nearby = await db.savedItem.findMany({
        where: {
          familyProfileId: profileId,
          lat: { gte: lat - 0.001, lte: lat + 0.001 },
          lng: { gte: lng - 0.001, lte: lng + 0.001 },
        },
        select: { id: true, lat: true, lng: true },
      });
      for (const item of nearby) {
        if (item.lat != null && item.lng != null && haversineMeters(lat, lng, item.lat, item.lng) <= 50) {
          matchedSavedItemId = item.id;
          break;
        }
      }
    }

    if (!matchedSavedItemId) {
      const titleNorm = normalizeTitle(stop.name);
      const candidates = await db.savedItem.findMany({
        where: { familyProfileId: profileId, destinationCity: tripCity },
        select: { id: true, rawTitle: true },
      });
      for (const item of candidates) {
        if (item.rawTitle && normalizeTitle(item.rawTitle) === titleNorm) {
          matchedSavedItemId = item.id;
          break;
        }
      }
    }

    // Create or update SavedItem
    if (matchedSavedItemId) {
      await db.savedItem.update({
        where: { id: matchedSavedItemId },
        data: { tripId, dayIndex, status: "SCHEDULED", tourId },
      });
    } else {
      const newItem = await db.savedItem.create({
        data: {
          familyProfileId: profileId,
          tripId,
          dayIndex,
          sourceMethod: "IN_APP_SAVE",
          sourcePlatform: PLATFORM_FLOKK_TOURS,
          rawTitle: stop.name,
          destinationCity: tripCity,
          destinationCountry: tripCountry,
          lat,
          lng,
          notes: stop.why || null,
          status: "SCHEDULED",
          extractionStatus: "ENRICHED",
          tourId,
        },
      });
      matchedSavedItemId = newItem.id;
    }
    savedItemIds.push(matchedSavedItemId);

    // Link TourStop → SavedItem
    await db.tourStop.update({
      where: { id: stop.id },
      data: { savedItemId: matchedSavedItemId },
    });

  }

  return NextResponse.json({ tourId, tourStopIds, savedItemIds }, { status: 201 });
}
