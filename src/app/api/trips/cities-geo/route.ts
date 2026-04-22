import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// Lambda-scoped cache: persists across requests on the same instance
const geoCache = new Map<string, { lat: number; lng: number }>();

async function geocodeCity(
  city: string,
  country: string | null
): Promise<{ lat: number; lng: number } | null> {
  const key = `${city.toLowerCase()},${(country ?? "").toLowerCase()}`;
  if (geoCache.has(key)) return geoCache.get(key)!;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const query = country ? `${city}, ${country}` : city;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (!loc) return null;
    const coords = { lat: loc.lat as number, lng: loc.lng as number };
    geoCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { cities?: Array<{ city: string; country: string | null }> };
  const cities = body.cities ?? [];

  const result: Record<string, { lat: number; lng: number }> = {};

  await Promise.all(
    cities.map(async ({ city, country }) => {
      const coords = await geocodeCity(city, country);
      if (coords) {
        const key = `${city.toLowerCase()},${(country ?? "").toLowerCase()}`;
        result[key] = coords;
      }
    })
  );

  return NextResponse.json(result);
}
