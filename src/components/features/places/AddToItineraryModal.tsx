"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { resolveMatchingTrips, addPlaceToTripSaves } from "@/lib/add-to-itinerary";
import type { AddToItineraryPlace, MatchingTrip } from "@/lib/add-to-itinerary";

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const GRAY_200 = "#E5E7EB";

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const start = new Date(startDate.split("T")[0] + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (!endDate) return start.toLocaleDateString("en-US", opts);
  const end = new Date(endDate.split("T")[0] + "T12:00:00");
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

interface Props {
  open: boolean;
  place: AddToItineraryPlace | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AddToItineraryModal({ open, place, onClose, onSuccess }: Props) {
  const [matches, setMatches] = useState<MatchingTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !place?.city) {
      setMatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    resolveMatchingTrips(place.city)
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [open, place?.city]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !place) return null;

  const city = place.city ?? "this city";

  async function handleConfirm(tripId: string | null, tripName: string | null) {
    if (!place) return;
    setSaving(true);
    setError(null);
    const result = await addPlaceToTripSaves(place, tripId);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    onSuccess(tripName ? `Added to ${tripName}` : "Saved for later");
    onClose();
  }

  const pillStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px", borderRadius: 10, border: `1px solid ${GRAY_200}`,
    background: "#FAFAFA", cursor: "pointer", fontFamily: "inherit",
    textAlign: "left", width: "100%",
  };

  const primaryBtn: React.CSSProperties = {
    padding: "11px 0", borderRadius: 8, border: "none",
    background: TERRA, color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
    fontFamily: "inherit", width: "100%",
  };

  const cancelBtn: React.CSSProperties = {
    padding: "11px 0", borderRadius: 8, border: `1px solid ${GRAY_200}`,
    background: "white", color: NAVY, fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", flex: 1,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 1200, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff", borderRadius: 16, padding: 24,
          width: "100%", maxWidth: 360, display: "flex",
          flexDirection: "column", gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{
              fontFamily: "Playfair Display, serif", fontSize: 18,
              fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.3,
            }}>
              {loading ? "Finding your trips..." : matches.length === 0 ? `No upcoming trip for ${city}` : matches.length === 1 ? `Add to your ${matches[0].name}?` : "Which trip?"}
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 0 }}>
              {place.name}{place.city ? `, ${place.city}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9CA3AF", marginLeft: 12, marginTop: 2 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 48, backgroundColor: "#F3F4F6", borderRadius: 10 }} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          // Zero-match state
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
              Save it to your library or start a new trip for {city}.
            </p>
            {error && <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href={`/trips/new${place.city ? `?destination=${encodeURIComponent(place.city)}` : ""}`}
                style={{
                  ...primaryBtn, display: "block", textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Create trip for {city}
              </a>
              <button
                type="button"
                style={{ ...primaryBtn, background: "#1B3A5C" }}
                onClick={() => handleConfirm(null, null)}
                disabled={saving}
              >
                {saving ? "Saving..." : "Just save it"}
              </button>
              <button type="button" style={cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : matches.length === 1 ? (
          // Single-match state
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={pillStyle}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: NAVY, margin: 0 }}>{matches[0].name}</p>
                <p style={{ fontSize: 12, color: "#6B7280", margin: 0, marginTop: 2 }}>
                  {formatDateRange(matches[0].startDate, matches[0].endDate)}
                </p>
              </div>
            </div>
            {error && <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{ ...primaryBtn, flex: 1 }}
                onClick={() => handleConfirm(matches[0].id, matches[0].name)}
                disabled={saving}
              >
                {saving ? "Adding..." : `Add to ${matches[0].name}`}
              </button>
              <button type="button" style={cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          // Multi-match state
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.map((trip) => (
              <button
                key={trip.id}
                type="button"
                style={pillStyle}
                onClick={() => handleConfirm(trip.id, trip.name)}
                disabled={saving}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: NAVY, margin: 0 }}>{trip.name}</p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0, marginTop: 2 }}>
                    {formatDateRange(trip.startDate, trip.endDate)}
                    {trip.matchReason === "itinerary-item-city" && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "#9CA3AF" }}>via itinerary</span>
                    )}
                  </p>
                </div>
                <span style={{ color: "#9CA3AF", fontSize: 18, lineHeight: 1 }}>›</span>
              </button>
            ))}
            {error && <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>}
            <button type="button" style={{ ...cancelBtn, width: "100%", flex: "none" }} onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
