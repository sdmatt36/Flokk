import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
  if (trip?.startDate) {
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
    const [dy, dm, dd] = date.split("-").map(Number);
    const dep = new Date(dy, dm - 1, dd);
    const diff = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    dayIndex = diff;
  }

  // Geocode venue if name/address provided
  let lat: number | null = null;
  let lng: number | null = null;
  if (venueName || address) {
    try {
      const query = encodeURIComponent([venueName, address].filter(Boolean).join(" "));
      const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=geometry&key=${apiKey}`
        );
        const geoData = await geoRes.json();
        const loc = geoData.candidates?.[0]?.geometry?.location;
        if (loc) { lat = loc.lat; lng = loc.lng; }
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

  // Increment budgetSpent only if activity currency matches trip's budgetCurrency
  if (price) {
    const cost = parseFloat(price);
    if (!isNaN(cost) && cost > 0) {
      const tripForBudget = await db.trip.findUnique({ where: { id: tripId }, select: { budgetCurrency: true } });
      const activityCurrency = currency ?? "USD";
      if (tripForBudget?.budgetCurrency && tripForBudget.budgetCurrency === activityCurrency) {
        db.trip.update({
          where: { id: tripId },
          data: { budgetSpent: { increment: cost } },
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json(activity, { status: 201 });
}
