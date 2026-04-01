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

  const items = await db.itineraryItem.findMany({
    where: {
      type: { in: ["TRAIN", "FLIGHT"] },
      arrivalLat: null,
    },
    select: { id: true, type: true, toCity: true, toAirport: true, latitude: true, longitude: true },
  });

  let updated = 0;

  for (const item of items) {
    if (item.type === "TRAIN") {
      if (!item.toCity) continue;
      const geo = await geocodePlace(`${item.toCity} train station`);
      if (geo) {
        await db.itineraryItem.update({ where: { id: item.id }, data: { arrivalLat: geo.lat, arrivalLng: geo.lng } });
        updated++;
      }
    } else if (item.type === "FLIGHT") {
      // For existing FLIGHT items, latitude/longitude is already the arrival airport.
      // Copy to arrivalLat/arrivalLng for consistency with the new transit card logic.
      if (item.latitude != null && item.longitude != null) {
        await db.itineraryItem.update({ where: { id: item.id }, data: { arrivalLat: item.latitude, arrivalLng: item.longitude } });
        updated++;
      } else {
        const dest = item.toAirport ?? item.toCity;
        if (!dest) continue;
        const suffix = item.toAirport ? "airport" : "airport";
        const geo = await geocodePlace(`${dest} ${suffix}`);
        if (geo) {
          await db.itineraryItem.update({ where: { id: item.id }, data: { arrivalLat: geo.lat, arrivalLng: geo.lng } });
          updated++;
        }
      }
    }
  }

  console.log(`[backfill-arrival-coords] total: ${items.length}, updated: ${updated}`);
  return NextResponse.json({ total: items.length, updated });
}
