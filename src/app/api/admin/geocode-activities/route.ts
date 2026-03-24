/**
 * POST /api/admin/geocode-activities
 * Retroactively geocodes ManualActivity records where lat IS NULL and venueName IS NOT NULL.
 *
 * Call from browser console while logged in:
 *   fetch('/api/admin/geocode-activities', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeVenue(venueName: string, city?: string | null, country?: string | null): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY) return null;
  const query = encodeURIComponent([venueName, city, country].filter(Boolean).join(", "));
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=geometry&key=${GOOGLE_API_KEY}`
    );
    const data = await res.json();
    const loc = data.candidates?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  } catch { /* ignore */ }
  return null;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!GOOGLE_API_KEY) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });

  // Find activities with no coords but a venue name
  const activities = await db.manualActivity.findMany({
    where: { lat: null, venueName: { not: null } },
    select: {
      id: true,
      venueName: true,
      title: true,
      trip: { select: { destinationCity: true, destinationCountry: true } },
    },
  });

  const results: string[] = [];
  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const coords = await geocodeVenue(a.venueName!, a.trip.destinationCity, a.trip.destinationCountry);

    if (coords) {
      await db.manualActivity.update({ where: { id: a.id }, data: { lat: coords.lat, lng: coords.lng } });
      geocoded++;
      results.push(`✓ ${a.title} (${a.venueName}) → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      failed++;
      results.push(`✗ ${a.title} (${a.venueName}) — geocode failed`);
    }

    if (i < activities.length - 1) await sleep(150);
  }

  return NextResponse.json({ total: activities.length, geocoded, failed, results });
}
