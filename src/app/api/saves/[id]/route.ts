import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { normalizePlaceName } from "@/lib/google-places";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    include: { trip: { select: { id: true, title: true } } },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item, interestKeys: item.interestKeys ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({ where: { id } });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (typeof body.rawTitle === "string") updateData.rawTitle = body.rawTitle;
  if (typeof body.notes === "string") updateData.notes = body.notes;
  if (typeof body.userRating === "number") updateData.userRating = body.userRating;
  if (Array.isArray(body.categoryTags)) updateData.categoryTags = { set: normalizeAndDedupeCategoryTags(body.categoryTags) };
  if (typeof body.tripId === "string") {
    updateData.tripId = body.tripId;
    updateData.status = "TRIP_ASSIGNED";
  } else if (body.tripId === null) {
    updateData.tripId = null;
    updateData.status = "UNORGANIZED";
  }
  if (typeof body.destinationCity === "string" || body.destinationCity === null) updateData.destinationCity = body.destinationCity ?? null;
  if (typeof body.destinationCountry === "string" || body.destinationCountry === null) updateData.destinationCountry = body.destinationCountry ?? null;
  if (typeof body.websiteUrl === "string" || body.websiteUrl === null) updateData.websiteUrl = body.websiteUrl ?? null;
  if (typeof body.dayIndex === "number" || body.dayIndex === null) updateData.dayIndex = body.dayIndex;
  if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
  if (typeof body.startTime === "string" || body.startTime === null) updateData.startTime = body.startTime ?? null;
  if (typeof body.extractedCheckin === "string" || body.extractedCheckin === null) updateData.extractedCheckin = body.extractedCheckin ?? null;
  if (typeof body.extractedCheckout === "string" || body.extractedCheckout === null) updateData.extractedCheckout = body.extractedCheckout ?? null;
  if (typeof body.tourId === "string" || body.tourId === null) updateData.tourId = body.tourId ?? null;
  if (typeof body.isBooked === "boolean") {
    updateData.isBooked = body.isBooked;
    if (body.isBooked) updateData.bookedAt = new Date();
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    console.log("[PATCH /api/saves] updateData:", JSON.stringify(updateData));
    const updated = await db.savedItem.update({ where: { id }, data: updateData });

    // PlaceRating write-through — fires when userRating is updated.
    // Keeps PlaceRating in sync with userRating so Community Picks aggregation is accurate.
    // Errors are logged but do not fail the PATCH response.
    if ("userRating" in updateData) {
      try {
        if (updated.userRating == null) {
          await db.placeRating.deleteMany({ where: { savedItemId: id } });
        } else {
          const existing = await db.placeRating.findFirst({ where: { savedItemId: id } });
          const ratingData = {
            rating: updated.userRating,
            notes: updated.notes ?? null,
            wouldReturn: updated.userRating >= 4,
          };
          if (existing) {
            await db.placeRating.update({ where: { id: existing.id }, data: ratingData });
          } else {
            await db.placeRating.create({
              data: {
                familyProfileId: updated.familyProfileId,
                tripId: updated.tripId ?? null,
                savedItemId: updated.id,
                placeName: updated.rawTitle ?? "Unknown",
                placeType: (updated.categoryTags && updated.categoryTags[0]) ? updated.categoryTags[0] : "other",
                destinationCity: updated.destinationCity ?? null,
                lat: updated.lat ?? null,
                lng: updated.lng ?? null,
                ...ratingData,
              },
            });
          }
        }
      } catch (e) {
        console.error("[placeRating-write-through] failed for save:", id, e);
      }
    }

    // Community layer write-through — fires when userRating or notes updated.
    // Errors are logged but do not fail the PATCH response.
    const triggersCommunity = updateData.userRating !== undefined || updateData.notes !== undefined;
    if (triggersCommunity) {
      try {
        const city = updated.destinationCity;
        if (!city) {
          // No destinationCity — not eligible for community layer
        } else if (updated.userRating == null && !updated.notes) {
          // Nothing to contribute yet — wait for an actual rating or note
        } else {
          const rawName = updated.rawTitle ?? "";
          const cleanedName = normalizePlaceName(rawName);

          await db.$transaction(async (tx) => {
            // Find or create CommunitySpot by normalized name+city (insensitive)
            let spot = await tx.communitySpot.findFirst({
              where: {
                name: { equals: cleanedName, mode: "insensitive" },
                city: { equals: city, mode: "insensitive" },
              },
              select: { id: true },
            });

            if (!spot) {
              // TODO: enrich lat/lng via Google Places in a future background job for spots with null coords
              spot = await tx.communitySpot.create({
                data: {
                  name: cleanedName,
                  city,
                  country: updated.destinationCountry ?? null,
                  lat: updated.lat ?? null,
                  lng: updated.lng ?? null,
                  photoUrl: updated.placePhotoUrl ?? updated.mediaThumbnailUrl ?? null,
                  websiteUrl: updated.websiteUrl ?? null,
                  description: updated.notes ?? null,
                  category: updated.categoryTags[0] ?? null,
                  authorProfileId: updated.familyProfileId,
                },
                select: { id: true },
              });
            }

            // Upsert this family's SpotContribution
            await tx.spotContribution.upsert({
              where: {
                communitySpotId_familyProfileId: {
                  communitySpotId: spot.id,
                  familyProfileId: updated.familyProfileId,
                },
              },
              create: {
                communitySpotId: spot.id,
                familyProfileId: updated.familyProfileId,
                rating: updated.userRating ?? null,
                note: updated.notes ?? null,
              },
              update: {
                rating: updated.userRating ?? null,
                note: updated.notes ?? null,
              },
            });

            // Recompute aggregates from all contributions for this spot
            const contributions = await tx.spotContribution.findMany({
              where: { communitySpotId: spot.id },
              select: { rating: true },
            });
            const ratedContribs = contributions.filter(c => c.rating != null);
            const ratingCount = ratedContribs.length;
            const contributionCount = contributions.length;
            const averageRating = ratingCount > 0
              ? ratedContribs.reduce((sum, c) => sum + c.rating!, 0) / ratingCount
              : null;

            await tx.communitySpot.update({
              where: { id: spot.id },
              data: { averageRating, ratingCount, contributionCount },
            });
          }, { timeout: 10000 });
        }
      } catch (e) {
        console.error("[community-write-through] failed for save:", id, e);
      }
    }

    return NextResponse.json({ savedItem: updated });
  } catch (e) {
    const err = e as Error;
    console.error("[PATCH /api/saves] Prisma error:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.savedItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
