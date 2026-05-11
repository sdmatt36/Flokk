import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Syncs CommunitySpot.category from matching SavedItem.categoryTags[0].
 * Match key: name (case-insensitive) + city (case-insensitive).
 * Only updates spots where category is null OR different from what the save says.
 * Safe to run multiple times — skips rows where nothing changes.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull all rated saved items that have at least one category tag
  const saves = await db.savedItem.findMany({
    where: {
      categoryTags: { isEmpty: false },
      userRating: { not: null },
      deletedAt: null,
      destinationCity: { not: null },
    },
    select: {
      rawTitle: true,
      destinationCity: true,
      categoryTags: true,
    },
  });

  let scanned = 0;
  let updated = 0;

  for (const save of saves) {
    if (!save.rawTitle || !save.destinationCity) continue;
    const primaryCategory = save.categoryTags[0];
    if (!primaryCategory) continue;

    scanned++;

    const spot = await db.communitySpot.findFirst({
      where: {
        name: { equals: save.rawTitle, mode: "insensitive" },
        city: { equals: save.destinationCity, mode: "insensitive" },
      },
      select: { id: true, category: true },
    });

    if (!spot) continue;
    if (spot.category === primaryCategory) continue;

    await db.communitySpot.update({
      where: { id: spot.id },
      data: { category: primaryCategory },
    });
    updated++;
  }

  return NextResponse.json({ scanned, updated });
}
