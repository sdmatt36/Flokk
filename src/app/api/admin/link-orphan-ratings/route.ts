import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Links PlaceRating rows where savedItemId IS NULL to their matching SavedItem,
 * then syncs SavedItem.userRating where it is currently null.
 *
 * Matching: same familyProfileId + case-insensitive placeName ↔ rawTitle.
 * When multiple SavedItems match, prefers the one whose destinationCity also matches.
 * When multiple PlaceRatings match the same SavedItem, uses the most recent one.
 *
 * Safe to run multiple times — only processes PlaceRatings where savedItemId IS NULL.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all orphaned PlaceRatings (no savedItemId)
  const orphans = await db.placeRating.findMany({
    where: { savedItemId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      familyProfileId: true,
      placeName: true,
      destinationCity: true,
      rating: true,
    },
  });

  let linked = 0;
  let ratingsSynced = 0;
  let unmatched = 0;

  // Track which savedItemId was already claimed (most-recent PlaceRating wins per savedItemId)
  const claimedSavedItemIds = new Set<string>();

  for (const pr of orphans) {
    const nameLower = pr.placeName.toLowerCase().trim();

    // Find SavedItems for this profile where rawTitle matches (case-insensitive)
    const candidates = await db.savedItem.findMany({
      where: { familyProfileId: pr.familyProfileId },
      select: { id: true, rawTitle: true, destinationCity: true, userRating: true },
    });

    const exactMatches = candidates.filter(
      (c) => (c.rawTitle ?? "").toLowerCase().trim() === nameLower
    );

    if (exactMatches.length === 0) {
      unmatched++;
      continue;
    }

    // Prefer a city match; fall back to any name match
    const cityLower = (pr.destinationCity ?? "").toLowerCase().trim();
    const cityMatch = exactMatches.find(
      (c) => cityLower && (c.destinationCity ?? "").toLowerCase().trim() === cityLower
    );
    const best = cityMatch ?? exactMatches[0];

    // Skip if another (more recent) PlaceRating already claimed this savedItemId
    if (claimedSavedItemIds.has(best.id)) continue;
    claimedSavedItemIds.add(best.id);

    try {
      // Link the PlaceRating to the SavedItem
      await db.placeRating.update({
        where: { id: pr.id },
        data: { savedItemId: best.id },
      });
      linked++;

      // Sync userRating only if currently null (never overwrite an existing rating)
      if (best.userRating == null && pr.rating != null) {
        await db.savedItem.update({
          where: { id: best.id },
          data: { userRating: pr.rating },
        });
        ratingsSynced++;
      }
    } catch (e) {
      console.error(`[link-orphan-ratings] failed for placeRatingId=${pr.id}:`, e);
    }
  }

  return NextResponse.json({
    scanned: orphans.length,
    linked,
    ratingsSynced,
    unmatched,
  });
}
