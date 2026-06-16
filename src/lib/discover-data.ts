import { db } from "@/lib/db";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import type { TourCardItem } from "@/components/shared/cards/TourCard";
import type { PickSpot } from "@/app/(app)/discover/_components/PicksGrid";

export const TRANSPORT_CATEGORIES = ["train", "flight", "airline", "transport", "transit"];

interface PlaceRatingRow {
  city_key: string;
  name_key: string;
  avg_rating: number;
  rating_count: number | bigint;
}

export async function fetchTrips(): Promise<CommunityTripCardTrip[]> {
  const rows = await db.trip.findMany({
    where: { isPublic: true, shareToken: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      shareToken: true,
      heroImageUrl: true,
      isAnonymous: true,
      startDate: true,
      endDate: true,
      familyProfile: { select: { familyName: true } },
    },
  });
  return rows as CommunityTripCardTrip[];
}

export async function fetchTours(): Promise<TourCardItem[]> {
  const rows = await db.generatedTour.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      shareToken: true,
      transport: true,
      _count: { select: { stops: { where: { deletedAt: null } } } },
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { imageUrl: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    destinationCity: r.destinationCity,
    destinationCountry: r.destinationCountry,
    shareToken: r.shareToken,
    transport: r.transport,
    stopCount: r._count.stops,
    firstStopImageUrl: r.stops[0]?.imageUrl ?? null,
  }));
}

function inferCategoryFromTypes(placeTypes: string[]): string | null {
  const types = placeTypes.map((t) => t.toLowerCase());
  if (
    types.some((t) =>
      [
        "restaurant",
        "food",
        "bakery",
        "bar",
        "cafe",
        "meal_takeaway",
        "meal_delivery",
        "fast_food_restaurant",
      ].includes(t)
    )
  )
    return "food_and_drink";
  if (
    types.some((t) =>
      ["lodging", "hotel", "motel", "resort_hotel", "bed_and_breakfast"].includes(t)
    )
  )
    return "lodging";
  return "activities";
}

export async function fetchPicks(): Promise<PickSpot[]> {
  const [spots, tourStops, placeRatingRows] = await Promise.all([
    db.communitySpot.findMany({
      where: {
        isPublic: true,
        OR: [
          { category: null },
          { category: { notIn: TRANSPORT_CATEGORIES } },
        ],
      },
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 1500,
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        category: true,
        photoUrl: true,
        averageRating: true,
        ratingCount: true,
        websiteUrl: true,
        lat: true,
        lng: true,
        googlePlaceId: true,
        description: true,
        shareToken: true,
        author: { select: { familyName: true } },
      },
    }),
    db.tourStop.findMany({
      where: {
        deletedAt: null,
        imageUrl: { not: null },
        tour: { isPublic: true, deletedAt: null },
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        imageUrl: true,
        websiteUrl: true,
        why: true,
        placeId: true,
        placeTypes: true,
        tour: {
          select: { destinationCity: true, destinationCountry: true },
        },
      },
      take: 300,
    }),
    db.$queryRaw<PlaceRatingRow[]>`
      SELECT
        LOWER("destinationCity") AS city_key,
        LOWER("placeName") AS name_key,
        AVG("rating")::float AS avg_rating,
        COUNT(DISTINCT "familyProfileId")::int AS rating_count
      FROM "PlaceRating"
      GROUP BY 1, 2
    `,
  ]);

  const prMap = new Map<string, { avgRating: number; count: number }>();
  for (const row of placeRatingRows) {
    const count = Number(row.rating_count);
    if (count > 0) {
      prMap.set(`${row.city_key}|${row.name_key}`, { avgRating: row.avg_rating, count });
    }
  }

  const stopPicks: PickSpot[] = tourStops
    .filter((s) => s.name.trim() && s.tour.destinationCity)
    .map((s) => ({
      id: `stop_${s.id}`,
      name: s.name,
      city: s.tour.destinationCity,
      country: s.tour.destinationCountry ?? null,
      category: inferCategoryFromTypes(s.placeTypes),
      photoUrl: s.imageUrl!,
      averageRating: null,
      ratingCount: 0,
      websiteUrl: s.websiteUrl ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      googlePlaceId: s.placeId ?? null,
      description: s.why ?? null,
    }));

  const mergedSpots: PickSpot[] = spots.map((s) => {
    const key = `${s.city.toLowerCase()}|${s.name.toLowerCase()}`;
    const pr = prMap.get(key);
    const base: PickSpot = {
      ...s,
      description: s.description ?? null,
      contributorName: s.author?.familyName ?? null,
      shareToken: s.shareToken ?? null,
    };
    if (!pr) return base;
    const totalCount = base.ratingCount + pr.count;
    const totalAvg =
      ((base.averageRating ?? 0) * base.ratingCount + pr.avgRating * pr.count) / totalCount;
    return { ...base, averageRating: totalAvg, ratingCount: totalCount };
  });

  const allSpots: PickSpot[] = [...mergedSpots, ...stopPicks];

  const byCountry = new Map<string, PickSpot[]>();
  for (const s of allSpots) {
    const key = s.country ?? "Other";
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key)!.push(s);
  }

  const MAX_PER_COUNTRY = 75;
  const MAX_TOTAL = 1500;
  const result: PickSpot[] = [];
  const buckets = [...byCountry.values()];

  for (let round = 0; round < MAX_PER_COUNTRY && result.length < MAX_TOTAL; round++) {
    for (const bucket of buckets) {
      if (result.length >= MAX_TOTAL) break;
      const spot = bucket[round];
      if (spot) result.push(spot);
    }
  }

  return result;
}
