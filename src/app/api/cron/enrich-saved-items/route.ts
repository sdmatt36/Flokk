import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichWithPlaces } from "@/lib/enrich-with-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.savedItem.findMany({
    where: {
      OR: [{ websiteUrl: null }, { placePhotoUrl: null }],
      extractionStatus: "ENRICHED",
      rawTitle: { not: null },
      enrichmentAttempts: { lt: 3 },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      websiteUrl: true,
      placePhotoUrl: true,
      enrichmentAttempts: true,
    },
    take: 25,
    orderBy: { savedAt: "asc" },
  });

  console.log(`[cron:enrich-saved-items] Found ${items.length} records to process`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    processed++;
    try {
      const { website, imageUrl } = await enrichWithPlaces(
        item.rawTitle!,
        item.destinationCity ?? ""
      );

      const updateData: Record<string, unknown> = {};
      if (website && !item.websiteUrl) updateData.websiteUrl = website;
      if (imageUrl && !item.placePhotoUrl) updateData.placePhotoUrl = imageUrl;

      // On the third attempt with still-null placePhotoUrl, give up permanently
      const willBeThirdAttempt = (item.enrichmentAttempts ?? 0) + 1 >= 3;
      const stillNoPhoto = !item.placePhotoUrl && !updateData.placePhotoUrl;
      if (willBeThirdAttempt && stillNoPhoto) {
        updateData.extractionStatus = "ENRICHMENT_FAILED";
        console.log(`[enrich-give-up] "${item.rawTitle}" reached 3 attempts without photo; marking ENRICHMENT_FAILED`);
      }

      // Always increment attempt counter regardless of success or failure
      await db.savedItem.update({
        where: { id: item.id },
        data: {
          ...updateData,
          enrichmentAttempts: { increment: 1 },
        },
      });

      if (Object.keys(updateData).filter(k => k !== "extractionStatus").length > 0) {
        updated++;
        console.log(`[cron:enrich-saved-items] Updated ${Object.keys(updateData).join(", ")} for ${item.rawTitle}`);
      } else {
        skipped++;
        console.log(`[cron:enrich-saved-items] No enrichment found for ${item.rawTitle}`);
      }
    } catch (err) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron:enrich-saved-items] Error for ${item.id} (${item.rawTitle}):`, msg);
    }
  }

  return NextResponse.json({ processed, updated, skipped });
}
