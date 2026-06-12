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
      OR: [{ googlePlaceId: null }, { address: null }],
      deletedAt: null,
      rawTitle: { not: null },
      enrichmentAttempts: { lt: 3 },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      googlePlaceId: true,
      address: true,
      enrichmentAttempts: true,
    },
    take: 25,
    orderBy: { savedAt: "asc" },
  });

  console.log(`[backfill-save-places] Processing ${items.length} saves`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      const { placeId, formattedAddress } = await enrichWithPlaces(
        item.rawTitle!,
        item.destinationCity ?? ""
      );

      const updateData: Record<string, unknown> = {
        enrichmentAttempts: { increment: 1 },
      };
      if (placeId && !item.googlePlaceId) updateData.googlePlaceId = placeId;
      if (formattedAddress && !item.address) updateData.address = formattedAddress;

      await db.savedItem.update({ where: { id: item.id }, data: updateData });

      if (placeId || formattedAddress) {
        updated++;
        const got = [placeId && "placeId", formattedAddress && "address"].filter(Boolean).join("+");
        console.log(`[backfill-save-places] "${item.rawTitle}" (${item.destinationCity ?? "?"}): ${got}`);
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
      console.error(`[backfill-save-places] Error for ${item.id} (${item.rawTitle}):`, err);
    }
  }

  const remaining = await db.savedItem.count({
    where: {
      OR: [{ googlePlaceId: null }, { address: null }],
      deletedAt: null,
      rawTitle: { not: null },
      enrichmentAttempts: { lt: 3 },
    },
  });

  return NextResponse.json({ processed: items.length, updated, skipped, remaining });
}
