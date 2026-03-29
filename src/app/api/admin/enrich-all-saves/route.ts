import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichSavedItem } from "@/lib/enrich-save";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all unenriched saves on PUBLIC trips
  const items = await db.savedItem.findMany({
    where: {
      OR: [{ lat: null }, { extractionStatus: { not: "ENRICHED" } }],
      trip: { privacy: "PUBLIC" },
    },
    select: { id: true },
  });

  console.log(`[enrich-all-saves] found ${items.length} items to enrich`);

  let enriched = 0;
  for (const item of items) {
    try {
      await enrichSavedItem(item.id);
      enriched++;
    } catch (e) {
      console.error(`[enrich-all-saves] failed for ${item.id}:`, e);
    }
    // 100ms delay between items to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ total: items.length, enriched });
}
