import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Restores SavedItem.userRating from the most recent PlaceRating for each saved item
 * where userRating is null but a PlaceRating exists.
 *
 * Root cause: backfill-created SavedItems and older records lost their userRating
 * when the SavedItem was re-created or never had it set. PlaceRating is the source
 * of truth for historical ratings.
 *
 * Safe to run multiple times — only updates rows where userRating IS NULL.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all PlaceRating rows that have a savedItemId but the SavedItem.userRating is null
  const placeRatings = await db.placeRating.findMany({
    where: {
      savedItemId: { not: null },
      rating: { not: undefined },
      savedItem: { userRating: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      savedItemId: true,
      rating: true,
    },
  });

  // Deduplicate: take the most recent PlaceRating per savedItemId (already sorted desc)
  const bestRatingBySavedItem = new Map<string, number>();
  for (const pr of placeRatings) {
    if (pr.savedItemId && pr.rating != null && !bestRatingBySavedItem.has(pr.savedItemId)) {
      bestRatingBySavedItem.set(pr.savedItemId, pr.rating);
    }
  }

  let restored = 0;
  let failed = 0;

  for (const [savedItemId, rating] of bestRatingBySavedItem) {
    try {
      await db.savedItem.update({
        where: { id: savedItemId },
        data: { userRating: rating },
      });
      restored++;
    } catch (e) {
      console.error(`[restore-ratings] failed for savedItemId=${savedItemId}:`, e);
      failed++;
    }
  }

  return NextResponse.json({ scanned: placeRatings.length, uniqueSavedItems: bestRatingBySavedItem.size, restored, failed });
}
