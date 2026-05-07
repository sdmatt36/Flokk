"use client";

import { CommunityTripCard } from "@/components/shared/cards/CommunityTripCard";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";

export function FlokkingNowRail({ trips }: { trips: CommunityTripCardTrip[] }) {
  if (trips.length === 0) {
    return (
      <p className="text-sm italic text-[#1B3A5C]/60">Be the first flokk.</p>
    );
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4 snap-x scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
    >
      {trips.map((trip) => (
        <div key={trip.id} className="snap-start shrink-0 w-72 md:w-80">
          <CommunityTripCard trip={trip} />
        </div>
      ))}
    </div>
  );
}
