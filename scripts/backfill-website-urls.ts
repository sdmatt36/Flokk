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

async function getPlacesWebsite(
  title: string,
  city: string
): Promise<{ website: string | null; placesName: string | null }> {
  if (!GOOGLE_MAPS_API_KEY || !title.trim()) return { website: null, placesName: null };
  try {
    const query = [title.trim(), city.trim()].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = (await searchRes.json()) as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return { website: null, placesName: null };

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = (await detailsRes.json()) as {
      result?: { name?: string; website?: string };
    };
    const result = detailsData.result;
    if (!result) return { website: null, placesName: null };

    return {
      website: result.website ?? null,
      placesName: result.name ?? null,
    };
  } catch {
    return { website: null, placesName: null };
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
      websiteUrl: null,
      rawTitle: { not: null },
      destinationCity: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
    },
  });

  const eligible = items.filter((item) => !isJunk(item.rawTitle!));
  const skippedJunk = items.length - eligible.length;

  console.log(
    `Found ${items.length} items with no websiteUrl. ${skippedJunk} junk skipped. Processing ${eligible.length}...`
  );

  let processed = 0;
  let filled = 0;
  let skipped = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const title = item.rawTitle!;
      const city = item.destinationCity!;
      const { website, placesName } = await getPlacesWebsite(title, city);
      processed++;

      if (!placesName) {
        console.log(`[website] "${title}" -> no match`);
        skipped++;
        continue;
      }

      if (!nameSimilar(title, placesName)) {
        console.log(`[website] "${title}" -> name mismatch ("${placesName}")`);
        skipped++;
        continue;
      }

      if (!website) {
        console.log(`[website] "${title}" -> no website (Places: "${placesName}")`);
        skipped++;
        continue;
      }

      await prisma.savedItem.update({
        where: { id: item.id },
        data: { websiteUrl: website },
      });
      console.log(`[website] "${title}" -> ${website}`);
      filled++;
    }

    if (i + BATCH_SIZE < eligible.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `\nDone. processed=${processed} filled=${filled} skipped=${skipped} skipped(junk)=${skippedJunk}`
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
