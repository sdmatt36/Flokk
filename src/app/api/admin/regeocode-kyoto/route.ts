/**
 * POST /api/admin/regeocode-kyoto
 * Re-geocodes Kyoto saves with coordinates outside Kyoto's bounding box.
 * Bounding box: lat 34.9–35.1, lng 135.6–135.9
 *
 * Call from browser console while logged in:
 *   fetch('/api/admin/regeocode-kyoto', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const KYOTO_BOUNDS = { latMin: 34.9, latMax: 35.1, lngMin: 135.6, lngMax: 135.9 };

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; results: { geometry: { location: { lat: number; lng: number } } }[] };
  if (data.status !== "OK" || !data.results[0]) return null;
  return data.results[0].geometry.location;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find Kyoto saves with coordinates outside the bounding box
  const saves = await db.savedItem.findMany({
    where: {
      destinationCity: { equals: "Kyoto", mode: "insensitive" },
      lat: { not: null },
      lng: { not: null },
      rawTitle: { not: null },
    },
    select: { id: true, rawTitle: true, lat: true, lng: true },
  });

  const outOfBounds = saves.filter(s =>
    s.lat! < KYOTO_BOUNDS.latMin || s.lat! > KYOTO_BOUNDS.latMax ||
    s.lng! < KYOTO_BOUNDS.lngMin || s.lng! > KYOTO_BOUNDS.lngMax
  );

  const results: string[] = [];
  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < outOfBounds.length; i++) {
    const item = outOfBounds[i];
    const query = `${item.rawTitle}, Kyoto, Japan`;
    const coords = await geocode(query);

    if (!coords) {
      failed++;
      results.push(`✗ ${item.rawTitle} — geocode failed`);
    } else if (
      coords.lat < KYOTO_BOUNDS.latMin || coords.lat > KYOTO_BOUNDS.latMax ||
      coords.lng < KYOTO_BOUNDS.lngMin || coords.lng > KYOTO_BOUNDS.lngMax
    ) {
      failed++;
      results.push(`✗ ${item.rawTitle} — new coords still outside Kyoto: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      await db.savedItem.update({ where: { id: item.id }, data: { lat: coords.lat, lng: coords.lng } });
      fixed++;
      results.push(`✓ ${item.rawTitle} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (was ${item.lat!.toFixed(4)}, ${item.lng!.toFixed(4)})`);
    }

    if (i < outOfBounds.length - 1) await sleep(150);
  }

  return NextResponse.json({
    total: saves.length,
    outOfBounds: outOfBounds.length,
    fixed,
    failed,
    results,
  });
}
