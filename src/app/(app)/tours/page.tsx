import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { FilteredToursSection } from "@/app/(app)/discover/_components/FilteredToursSection";
import type { TourCardItem } from "@/components/shared/cards/TourCard";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tours · Flokk",
  description: "Stop-by-stop tours built by Flokkers and Flokk's AI.",
};

async function fetchTours(): Promise<TourCardItem[]> {
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

export default async function ToursPage() {
  const tours = await fetchTours();
  return (
    <main>
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          Tours
        </p>
        <p className="text-sm md:text-base italic" style={{ color: "rgba(250, 247, 242, 0.8)" }}>
          Stop-by-stop tours built by Flokkers and Flokk&apos;s AI.
        </p>
      </div>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <FilteredToursSection tours={tours} />
      </section>
    </main>
  );
}
