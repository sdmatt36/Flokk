"use client";

import { useState } from "react";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { ItemDetailModal } from "@/components/shared/ItemDetailModal";

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
  shareToken?: string | null;
};

export function PicksGrid({ spots }: { spots: PickSpot[] }) {
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
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

  const openSpot = openSpotId ? spots.find((s) => s.id === openSpotId) ?? null : null;

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
              shareToken: spot.shareToken,
            }}
            isSaved={savedIds.has(spot.id)}
            onClickCard={() => setOpenSpotId(spot.id)}
            onFlokkIt={() => handleFlokkIt(spot)}
          />
        ))}
      </div>

      <ItemDetailModal
        entityType="CommunitySpot"
        id={openSpotId ?? ""}
        open={!!openSpotId}
        onClose={() => setOpenSpotId(null)}
        initialIsSaved={openSpot ? savedIds.has(openSpot.id) : false}
        onSaved={(id) => setSavedIds((prev) => new Set(prev).add(id))}
        showAddToItinerary={true}
      />
    </>
  );
}
