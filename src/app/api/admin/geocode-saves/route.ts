/**
 * POST /api/admin/geocode-saves
 * One-shot geocoding pass. Requires Clerk auth.
 * Processes all SavedItems where lat IS NULL using Google Maps Geocoding API.
 * Returns a summary of what was updated.
 *
 * Call from browser dev console while logged in:
 *   fetch('/api/admin/geocode-saves', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute Vercel function timeout

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const DELAY_MS = 150;

async function geocode(
  title: string,
  city: string | null,
  country: string | null
): Promise<{ lat: number; lng: number } | null | { error: string }> {
  const query = [title, city, country].filter(Boolean).join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results: { geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status !== "OK" || !data.results[0]) {
    return { error: `status=${data.status}${data.error_message ? ` msg="${data.error_message}"` : ""}` };
  }
  return data.results[0].geometry.location;
}

async function getPlaceDetails(
  title: string,
  lat: number,
  lng: number
): Promise<{ website?: string; photoUrl?: string; rating?: number }> {
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(title)}&inputtype=textquery` +
    `&fields=website,photos,rating` +
    `&location=${lat},${lng}&radius=5000` +
    `&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    candidates: {
      website?: string;
      rating?: number;
      photos?: { photo_reference: string }[];
    }[];
  };
  if (data.status !== "OK" || !data.candidates[0]) return {};
  const c = data.candidates[0];
  const result: { website?: string; photoUrl?: string; rating?: number } = {};
  if (c.website) result.website = c.website;
  if (typeof c.rating === "number") result.rating = c.rating;
  if (c.photos?.[0]?.photo_reference) {
    result.photoUrl =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800` +
      `&photo_reference=${c.photos[0].photo_reference}` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Env diagnostics — logged server-side and included in response
  const keyEnvName = process.env.GOOGLE_MAPS_API_KEY !== undefined
    ? "GOOGLE_MAPS_API_KEY"
    : process.env.GOOGLE_PLACES_API_KEY !== undefined
    ? "GOOGLE_PLACES_API_KEY (fallback)"
    : "NONE — neither env var is set";
  const keyPresent = process.env.GOOGLE_MAPS_API_KEY !== undefined || process.env.GOOGLE_PLACES_API_KEY !== undefined;
  const keyPrefix = GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.slice(0, 8) + "…" : "(empty)";
  console.log(`[geocode-saves] env key: ${keyEnvName}, present: ${keyPresent}, prefix: ${keyPrefix}`);

  const items = await db.savedItem.findMany({
    where: { lat: null, rawTitle: { not: null } },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      sourceUrl: true,
      mediaThumbnailUrl: true,
      placePhotoUrl: true,
    },
  });

  const results: string[] = [];
  let geocoded = 0;
  let failed = 0;
  let firstErrorLogged = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = item.rawTitle!;

    const coordsResult = await geocode(title, item.destinationCity, item.destinationCountry);
    const isError = coordsResult !== null && typeof coordsResult === "object" && "error" in coordsResult;
    const coords = isError || coordsResult === null ? null : (coordsResult as { lat: number; lng: number });
    const errorReason = isError ? (coordsResult as { error: string }).error : "null result";

    if (!coords) {
      failed++;
      const msg = `✗ ${title} — ${errorReason}`;
      results.push(msg);
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.error(`[geocode-saves] FIRST FAILURE — ${msg}`);
        console.error(`[geocode-saves] key env: ${keyEnvName} | present: ${keyPresent} | prefix: ${keyPrefix}`);
      }
      if (i < items.length - 1) await sleep(DELAY_MS);
      continue;
    }

    const place = await getPlaceDetails(title, coords.lat, coords.lng);

    const updateData: Record<string, unknown> = {
      lat: coords.lat,
      lng: coords.lng,
      extractionStatus: "ENRICHED",
    };
    if (place.website && !item.sourceUrl) updateData.sourceUrl = place.website;
    if (place.photoUrl) updateData.placePhotoUrl = place.photoUrl;
    if (typeof place.rating === "number") updateData.relevanceScore = place.rating;

    await db.savedItem.update({ where: { id: item.id }, data: updateData });

    const extras = [
      place.website && !item.sourceUrl ? "website" : null,
      place.photoUrl ? "photo" : null,
    ].filter(Boolean);

    geocoded++;
    const extraStr = extras.length ? ` [+${extras.join(", ")}]` : "";
    results.push(`✓ ${title} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}${extraStr}`);
    console.log(`[geocode-saves] ${results[results.length - 1]}`);

    if (i < items.length - 1) await sleep(DELAY_MS);
  }

  return NextResponse.json({
    total: items.length,
    geocoded,
    failed,
    keyEnvName,
    keyPresent,
    keyPrefix,
    results,
  });
}
