import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nameSimilar } from "@/lib/enrich-with-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.savedItem.findMany({
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
        await db.savedItem.update({
          where: { id: item.id },
          data: { placePhotoUrl: null },
        });
        nulled++;
      } else {
        kept++;
      }
    }

    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return NextResponse.json({ checked, nulled, kept });
}
