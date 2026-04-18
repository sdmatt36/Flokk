"use client";

import { useState } from "react";
import { ExternalLink, Share2, Pencil, Plus, BookmarkCheck } from "lucide-react";
import { useAddToItinerary } from "./AddToItineraryProvider";
import { sharePlace, type ShareablePlace } from "@/lib/share";
import type { AddToItineraryPlace } from "@/lib/add-to-itinerary";

export interface PlaceActionRowPlace extends AddToItineraryPlace, ShareablePlace {
  id?: string;
}

export interface PlaceActionRowProps {
  place: PlaceActionRowPlace;
  userRating?: number | null;
  isSaved: boolean;
  canEdit?: boolean;
  onFlokkIt: () => Promise<void> | void;
  onEdit?: () => void;
  onShareToast?: (message: string) => void;
  layout?: "horizontal" | "vertical";
}

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";
const GRAY_200 = "#E5E7EB";

export function PlaceActionRow({
  place,
  userRating,
  isSaved,
  canEdit = false,
  onFlokkIt,
  onEdit,
  onShareToast,
  layout = "horizontal",
}: PlaceActionRowProps) {
  const { open: openAddToItinerary } = useAddToItinerary();
  const [flokking, setFlokking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleFlokkIt = async () => {
    if (isSaved || flokking) return;
    setFlokking(true);
    try {
      await onFlokkIt();
    } finally {
      setFlokking(false);
    }
  };

  const handleAddToItinerary = () => {
    openAddToItinerary(place);
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await sharePlace(place);
      if (result.ok) {
        onShareToast?.("Link copied to clipboard");
      } else {
        onShareToast?.(result.error ?? "Could not share");
      }
    } finally {
      setSharing(false);
    }
  };

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "8px 12px", borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${GRAY_200}`, background: "white", color: NAVY,
    fontFamily: "inherit", transition: "background-color 0.15s",
  };

  const primaryBtn: React.CSSProperties = {
    ...btnBase, border: "none", background: TERRA, color: "white",
    cursor: flokking ? "default" : "pointer", opacity: flokking ? 0.7 : 1,
  };

  const savedPill: React.CSSProperties = {
    ...btnBase, background: "#F9FAFB", color: "#6B7280",
    cursor: "default", border: `1px solid ${GRAY_200}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {userRating != null && userRating > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B7280" }}>
          <span>You rated:</span>
          <div style={{ display: "flex", gap: 1 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ color: i <= userRating ? "#f59e0b" : "#d1d5db", fontSize: 13 }}>★</span>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        flexDirection: layout === "horizontal" ? "row" : "column",
        flexWrap: layout === "horizontal" ? "wrap" : "nowrap",
        gap: 6,
        alignItems: layout === "horizontal" ? "center" : "stretch",
      }}>
        {isSaved ? (
          <button type="button" style={savedPill} disabled>
            <BookmarkCheck size={14} /> Saved
          </button>
        ) : (
          <button
            type="button"
            style={primaryBtn}
            onClick={handleFlokkIt}
            disabled={flokking}
            aria-label={`Flokk ${place.name}`}
          >
            {flokking ? "Saving..." : "Flokk It"}
          </button>
        )}

        <button
          type="button"
          style={btnBase}
          onClick={handleAddToItinerary}
          aria-label={`Add ${place.name} to itinerary`}
        >
          <Plus size={14} /> Itinerary
        </button>

        {place.websiteUrl && (
          <a
            href={place.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnBase, textDecoration: "none" }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Visit site for ${place.name}`}
          >
            <ExternalLink size={14} /> Visit
          </a>
        )}

        <button
          type="button"
          style={btnBase}
          onClick={handleShare}
          disabled={sharing}
          aria-label={`Share ${place.name}`}
        >
          <Share2 size={14} /> Share
        </button>

        {canEdit && onEdit && (
          <button
            type="button"
            style={btnBase}
            onClick={onEdit}
            aria-label={`Edit ${place.name}`}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
