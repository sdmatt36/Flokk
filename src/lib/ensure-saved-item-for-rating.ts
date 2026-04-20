import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface EnsureSavedItemContext {
  familyProfileId: string;
  communitySpotId: string;      // produced by writeThroughCommunitySpot — REQUIRED
  placeName: string;             // already-cleaned name (matches CommunitySpot.name)
  city: string;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  photoUrl?: string | null;
  websiteUrl?: string | null;
  category?: string | null;
  googlePlaceId?: string | null;
  rating?: number | null;        // user's rating; stored on SavedItem.userRating if creating
  note?: string | null;          // user's note; stored on SavedItem.notes if creating
}

/**
 * Ensure this family has a SavedItem linked to the given CommunitySpot.
 *
 * Behavior:
 *   - If a SavedItem with matching (familyProfileId, communitySpotId) exists: NO-OP, return existing id.
 *   - If a SavedItem with matching (familyProfileId, name+city, no communitySpotId) exists:
 *     UPDATE to add the link and optionally the rating/note. Does NOT overwrite existing userRating.
 *   - Otherwise: CREATE a global-scope SavedItem (no tripId) with communitySpotId link,
 *     sourceType MANUAL, extractionStatus ENRICHED.
 *
 * MUST be called inside a $transaction. Returns the SavedItem id.
 *
 * Global scope: no tripId. Rated place lives in the family's Saves library,
 * not pinned to any specific trip bucket.
 */
export async function ensureSavedItemForRating(
  tx: Tx,
  ctx: EnsureSavedItemContext
): Promise<string> {
  // 1. Match by communitySpotId (preferred — already linked)
  const byLink = await tx.savedItem.findFirst({
    where: {
      familyProfileId: ctx.familyProfileId,
      communitySpotId: ctx.communitySpotId,
    },
    select: { id: true, userRating: true, notes: true },
  });

  if (byLink) {
    // Already linked. Upgrade rating/note only if currently empty.
    const patch: Prisma.SavedItemUpdateInput = {};
    if (byLink.userRating == null && ctx.rating != null) patch.userRating = ctx.rating;
    if ((!byLink.notes || !byLink.notes.trim()) && ctx.note) patch.notes = ctx.note;
    if (Object.keys(patch).length > 0) {
      await tx.savedItem.update({ where: { id: byLink.id }, data: patch });
    }
    return byLink.id;
  }

  // 2. Match by name + city (self-heal saves that pre-date the communitySpotId link)
  const byNameCity = await tx.savedItem.findFirst({
    where: {
      familyProfileId: ctx.familyProfileId,
      communitySpotId: null,
      rawTitle: { equals: ctx.placeName, mode: "insensitive" },
      destinationCity: { equals: ctx.city, mode: "insensitive" },
    },
    select: { id: true, userRating: true, notes: true },
  });

  if (byNameCity) {
    const patch: Prisma.SavedItemUpdateInput = {
      communitySpot: { connect: { id: ctx.communitySpotId } },
    };
    if (byNameCity.userRating == null && ctx.rating != null) patch.userRating = ctx.rating;
    if ((!byNameCity.notes || !byNameCity.notes.trim()) && ctx.note) patch.notes = ctx.note;
    await tx.savedItem.update({ where: { id: byNameCity.id }, data: patch });
    return byNameCity.id;
  }

  // 3. No existing SavedItem — create new global-scope save
  const created = await tx.savedItem.create({
    data: {
      familyProfileId: ctx.familyProfileId,
      communitySpotId: ctx.communitySpotId,
      sourceMethod: "IN_APP_SAVE",
      sourcePlatform: "direct",
      extractionStatus: "ENRICHED",
      status: "UNORGANIZED",
      rawTitle: ctx.placeName,
      destinationCity: ctx.city,
      destinationCountry: ctx.country ?? null,
      lat: ctx.lat ?? null,
      lng: ctx.lng ?? null,
      placePhotoUrl: ctx.photoUrl ?? null,
      websiteUrl: ctx.websiteUrl ?? null,
      categoryTags: ctx.category ? [ctx.category] : [],
      userRating: ctx.rating ?? null,
      notes: ctx.note ?? null,
      // No tripId — global scope per design
    },
    select: { id: true },
  });

  return created.id;
}
