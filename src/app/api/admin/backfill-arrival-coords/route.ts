import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const first = data.results?.[0];
    if (!first) return null;
    return first.geometry.location;
  } catch {
    return null;
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TRAIN: only backfill missing arrivalLat
  const trainItems = await db.itineraryItem.findMany({
    where: { type: "TRAIN", arrivalLat: null },
    select: { id: true, toCity: true },
  });

  // FLIGHT: re-geocode ALL using improved IATA+city query (fixes ICN/GMP confusion)
  const flightItems = await db.itineraryItem.findMany({
    where: { type: "FLIGHT" },
    select: { id: true, toCity: true, toAirport: true },
  });

  let updated = 0;

  for (const item of trainItems) {
    if (!item.toCity) continue;
    const geo = await geocodePlace(`${item.toCity} train station`);
    if (geo) {
      await db.itineraryItem.update({ where: { id: item.id }, data: { arrivalLat: geo.lat, arrivalLng: geo.lng } });
      updated++;
    }
  }

  for (const item of flightItems) {
    const arrQuery = item.toAirport && item.toCity
      ? `${item.toAirport} airport ${item.toCity}`
      : item.toAirport ? `${item.toAirport} airport`
      : item.toCity ? `${item.toCity} international airport`
      : null;
    if (!arrQuery) continue;
    let geo = await geocodePlace(arrQuery);
    if (!geo && item.toCity) geo = await geocodePlace(`${item.toCity} international airport`);
    if (geo) {
      await db.itineraryItem.update({ where: { id: item.id }, data: { latitude: geo.lat, longitude: geo.lng, arrivalLat: geo.lat, arrivalLng: geo.lng } });
      updated++;
    }
  }

  console.log(`[backfill-arrival-coords] trains: ${trainItems.length}, flights: ${flightItems.length}, updated: ${updated}`);
  return NextResponse.json({ trains: trainItems.length, flights: flightItems.length, updated });
}
