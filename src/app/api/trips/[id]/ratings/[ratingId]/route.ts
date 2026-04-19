import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { writeThroughCommunitySpot } from "@/lib/community-write-through";
import { ensureSavedItemForRating } from "@/lib/ensure-saved-item-for-rating";
import { normalizePlaceName } from "@/lib/google-places";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; ratingId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, ratingId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const existing = await db.placeRating.findUnique({ where: { id: ratingId } });
  if (!existing || existing.familyProfileId !== profileId || existing.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { rating: number; notes?: string; wouldReturn?: boolean };

  const updated = await db.placeRating.update({
    where: { id: ratingId },
    data: {
      rating: body.rating,
      notes: body.notes ?? null,
      wouldReturn: body.wouldReturn ?? null,
    },
  });

  // Community layer write-through — fires for itinerary/manual kind ratings on edit.
  // Save-kind ratings route through PATCH /api/saves/[id].
  if (existing.itineraryItemId || existing.manualActivityId) {
    try {
      const trip = await db.trip.findUnique({ where: { id: tripId } });
      if (trip) {
        let rawName: string | null = null;
        let city: string | null = null;
        let country: string | null = trip.destinationCountry ?? null;
        let lat: number | null = null;
        let lng: number | null = null;
        let photoUrl: string | null = null;
        let websiteUrl: string | null = null;
        let category: string | null = null;

        if (existing.manualActivityId) {
          const ma = await db.manualActivity.findUnique({
            where: { id: existing.manualActivityId },
            select: { title: true, city: true, type: true, lat: true, lng: true, imageUrl: true, website: true },
          });
          if (ma) {
            rawName = ma.title;
            city = ma.city ?? trip.destinationCity ?? null;
            lat = ma.lat ?? null;
            lng = ma.lng ?? null;
            photoUrl = ma.imageUrl ?? null;
            websiteUrl = ma.website ?? null;
            category = ma.type ?? null;
          }
        } else if (existing.itineraryItemId) {
          const ii = await db.itineraryItem.findUnique({
            where: { id: existing.itineraryItemId },
            select: { title: true, type: true, latitude: true, longitude: true },
          });
          if (ii) {
            if (ii.type === "FLIGHT" || ii.type === "TRAIN") {
              // fall through — transit types are not community spots
            } else {
              rawName = ii.title;
              city = trip.destinationCity ?? null;
              lat = ii.latitude ?? null;
              lng = ii.longitude ?? null;
              category = ii.type ?? null;
            }
          }
        }

        if (rawName && city) {
          const cleanedName = normalizePlaceName(rawName);
          try {
            await db.$transaction(async (tx) => {
              const spotId = await writeThroughCommunitySpot(tx, {
                name: rawName,
                city: city!,
                country,
                lat,
                lng,
                photoUrl,
                websiteUrl,
                category,
                googlePlaceId: null,
                authorProfileId: profileId,
                familyProfileId: profileId,
                rating: updated.rating,
                note: updated.notes ?? null,
              });

              if (spotId) {
                await ensureSavedItemForRating(tx, {
                  familyProfileId: profileId,
                  communitySpotId: spotId,
                  placeName: cleanedName,
                  city: city!,
                  country,
                  lat,
                  lng,
                  photoUrl,
                  websiteUrl,
                  category,
                  googlePlaceId: null,
                  rating: updated.rating,
                  note: updated.notes ?? null,
                });
              }
            }, { timeout: 10000 });
          } catch (e) {
            console.error("[community-write-through] trips/ratings/[ratingId] PATCH failed:", e);
          }
        }
      }
    } catch (e) {
      console.error("[community-write-through] trips/ratings/[ratingId] outer failed:", e);
    }
  }

  return NextResponse.json({ success: true, rating: updated });
}
