import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveGooglePhotoUrl } from "@/lib/google-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

async function resolvePhotoUrl(photoReference: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_KEY}`;
  return resolveGooglePhotoUrl(url);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch activities missing website or image, not yet at attempt cap
  const activities = await db.manualActivity.findMany({
    where: {
      OR: [
        { website: null },
        { imageUrl: null },
      ],
      enrichmentAttempts: { lt: 3 },
    },
    select: {
      id: true,
      title: true,
      city: true,
      website: true,
      imageUrl: true,
      enrichmentAttempts: true,
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  console.log(`[enrich-manual-activities] Found ${activities.length} records to process`);

  let processed = 0;
  let enriched = 0;
  let gaveUp = 0;
  const errors: string[] = [];

  for (const activity of activities) {
    processed++;
    try {
      const query = [activity.title, activity.city].filter(Boolean).join(" ");
      const update: { website?: string; imageUrl?: string } = {};

      // Text Search to get place_id
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`
      );
      const searchData = await searchRes.json() as { results?: { place_id: string }[] };
      const placeId = searchData.results?.[0]?.place_id;

      if (placeId) {
        // Places Details
        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,photos&key=${GOOGLE_KEY}`
        );
        const detailsData = await detailsRes.json() as {
          result?: {
            website?: string;
            formatted_phone_number?: string;
            photos?: { photo_reference: string }[];
          };
        };
        const result = detailsData.result;

        if (result) {
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
        }
      }

      // Always increment attempt counter regardless of success or failure — mirror enrich-saved-items
      const willBeThirdAttempt = (activity.enrichmentAttempts ?? 0) + 1 >= 3;
      const noDataFound = Object.keys(update).length === 0;

      const updateData: Record<string, unknown> = {
        ...update,
        enrichmentAttempts: { increment: 1 },
      };

      if (willBeThirdAttempt && noDataFound) {
        updateData.enrichmentFailedAt = new Date();
        gaveUp++;
        console.log(`[enrich-manual-activities] Gave up on "${activity.title}" after 3 attempts`);
      }

      await db.manualActivity.update({
        where: { id: activity.id },
        data: updateData,
      });

      if (Object.keys(update).length > 0) {
        enriched++;
        console.log(
          `[enrich-manual-activities] Enriched: ${activity.title} | website: ${update.website ?? "—"} | image: ${!!update.imageUrl}`
        );
      } else if (!willBeThirdAttempt) {
        console.log(`[enrich-manual-activities] No enrichment found for "${activity.title}" (attempt ${(activity.enrichmentAttempts ?? 0) + 1})`);
      }
    } catch (err) {
      // Exception during Places calls or DB write — do NOT increment, retry on next run
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enrich-manual-activities] Error for ${activity.id} (${activity.title}):`, msg);
      errors.push(`${activity.title}: ${msg}`);
    }
  }

  return NextResponse.json({ processed, enriched, gaveUp, errors });
}
