import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";
import { getTripCoverImage } from "@/lib/destination-images";
import { getCityImageUrl } from "@/lib/city-image";
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

// ── Country drill-down ─────────────────────────────────────────────────────────

export type CountryCity = {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  spotCount: number;
};

export type CountryPageData = {
  country: {
    id: string;
    slug: string;
    name: string;
    blurb: string | null;
    photoUrl: string | null;
    photoCredit: string | null;
    continentId: string;
    continent: { slug: string; name: string };
  };
  cities: CountryCity[];
};

// ── City drill-down ────────────────────────────────────────────────────────────

export type CityPickItem = {
  id: string;
  name: string;
  category: string | null;
  cuisine: string | null | undefined;
  lodgingType: string | null | undefined;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
  websiteUrl: string | null | undefined;
  address: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  googlePlaceId: string | null | undefined;
  contributorName?: string | null;
};

export type CityItineraryItem = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  shareToken: string | null;
  heroImageUrl?: string | null;
  isAnonymous: boolean;
  startDate: Date | null;
  endDate: Date | null;
  familyProfile: { familyName: string | null } | null;
};

export type CityTourItem = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  shareToken: string | null;
  transport: string | null;
  stopCount: number;
  firstStopImageUrl: string | null;
};

export type CityRelatedCity = {
  slug: string;
  name: string;
  country: string;
  coverImageUrl: string | null;
};

export type SpotBuckets = {
  foodAndDrink: { items: CityPickItem[]; total: number };
  activities: { items: CityPickItem[]; total: number; categories: { category: string; count: number }[] };
  lodging: { items: CityPickItem[]; total: number };
};

export type CityPageData = {
  city: {
    id: string;
    slug: string;
    name: string;
    blurb: string | null;
    photoUrl: string | null;
    heroPhotoUrl: string | null;
    heroPhotoAttribution: string | null;
    latitude: number | null;
    longitude: number | null;
    countryId: string;
    country: {
      id: string;
      name: string;
      slug: string;
      continentId: string;
      continent: { id: string; name: string; slug: string };
    };
  };
  spotCount: number;
  itineraryCount: number;
  tourCount: number;
  ratingCount: number;
  siblingCities: Array<{ slug: string; name: string }>;
  itineraries: CityItineraryItem[];
  tours: CityTourItem[];
  foodAndDrink: { items: CityPickItem[]; total: number };
  activities: { items: CityPickItem[]; total: number; categories: { category: string; count: number }[] };
  lodging: { items: CityPickItem[]; total: number };
  relatedCities: CityRelatedCity[];
};

const BUCKET_FOOD = new Set(["food_and_drink", "Food", "food"]);
const BUCKET_LODGING = new Set(["lodging", "Lodging"]);

export function buildSpotBuckets(spots: CityPickItem[]): SpotBuckets {
  const food = spots.filter((s) => BUCKET_FOOD.has(s.category ?? ""));
  const lodging = spots.filter((s) => BUCKET_LODGING.has(s.category ?? ""));
  const activities = spots.filter(
    (s) => !BUCKET_FOOD.has(s.category ?? "") && !BUCKET_LODGING.has(s.category ?? "")
  );
  const catCounts = new Map<string, number>();
  for (const s of activities) {
    if (s.category) catCounts.set(s.category, (catCounts.get(s.category) ?? 0) + 1);
  }
  const categories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));
  return {
    foodAndDrink: { items: food, total: food.length },
    activities: { items: activities, total: activities.length, categories },
    lodging: { items: lodging, total: lodging.length },
  };
}

function slugForDedup(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchCityData(slug: string): Promise<CityPageData | null> {
  try {
    const city = await db.city.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        blurb: true,
        photoUrl: true,
        heroPhotoUrl: true,
        heroPhotoAttribution: true,
        latitude: true,
        longitude: true,
        countryId: true,
        country: {
          select: {
            id: true,
            name: true,
            slug: true,
            continentId: true,
            continent: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!city) return null;

    interface RatingRow {
      name: string;
      category: string;
      averageRating: number;
      ratingCount: bigint | number;
    }

    const [
      spots, itineraries, tours, ratingRows,
      spotCount, itineraryCount, tourCount, ratingCount,
      siblingCities, sameCountryCities,
    ] = await Promise.all([
      db.communitySpot.findMany({
        where: { cityId: city.id },
        select: {
          id: true, name: true, category: true, cuisine: true, lodgingType: true,
          photoUrl: true, averageRating: true, ratingCount: true, description: true,
          websiteUrl: true, address: true, lat: true, lng: true, googlePlaceId: true,
          author: { select: { familyName: true } },
        },
        orderBy: [{ ratingCount: "desc" }, { averageRating: "desc" }],
        take: 50,
      }),
      db.trip.findMany({
        where: {
          isPublic: true,
          shareToken: { not: null },
          destinationCity: { contains: city.name, mode: "insensitive" },
        },
        select: {
          id: true, title: true, destinationCity: true, destinationCountry: true,
          heroImageUrl: true, shareToken: true, startDate: true, endDate: true, isAnonymous: true,
          familyProfile: { select: { familyName: true } },
        },
        orderBy: { viewCount: "desc" },
        take: 12,
      }),
      db.generatedTour.findMany({
        where: {
          isPublic: true,
          deletedAt: null,
          shareToken: { not: null },
          destinationCity: { contains: city.name, mode: "insensitive" },
        },
        select: {
          id: true, title: true, destinationCity: true, destinationCountry: true,
          shareToken: true, transport: true,
          stops: {
            where: { deletedAt: null },
            orderBy: { orderIndex: "asc" },
            take: 1,
            select: { imageUrl: true },
          },
          _count: { select: { stops: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.$queryRaw<RatingRow[]>`
        SELECT
          "placeName" AS name,
          "placeType" AS category,
          AVG("rating")::float AS "averageRating",
          COUNT(DISTINCT "familyProfileId")::int AS "ratingCount"
        FROM "PlaceRating"
        WHERE LOWER("destinationCity") = LOWER(${city.name})
        GROUP BY "placeName", "placeType"
      `,
      db.communitySpot.count({ where: { cityId: city.id } }),
      db.trip.count({
        where: { isPublic: true, shareToken: { not: null }, destinationCity: { contains: city.name, mode: "insensitive" } },
      }),
      db.generatedTour.count({
        where: { isPublic: true, deletedAt: null, shareToken: { not: null }, destinationCity: { contains: city.name, mode: "insensitive" } },
      }),
      db.spotContribution.count({ where: { spot: { cityId: city.id }, rating: { not: null } } }),
      db.city.findMany({
        where: { countryId: city.countryId, id: { not: city.id }, featured: true },
        orderBy: { priorityRank: "asc" },
        take: 12,
        select: { slug: true, name: true },
      }),
      db.city.findMany({
        where: { countryId: city.countryId, id: { not: city.id }, featured: true },
        orderBy: { priorityRank: "asc" },
        take: 4,
        select: { slug: true, name: true, photoUrl: true, heroPhotoUrl: true, country: { select: { name: true } } },
      }),
    ]);

    // Fill related cities to 6 from same continent, different country
    const needed = 6 - sameCountryCities.length;
    const continentFill = needed > 0
      ? await db.city.findMany({
          where: {
            featured: true,
            id: { not: city.id },
            country: { continentId: city.country.continentId, id: { not: city.countryId } },
          },
          orderBy: { priorityRank: "asc" },
          take: needed,
          select: { slug: true, name: true, photoUrl: true, heroPhotoUrl: true, country: { select: { name: true } } },
        })
      : [];

    const relatedCities: CityRelatedCity[] = [...sameCountryCities, ...continentFill].map((c) => ({
      slug: c.slug,
      name: c.name,
      country: c.country.name,
      coverImageUrl: getCityImageUrl(c.heroPhotoUrl, c.photoUrl),
    }));

    // Dedup spots by name + merge PlaceRating aggregates (mirrors loadCity)
    const spotMap = new Map<string, CityPickItem>();
    for (const s of spots) {
      const nameKey = slugForDedup(s.name);
      if (!spotMap.has(nameKey)) {
        const normCat = normalizeCategorySlug(s.category) ?? s.category;
        spotMap.set(nameKey, { ...s, category: normCat, contributorName: s.author?.familyName ?? null });
      }
    }

    const prOnlyMap = new Map<string, CityPickItem>();
    for (const row of ratingRows) {
      const nameKey = slugForDedup(row.name);
      const count = Number(row.ratingCount);
      const normCat = normalizeCategorySlug(row.category) ?? "other";
      const csEntry = spotMap.get(nameKey);

      if (csEntry) {
        const newCount = csEntry.ratingCount + count;
        const newAvg =
          ((csEntry.averageRating ?? 0) * csEntry.ratingCount + row.averageRating * count) / newCount;
        const promotedCategory =
          csEntry.category === "other" && normCat && normCat !== "other" ? normCat : csEntry.category;
        spotMap.set(nameKey, { ...csEntry, category: promotedCategory, averageRating: newAvg, ratingCount: newCount });
      } else {
        const prEntry = prOnlyMap.get(nameKey);
        if (prEntry) {
          const newCount = prEntry.ratingCount + count;
          const newAvg =
            ((prEntry.averageRating ?? 0) * prEntry.ratingCount + row.averageRating * count) / newCount;
          prOnlyMap.set(nameKey, { ...prEntry, averageRating: newAvg, ratingCount: newCount });
        } else {
          prOnlyMap.set(nameKey, {
            id: `pr_${nameKey}`,
            name: row.name,
            category: normCat,
            cuisine: null,
            lodgingType: null,
            photoUrl: null,
            averageRating: row.averageRating,
            ratingCount: count,
            description: null,
            websiteUrl: null,
            address: null,
            lat: null,
            lng: null,
            googlePlaceId: null,
          });
        }
      }
    }

    const allSpots: CityPickItem[] = [...spotMap.values(), ...prOnlyMap.values()];
    const buckets = buildSpotBuckets(allSpots);

    return {
      city: {
        id: city.id,
        slug: city.slug,
        name: city.name,
        blurb: city.blurb ?? null,
        photoUrl: city.photoUrl ?? null,
        heroPhotoUrl: city.heroPhotoUrl ?? null,
        heroPhotoAttribution: city.heroPhotoAttribution ?? null,
        latitude: city.latitude ?? null,
        longitude: city.longitude ?? null,
        countryId: city.countryId,
        country: {
          id: city.country.id,
          name: city.country.name,
          slug: city.country.slug,
          continentId: city.country.continentId,
          continent: {
            id: city.country.continent.id,
            name: city.country.continent.name,
            slug: city.country.continent.slug,
          },
        },
      },
      spotCount,
      itineraryCount,
      tourCount,
      ratingCount,
      siblingCities,
      itineraries: itineraries as unknown as CityItineraryItem[],
      tours: tours.map((t) => ({
        id: t.id,
        title: t.title,
        destinationCity: t.destinationCity,
        destinationCountry: t.destinationCountry,
        shareToken: t.shareToken,
        transport: t.transport,
        stopCount: t._count.stops,
        firstStopImageUrl: t.stops[0]?.imageUrl ?? null,
      })),
      ...buckets,
      relatedCities,
    };
  } catch (err) {
    console.error("[fetchCityData] error", err);
    return null;
  }
}

export async function fetchCountryData(slug: string): Promise<CountryPageData | null> {
  const row = await db.country.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      blurb: true,
      photoUrl: true,
      photoCredit: true,
      continentId: true,
      continent: { select: { name: true, slug: true } },
      cities: {
        where: { featured: true, type: "CITY" },
        select: {
          id: true,
          slug: true,
          name: true,
          photoUrl: true,
          heroPhotoUrl: true,
          _count: { select: { communitySpots: true } },
        },
        orderBy: [{ priorityRank: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!row) return null;

  return {
    country: {
      id: row.id,
      slug,
      name: row.name,
      blurb: row.blurb ?? null,
      photoUrl: row.photoUrl ?? null,
      photoCredit: row.photoCredit ?? null,
      continentId: row.continentId,
      continent: row.continent,
    },
    cities: row.cities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      coverImageUrl: getCityImageUrl(c.heroPhotoUrl, c.photoUrl),
      spotCount: c._count.communitySpots,
    })),
  };
}
