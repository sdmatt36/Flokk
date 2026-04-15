import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nameSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const wordsA = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wordsB = norm(b).split(" ").filter((w) => w.length > 2);
  const overlap = wordsB.filter((w) => wordsA.has(w)).length;
  return overlap > 0 || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

async function enrichWithPlaces(name: string, city: string): Promise<{ imageUrl: string | null; website: string | null }> {
  if (!GOOGLE_MAPS_API_KEY || !name.trim()) return { imageUrl: null, website: null };
  try {
    const query = [name.trim(), city.trim()].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return { imageUrl: null, website: null };

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,photos&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: { name?: string; website?: string; photos?: { photo_reference: string }[] };
    };
    const result = detailsData.result;
    if (!result) return { imageUrl: null, website: null };

    const website = result.website ?? null;
    const photoRef = result.photos?.[0]?.photo_reference ?? null;

    const placesName = result.name ?? "";
    if (placesName && !nameSimilar(name, placesName)) {
      console.log(`  [name mismatch] "${name}" -> "${placesName}" — skipping image`);
      return { imageUrl: null, website };
    }

    let imageUrl: string | null = null;
    if (photoRef) {
      const photoRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`,
        { redirect: "follow" }
      );
      const finalUrl = photoRes.url;
      if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
        imageUrl = finalUrl;
      }
    }

    return { imageUrl, website };
  } catch {
    return { imageUrl: null, website: null };
  }
}

const JUNK_PATTERNS = [/instagram/i, /airbnb/i, /\broom\b/i];

function isJunk(title: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(title));
}

async function main() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY is not set");
    process.exit(1);
  }

  const items = await prisma.savedItem.findMany({
    where: {
      placePhotoUrl: null,
      mediaThumbnailUrl: null,
      rawTitle: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
    },
  });

  const eligible = items.filter((item) => !isJunk(item.rawTitle!));
  const skippedJunk = items.length - eligible.length;

  console.log(`Found ${items.length} items with no image. ${skippedJunk} junk skipped. Processing ${eligible.length}...`);

  let processed = 0;
  let enriched = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const title = item.rawTitle!;
      const city = item.destinationCity ?? "";
      const result = await enrichWithPlaces(title, city);
      processed++;

      if (result.imageUrl) {
        await prisma.savedItem.update({
          where: { id: item.id },
          data: { placePhotoUrl: result.imageUrl },
        });
        console.log(`[reenrich] "${title}" -> ${result.imageUrl.slice(0, 80)}...`);
        enriched++;
      } else {
        console.log(`[reenrich] "${title}" -> no image found`);
      }
    }

    if (i + BATCH_SIZE < eligible.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. processed=${processed} enriched=${enriched} skipped(junk)=${skippedJunk}`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
