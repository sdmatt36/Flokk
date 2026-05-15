import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";
const BATCH_SIZE = 50; // imports to process per cron tick

interface GeoDetail {
  cityName: string;
  countryCode: string;
}

async function geocodeLatlng(lat: number, lng: number): Promise<GeoDetail | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL(GEOCODE_API);
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("result_type", "locality|administrative_area_level_3|administrative_area_level_2");
    url.searchParams.set("language", "en");
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as {
      status: string;
      results?: Array<{ address_components: Array<{ long_name: string; short_name: string; types: string[] }> }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    let cityName: string | null = null;
    let countryCode = "";
    for (const result of data.results) {
      for (const comp of result.address_components) {
        if (!cityName && (comp.types.includes("locality") || comp.types.includes("administrative_area_level_3") || comp.types.includes("administrative_area_level_2"))) {
          cityName = comp.long_name;
        }
        if (comp.types.includes("country")) countryCode = comp.short_name;
      }
      if (cityName && countryCode) break;
    }
    if (!cityName) return null;
    return { cityName, countryCode };
  } catch { return null; }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find imported saves missing cityId, with valid coordinates, not deleted
  const items = await db.savedItem.findMany({
    where: {
      sourceMethod: "maps_import",
      cityId: null,
      lat: { not: null },
      lng: { not: null },
      deletedAt: null,
    },
    select: { id: true, lat: true, lng: true },
    take: BATCH_SIZE,
  });

  if (items.length === 0) {
    return NextResponse.json({ processed: 0, message: "No items to backfill." });
  }

  // Geocode in parallel
  const geoResults = await Promise.all(
    items.map(item => geocodeLatlng(item.lat!, item.lng!))
  );

  // City resolution cache: name_code → cityId
  const cityCache = new Map<string, string | null>();
  let processed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const geo = geoResults[i];
    if (!geo) continue;

    const cacheKey = `${geo.cityName.toLowerCase()}_${geo.countryCode}`;
    let cityId: string | null = null;

    if (cityCache.has(cacheKey)) {
      cityId = cityCache.get(cacheKey)!;
    } else {
      const existing = await db.city.findFirst({
        where: { name: { equals: geo.cityName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        cityId = existing.id;
      }
      cityCache.set(cacheKey, cityId);
    }

    // UPDATE in place — never delete, only fill null fields
    await db.savedItem.update({
      where: { id: item.id },
      data: {
        cityId: cityId ?? undefined,
        destinationCity: geo.cityName,
      },
    });
    processed++;
  }

  return NextResponse.json({ processed, total: items.length });
}
