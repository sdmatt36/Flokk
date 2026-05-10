import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { classifyActivityType } from "@/lib/activity-intelligence";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { normalizeCategorySlug } from "@/lib/categories";
import { reverseGeocodeCityFromCoords } from "@/lib/google-places";

// Returns the city the traveler is in on a given date by looking at the most recent
// LODGING check-in on or before that day. Falls back to trip destinationCity.
async function getCityForDay(tripId: string, dayDate: string): Promise<string> {
  const lodging = await db.itineraryItem.findFirst({
    where: {
      tripId,
      type: "LODGING",
      toCity: { not: null },
      scheduledDate: { lte: dayDate },
    },
    orderBy: { scheduledDate: "desc" },
    select: { toCity: true },
  });
  if (lodging?.toCity) return lodging.toCity;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destinationCity: true, destinationCountry: true },
  });
  return [trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(", ");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const activities = await db.manualActivity.findMany({
    where: { tripId },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return NextResponse.json(activities);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const body = await request.json();
  const {
    title,
    date,
    time,
    endTime,
    venueName,
    address,
    website,
    price,
    currency,
    notes,
    status,
    confirmationCode,
    lat: clientLat,
    lng: clientLng,
    type: clientType,
    imageUrl: clientImageUrl,
  } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "Title and date required" }, { status: 400 });
  }

  // Apply default check-in/check-out time for lodging when user didn't supply one
  let resolvedTime: string | null = time ?? null;
  if (!resolvedTime && /hotel|hostel|resort|airbnb|inn|hyatt|hilton|marriott|sheraton|westin|check.?in/i.test(title ?? "")) {
    resolvedTime = /check.?out|checkout|departure|leaving/i.test(title ?? "") ? "11:00" : "15:00";
  }

  // Calculate dayIndex (0-indexed, timezone-safe) from trip startDate
  let dayIndex: number | null = null;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true, destinationCity: true, destinationCountry: true } });
  if (trip?.startDate) {
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
    const [dy, dm, dd] = date.split("-").map(Number);
    const dep = new Date(dy, dm - 1, dd);
    const diff = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    dayIndex = diff;
  }

  // Use client-provided coords (from Places confirmation or AI fallback); geocode only if not supplied
  let lat: number | null = typeof clientLat === "number" ? clientLat : null;
  let lng: number | null = typeof clientLng === "number" ? clientLng : null;
  if ((lat == null || lng == null) && (venueName || address)) {
    try {
      const activityCity = await getCityForDay(tripId, date);
      const geocodeQuery = [title, venueName, address, activityCity].filter(Boolean).join(", ");
      const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geocodeQuery)}&key=${apiKey}`;
        const geoRes = await fetch(geocodeUrl);
        const geoData = await geoRes.json();
        const location = geoData.results?.[0]?.geometry?.location;
        lat = location?.lat ?? null;
        lng = location?.lng ?? null;
        console.log(`[GEOCODE] city for day=${date}: "${activityCity}" | query="${geocodeQuery}" result=${lat},${lng}`);
      }
    } catch { /* geocoding optional */ }
  }

  const resolvedType = normalizeCategorySlug(clientType) ?? null;

  const sanitizedImageUrl =
    typeof clientImageUrl === "string" && clientImageUrl.startsWith("http") ? clientImageUrl : null;

  const activity = await db.manualActivity.create({
    data: {
      tripId,
      title,
      date,
      time: resolvedTime,
      endTime: endTime ?? null,
      venueName: venueName ?? null,
      address: address ?? null,
      lat,
      lng,
      website: website ?? null,
      price: price ? parseFloat(price) : null,
      currency: currency ?? "USD",
      notes: notes ?? null,
      status: status ?? "interested",
      confirmationCode: confirmationCode ?? null,
      dayIndex,
      imageUrl: sanitizedImageUrl,
      ...(resolvedType && { type: resolvedType }),
    },
  });

  // Enrich with Google Places photo + website at save time (synchronous — result in same response).
  // Website resolution runs unconditionally when missing (decoupled from imageUrl gate).
  let activityEnrichedImageUrl: string | null = null;
  let activityEnrichedWebsite: string | null = null;
  const activityCity = [trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(", ");
  if (!activity.imageUrl || !activity.website) {
    const enriched = await enrichWithPlaces(activity.title, activityCity);
    const placesUpdate: { imageUrl?: string; website?: string } = {};
    if (enriched.imageUrl && !activity.imageUrl) { placesUpdate.imageUrl = enriched.imageUrl; activityEnrichedImageUrl = enriched.imageUrl; }
    if (!activity.website) {
      const resolvedWebsite = enriched.website ?? resolveCanonicalUrl({ name: activity.title, city: activityCity });
      placesUpdate.website = resolvedWebsite ?? undefined;
      activityEnrichedWebsite = resolvedWebsite;
    }
    if (Object.keys(placesUpdate).length > 0) {
      await db.manualActivity.update({ where: { id: activity.id }, data: placesUpdate });
    }
  }

  // City resolution for multi-city trip community spot attribution.
  // Populates ManualActivity.city so writeThroughCommunitySpot gets the physical city
  // instead of falling through to trip.destinationCity (which caused Busan→Seoul mis-tagging).
  {
    let resolvedCity: string | null = null;

    // Path 1: reverse-geocode from lat/lng — most accurate for multi-city trips
    if (lat !== null && lng !== null) {
      try {
        resolvedCity = await reverseGeocodeCityFromCoords({ lat, lng });
      } catch { /* non-fatal */ }
    }

    // Path 2: LODGING check-in anchor for this date — handles multi-city without coords
    // Avoids using getCityForDay because that falls back to trip.destinationCity (same bug)
    if (!resolvedCity) {
      const lodgingAnchor = await db.itineraryItem.findFirst({
        where: {
          tripId,
          type: "LODGING",
          toCity: { not: null },
          scheduledDate: { lte: date },
        },
        orderBy: { scheduledDate: "desc" },
        select: { toCity: true },
      });
      if (lodgingAnchor?.toCity) resolvedCity = lodgingAnchor.toCity;
    }

    // Path 3: leave city null — ratings write-through falls back to trip.destinationCity
    if (resolvedCity) {
      await db.manualActivity.update({ where: { id: activity.id }, data: { city: resolvedCity } });
    }
  }

  // Classify activity type (fire-and-forget) — skip if user explicitly selected a category
  if (!resolvedType) {
    classifyActivityType(activity.title, activity.venueName, activity.address)
      .then((type) => {
        db.manualActivity.update({ where: { id: activity.id }, data: { type } }).catch(() => {});
      })
      .catch(() => {});
  }

  // Increment budgetSpent only if activity currency matches trip's budgetCurrency
  if (price) {
    const cost = parseFloat(price);
    if (!isNaN(cost) && cost > 0) {
      const tripForBudget = await db.trip.findUnique({ where: { id: tripId }, select: { budgetCurrency: true } });
      const activityCurrency = currency ?? "USD";
      if (tripForBudget && (!tripForBudget.budgetCurrency || tripForBudget.budgetCurrency === activityCurrency)) {
        db.trip.update({
          where: { id: tripId },
          data: {
            budgetSpent: { increment: cost },
            budgetCurrency: tripForBudget.budgetCurrency ?? activityCurrency,
          },
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({
    ...activity,
    imageUrl: activityEnrichedImageUrl ?? activity.imageUrl,
    website: activityEnrichedWebsite ?? activity.website,
  }, { status: 201 });
}
