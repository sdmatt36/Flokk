"use client";

export type SpotRailItem = {
  id: string;
  name: string;
  city: string;
  country: string | null;
  category: string | null;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
};

function SpotCard({ spot }: { spot: SpotRailItem }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[#E8DDC8] bg-[#FBF6EC]">
      <div className="h-36 w-full overflow-hidden bg-[#E8DDC8]">
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.photoUrl}
            alt={spot.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#1B3A5C]/30 text-xs italic">{spot.city}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-[#1B3A5C] line-clamp-1">{spot.name}</p>
        <p className="text-xs text-[#1B3A5C]/60 mt-0.5">
          {spot.city}{spot.category ? ` · ${spot.category}` : ""}
        </p>
        {spot.averageRating !== null && spot.ratingCount > 0 && (
          <p className="text-xs text-[#1B3A5C]/50 mt-0.5">
            {spot.averageRating.toFixed(1)} · {spot.ratingCount} rating{spot.ratingCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export function SpotsRail({ spots }: { spots: SpotRailItem[] }) {
  if (spots.length === 0) {
    return (
      <p className="text-sm italic text-[#1B3A5C]/60">No spots yet — save a place to get started.</p>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {spots.map((spot) => (
        <div key={spot.id} className="snap-start shrink-0 w-48 md:w-56">
          <SpotCard spot={spot} />
        </div>
      ))}
    </div>
  );
}
