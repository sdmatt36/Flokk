import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichWithPlaces } from "@/lib/enrich-with-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json() as { results?: { formatted_address: string }[]; status: string };
    if (data.status === "OK" && data.results?.[0]?.formatted_address) {
      return data.results[0].formatted_address;
    }
  } catch (e) {
    console.error("[backfill-addresses] reverseGeocode error:", e);
  }
  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch saves with no address — prefer lat/lng items (cheap geocode) first,
  // then fall back to title+city enrichment for saves without coordinates.
  const withLatLng = await db.savedItem.findMany({
    where: { address: null, deletedAt: null, lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, rawTitle: true },
    take: 50,
    orderBy: { savedAt: "asc" },
  });

  const titleOnly = withLatLng.length < 50
    ? await db.savedItem.findMany({
        where: {
          address: null,
          deletedAt: null,
          lat: null,
          rawTitle: { not: null },
          destinationCity: { not: null },
          enrichmentAttempts: { lt: 3 },
        },
        select: { id: true, rawTitle: true, destinationCity: true },
        take: 50 - withLatLng.length,
        orderBy: { savedAt: "asc" },
      })
    : [];

  const items = [
    ...withLatLng.map(i => ({ ...i, source: "latlng" as const })),
    ...titleOnly.map(i => ({ id: i.id, lat: null, lng: null, rawTitle: i.rawTitle, destinationCity: i.destinationCity, source: "title" as const })),
  ];

  console.log(`[backfill-addresses] Processing ${items.length} saves (${withLatLng.length} lat/lng, ${titleOnly.length} title-only)`);

  // Idle guard: no address=null backlog → make zero Places/geocode calls this run.
  if (items.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, idle: true });
  }

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      let address: string | null = null;

      if (item.source === "latlng" && item.lat != null && item.lng != null) {
        address = await reverseGeocode(item.lat, item.lng);
      } else if (item.source === "title" && item.rawTitle && "destinationCity" in item) {
        const enriched = await enrichWithPlaces(item.rawTitle, (item as { destinationCity: string | null }).destinationCity ?? "");
        address = enriched.formattedAddress ?? null;
        // Also update lat/lng if enrichment found them
        if (address || enriched.lat) {
          await db.savedItem.update({
            where: { id: item.id },
            data: {
              ...(address ? { address } : {}),
              ...(enriched.lat ? { lat: enriched.lat, lng: enriched.lng } : {}),
              enrichmentAttempts: { increment: 1 },
            },
          });
          if (address) {
            updated++;
            console.log(`[backfill-addresses] title "${item.rawTitle}": ${address}`);
          } else {
            skipped++;
          }
          continue;
        }
        await db.savedItem.update({ where: { id: item.id }, data: { enrichmentAttempts: { increment: 1 } } });
        skipped++;
        continue;
      }

      if (address) {
        await db.savedItem.update({ where: { id: item.id }, data: { address } });
        updated++;
        console.log(`[backfill-addresses] "${item.rawTitle}": ${address}`);
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
      console.error(`[backfill-addresses] Error for ${item.id} (${item.rawTitle}):`, err);
    }
  }

  const remaining = await db.savedItem.count({
    where: {
      address: null,
      deletedAt: null,
      OR: [
        { lat: { not: null } },
        { AND: [{ rawTitle: { not: null } }, { destinationCity: { not: null } }, { enrichmentAttempts: { lt: 3 } }] },
      ],
    },
  });

  return NextResponse.json({ processed: items.length, updated, skipped, remaining });
}
