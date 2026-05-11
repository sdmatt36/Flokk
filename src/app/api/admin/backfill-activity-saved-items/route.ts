import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Backfills paired SavedItems for all existing ManualActivities that lack one.
 * For each ManualActivity without savedItemId:
 *   1. Finds the Trip.familyProfileId
 *   2. Creates a SavedItem with categoryTags seeded from ManualActivity.type
 *   3. Updates ManualActivity.savedItemId to point to the new SavedItem
 * Safe to run multiple times — skips activities that already have savedItemId.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activities = await db.manualActivity.findMany({
    where: { savedItemId: null, deletedAt: null },
    select: {
      id: true,
      tripId: true,
      title: true,
      dayIndex: true,
      lat: true,
      lng: true,
      notes: true,
      website: true,
      imageUrl: true,
      city: true,
      type: true,
      trip: {
        select: {
          familyProfileId: true,
          destinationCity: true,
          destinationCountry: true,
        },
      },
    },
  });

  let scanned = 0;
  let created = 0;
  let skipped = 0;

  for (const a of activities) {
    scanned++;
    if (!a.trip?.familyProfileId) { skipped++; continue; }

    const resolvedType = a.type ? (normalizeCategorySlug(a.type) ?? a.type) : null;
    const categoryTags = resolvedType ? [resolvedType] : [];
    const cityForSaved = a.city ?? a.trip.destinationCity ?? null;

    try {
      const savedItem = await db.savedItem.create({
        data: {
          familyProfileId: a.trip.familyProfileId,
          tripId: a.tripId,
          rawTitle: a.title,
          dayIndex: a.dayIndex,
          lat: a.lat,
          lng: a.lng,
          notes: a.notes ?? null,
          websiteUrl: a.website ?? null,
          placePhotoUrl: a.imageUrl ?? null,
          destinationCity: cityForSaved,
          destinationCountry: a.trip.destinationCountry ?? null,
          categoryTags,
          status: "TRIP_ASSIGNED",
          sourceMethod: "manual_activity",
        },
        select: { id: true },
      });

      await db.manualActivity.update({
        where: { id: a.id },
        data: { savedItemId: savedItem.id },
      });

      created++;
    } catch (e) {
      console.error(`[backfill-activity-saved-items] failed for activity ${a.id}:`, e);
      skipped++;
    }
  }

  return NextResponse.json({ scanned, created, skipped });
}
