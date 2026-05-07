import Link from "next/link";

export type TourCardItem = {
  id: string;
  title: string;
  destinationCity: string;
  shareToken: string | null;
  _count: { stops: number };
  stops: { imageUrl: string | null }[];
};

export function TourCard({ tour }: { tour: TourCardItem }) {
  const imageUrl = tour.stops[0]?.imageUrl ?? null;
  const href = tour.shareToken ? `/s/${tour.shareToken}` : "#";

  return (
    <Link
      href={href}
      className="group block rounded-2xl overflow-hidden border border-[#E8DDC8] bg-[#FBF6EC] hover:shadow-md transition-shadow duration-200"
      style={{ textDecoration: "none" }}
    >
      <div className="h-40 w-full overflow-hidden bg-[#E8DDC8]">
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
      <div className="p-4">
        <p className="text-sm font-semibold text-[#1B3A5C] leading-snug line-clamp-2 mb-1">
          {tour.title}
        </p>
        <p className="text-xs text-[#1B3A5C]/60">
          {tour._count.stops} stops · {tour.destinationCity}
        </p>
      </div>
    </Link>
  );
}
