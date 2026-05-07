"use client";

import Link from "next/link";

export type TourRailItem = {
  id: string;
  title: string;
  destinationCity: string;
  shareToken: string | null;
  _count: { stops: number };
  stops: { imageUrl: string | null }[];
};

function TourCard({ tour }: { tour: TourRailItem }) {
  const imageUrl = tour.stops[0]?.imageUrl ?? null;
  const href = tour.shareToken ? `/s/${tour.shareToken}` : "#";

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden border border-[#E8DDC8] bg-[#FBF6EC] hover:shadow-md transition-shadow duration-200"
    >
      <div className="h-36 w-full overflow-hidden bg-[#E8DDC8]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={tour.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#1B3A5C]/30 text-xs italic">{tour.destinationCity}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-[#1B3A5C] line-clamp-2 leading-snug">
          {tour.title}
        </p>
        <p className="text-xs text-[#1B3A5C]/60 mt-1">
          {tour._count.stops} stops · {tour.destinationCity}
        </p>
      </div>
    </Link>
  );
}

export function ToursRail({ tours }: { tours: TourRailItem[] }) {
  if (tours.length === 0) {
    return (
      <p className="text-sm italic text-[#1B3A5C]/60">No tours published yet.</p>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {tours.map((tour) => (
        <div key={tour.id} className="snap-start shrink-0 w-56 md:w-64">
          <TourCard tour={tour} />
        </div>
      ))}
    </div>
  );
}
