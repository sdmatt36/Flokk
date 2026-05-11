"use client";

import { useState } from "react";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { CommunitySpotDetailPanel } from "@/components/shared/cards/CommunitySpotDetailPanel";

export type PickSpot = {
  id: string;
  name: string;
  city: string;
  country: string | null;
  category: string | null;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  websiteUrl: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  description: string | null;
  contributorName?: string | null;
};

export function PicksGrid({ spots }: { spots: PickSpot[] }) {
  const [openSpot, setOpenSpot] = useState<PickSpot | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  async function handleFlokkIt(spot: PickSpot) {
    await fetch("/api/saves/from-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: spot.name,
        city: spot.city,
        lat: spot.lat ?? undefined,
        lng: spot.lng ?? undefined,
        placePhotoUrl: spot.photoUrl ?? undefined,
        websiteUrl: spot.websiteUrl ?? undefined,
        category: spot.category ?? undefined,
      }),
    });
    setSavedIds((prev) => new Set(prev).add(spot.id));
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spots.map((spot) => (
          <CommunitySpotCard
            key={spot.id}
            spot={{
              id: spot.id,
              title: spot.name,
              city: spot.city,
              photoUrl: spot.photoUrl,
              category: spot.category,
              rating: spot.averageRating !== null ? Math.round(spot.averageRating) : null,
              ratingCount: spot.ratingCount,
              description: spot.description,
              websiteUrl: spot.websiteUrl,
              lat: spot.lat,
              lng: spot.lng,
              contributorName: spot.contributorName,
            }}
            isSaved={savedIds.has(spot.id)}
            onClickCard={() => setOpenSpot(spot)}
            onFlokkIt={() => handleFlokkIt(spot)}
          />
        ))}
      </div>

      {openSpot && (
        <CommunitySpotDetailPanel
          spot={{
            id: openSpot.id,
            title: openSpot.name,
            city: openSpot.city,
            photoUrl: openSpot.photoUrl,
            category: openSpot.category,
            rating: openSpot.averageRating !== null ? Math.round(openSpot.averageRating) : null,
            ratingCount: openSpot.ratingCount,
            description: openSpot.description,
            websiteUrl: openSpot.websiteUrl,
            lat: openSpot.lat,
            lng: openSpot.lng,
            contributorName: openSpot.contributorName ?? null,
          }}
          isSaved={savedIds.has(openSpot.id)}
          saveStatus={null}
          userRating={null}
          onClose={() => setOpenSpot(null)}
          onFlokkIt={async () => {
            await handleFlokkIt(openSpot);
            setOpenSpot(null);
          }}
          showAddToItinerary={true}
        />
      )}
    </>
  );
}
