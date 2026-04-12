import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

async function resolvePhotoUrl(photoReference: string): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    return res.url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch activities missing website or image, limit 50 per run
  const activities = await db.manualActivity.findMany({
    where: {
      OR: [
        { website: null },
        { imageUrl: null },
      ],
    },
    select: {
      id: true,
      title: true,
      city: true,
      website: true,
      imageUrl: true,
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  console.log(`[enrich-manual-activities] Found ${activities.length} records to process`);

  let processed = 0;
  let enriched = 0;
  const errors: string[] = [];

  for (const activity of activities) {
    processed++;
    try {
      const query = [activity.title, activity.city].filter(Boolean).join(" ");

      // Text Search to get place_id
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json() as { results?: { place_id: string }[] };
      const placeId = searchData.results?.[0]?.place_id;
      if (!placeId) continue;

      // Places Details
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,photos&key=${GOOGLE_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json() as {
        result?: {
          website?: string;
          formatted_phone_number?: string;
          photos?: { photo_reference: string }[];
        };
      };
      const result = detailsData.result;
      if (!result) continue;

      // Build update — only patch null fields, never overwrite existing values
      const update: { website?: string; imageUrl?: string } = {};

      if (!activity.website && result.website) {
        update.website = result.website;
      }

      if (!activity.imageUrl) {
        const photoRef = result.photos?.[0]?.photo_reference;
        if (photoRef) {
          const imageUrl = await resolvePhotoUrl(photoRef);
          if (imageUrl) update.imageUrl = imageUrl;
        }
      }

      if (Object.keys(update).length === 0) continue;

      await db.manualActivity.update({
        where: { id: activity.id },
        data: update,
      });

      enriched++;
      console.log(
        `[enrich-manual-activities] Enriched: ${activity.title} | website: ${update.website ?? "—"} | image: ${!!update.imageUrl}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enrich-manual-activities] Error for ${activity.id} (${activity.title}):`, msg);
      errors.push(`${activity.title}: ${msg}`);
    }
  }

  return NextResponse.json({ processed, enriched, errors });
}
