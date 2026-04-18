import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { sendRatingsCompleteEvent } from "@/lib/loops";

export const dynamic = "force-dynamic";

// Inline copy — canonical source: scripts/lib/clean-venue-name.ts
function cleanVenueName(raw: string): string {
  if (!raw) return raw;
  let name = raw;
  name = name.replace(/\s*\|\s*Tabelog.*$/i, "");
  name = name.replace(/\s+-\s+[^|]+\/[^|]+$/i, "");
  name = name.replace(/\s*\([^)]*\/[^)]*\)\s*$/u, "");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = await db.placeRating.findMany({
    where: { tripId },
    select: {
      id: true,
      rating: true,
      notes: true,
      wouldReturn: true,
      kidsRating: true,
      itineraryItemId: true,
      manualActivityId: true,
      savedItemId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ratings });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    itineraryItemId?: string;
    manualActivityId?: string;
    savedItemId?: string;
    placeName: string;
    placeType: string;
    rating: number;
    notes?: string;
    wouldReturn?: boolean;
    kidsRating?: number;
  };

  const rating = await db.placeRating.create({
    data: {
      familyProfileId: profileId,
      tripId,
      itineraryItemId: body.itineraryItemId ?? null,
      manualActivityId: body.manualActivityId ?? null,
      savedItemId: body.savedItemId ?? null,
      placeName: body.placeName,
      placeType: body.placeType,
      destinationCity: trip.destinationCity ?? null,
      rating: body.rating,
      notes: body.notes ?? null,
      wouldReturn: body.wouldReturn ?? null,
      kidsRating: body.kidsRating ?? null,
    },
  });

  // Community layer write-through — fires for itinerary/manual kind ratings.
  // Errors are logged but do not fail the POST response.
  // Save-kind ratings route through PATCH /api/saves/[id] (Option B).
  if (rating.itineraryItemId || rating.manualActivityId) {
    try {
      let rawName: string | null = null;
      let city: string | null = null;
      let country: string | null = trip.destinationCountry ?? null;
      let lat: number | null = null;
      let lng: number | null = null;
      let photoUrl: string | null = null;
      let websiteUrl: string | null = null;
      let category: string | null = null;

      if (rating.manualActivityId) {
        const ma = await db.manualActivity.findUnique({
          where: { id: rating.manualActivityId },
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
      } else if (rating.itineraryItemId) {
        const ii = await db.itineraryItem.findUnique({
          where: { id: rating.itineraryItemId },
          select: { title: true, type: true, latitude: true, longitude: true },
        });
        if (ii) {
          // Skip transit types — flights and trains are not community spots
          if (ii.type === "FLIGHT" || ii.type === "TRAIN") {
            // fall through to Loops check below without write-through
          } else {
            rawName = ii.title;
            city = trip.destinationCity ?? null;
            lat = ii.latitude ?? null;
            lng = ii.longitude ?? null;
            category = ii.type ?? null;
            // ItineraryItem has no imageUrl or websiteUrl — nulls are fine
          }
        }
      }

      if (rawName && city) {
        const cleanedName = cleanVenueName(rawName);

        await db.$transaction(async (tx) => {
          // Find or create CommunitySpot by normalized name+city (insensitive)
          let spot = await tx.communitySpot.findFirst({
            where: {
              name: { equals: cleanedName, mode: "insensitive" },
              city: { equals: city!, mode: "insensitive" },
            },
            select: { id: true },
          });

          if (!spot) {
            // TODO: enrich lat/lng via Google Places in a future background job for spots with null coords
            spot = await tx.communitySpot.create({
              data: {
                name: cleanedName,
                city: city!,
                country,
                lat,
                lng,
                photoUrl,
                websiteUrl,
                category,
                authorProfileId: profileId,
              },
              select: { id: true },
            });
          }

          // Upsert this family's SpotContribution
          await tx.spotContribution.upsert({
            where: {
              communitySpotId_familyProfileId: {
                communitySpotId: spot.id,
                familyProfileId: profileId,
              },
            },
            create: {
              communitySpotId: spot.id,
              familyProfileId: profileId,
              rating: rating.rating,
              note: rating.notes ?? null,
            },
            update: {
              rating: rating.rating,
              note: rating.notes ?? null,
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
      console.error("[community-write-through] trips/ratings failed:", e);
    }
  }

  try {
    const totalActivities = await db.manualActivity.count({ where: { tripId } });
    const ratedActivities = await db.placeRating.count({ where: { tripId, manualActivityId: { not: null } } });
    if (totalActivities > 0 && ratedActivities >= totalActivities) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
      await sendRatingsCompleteEvent(email, {
        tripDestination: trip.destinationCity ?? trip.title ?? "your destination",
      });
    }
  } catch (e) { console.error("[loops] ratings_complete check error", e); }

  return NextResponse.json({ success: true, rating });
}
