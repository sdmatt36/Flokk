import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, activityId } = await params;

  const activity = await db.manualActivity.findUnique({
    where: { id: activityId },
    select: { id: true, title: true, venueName: true, tripId: true, lat: true },
  });
  if (!activity || activity.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only geocode if coords are missing
  if (activity.lat != null) {
    return NextResponse.json({ alreadyGeocoded: true });
  }

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destinationCity: true, destinationCountry: true },
  });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No geocoding key" }, { status: 500 });

  const query = [activity.venueName ?? activity.title, trip?.destinationCity, trip?.destinationCountry]
    .filter(Boolean)
    .join(", ");

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=geometry&key=${apiKey}`
    );
    const data = await res.json();
    const loc = data.candidates?.[0]?.geometry?.location;

    if (loc?.lat && loc?.lng) {
      await db.manualActivity.update({
        where: { id: activityId },
        data: { lat: loc.lat, lng: loc.lng },
      });
      return NextResponse.json({ lat: loc.lat, lng: loc.lng });
    }
  } catch { /* geocoding optional */ }

  return NextResponse.json({ lat: null, lng: null });
}
