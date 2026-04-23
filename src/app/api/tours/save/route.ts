import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { classifyActivityType } from "@/lib/activity-intelligence";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
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
    stops: TourStop[];
    tripId: string;
    dayIndex: number;
  };

  const { tourMeta, stops, tripId, dayIndex } = body;

  if (!tourMeta?.prompt || !tourMeta?.destinationCity || !tripId || dayIndex == null || !stops?.length) {
    return NextResponse.json({ error: "tourMeta, stops, tripId, and dayIndex are required" }, { status: 400 });
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

  // 1. Create GeneratedTour
  const tourId = crypto.randomUUID();
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

  const tourStopIds: string[] = [];
  const savedItemIds: string[] = [];
  const activityIds: string[] = [];

  // 2. Process each stop sequentially to maintain orderIndex integrity
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const lat: number | null = stop.lat || null;
    const lng: number | null = stop.lng || null;

    // 2a. Create TourStop
    const tourStopId = crypto.randomUUID();
    await db.tourStop.create({
      data: {
        id: tourStopId,
        tourId,
        orderIndex: i,
        name: stop.name,
        address: stop.address || null,
        lat,
        lng,
        durationMin: stop.duration || null,
        travelTimeMin: stop.travelTime || null,
        why: stop.why || null,
        familyNote: stop.familyNote || null,
      },
    });
    tourStopIds.push(tourStopId);

    // 2b. SavedItem dedupe — 50m coordinate match first, then normalized title+city fallback
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

    // 2c. Create or update SavedItem
    if (matchedSavedItemId) {
      await db.savedItem.update({
        where: { id: matchedSavedItemId },
        data: { tripId, dayIndex, status: "SCHEDULED" },
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
        },
      });
      matchedSavedItemId = newItem.id;
    }
    savedItemIds.push(matchedSavedItemId);

    // 2d. Link TourStop → SavedItem
    await db.tourStop.update({
      where: { id: tourStopId },
      data: { savedItemId: matchedSavedItemId },
    });

    // 2e. Create ManualActivity
    const activity = await db.manualActivity.create({
      data: {
        tripId,
        title: stop.name,
        date,
        address: stop.address || null,
        lat,
        lng,
        notes: stop.why || null,
        status: "interested",
        dayIndex,
        city: tripCity,
        tourId,
      },
    });
    activityIds.push(activity.id);

    // Enrich with Places photo (fire-and-forget per stop)
    enrichWithPlaces(stop.name, [tripCity, tripCountry].filter(Boolean).join(", "))
      .then(enriched => {
        const placesUpdate: { imageUrl?: string; website?: string } = {};
        if (enriched.imageUrl) placesUpdate.imageUrl = enriched.imageUrl;
        if (enriched.website) placesUpdate.website = enriched.website;
        if (Object.keys(placesUpdate).length > 0) {
          db.manualActivity.update({ where: { id: activity.id }, data: placesUpdate }).catch(() => {});
        }
      })
      .catch(() => {});

    // Classify activity type (fire-and-forget)
    classifyActivityType(stop.name, null, stop.address)
      .then(type => db.manualActivity.update({ where: { id: activity.id }, data: { type } }).catch(() => {}))
      .catch(() => {});
  }

  return NextResponse.json({ tourId, tourStopIds, savedItemIds, activityIds }, { status: 201 });
}
