import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { ContinentGrid } from "./_components/ContinentGrid";
import { UnderConstructionBanner } from "./_components/UnderConstructionBanner";
import { DiscoverSection } from "./_components/DiscoverSection";
import { TourCard } from "./_components/TourCard";
import { PicksGrid } from "./_components/PicksGrid";
import { CommunityTripCard } from "@/components/shared/cards/CommunityTripCard";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import type { TourCardItem } from "./_components/TourCard";
import type { PickSpot } from "./_components/PicksGrid";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

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
      <UnderConstructionBanner />

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

      {/* Itineraries section */}
      <DiscoverSection
        title="Itineraries"
        description="Real day-by-day plans from real Flokkers. Steal a few days from a family who's been there, or share your own."
        addLabel="+ Itinerary"
        addHref="/trips"
        browseAllLabel="Browse all itineraries"
        browseAllHref="/itineraries"
      >
        {trips.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <CommunityTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <p className="italic text-[#1B3A5C]/60">Be the first Flokker.</p>
        )}
      </DiscoverSection>

      {/* Tours section */}
      <DiscoverSection
        title="Tours"
        description="Stop-by-stop walks, drives, and rides through cities. Built by Flokkers, by Flokk's AI, or both. Save one for your next trip, or build your own."
        addLabel="+ Tour"
        addHref="/tour"
        browseAllLabel="Browse all tours"
        browseAllHref="/tours"
      >
        {tours.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        ) : (
          <p className="italic text-[#1B3A5C]/60">Be the first Flokker.</p>
        )}
      </DiscoverSection>

      {/* Picks section */}
      <DiscoverSection
        title="Picks"
        description="Places, food, lodging, and activities. Everywhere Flokkers have eaten, slept, played, or rated. Save what catches your eye."
        addLabel="+ Pick"
        addHref="/saves"
        browseAllLabel="Browse all picks"
        browseAllHref="/picks"
      >
        {picks.length ? (
          <PicksGrid spots={picks} />
        ) : (
          <p className="italic text-[#1B3A5C]/60">Be the first Flokker.</p>
        )}
      </DiscoverSection>
    </main>
  );
}

async function fetchTrips(): Promise<CommunityTripCardTrip[]> {
  const rows = await db.trip.findMany({
    where: { isPublic: true, shareToken: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 24,
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
  // Dedupe by destinationCity, cap at 9 (3 rows × 3 cols)
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.destinationCity ?? r.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 9) as CommunityTripCardTrip[];
}

async function fetchTours(): Promise<TourCardItem[]> {
  const rows = await db.generatedTour.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      destinationCity: true,
      shareToken: true,
      _count: { select: { stops: { where: { deletedAt: null } } } },
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { imageUrl: true },
      },
    },
  });
  // Dedupe by destinationCity, cap at 9 (3 rows × 3 cols)
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.destinationCity)) return false;
    seen.add(r.destinationCity);
    return true;
  }).slice(0, 9);
}

async function fetchPicks(): Promise<PickSpot[]> {
  return db.communitySpot.findMany({
    where: {
      OR: [
        { category: null },
        { category: { notIn: TRANSPORT_CATEGORIES } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 9,
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
    },
  });
}
