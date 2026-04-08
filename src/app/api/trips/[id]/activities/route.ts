import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { classifyActivityType } from "@/lib/activity-intelligence";

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
  } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "Title and date required" }, { status: 400 });
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

  // Geocode venue using day-aware city context (lodging city for that day, not trip primary city)
  let lat: number | null = null;
  let lng: number | null = null;
  if (venueName || address) {
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

  const activity = await db.manualActivity.create({
    data: {
      tripId,
      title,
      date,
      time: time ?? null,
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
    },
  });

  // Classify activity type (fire-and-forget)
  classifyActivityType(activity.title, activity.venueName, activity.address)
    .then((type) => {
      db.manualActivity.update({ where: { id: activity.id }, data: { type } }).catch(() => {});
    })
    .catch(() => {});

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

  return NextResponse.json(activity, { status: 201 });
}
