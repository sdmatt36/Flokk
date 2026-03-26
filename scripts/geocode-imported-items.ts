import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_KEY || !query.trim()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const first = data.results?.[0];
    if (!first) return null;
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  } catch {
    return null;
  }
}

async function main() {
  if (!GOOGLE_KEY) {
    console.error("[geocode-backfill] NEXT_PUBLIC_GOOGLE_PLACES_API_KEY not set — aborting");
    process.exit(1);
  }

  const items = await db.itineraryItem.findMany({
    where: { latitude: null, NOT: { type: "FLIGHT" } },
    include: { trip: { select: { destinationCity: true } } },
  });

  // Also include FLIGHT items with null latitude
  const flightItems = await db.itineraryItem.findMany({
    where: { latitude: null, type: "FLIGHT" },
    include: { trip: { select: { destinationCity: true } } },
  });

  const all = [...items, ...flightItems];
  console.log(`[geocode-backfill] ${all.length} items to geocode`);

  for (const item of all) {
    const destCity = item.trip?.destinationCity ?? "";
    let query = "";

    if (item.type === "FLIGHT") {
      // Use arrival airport from title (e.g. "ICN → NRT" → geocode "NRT airport")
      const parts = item.title.split("→").map(s => s.trim());
      const arrival = parts[1] ?? parts[0] ?? "";
      query = `${arrival} airport${destCity ? " " + destCity : ""}`.trim();
    } else if (item.type === "LODGING") {
      const name = item.title.replace(/^Check-in:\s*/i, "").replace(/^Check-out:\s*/i, "");
      query = `${name}${destCity ? " " + destCity : ""}`.trim();
    } else if (item.type === "TRAIN") {
      const city = item.fromCity ?? destCity;
      query = city ? `${city} train station` : item.title;
    } else {
      query = `${item.title}${destCity ? " " + destCity : ""}`.trim();
    }

    if (!query) {
      console.log(`[geocode-backfill] skipping "${item.title}" — no query`);
      continue;
    }

    const geo = await geocodePlace(query);
    if (!geo) {
      console.log(`[geocode-backfill] no result for "${item.title}" (query: "${query}")`);
      continue;
    }

    await db.itineraryItem.update({
      where: { id: item.id },
      data: { latitude: geo.lat, longitude: geo.lng },
    });
    console.log(`[geocode-backfill] "${item.title}" → lat: ${geo.lat}, lng: ${geo.lng}`);

    // Brief pause to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("[geocode-backfill] done");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
