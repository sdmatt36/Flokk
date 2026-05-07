"use client";

import { useState } from "react";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";

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
};

function PickCard({ spot }: { spot: PickSpot }) {
  const [isSaved, setIsSaved] = useState(false);

  const handleFlokkIt = async () => {
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
    setIsSaved(true);
  };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #EEEEEE",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: "144px", backgroundColor: "#1B3A5C1A", overflow: "hidden", flexShrink: 0 }}>
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.photoUrl}
            alt={spot.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "#1B3A5C", opacity: 0.3, fontStyle: "italic" }}>{spot.city}</span>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ fontSize: 11, color: "#AAAAAA", marginBottom: 2 }}>{spot.city}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#1B3A5C", lineHeight: 1.3, marginBottom: 10 }}>
          {spot.name}
        </p>
        <div style={{ marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
          <PlaceActionRow
            place={{
              name: spot.name,
              city: spot.city,
              websiteUrl: spot.websiteUrl ?? undefined,
              lat: spot.lat ?? undefined,
              lng: spot.lng ?? undefined,
              googlePlaceId: spot.googlePlaceId ?? undefined,
              photoUrl: spot.photoUrl ?? undefined,
              category: spot.category ?? undefined,
            }}
            isSaved={isSaved}
            onFlokkIt={handleFlokkIt}
            showAddToItinerary={true}
            variant="card-compact"
          />
        </div>
      </div>
    </div>
  );
}

export function PicksGrid({ spots }: { spots: PickSpot[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:gap-6">
      {spots.map((spot) => (
        <PickCard key={spot.id} spot={spot} />
      ))}
    </div>
  );
}
