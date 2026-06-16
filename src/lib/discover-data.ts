import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";
import { getTripCoverImage } from "@/lib/destination-images";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import type { TourCardItem } from "@/components/shared/cards/TourCard";
import type { PickSpot } from "@/app/(app)/discover/_components/PicksGrid";

export const TRANSPORT_CATEGORIES = ["train", "flight", "airline", "transport", "transit"];

const JUNK_NAME_PREFIXES = [
  "Flight from ",
  "Flight to ",
  "Flight ",
  "Transfer ",
  "Drive to ",
  "Ferry to ",
  "Train to ",
];
const JUNK_NAME_CONTAINS = ["airport transfer"];
const JUNK_DAY_RE = /^Day \d+ *:/i;

function isJunkPick(name: string): boolean {
  const n = name.trim();
  if (JUNK_DAY_RE.test(n)) return true;
  const lower = n.toLowerCase();
  if (JUNK_NAME_CONTAINS.some((p) => lower.includes(p))) return true;
  return JUNK_NAME_PREFIXES.some((p) => n.startsWith(p));
}

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
  return "experiences";
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

  return result
    .filter((s) => !isJunkPick(s.name))
    .map((s) => ({ ...s, category: normalizeCategorySlug(s.category) }));
}

// ── Continent drill-down ───────────────────────────────────────────────────────

export type ContinentCountry = {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  blurb: string | null;
  coverImageUrl: string;
  _count: { cities: number };
  spotCount: number;
  topCities: Array<{ name: string; photoUrl: string | null }>;
};

export type ContinentPageData = {
  continent: {
    id: string;
    name: string;
    blurb: string | null;
    photoUrl: string | null;
    allCountries: Array<{ slug: string; name: string }>;
  };
  countries: ContinentCountry[];
};

export async function fetchContinentData(slug: string): Promise<ContinentPageData | null> {
  const row = await db.continent.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      blurb: true,
      photoUrl: true,
      countries: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          blurb: true,
          photoUrl: true,
          cities: {
            where: { featured: true, type: "CITY" },
            select: {
              name: true,
              photoUrl: true,
              heroPhotoUrl: true,
              _count: { select: { communitySpots: true } },
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  const countries: ContinentCountry[] = row.countries.map((c) => {
    const cityCount = c.cities.length;
    const spotCount = c.cities.reduce((sum, city) => sum + city._count.communitySpots, 0);
    const topCities = (() => {
      const sorted = [...c.cities]
        .sort((a, b) => {
          const aPhoto = (a.heroPhotoUrl ?? a.photoUrl) != null ? 1 : 0;
          const bPhoto = (b.heroPhotoUrl ?? b.photoUrl) != null ? 1 : 0;
          if (bPhoto !== aPhoto) return bPhoto - aPhoto;
          if (b._count.communitySpots !== a._count.communitySpots)
            return b._count.communitySpots - a._count.communitySpots;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 3)
        .map((city) => ({
          name: city.name,
          photoUrl: city.heroPhotoUrl ?? city.photoUrl ?? null,
        }));
      // country.photoUrl takes priority over topCity photo as hero image — mirrors CountryCard
      if (c.photoUrl != null && sorted.length > 0) {
        return [{ ...sorted[0], photoUrl: c.photoUrl }, ...sorted.slice(1)];
      }
      return sorted;
    })();

    // Cover image: same chain as CountryCard.tsx
    const cityPhoto = topCities[0]?.photoUrl ?? c.photoUrl ?? null;
    const coverImageUrl = cityPhoto ?? getTripCoverImage(null, c.name, null);

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      photoUrl: c.photoUrl ?? null,
      blurb: c.blurb ?? null,
      coverImageUrl,
      _count: { cities: cityCount },
      spotCount,
      topCities,
    };
  }).filter(
    (c) => c._count.cities > 0 || (c.blurb && c.blurb.length >= 20 && c.photoUrl),
  );

  return {
    continent: {
      id: row.id,
      name: row.name,
      blurb: row.blurb ?? null,
      photoUrl: row.photoUrl ?? null,
      allCountries: [...row.countries].sort((a, b) => a.name.localeCompare(b.name)),
    },
    countries,
  };
}
