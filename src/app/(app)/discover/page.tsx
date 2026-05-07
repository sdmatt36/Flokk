import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { ContinentGrid } from "./_components/ContinentGrid";
import { ItinerariesRail } from "./_components/ItinerariesRail";
import { ToursRail } from "./_components/ToursRail";
import { SpotRail } from "./_components/SpotsRail";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import type { TourRailItem } from "./_components/ToursRail";
import type { SpotRailItem } from "./_components/SpotsRail";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Discover · Flokk",
  description: "Steal a trip. Find a tour. Flokk it.",
};

// Transport/system categories excluded from discovery rails
const EXCLUDED_CATEGORIES = ["train", "flight", "airline", "transport", "transit", "lodging"];

export default async function DiscoverPage() {
  let recentTrips: CommunityTripCardTrip[] = [];
  let recentTours: TourRailItem[] = [];
  let activities: SpotRailItem[] = [];
  let food: SpotRailItem[] = [];

  try {
    [recentTrips, recentTours, activities, food] = await Promise.all([
      fetchRecentTrips(),
      fetchRecentTours(),
      fetchRecentActivities(),
      fetchRecentFood(),
    ]);
  } catch {
    // non-fatal — rails render empty states
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

      {/* Continent grid */}
      <ContinentGrid playfairClassName={playfair.className} />

      {/* Itineraries rail */}
      <section className="max-w-7xl mx-auto px-6 py-10 md:py-12">
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-2`}>
          Itineraries
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mb-6">
          Real trips from real Flokkers.
        </p>
        <ItinerariesRail trips={recentTrips} />
      </section>

      {/* Tours rail */}
      <section className="max-w-7xl mx-auto px-6 py-10 md:py-12 border-t border-[#E8DDC8]">
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-2`}>
          Tours
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mb-6">
          Tours built by Flokkers and Flokk&apos;s AI.
        </p>
        <ToursRail tours={recentTours} />
      </section>

      {/* Activities rail */}
      <section className="max-w-7xl mx-auto px-6 py-10 md:py-12 border-t border-[#E8DDC8]">
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-2`}>
          Activities
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mb-6">
          Things flokkers do, rated by families.
        </p>
        <SpotRail spots={activities} />
      </section>

      {/* Food rail */}
      <section className="max-w-7xl mx-auto px-6 py-10 md:py-12 border-t border-[#E8DDC8]">
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-2`}>
          Food
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mb-6">
          Where flokkers eat, drink, and bring the kids.
        </p>
        <SpotRail spots={food} />
      </section>
    </main>
  );
}

async function fetchRecentTrips(): Promise<CommunityTripCardTrip[]> {
  const rows = await db.trip.findMany({
    where: { isPublic: true, shareToken: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 40,
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
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.destinationCity ?? r.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12) as CommunityTripCardTrip[];
}

async function fetchRecentTours(): Promise<TourRailItem[]> {
  const rows = await db.generatedTour.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 40,
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
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.destinationCity)) return false;
    seen.add(r.destinationCity);
    return true;
  }).slice(0, 12);
}

async function fetchRecentActivities(): Promise<SpotRailItem[]> {
  return db.communitySpot.findMany({
    where: {
      OR: [
        { category: null },
        { category: { notIn: ["food_and_drink", ...EXCLUDED_CATEGORIES] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
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

async function fetchRecentFood(): Promise<SpotRailItem[]> {
  return db.communitySpot.findMany({
    where: { category: "food_and_drink" },
    orderBy: { createdAt: "desc" },
    take: 12,
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
