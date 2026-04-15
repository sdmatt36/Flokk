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
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      websiteUrl: true,
      placePhotoUrl: true,
    },
    take: 50,
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

      const updateData: Record<string, string> = {};
      if (website && !item.websiteUrl) updateData.websiteUrl = website;
      if (imageUrl && !item.placePhotoUrl) updateData.placePhotoUrl = imageUrl;

      if (Object.keys(updateData).length > 0) {
        await db.savedItem.update({
          where: { id: item.id },
          data: updateData,
        });
        updated++;
        console.log(`[cron:enrich-saved-items] Updated ${Object.keys(updateData).join(", ")} for ${item.rawTitle}`);
      } else {
        skipped++;
        console.log(`[cron:enrich-saved-items] No website found for ${item.rawTitle}`);
      }
    } catch (err) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron:enrich-saved-items] Error for ${item.id} (${item.rawTitle}):`, msg);
    }
  }

  return NextResponse.json({ processed, updated, skipped });
}
