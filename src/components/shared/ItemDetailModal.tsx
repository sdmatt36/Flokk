"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SpotImage } from "@/components/shared/SpotImage";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import { CategoryBadges } from "@/components/shared/CategoryBadges";

interface SpotData {
  id: string;
  name: string;
  city: string;
  photoUrl: string | null;
  category: string | null;
  description: string | null;
  averageRating: number | null;
  ratingCount: number;
  websiteUrl: string | null;
  shareToken: string | null;
  contributorName: string | null;
}

export interface ItemDetailModalProps {
  entityType: "CommunitySpot";
  id: string;
  open: boolean;
  onClose: () => void;
  initialIsSaved?: boolean;
  onSaved?: (id: string) => void;
  onShareToast?: (msg: string) => void;
  showAddToItinerary?: boolean;
}

export function ItemDetailModal({
  entityType,
  id,
  open,
  onClose,
  initialIsSaved = false,
  onSaved,
  onShareToast,
  showAddToItinerary = true,
}: ItemDetailModalProps) {
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved);

  useEffect(() => {
    if (!open || !id || entityType !== "CommunitySpot") return;
    setIsSaved(initialIsSaved);
    setSpot(null);
    setLoading(true);
    fetch(`/api/community-spots/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { spot?: SpotData } | null) => {
        if (data?.spot) setSpot(data.spot);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, id, entityType]);

  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  async function handleFlokkIt() {
    if (!spot) return;
    await fetch("/api/saves/from-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: spot.name,
        city: spot.city,
        placePhotoUrl: spot.photoUrl ?? undefined,
        websiteUrl: spot.websiteUrl ?? undefined,
        category: spot.category ?? undefined,
      }),
    });
    setIsSaved(true);
    onSaved?.(id);
  }

  const rating =
    spot?.averageRating !== null && spot?.averageRating !== undefined
      ? Math.round(spot.averageRating)
      : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "440px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {loading && !spot ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#AAAAAA",
              fontSize: "14px",
            }}
          >
            Loading...
          </div>
        ) : spot ? (
          <>
            {spot.photoUrl && (
              <div
                style={{
                  height: "220px",
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <SpotImage
                  spotId={spot.id}
                  src={spot.photoUrl}
                  category={spot.category}
                  alt={spot.name}
                  allowResolve={true}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {rating !== null && rating >= 3 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      backgroundColor: "#C4664A",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    Flokk Approved
                  </span>
                )}
              </div>
            )}
            <div
              style={{
                padding: "20px 20px 24px",
                overflowY: "auto",
                flex: 1,
                position: "relative",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#999",
                  fontSize: "22px",
                  lineHeight: 1,
                  padding: "0 0 0 12px",
                }}
              >
                <X size={20} />
              </button>
              <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "4px" }}>
                {spot.city}
              </p>
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#1B3A5C",
                  marginBottom: "8px",
                  lineHeight: 1.3,
                  paddingRight: "32px",
                }}
              >
                {spot.name}
              </p>
              {spot.category && (
                <div style={{ marginBottom: "10px" }}>
                  <CategoryBadges slugs={[spot.category]} />
                </div>
              )}
              {spot.description && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "#717171",
                    lineHeight: 1.6,
                    marginBottom: "12px",
                  }}
                >
                  {spot.description}
                </p>
              )}
              {rating !== null && spot.ratingCount >= 2 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      color: "#f59e0b",
                      fontSize: "16px",
                      letterSpacing: "1px",
                    }}
                  >
                    {"★".repeat(rating)}
                    {"☆".repeat(5 - rating)}
                  </span>
                  <span style={{ fontSize: "12px", color: "#AAAAAA" }}>
                    {spot.ratingCount} families rated this
                  </span>
                </div>
              ) : spot.ratingCount === 1 ? (
                <p
                  style={{
                    fontSize: "12px",
                    color: "#CCCCCC",
                    marginBottom: "10px",
                  }}
                >
                  1 family rated this
                </p>
              ) : null}
              {spot.contributorName && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#AAAAAA",
                    marginBottom: "10px",
                  }}
                >
                  Saved by{" "}
                  <span style={{ fontWeight: 600 }}>{spot.contributorName}</span>
                </p>
              )}
              <PlaceActionRow
                place={{
                  name: spot.name,
                  city: spot.city,
                  websiteUrl: spot.websiteUrl ?? null,
                  photoUrl: spot.photoUrl,
                  category: spot.category,
                  shareUrl: spot.shareToken
                    ? `/spots/${spot.shareToken}`
                    : undefined,
                }}
                isSaved={isSaved}
                showAddToItinerary={showAddToItinerary}
                userRating={null}
                onFlokkIt={handleFlokkIt}
                onShareToast={onShareToast}
                variant="card-expanded"
              />
            </div>
          </>
        ) : (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#AAAAAA",
              fontSize: "14px",
            }}
          >
            Could not load details.
          </div>
        )}
      </div>
    </div>
  );
}
