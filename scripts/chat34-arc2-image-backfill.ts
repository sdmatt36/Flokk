/**
 * chat34-arc2-image-backfill.ts
 *
 * Enriches EMAIL_FORWARD SavedItems created on/after 2026-04-23 that have null placePhotoUrl.
 * Uses inline Google Places fetch calls (not the enrichWithPlaces utility) to avoid the
 * ESM import-hoisting issue where the shared utility captures GOOGLE_MAPS_API_KEY at
 * module-load time before dotenv runs.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getVenueImage } from "../src/lib/destination-images";

// Read key at runtime (after dotenv has loaded)
function getKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

async function fetchPlacesEnrichment(
  name: string,
  cityStr: string
): Promise<{ imageUrl: string | null; website: string | null }> {
  const key = getKey();
  if (!key || !name.trim()) return { imageUrl: null, website: null };

  try {
    const query = [name.trim(), cityStr.trim()].filter(Boolean).join(" ");

    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return { imageUrl: null, website: null };

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,photos&key=${key}`
    );
    const detailsData = await detailsRes.json() as {
      result?: { name?: string; website?: string; photos?: { photo_reference: string }[] };
    };
    const result = detailsData.result;
    if (!result) return { imageUrl: null, website: null };

    const website = result.website ?? null;
    const photoRef = result.photos?.[0]?.photo_reference ?? null;

    let imageUrl: string | null = null;
    if (photoRef) {
      const photoRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${key}`,
        { redirect: "follow" }
      );
      const finalUrl = photoRes.url;
      if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
        imageUrl = finalUrl;
      }
    }

    return { imageUrl, website };
  } catch (e: any) {
    console.warn(`  [places exception] ${e?.message ?? e}`);
    return { imageUrl: null, website: null };
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const rows = await db.savedItem.findMany({
    where: {
      sourceMethod: "EMAIL_FORWARD",
      placePhotoUrl: null,
      savedAt: { gte: new Date("2026-04-23T00:00:00Z") },
    },
    select: {
      id: true, rawTitle: true, destinationCity: true, destinationCountry: true, websiteUrl: true,
    },
    orderBy: { savedAt: "asc" },
  });

  console.log(`Arc 2 rows with null placePhotoUrl: ${rows.length}`);
  if (rows.length === 0) {
    console.log("Nothing to backfill.");
    await pool.end();
    return;
  }

  let updated = 0;
  let venueHits = 0;
  let placesHits = 0;
  let noEnrichment = 0;

  for (const r of rows) {
    if (!r.rawTitle) { console.log(`[skip] ${r.id}: no rawTitle`); continue; }
    console.log(`\nEnriching: ${r.rawTitle} (${r.destinationCity ?? "?"})`);

    // Curated lookup first (synchronous, no API call)
    const curated = getVenueImage(r.rawTitle);
    let finalPhoto: string | null = curated ?? null;
    if (curated) {
      console.log(`  [venue] hit`);
      venueHits++;
    }

    // Google Places for photo (if not curated) + website (always try)
    let placesWebsite: string | null = null;
    const cityStr = [r.destinationCity, r.destinationCountry].filter(Boolean).join(", ");
    const placesResult = await fetchPlacesEnrichment(r.rawTitle, cityStr);
    if (placesResult.imageUrl && !finalPhoto) {
      finalPhoto = placesResult.imageUrl;
      console.log(`  [places photo] hit: ${placesResult.imageUrl.slice(0, 80)}`);
      placesHits++;
    }
    if (placesResult.website && !r.websiteUrl) {
      placesWebsite = placesResult.website;
      console.log(`  [places website] hit: ${placesResult.website.slice(0, 80)}`);
    }

    if (!finalPhoto && !placesWebsite) {
      console.log(`  [no-op] nothing found`);
      noEnrichment++;
      continue;
    }

    const updateData: Record<string, string> = {};
    if (finalPhoto) updateData.placePhotoUrl = finalPhoto;
    if (placesWebsite) updateData.websiteUrl = placesWebsite;
    await db.savedItem.update({ where: { id: r.id }, data: updateData });
    updated++;
    console.log(`  [saved]`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Total processed: ${rows.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Venue-curated hits: ${venueHits}`);
  console.log(`  Google Places photo hits: ${placesHits}`);
  console.log(`  No enrichment available: ${noEnrichment}`);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
