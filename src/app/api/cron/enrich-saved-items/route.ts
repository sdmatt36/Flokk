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
      title: { not: null },
    },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      websiteUrl: true,
      placePhotoUrl: true,
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  console.log(`[cron:enrich-saved-items] Found ${items.length} records to process`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    processed++;
    try {
      const { website, imageUrl } = await enrichWithPlaces(
        item.title!,
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
        console.log(`[cron:enrich-saved-items] Updated ${Object.keys(updateData).join(", ")} for ${item.title}`);
      } else {
        skipped++;
        console.log(`[cron:enrich-saved-items] No website found for ${item.title}`);
      }
    } catch (err) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron:enrich-saved-items] Error for ${item.id} (${item.title}):`, msg);
    }
  }

  return NextResponse.json({ processed, updated, skipped });
}
