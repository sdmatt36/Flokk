"use client";

import { useState } from "react";
import { ExternalLink, Share2, Pencil, Plus, BookmarkCheck, CalendarPlus, Star } from "lucide-react";
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
  onFlokkIt?: () => Promise<void> | void;
  onAddToTrip?: () => void;
  onRate?: () => void;
  onEdit?: () => void;
  onShareToast?: (message: string) => void;
  variant?: "card-compact" | "card-expanded";
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
  onAddToTrip,
  onRate,
  onEdit,
  onShareToast,
  variant = "card-expanded",
}: PlaceActionRowProps) {
  const { open: openAddToItinerary } = useAddToItinerary();
  const [flokking, setFlokking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleFlokkIt = async () => {
    if (!onFlokkIt || isSaved || flokking) return;
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

  // Rate button content — filled stars if rated, "Rate" text if not
  const rateContent = (size: number) => {
    const rating = typeof userRating === "number" && userRating > 0 ? userRating : 0;
    if (rating > 0) {
      return (
        <>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ color: i <= rating ? TERRA : GRAY_200, fontSize: size, lineHeight: 1 }}>★</span>
          ))}
        </>
      );
    }
    return <><Star size={size - 1} /> Rate</>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {variant === "card-compact" ? (
        // Two-row compact layout for 3-col card grid
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Row 1: Primary action, full width — priority: Flokk It > Add to trip > skip */}
          {onFlokkIt != null ? (
            isSaved ? (
              <button type="button" disabled style={{ ...savedPill, width: "100%", padding: "7px 10px", fontSize: 12 }}>
                <BookmarkCheck size={13} /> Saved
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFlokkIt}
                disabled={flokking}
                aria-label={`Flokk ${place.name}`}
                style={{ ...primaryBtn, width: "100%", padding: "7px 10px", fontSize: 12 }}
              >
                {flokking ? "Saving…" : "Flokk It"}
              </button>
            )
          ) : onAddToTrip != null ? (
            <button
              type="button"
              onClick={onAddToTrip}
              aria-label={`Add ${place.name} to trip`}
              style={{ ...primaryBtn, width: "100%", padding: "7px 10px", fontSize: 12, cursor: "pointer", opacity: 1 }}
            >
              <Plus size={14} /> Add to trip
            </button>
          ) : null}

          {/* Row 2: Secondary actions, equal-flex */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleAddToItinerary}
              aria-label={`Add ${place.name} to itinerary`}
              style={{ ...btnBase, flex: 1, padding: "6px 4px", fontSize: 11, gap: 3 }}
            >
              <CalendarPlus size={12} /> + Itinerary
            </button>

            {place.websiteUrl ? (
              <a
                href={place.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Link for ${place.name}`}
                style={{ ...btnBase, flex: 1, padding: "6px 4px", fontSize: 11, gap: 3, textDecoration: "none" }}
              >
                <ExternalLink size={12} /> Link
              </a>
            ) : null}

            {onRate != null ? (
              <button
                type="button"
                onClick={onRate}
                aria-label={`Rate ${place.name}`}
                style={{ ...btnBase, flex: 1, padding: "6px 4px", fontSize: 11, gap: 3 }}
              >
                {rateContent(13)}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              aria-label={`Share ${place.name}`}
              style={{ ...btnBase, flex: 1, padding: "6px 4px", fontSize: 11, gap: 3 }}
            >
              <Share2 size={12} /> Share
            </button>

            {canEdit && onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${place.name}`}
                style={{ ...btnBase, padding: "6px 8px", fontSize: 11 }}
              >
                <Pencil size={12} />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        // Expanded layout for detail modal and wider containers
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {onFlokkIt != null ? (
            isSaved ? (
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
                {flokking ? "Saving…" : "Flokk It"}
              </button>
            )
          ) : onAddToTrip != null ? (
            <button
              type="button"
              onClick={onAddToTrip}
              aria-label={`Add ${place.name} to trip`}
              style={{ ...primaryBtn, cursor: "pointer", opacity: 1 }}
            >
              <Plus size={14} /> Add to trip
            </button>
          ) : null}

          <button
            type="button"
            style={btnBase}
            onClick={handleAddToItinerary}
            aria-label={`Add ${place.name} to itinerary`}
          >
            <CalendarPlus size={14} /> + Itinerary
          </button>

          {place.websiteUrl && (
            <a
              href={place.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...btnBase, textDecoration: "none" }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Link for ${place.name}`}
            >
              <ExternalLink size={14} /> Link
            </a>
          )}

          {onRate != null && (
            <button
              type="button"
              style={btnBase}
              onClick={onRate}
              aria-label={`Rate ${place.name}`}
            >
              {rateContent(14)}
            </button>
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
      )}
    </div>
  );
}
