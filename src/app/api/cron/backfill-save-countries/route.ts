import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveCountry, PLACES_INFRA_STATUSES } from "@/lib/google-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";
const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

async function countryFromPlaceId(placeId: string): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${PLACES_DETAILS}?place_id=${encodeURIComponent(placeId)}&fields=address_components&language=en&key=${API_KEY}`
    );
    const data = await res.json() as {
      status?: string;
      result?: { address_components?: Array<{ long_name: string; types: string[] }> };
    };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "")) {
      console.error(`[backfill-save-countries] INFRA status=${data.status} placeId=${placeId}`);
      return null;
    }
    return data.result?.address_components?.find(c => c.types.includes("country"))?.long_name ?? null;
  } catch { return null; }
}

async function countryFromLatLng(lat: number, lng: number): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${GEOCODE_API}?latlng=${lat},${lng}&result_type=country&language=en&key=${API_KEY}`
    );
    const data = await res.json() as {
      status: string;
      results?: Array<{ address_components: Array<{ long_name: string; types: string[] }> }>;
    };
    if (PLACES_INFRA_STATUSES.has(data.status)) {
      console.error(`[backfill-save-countries] INFRA status=${data.status} lat=${lat} lng=${lng}`);
      return null;
    }
    if (data.status !== "OK" || !data.results?.length) return null;
    for (const result of data.results) {
      const comp = result.address_components.find(c => c.types.includes("country"));
      if (comp?.long_name) return comp.long_name;
    }
    return null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Priority 1: saves with googlePlaceId — single details call, no text search needed
  const withPlaceId = await db.savedItem.findMany({
    where: { destinationCountry: null, deletedAt: null, googlePlaceId: { not: null } },
    select: { id: true, googlePlaceId: true },
    take: 25,
    orderBy: { savedAt: "asc" },
  });

  // Priority 2: saves with lat/lng but no placeId
  const withLatLng = withPlaceId.length < 25
    ? await db.savedItem.findMany({
        where: { destinationCountry: null, deletedAt: null, googlePlaceId: null, lat: { not: null }, lng: { not: null } },
        select: { id: true, lat: true, lng: true },
        take: 25 - withPlaceId.length,
        orderBy: { savedAt: "asc" },
      })
    : [];

  // Priority 3: saves with rawTitle + destinationCity (text search needed), capped attempts
  const titleSlots = 50 - withPlaceId.length - withLatLng.length;
  const withTitleCity = titleSlots > 0
    ? await db.savedItem.findMany({
        where: {
          destinationCountry: null,
          deletedAt: null,
          googlePlaceId: null,
          lat: null,
          rawTitle: { not: null },
          destinationCity: { not: null },
          enrichmentAttempts: { lt: 3 },
        },
        select: { id: true, rawTitle: true, destinationCity: true },
        take: titleSlots,
        orderBy: { savedAt: "asc" },
      })
    : [];

  type Item =
    | { id: string; source: "placeId"; googlePlaceId: string }
    | { id: string; source: "latlng"; lat: number; lng: number }
    | { id: string; source: "title"; rawTitle: string; destinationCity: string };

  const items: Item[] = [
    ...withPlaceId.map(i => ({ id: i.id, source: "placeId" as const, googlePlaceId: i.googlePlaceId! })),
    ...withLatLng.map(i => ({ id: i.id, source: "latlng" as const, lat: i.lat!, lng: i.lng! })),
    ...withTitleCity.map(i => ({ id: i.id, source: "title" as const, rawTitle: i.rawTitle!, destinationCity: i.destinationCity! })),
  ];

  console.log(`[backfill-save-countries] Processing ${items.length} saves (${withPlaceId.length} placeId, ${withLatLng.length} latlng, ${withTitleCity.length} title+city)`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      let country: string | null = null;

      if (item.source === "placeId") {
        country = await countryFromPlaceId(item.googlePlaceId);
        if (country) {
          await db.savedItem.update({ where: { id: item.id }, data: { destinationCountry: country } });
          updated++;
          console.log(`[backfill-save-countries] placeId ${item.id}: ${country}`);
        } else {
          skipped++;
        }
      } else if (item.source === "latlng") {
        country = await countryFromLatLng(item.lat, item.lng);
        if (country) {
          await db.savedItem.update({ where: { id: item.id }, data: { destinationCountry: country } });
          updated++;
          console.log(`[backfill-save-countries] latlng ${item.id}: ${country}`);
        } else {
          skipped++;
        }
      } else {
        country = await resolveCountry(item.rawTitle, item.destinationCity);
        await db.savedItem.update({
          where: { id: item.id },
          data: {
            ...(country ? { destinationCountry: country } : {}),
            enrichmentAttempts: { increment: 1 },
          },
        });
        if (country) {
          updated++;
          console.log(`[backfill-save-countries] title "${item.rawTitle}" (${item.destinationCity}): ${country}`);
        } else {
          skipped++;
        }
      }
    } catch (err) {
      skipped++;
      console.error(`[backfill-save-countries] Error for ${item.id}:`, err);
    }
  }

  const remaining = await db.savedItem.count({
    where: {
      destinationCountry: null,
      deletedAt: null,
      OR: [
        { googlePlaceId: { not: null } },
        { lat: { not: null } },
        { AND: [{ rawTitle: { not: null } }, { destinationCity: { not: null } }, { enrichmentAttempts: { lt: 3 } }] },
      ],
    },
  });

  return NextResponse.json({ processed: items.length, updated, skipped, remaining });
}
