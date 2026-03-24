/**
 * One-shot geocoding pass for seeded template trip SavedItems.
 *
 * Uses a single Places findplacefromtext call per item (returns geometry +
 * website + photos in one request). This matches what the production app
 * uses for activity geocoding and avoids needing the separate Geocoding API.
 *
 * Phase 1: Seeded trips — SavedItems where lat IS NULL in any known template trip.
 * Phase 2: Full DB sweep — any SavedItem with lat IS NULL (catches all users).
 *
 * Sets extractionStatus = 'ENRICHED' only after lat/lng are successfully written.
 *
 * Usage (requires real GOOGLE_MAPS_API_KEY in env):
 *   npx tsx --env-file=.env.local scripts/geocode-seeded-saves.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load .env.local manually if dotenv not picking it up
if (!process.env.DATABASE_URL) {
  const fs = await import("fs");
  const path = await import("path");
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)="?([^"]*)"?$/);
      if (match) process.env[match[1]] = match[2].replace(/\\n/g, "");
    }
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "";
const DELAY_MS = 200;

const SEEDED_TRIP_TITLES = [
  "Marrakesh Magic",
  "Tokyo Family Week",
  "Paris with Kids",
  "Barcelona Sun & Culture",
  "Bangkok Adventure",
  "Seoul in 7 Days",
  "Lisbon Long Weekend",
  "London Family Trip",
  "Montreal Summer",
  "Buenos Aires Cultural Week",
  "Kyoto + Nara Feb 26",
  "Tokyo Jan 26",
  "Chiang Rai Dec 25",
  "Chiang Mai Dec 25",
  "Lisbon & Sintra",
  "Madrid Long Weekend",
];

interface PlaceResult {
  lat?: number;
  lng?: number;
  website?: string;
  photoUrl?: string;
}

async function lookupPlace(
  title: string,
  city: string | null,
  country: string | null
): Promise<PlaceResult> {
  const input = [title, city, country].filter(Boolean).join(", ");
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery` +
    `&fields=geometry,website,photos` +
    `&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    candidates: {
      geometry?: { location: { lat: number; lng: number } };
      website?: string;
      photos?: { photo_reference: string }[];
    }[];
  };

  if (data.status !== "OK" || !data.candidates[0]) {
    if (data.error_message) {
      console.error(`  [Places API error] ${data.status}: ${data.error_message}`);
    }
    return {};
  }

  const c = data.candidates[0];
  const result: PlaceResult = {};
  if (c.geometry?.location) {
    result.lat = c.geometry.location.lat;
    result.lng = c.geometry.location.lng;
  }
  if (c.website) result.website = c.website;
  if (c.photos?.[0]?.photo_reference) {
    result.photoUrl =
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=800&photo_reference=${c.photos[0].photo_reference}` +
      `&key=${GOOGLE_API_KEY}`;
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processItem(item: {
  id: string;
  rawTitle: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  sourceUrl: string | null;
  mediaThumbnailUrl: string | null;
}): Promise<boolean> {
  const title = item.rawTitle ?? "";
  if (!title) {
    console.log(`  ⊘ (no title, id=${item.id}) — skipping`);
    return false;
  }

  const place = await lookupPlace(title, item.destinationCity, item.destinationCountry);

  if (place.lat == null || place.lng == null) {
    console.log(`  ✗ ${title} — no coordinates from Places API`);
    return false;
  }

  const updateData: Record<string, unknown> = {
    lat: place.lat,
    lng: place.lng,
    extractionStatus: "ENRICHED",
  };
  if (place.website && !item.sourceUrl) updateData.sourceUrl = place.website;
  if (place.photoUrl && !item.mediaThumbnailUrl)
    updateData.mediaThumbnailUrl = place.photoUrl;

  await db.savedItem.update({ where: { id: item.id }, data: updateData });

  const extras: string[] = [];
  if (updateData.sourceUrl) extras.push("website");
  if (updateData.mediaThumbnailUrl) extras.push("photo");
  const extraStr = extras.length ? ` [+${extras.join(", ")}]` : "";
  console.log(
    `  ✓ ${title} → ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}${extraStr}`
  );
  return true;
}

async function runPhase(
  label: string,
  items: {
    id: string;
    rawTitle: string | null;
    destinationCity: string | null;
    destinationCountry: string | null;
    sourceUrl: string | null;
    mediaThumbnailUrl: string | null;
  }[]
) {
  if (items.length === 0) {
    console.log(`\n── ${label}: nothing to do\n`);
    return { total: 0, geocoded: 0, failed: 0 };
  }
  console.log(`\n── ${label}: ${items.length} items with null lat/lng\n`);

  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const ok = await processItem(items[i]);
    if (ok) geocoded++;
    else failed++;
    if (i < items.length - 1) await sleep(DELAY_MS);
  }

  console.log(
    `\n  → ${label} done: ${geocoded} geocoded, ${failed} failed out of ${items.length}\n`
  );
  return { total: items.length, geocoded, failed };
}

async function main() {
  console.log(`Using API key: ${GOOGLE_API_KEY ? GOOGLE_API_KEY.slice(0, 8) + "…" : "(none)"}`);

  if (!GOOGLE_API_KEY) {
    console.error("ERROR: GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is not set");
    process.exit(1);
  }

  // ── Phase 1: seeded template trips ──────────────────────────────────────
  const seededTrips = await db.trip.findMany({
    where: { title: { in: SEEDED_TRIP_TITLES } },
    select: { id: true, title: true },
  });

  console.log(`\nFound ${seededTrips.length} seeded trips:`);
  seededTrips.forEach((t) => console.log(`  • ${t.title} (${t.id})`));

  const seededTripIds = seededTrips.map((t) => t.id);
  const seededItems = await db.savedItem.findMany({
    where: { tripId: { in: seededTripIds }, lat: null },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      sourceUrl: true,
      mediaThumbnailUrl: true,
    },
  });

  const phase1 = await runPhase("Seeded template trips", seededItems);

  // ── Phase 2: full DB sweep ───────────────────────────────────────────────
  const processedIds = new Set(seededItems.map((i) => i.id));
  const allNullItems = await db.savedItem.findMany({
    where: {
      lat: null,
      rawTitle: { not: null },
      id: { notIn: Array.from(processedIds) },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      sourceUrl: true,
      mediaThumbnailUrl: true,
    },
  });

  const phase2 = await runPhase("Full DB sweep (all remaining null lat)", allNullItems);

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalGeocoded = phase1.geocoded + phase2.geocoded;
  const totalFailed = phase1.failed + phase2.failed;
  const totalItems = phase1.total + phase2.total;
  console.log("══════════════════════════════════");
  console.log(
    `TOTAL: ${totalGeocoded} geocoded, ${totalFailed} failed, ${totalItems} processed`
  );
  console.log("══════════════════════════════════");
}

main().catch(console.error).finally(() => db.$disconnect());
