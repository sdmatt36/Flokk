import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { ContinentGrid } from "./_components/ContinentGrid";
import { FlokkingNowRail } from "./_components/FlokkingNowRail";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Discover · Flokk",
  description: "Where will your flokk land? Pick a horizon to start.",
};

export default async function DiscoverPage() {
  let recentTrips: Awaited<ReturnType<typeof fetchRecentTrips>> = [];
  try {
    recentTrips = await fetchRecentTrips();
  } catch {
    // non-fatal — rail renders empty state
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
          Pick a horizon to start.
        </p>
      </div>

      {/* Continent grid */}
      <ContinentGrid playfairClassName={playfair.className} />

      {/* Flokking Now rail */}
      <section className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <h2
          className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-2`}
        >
          Flokking Now
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mb-6">
          Recent flokks finding their next favorite place.
        </p>
        <FlokkingNowRail trips={recentTrips} />
      </section>
    </main>
  );
}

async function fetchRecentTrips() {
  return db.trip.findMany({
    where: {
      isPublic: true,
      shareToken: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
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
}
