import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

async function geocodeVenue(venueName: string, tripId: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { destinationCity: true, destinationCountry: true } });
    const query = encodeURIComponent([venueName, trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(", "));
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=geometry&key=${apiKey}`
    );
    const data = await res.json();
    const loc = data.candidates?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  } catch { /* geocoding optional */ }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, activityId } = await params;
  const body = await request.json();

  // Recalculate dayIndex if date is being updated
  if (body.date) {
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
    if (trip?.startDate) {
      const rawStart = new Date(trip.startDate);
      const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
      const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
      const [dy, dm, dd] = body.date.split("-").map(Number);
      const dep = new Date(dy, dm - 1, dd);
      body.dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Geocode if venueName is being set and current lat is null
  if (body.venueName && body.lat == null) {
    const existing = await db.manualActivity.findUnique({ where: { id: activityId }, select: { lat: true } });
    if (existing?.lat == null) {
      const coords = await geocodeVenue(body.venueName, tripId);
      if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
    }
  }

  const updated = await db.manualActivity.update({
    where: { id: activityId },
    data: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId } = await params;

  await db.manualActivity.delete({ where: { id: activityId } });

  return NextResponse.json({ success: true });
}
