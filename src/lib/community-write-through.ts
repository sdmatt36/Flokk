import type { Prisma } from "@prisma/client";

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

// Inline copy — canonical source: scripts/lib/clean-venue-name.ts
export function cleanVenueName(raw: string): string {
  if (!raw) return raw;
  let name = raw;
  name = name.replace(/\s*\|\s*Tabelog.*$/i, "");
  name = name.replace(/\s+-\s+[^|]+\/[^|]+$/i, "");
  name = name.replace(/\s*\([^)]*\/[^)]*\)\s*$/u, "");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

/**
 * Upsert CommunitySpot + SpotContribution for a rating/note write.
 * No-ops if city missing or if both rating and note are absent.
 * MUST be called inside a Prisma $transaction.
 */
export async function writeThroughCommunitySpot(
  tx: Tx,
  ctx: CommunityWriteThroughContext
): Promise<string | null> {
  if (!ctx.city || !ctx.city.trim()) return null;
  if (ctx.rating == null && !ctx.note) return null;

  const cleanedName = cleanVenueName(ctx.name);
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
    spot = await tx.communitySpot.create({
      data: {
        name: cleanedName,
        city: ctx.city,
        country: ctx.country ?? null,
        lat: ctx.lat ?? null,
        lng: ctx.lng ?? null,
        photoUrl: ctx.photoUrl ?? null,
        websiteUrl: ctx.websiteUrl ?? null,
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
