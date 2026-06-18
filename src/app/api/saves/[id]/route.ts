import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { normalizeCategorySlug } from "@/lib/categories";
import { writeThroughCommunitySpot } from "@/lib/community-write-through";

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
    include: {
      trip: { select: { id: true, title: true } },
      communitySpot: { select: { websiteUrl: true } },
      manualActivity: { select: { address: true } },
    },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If SavedItem.userRating is null, hydrate from the most recent PlaceRating.
  // Backfill-created SavedItems start with userRating=null even when PlaceRating exists.
  let effectiveRating = item.userRating;
  let effectiveWouldReturn: boolean | null = null;
  const pr = await db.placeRating.findFirst({
    where: { savedItemId: id },
    orderBy: { createdAt: "desc" },
    select: { rating: true, wouldReturn: true },
  });
  if (pr?.rating != null) effectiveRating = pr.rating;
  if (pr?.wouldReturn != null) effectiveWouldReturn = pr.wouldReturn;

  const { communitySpot, manualActivity, ...itemData } = item;
  return NextResponse.json({
    item: {
      ...itemData,
      address: itemData.address ?? manualActivity?.address ?? null,
      communitySpotWebsiteUrl: communitySpot?.websiteUrl ?? null,
      userRating: effectiveRating,
      wouldReturn: effectiveWouldReturn,
    },
    interestKeys: item.interestKeys ?? [],
  });
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

  const item = await db.savedItem.findUnique({
    where: { id },
    include: { manualActivity: { select: { id: true } } },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  // wouldReturn is not stored on SavedItem; carried through to PlaceRating write-through below.
  const clientWouldReturn: boolean | null = typeof body.wouldReturn === "boolean" ? body.wouldReturn : null;
  const updateData: Record<string, unknown> = {};
  if (typeof body.rawTitle === "string") updateData.rawTitle = body.rawTitle;
  if (typeof body.notes === "string") updateData.notes = body.notes;
  if (typeof body.userRating === "number") updateData.userRating = body.userRating;
  if (Array.isArray(body.categoryTags)) {
    const normalized = normalizeAndDedupeCategoryTags(
      (body.categoryTags as string[]).map(t => normalizeCategorySlug(t) ?? t)
    );
    updateData.categoryTags = { set: normalized };
  }
  if (typeof body.tripId === "string") {
    updateData.tripId = body.tripId;
    updateData.status = "TRIP_ASSIGNED";
  } else if (body.tripId === null) {
    updateData.tripId = null;
    updateData.status = "UNORGANIZED";
    updateData.dayIndex = null;
  }
  if (typeof body.destinationCity === "string" || body.destinationCity === null) updateData.destinationCity = body.destinationCity ?? null;
  if (typeof body.destinationCountry === "string" || body.destinationCountry === null) updateData.destinationCountry = body.destinationCountry ?? null;
  if (typeof body.address === "string" || body.address === null) updateData.address = body.address ?? null;
  if (typeof body.websiteUrl === "string" || body.websiteUrl === null) updateData.websiteUrl = body.websiteUrl ?? null;
  if (typeof body.dayIndex === "number" || body.dayIndex === null) updateData.dayIndex = body.dayIndex;
  if (typeof body.scheduledDate === "string" || body.scheduledDate === null) updateData.scheduledDate = body.scheduledDate ?? null;
  if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
  if (typeof body.startTime === "string" || body.startTime === null) updateData.startTime = body.startTime ?? null;
  if (typeof body.endTime === "string" || body.endTime === null) updateData.endTime = body.endTime ?? null;
  if (typeof body.lodgingType === "string" || body.lodgingType === null) updateData.lodgingType = body.lodgingType ?? null;
  if (typeof body.extractedCheckin === "string" || body.extractedCheckin === null) updateData.extractedCheckin = body.extractedCheckin ?? null;
  if (typeof body.extractedCheckout === "string" || body.extractedCheckout === null) updateData.extractedCheckout = body.extractedCheckout ?? null;
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

    // When unassigning from a trip, remove the paired ManualActivity so the itinerary stays clean.
    if (body.tripId === null && item.manualActivity?.id) {
      try {
        await db.manualActivity.delete({ where: { id: item.manualActivity.id } });
      } catch (e) {
        console.error("[unassign-manual-activity] failed for save:", id, e);
      }
    }

    // ManualActivity address sync — keep ManualActivity.address in lockstep with SavedItem.address
    // so the day-items endpoint (which reads ManualActivity.address for manualActivity rows) stays current.
    if ("address" in updateData) {
      try {
        await db.manualActivity.updateMany({
          where: { savedItemId: id },
          data: { address: updated.address ?? null },
        });
      } catch (e) {
        console.error("[address-sync-manual-activity] failed for save:", id, e);
      }
    }

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
            wouldReturn: clientWouldReturn,
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
    const triggersCommunity = updateData.userRating !== undefined || updateData.notes !== undefined || updateData.categoryTags !== undefined;
    if (triggersCommunity) {
      try {
        await db.$transaction(async (tx) => {
          await writeThroughCommunitySpot(tx, {
            name: updated.rawTitle ?? "",
            city: updated.destinationCity ?? "",
            country: updated.destinationCountry ?? null,
            lat: updated.lat ?? null,
            lng: updated.lng ?? null,
            photoUrl: updated.placePhotoUrl ?? updated.mediaThumbnailUrl ?? null,
            websiteUrl: updated.websiteUrl ?? null,
            description: updated.notes ?? null,
            category: updated.categoryTags[0] ?? null,
            googlePlaceId: null,
            authorProfileId: updated.familyProfileId,
            familyProfileId: updated.familyProfileId,
            rating: updated.userRating ?? null,
            note: updated.notes ?? null,
          });
        }, { timeout: 10000 });
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
    select: { familyProfileId: true, manualActivity: { select: { id: true } } },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.savedItem.update({ where: { id }, data: { deletedAt: new Date() } });
    if (item.manualActivity?.id) {
      await tx.manualActivity.update({
        where: { id: item.manualActivity.id },
        data: { deletedAt: new Date() },
      });
    }
  });

  return NextResponse.json({ success: true });
}
