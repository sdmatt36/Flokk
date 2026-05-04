import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

// Reverse-geocode lat/lng to city name using address_components locality.
async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      results?: Array<{ address_components: Array<{ long_name: string; types: string[] }> }>;
      status?: string;
    };
    if (!data.results?.length) return null;
    const components = data.results[0].address_components;
    const locality = components.find(c => c.types.includes("locality"));
    if (locality) return locality.long_name;
    const subloc = components.find(c => c.types.includes("sublocality") || c.types.includes("sublocality_level_1"));
    if (subloc) return subloc.long_name;
    const area2 = components.find(c => c.types.includes("administrative_area_level_2"));
    if (area2) return area2.long_name;
    return null;
  } catch {
    return null;
  }
}

// Forward-geocode hotel name to find city via Places Text Search.
async function forwardGeocodeCity(hotelName: string): Promise<{ city: string; lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(hotelName)}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    const first = data.results?.[0];
    if (!first) return null;
    const { lat, lng } = first.geometry.location;
    // Try address_components for locality; fall back to comma-parsing formatted_address
    const components = first.address_components ?? [];
    const locality = components.find(c => c.types.includes("locality"))?.long_name
      ?? components.find(c => c.types.includes("administrative_area_level_2"))?.long_name
      ?? null;
    if (locality) return { city: locality, lat, lng };
    // Formatted address typically: "Hotel Name, City, Country" — take second token
    const parts = first.formatted_address.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) return { city: parts[1], lat, lng };
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  }

  const items = await db.itineraryItem.findMany({
    where: {
      type: "LODGING",
      OR: [{ toCity: null }, { toCity: "" }],
      title: { startsWith: "Check-in:" },
    },
    select: { id: true, title: true, latitude: true, longitude: true, tripId: true },
  });

  const results: { id: string; title: string; resolved: string | null; method: string }[] = [];

  for (const item of items) {
    const hotelName = item.title.replace(/^check[\s-]?in:\s*/i, "").trim();
    let city: string | null = null;
    let method = "none";

    if (item.latitude != null && item.longitude != null) {
      city = await reverseGeocodeCity(item.latitude, item.longitude);
      if (city) method = "reverse_geocode";
    }

    if (!city) {
      const fwd = await forwardGeocodeCity(hotelName);
      if (fwd) {
        city = fwd.city;
        method = "forward_geocode";
        // Also backfill coords if missing
        if (item.latitude == null || item.longitude == null) {
          await db.itineraryItem.update({
            where: { id: item.id },
            data: { latitude: fwd.lat, longitude: fwd.lng },
          });
        }
      }
    }

    if (city) {
      await db.itineraryItem.update({
        where: { id: item.id },
        data: { toCity: city },
      });
      // Also update the matching check-out for the same hotel on the same trip
      await db.itineraryItem.updateMany({
        where: {
          tripId: item.tripId,
          type: "LODGING",
          title: `Check-out: ${hotelName}`,
          OR: [{ toCity: null }, { toCity: "" }],
        },
        data: { toCity: city },
      });
    }

    results.push({ id: item.id, title: item.title, resolved: city, method });
    console.log(`[backfill-lodging-tocity] ${item.title} → ${city ?? "UNRESOLVED"} (${method})`);
  }

  const resolved = results.filter(r => r.resolved).length;
  const unresolved = results.filter(r => !r.resolved).length;
  return NextResponse.json({ total: items.length, resolved, unresolved, results });
}
