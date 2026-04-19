import type { Prisma } from "@prisma/client";
import { normalizePlaceName, resolvePlaceUrl, deservesUrl } from "./google-places";

type Tx = Prisma.TransactionClient;

export interface CommunityWriteThroughContext {
  name: string;
  city: string;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  photoUrl?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  category?: string | null;
  googlePlaceId?: string | null;
  authorProfileId: string;
  familyProfileId: string;
  rating?: number | null;
  note?: string | null;
}

/**
 * Upsert CommunitySpot + SpotContribution for a rating/note write.
 * No-ops if city missing or if both rating and note are absent.
 * MUST be called inside a Prisma $transaction.
 *
 * Note: callers pass tx. The Places URL lookup happens inside this function
 * before the CommunitySpot create, which means it runs during the caller's
 * open transaction (~1-2s worst case). Acceptable given the 10s tx timeout.
 * URL is only resolved for new spots — matched spots are untouched.
 */
export async function writeThroughCommunitySpot(
  tx: Tx,
  ctx: CommunityWriteThroughContext
): Promise<string | null> {
  if (!ctx.city || !ctx.city.trim()) return null;
  if (ctx.rating == null && !ctx.note) return null;

  const cleanedName = normalizePlaceName(ctx.name);
  if (!cleanedName) return null;

  let spot: { id: string } | null = null;

  if (ctx.googlePlaceId) {
    spot = await tx.communitySpot.findFirst({
      where: { googlePlaceId: ctx.googlePlaceId },
      select: { id: true },
    });
  }

  if (!spot) {
    spot = await tx.communitySpot.findFirst({
      where: {
        name: { equals: cleanedName, mode: "insensitive" },
        city: { equals: ctx.city, mode: "insensitive" },
      },
      select: { id: true },
    });
  }

  if (!spot) {
    // Resolve URL only for new spots. ctx.websiteUrl takes precedence.
    let resolvedUrl: string | null = ctx.websiteUrl ?? null;
    let needsUrlReview = false;

    if (!resolvedUrl && deservesUrl(cleanedName)) {
      try {
        resolvedUrl = await resolvePlaceUrl(cleanedName, ctx.city);
      } catch {
        resolvedUrl = null;
      }
      if (!resolvedUrl) needsUrlReview = true;
    }

    spot = await tx.communitySpot.create({
      data: {
        name: cleanedName,
        city: ctx.city,
        country: ctx.country ?? null,
        lat: ctx.lat ?? null,
        lng: ctx.lng ?? null,
        photoUrl: ctx.photoUrl ?? null,
        websiteUrl: resolvedUrl,
        needsUrlReview,
        description: ctx.description ?? null,
        category: ctx.category ?? null,
        googlePlaceId: ctx.googlePlaceId ?? null,
        authorProfileId: ctx.authorProfileId,
      },
      select: { id: true },
    });
  }

  await tx.spotContribution.upsert({
    where: {
      communitySpotId_familyProfileId: {
        communitySpotId: spot.id,
        familyProfileId: ctx.familyProfileId,
      },
    },
    create: {
      communitySpotId: spot.id,
      familyProfileId: ctx.familyProfileId,
      rating: ctx.rating ?? null,
      note: ctx.note ?? null,
    },
    update: {
      rating: ctx.rating ?? null,
      note: ctx.note ?? null,
    },
  });

  const contributions = await tx.spotContribution.findMany({
    where: { communitySpotId: spot.id },
    select: { rating: true },
  });
  const ratedContribs = contributions.filter((c) => c.rating != null);
  const ratingCount = ratedContribs.length;
  const contributionCount = contributions.length;
  const averageRating =
    ratingCount > 0
      ? ratedContribs.reduce((sum, c) => sum + (c.rating as number), 0) / ratingCount
      : null;

  await tx.communitySpot.update({
    where: { id: spot.id },
    data: { averageRating, ratingCount, contributionCount },
  });

  return spot.id;
}
