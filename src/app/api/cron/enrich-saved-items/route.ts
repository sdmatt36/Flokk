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
      websiteUrl: null,
      extractionStatus: "ENRICHED",
      title: { not: null },
    },
    select: {
      id: true,
      title: true,
      destinationCity: true,
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
      const { website } = await enrichWithPlaces(
        item.title!,
        item.destinationCity ?? ""
      );

      if (website) {
        await db.savedItem.update({
          where: { id: item.id },
          data: { websiteUrl: website },
        });
        updated++;
        console.log(`[cron:enrich-saved-items] Updated websiteUrl for ${item.title}`);
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
