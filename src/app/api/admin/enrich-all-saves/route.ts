import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichSavedItem } from "@/lib/enrich-save";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch dirty saves across all trips — not limited to PUBLIC
  const items = await db.savedItem.findMany({
    where: {
      OR: [
        { rawTitle: { contains: "on Instagram", mode: "insensitive" } },
        { rawTitle: { equals: "Google Maps" } },
        { rawTitle: { equals: "google.com" } },
        { extractionStatus: { notIn: ["ENRICHED", "ENRICHMENT_FAILED"] } },
        {
          AND: [
            { placePhotoUrl: null },
            { mediaThumbnailUrl: null },
            { sourceMethod: "URL_PASTE" },
          ],
        },
      ],
    },
    select: { id: true },
    take: 50,
  });

  console.log(`[enrich-all-saves] found ${items.length} dirty items to enrich`);

  let enriched = 0;
  for (const item of items) {
    try {
      await enrichSavedItem(item.id);
      enriched++;
    } catch (e) {
      console.error(`[enrich-all-saves] failed for ${item.id}:`, e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ total: items.length, enriched });
}
