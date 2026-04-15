import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

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

async function getPlacesName(title: string, city: string | null): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY || !title.trim()) return null;
  try {
    const query = [title.trim(), city?.trim() ?? ""].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as { result?: { name?: string } };
    return detailsData.result?.name ?? null;
  } catch {
    return null;
  }
}

async function main() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY is not set");
    process.exit(1);
  }

  const items = await prisma.savedItem.findMany({
    where: {
      placePhotoUrl: { not: null },
      rawTitle: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      placePhotoUrl: true,
    },
  });

  console.log(`Found ${items.length} SavedItems with placePhotoUrl set`);

  let checked = 0;
  let nulled = 0;
  let kept = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const title = item.rawTitle!;
      const placesName = await getPlacesName(title, item.destinationCity);
      checked++;

      if (placesName && !nameSimilar(title, placesName)) {
        console.log(`[revalidate] nulled: "${title}" -> "${placesName}"`);
        await prisma.savedItem.update({
          where: { id: item.id },
          data: { placePhotoUrl: null },
        });
        nulled++;
      } else {
        console.log(`[revalidate] kept: "${title}"${placesName ? ` (Places: "${placesName}")` : " (no Places result)"}`);
        kept++;
      }
    }

    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. checked=${checked} nulled=${nulled} kept=${kept}`);
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
