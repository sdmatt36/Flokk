/**
 * chat33-backfill-maps-city.ts
 *
 * Targets all Google Maps saves that have lat/lng but null destinationCity.
 * Calls reverseGeocodeCity logic inline and writes city+country back to DB.
 *
 * Scope: all profiles (universal), not just Greene.
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/chat33-backfill-maps-city.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function reverseGeocodeCity(
  lat: number,
  lng: number
): Promise<{ city: string | null; country: string | null }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { city: null, country: null };
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${key}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      results?: {
        address_components: { types: string[]; long_name: string }[];
      }[];
    };
    const components = data?.results?.[0]?.address_components ?? [];
    const getComponent = (types: string[]) => {
      for (const t of types) {
        const found = components.find((c) => c.types.includes(t));
        if (found) return found.long_name;
      }
      return null;
    };
    const city =
      getComponent(["locality"]) ??
      getComponent(["administrative_area_level_2"]) ??
      getComponent(["administrative_area_level_1"]);
    const country = getComponent(["country"]);
    return { city, country };
  } catch (err) {
    console.error("[reverseGeocodeCity] failed:", err);
    return { city: null, country: null };
  }
}

async function main() {
  // Find all Google Maps saves (by sourcePlatform or URL pattern) with coords but missing city
  const saves = await db.savedItem.findMany({
    where: {
      AND: [
        { lat: { not: null } },
        { lng: { not: null } },
        { destinationCity: null },
        {
          OR: [
            { sourcePlatform: "google_maps" },
            { sourceUrl: { contains: "maps.google.com" } },
            { sourceUrl: { contains: "google.com/maps" } },
            { sourceUrl: { contains: "maps.app.goo.gl" } },
            { sourceUrl: { contains: "goo.gl/maps" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      rawTitle: true,
      lat: true,
      lng: true,
      destinationCity: true,
      destinationCountry: true,
    },
  });

  console.log(`Found ${saves.length} Google Maps saves with coords but no city.`);

  let updated = 0;
  let skipped = 0;

  for (const save of saves) {
    if (!save.lat || !save.lng) { skipped++; continue; }

    const rev = await reverseGeocodeCity(save.lat, save.lng);
    if (!rev.city) {
      console.log(`  SKIP ${save.id} (${save.rawTitle}) — reverse geocode returned null`);
      skipped++;
      continue;
    }

    await db.savedItem.update({
      where: { id: save.id },
      data: {
        destinationCity: rev.city,
        destinationCountry: rev.country ?? save.destinationCountry,
      },
    });

    console.log(
      `  UPDATED ${save.id} (${save.rawTitle}) → city=${rev.city} country=${rev.country}`
    );
    updated++;

    // Throttle: 1 geocode per 200ms to stay within Google rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
