"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SpotImage } from "@/components/shared/SpotImage";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import type { EntityStatusResult } from "@/lib/entity-status";
import type { CommunitySpotCardSpot } from "./CommunitySpotCard";

export interface CommunitySpotDetailPanelProps {
  spot: CommunitySpotCardSpot;
  isSaved: boolean;
  saveStatus: EntityStatusResult | null;
  userRating: number | null;
  onClose: () => void;
  onFlokkIt: () => Promise<void> | void;
  onShareToast?: (msg: string) => void;
  showAddToItinerary?: boolean;
}

export function CommunitySpotDetailPanel({
  spot,
  isSaved,
  saveStatus,
  userRating,
  onClose,
  onFlokkIt,
  onShareToast,
  showAddToItinerary = true,
}: CommunitySpotDetailPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "440px", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
      >
        {spot.photoUrl && (
          <div style={{ height: "220px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            <SpotImage
              spotId={spot.id}
              src={spot.photoUrl}
              category={spot.category}
              alt={spot.title}
              allowResolve={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {spot.rating !== null && spot.rating >= 3 && (
              <span style={{ position: "absolute", bottom: "12px", left: "12px", backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px" }}>
                Flokk Approved
              </span>
            )}
          </div>
        )}
        <div style={{ padding: "20px 20px 24px", overflowY: "auto", flex: 1, position: "relative" }}>
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "22px", lineHeight: 1, padding: "0 0 0 12px" }}
          >
            <X size={20} />
          </button>
          <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "4px" }}>{spot.city ?? ""}</p>
          <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", marginBottom: "10px", lineHeight: 1.3, paddingRight: "32px" }}>{spot.title}</p>
          {spot.description && (
            <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.6, marginBottom: "12px" }}>{spot.description}</p>
          )}
          {spot.rating !== null && spot.ratingCount >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ color: "#f59e0b", fontSize: "16px", letterSpacing: "1px" }}>
                {"★".repeat(spot.rating)}{"☆".repeat(5 - spot.rating)}
              </span>
              <span style={{ fontSize: "12px", color: "#AAAAAA" }}>{spot.ratingCount} families rated this</span>
            </div>
          )}
          <PlaceActionRow
            place={{
              name: spot.title,
              city: spot.city,
              websiteUrl: spot.websiteUrl ?? null,
              photoUrl: spot.photoUrl,
              category: spot.category,
            }}
            isSaved={isSaved}
            showAddToItinerary={showAddToItinerary && (!saveStatus || saveStatus.showAffordance)}
            userRating={userRating}
            onFlokkIt={onFlokkIt}
            onShareToast={onShareToast}
            variant="card-expanded"
          />
        </div>
      </div>
    </div>
  );
}
