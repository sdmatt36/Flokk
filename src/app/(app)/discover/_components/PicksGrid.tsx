"use client";

import { useState } from "react";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import { CommunitySpotDetailPanel } from "@/components/shared/cards/CommunitySpotDetailPanel";
import { CATEGORIES } from "@/lib/categories";

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

const TERRA = "#C4664A";

function categoryLabel(slug: string | null): string | null {
  if (!slug) return null;
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

interface PickCardProps {
  spot: PickSpot;
  isSaved: boolean;
  onOpenDetail: (spot: PickSpot) => void;
  onFlokkIt: () => Promise<void>;
}

function PickCard({ spot, isSaved, onOpenDetail, onFlokkIt }: PickCardProps) {
  const label = categoryLabel(spot.category);
  const rating = spot.averageRating !== null ? Math.round(spot.averageRating) : null;

  return (
    <div
      onClick={() => onOpenDetail(spot)}
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #EEEEEE",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 8px rgba(0,0,0,0.06)";
      }}
    >
      {/* Photo */}
      <div
        style={{
          height: "148px",
          backgroundColor: "#1B3A5C1A",
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.photoUrl}
            alt={spot.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 11, color: "#1B3A5C", opacity: 0.3, fontStyle: "italic" }}>
              {spot.city}
            </span>
          </div>
        )}
        {/* Category badge */}
        {label && (
          <span
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              fontSize: "10px",
              fontWeight: 700,
              backgroundColor: TERRA,
              color: "#fff",
              borderRadius: "20px",
              padding: "2px 8px",
            }}
          >
            {label}
          </span>
        )}
        {/* Flokk Approved ribbon */}
        {rating !== null && rating >= 3 && (
          <span
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              fontSize: "10px",
              fontWeight: 700,
              backgroundColor: TERRA,
              color: "#fff",
              borderRadius: "20px",
              padding: "3px 8px",
            }}
          >
            Flokk Approved
          </span>
        )}
      </div>

      {/* Body */}
      <div
        style={{ padding: "12px 14px", display: "flex", flexDirection: "column", flex: 1 }}
      >
        <p style={{ fontSize: 11, color: "#AAAAAA", marginBottom: 2 }}>
          {spot.city}
          {spot.country ? `, ${spot.country}` : ""}
        </p>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1B3A5C",
            lineHeight: 1.3,
            marginBottom: spot.description ? 6 : 10,
          }}
        >
          {spot.name}
        </p>
        {spot.description && (
          <p
            style={{
              fontSize: 12,
              color: "#888",
              lineHeight: 1.4,
              marginBottom: 6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {spot.description}
          </p>
        )}
        {rating !== null && spot.ratingCount >= 2 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ color: "#f59e0b", fontSize: "13px", letterSpacing: "1px" }}>
              {"★".repeat(rating)}{"☆".repeat(5 - rating)}
            </span>
            <span style={{ fontSize: "11px", color: "#AAAAAA" }}>
              {spot.ratingCount} families rated this
            </span>
          </div>
        ) : spot.ratingCount === 1 ? (
          <p style={{ fontSize: "11px", color: "#CCCCCC", marginBottom: "4px" }}>1 family rated this</p>
        ) : null}
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
            onFlokkIt={onFlokkIt}
            showAddToItinerary={true}
            variant="card-compact"
          />
        </div>
      </div>
    </div>
  );
}

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
          <PickCard
            key={spot.id}
            spot={spot}
            isSaved={savedIds.has(spot.id)}
            onOpenDetail={setOpenSpot}
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
            rating:
              openSpot.averageRating !== null ? Math.round(openSpot.averageRating) : null,
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
