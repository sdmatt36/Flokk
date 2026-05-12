import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { ContinentGrid } from "./_components/ContinentGrid";
import { FilteredItinerariesSection } from "./_components/FilteredItinerariesSection";
import { FilteredToursSection } from "./_components/FilteredToursSection";
import { FilteredPicksSection } from "./_components/FilteredPicksSection";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import type { TourCardItem } from "@/components/shared/cards/TourCard";
import type { PickSpot } from "./_components/PicksGrid";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover · Flokk",
  description: "Steal a trip. Find a tour. Flokk it.",
};

const TRANSPORT_CATEGORIES = ["train", "flight", "airline", "transport", "transit"];

export default async function DiscoverPage() {
  let trips: CommunityTripCardTrip[] = [];
  let tours: TourCardItem[] = [];
  let picks: PickSpot[] = [];

  try {
    [trips, tours, picks] = await Promise.all([
      fetchTrips(),
      fetchTours(),
      fetchPicks(),
    ]);
  } catch {
    // non-fatal — sections render empty states
  }

  return (
    <main>
      {/* Tagline band */}
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          Where will your flokk land?
        </p>
        <p
          className="text-sm md:text-base italic"
          style={{ color: "rgba(250, 247, 242, 0.8)" }}
        >
          Steal a trip. Find a tour. Flokk it.
        </p>
      </div>

      {/* Page-level intro */}
      <section className="max-w-3xl mx-auto px-6 py-8 md:py-10 text-center">
        <p className="text-base md:text-lg text-[#1B3A5C]/85 leading-relaxed">
          Discover is where Flokkers leave breadcrumbs. Real itineraries, real tours, real places,
          all from families who&apos;ve already been. Pick a continent below to dive in, or scroll
          for inspiration.
        </p>
      </section>

      {/* Continent grid */}
      <ContinentGrid playfairClassName={playfair.className} />

      {/* Bridge */}
      <section className="py-12 md:py-16 text-center px-4">
        <h2 className={`${playfair.className} text-3xl md:text-4xl text-[#1B3A5C] mb-3`}>
          Be Inspired
        </h2>
        <p className="text-base md:text-lg italic text-[#1B3A5C]/70">
          Trips, tours, and picks from real Flokk families.
        </p>
      </section>

      {/* Itineraries */}
      <div className="max-w-7xl mx-auto px-6">
        <FilteredItinerariesSection
          trips={trips}
          description="Real day-by-day plans from real Flokkers. Steal a few days from a family who's been there, or share your own."
          browseAllHref="/itineraries"
        />
      </div>

      {/* Tours */}
      <div className="max-w-7xl mx-auto px-6">
        <FilteredToursSection
          tours={tours}
          description="Stop-by-stop walks, drives, and rides through cities. Built by Flokkers, by Flokk's AI, or both."
          browseAllHref="/tours"
        />
      </div>

      {/* Picks */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <FilteredPicksSection
          spots={picks}
          title="Flokk Picks"
          description="Places, food, lodging, and activities. Everywhere Flokkers have eaten, slept, played, or rated."
        />
      </div>
    </main>
  );
}

async function fetchTrips(): Promise<CommunityTripCardTrip[]> {
  const rows = await db.trip.findMany({
    where: { isPublic: true, shareToken: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 50,
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

async function fetchTours(): Promise<TourCardItem[]> {
  const rows = await db.generatedTour.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
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

interface PlaceRatingRow {
  city_key: string;
  name_key: string;
  avg_rating: number;
  rating_count: number | bigint;
}

async function fetchPicks(): Promise<PickSpot[]> {
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

  // Build a merge map: "city|name" → PlaceRating aggregate
  const prMap = new Map<string, { avgRating: number; count: number }>();
  for (const row of placeRatingRows) {
    const count = Number(row.rating_count);
    if (count > 0) {
      prMap.set(`${row.city_key}|${row.name_key}`, { avgRating: row.avg_rating, count });
    }
  }

  // Map tour stops into PickSpot format
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

  // Merge PlaceRating aggregates into community spots (same logic as city page)
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
    const totalAvg = ((base.averageRating ?? 0) * base.ratingCount + pr.avgRating * pr.count) / totalCount;
    return { ...base, averageRating: totalAvg, ratingCount: totalCount };
  });

  // Combine: rated community spots first, then tour stop picks
  const allSpots: PickSpot[] = [...mergedSpots, ...stopPicks];

  // Geographic distribution: group by country, interleave for variety
  // Rated spots are already sorted by rating within each country group
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

  // Round-robin: take one from each country per round
  for (let round = 0; round < MAX_PER_COUNTRY && result.length < MAX_TOTAL; round++) {
    for (const bucket of buckets) {
      if (result.length >= MAX_TOTAL) break;
      const spot = bucket[round];
      if (spot) result.push(spot);
    }
  }

  return result;
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
