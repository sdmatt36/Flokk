"use client";

import { useEffect, useState, useMemo } from "react";
import type { IntelItem } from "@/app/api/trips/[id]/booking-intel/route";

const CATEGORY_LABEL: Record<IntelItem["category"], string> = {
  flights: "Flights",
  hotel: "Hotel",
  activities: "Activities",
  documents: "Documents",
  logistics: "Logistics",
};

const STATUS_DOT: Record<IntelItem["status"], string> = {
  booked: "#4CAF50",
  saved: "#F59E0B",
  missing: "#E53935",
};

function getBookingUrl(
  category: IntelItem["category"],
  destinationCity: string,
  destinationCountry: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const city = encodeURIComponent(destinationCity);
  const checkIn = startDate ? new Date(startDate).toISOString().split("T")[0] : "";
  const checkOut = endDate ? new Date(endDate).toISOString().split("T")[0] : "";

  switch (category) {
    case "hotel":
      return `https://www.booking.com/searchresults.html?aid=2311236&ss=${city}&checkin=${checkIn}&checkout=${checkOut}&group_adults=2`;
    case "flights":
      return `https://www.google.com/travel/flights?q=flights+to+${city}`;
    case "activities":
      return `https://www.getyourguide.com/s/?q=${city}&partner_id=9ZETRF4`;
    case "logistics":
      return `https://www.getyourguide.com/s/?q=${city}+transport+pass&partner_id=9ZETRF4`;
    case "documents":
      return `https://www.insuremytrip.com/`;
    default:
      return `https://www.getyourguide.com/s/?q=${city}&partner_id=9ZETRF4`;
  }
}

function computeDaysAway(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const ms = new Date(startDate).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(daysAway: number): string {
  if (daysAway <= 0) return "trip in progress";
  if (daysAway === 1) return "tomorrow — book immediately";
  if (daysAway <= 7) return `${daysAway} days away — book immediately`;
  if (daysAway <= 14) return "1 week away — book now";
  if (daysAway <= 21) return "2 weeks away — book soon";
  if (daysAway <= 30) return "3 weeks away";
  const months = Math.floor(daysAway / 30);
  return `${months} month${months > 1 ? "s" : ""} away`;
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#E5E5E5", flexShrink: 0, marginTop: "5px", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "14px", borderRadius: "6px", backgroundColor: "#E5E5E5", marginBottom: "6px", width: "60%", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: "11px", borderRadius: "6px", backgroundColor: "#F0F0F0", width: "90%", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

export function BookingIntelCard({ tripId, destinationCity, destinationCountry, startDate, endDate, onAddFlight }: {
  tripId: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  onAddFlight?: () => void;
}) {
  const [state, setState] = useState<"loading" | "hidden" | "ready">("loading");
  const [items, setItems] = useState<IntelItem[]>([]);
  const [showBooked, setShowBooked] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewObservations, setReviewObservations] = useState<string[] | null>(null);
  const [reviewError, setReviewError] = useState(false);

  const STATUS_ORDER: Record<IntelItem["status"], number> = { missing: 0, saved: 1, booked: 2 };
  const { activeItems, bookedItems } = useMemo(() => {
    const sorted = [...items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    return {
      activeItems: sorted.filter(i => i.status !== "booked"),
      bookedItems: sorted.filter(i => i.status === "booked"),
    };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute daysAway from the startDate prop directly — never rely on API response
  const daysAway = computeDaysAway(startDate);
  const urgencyLabel = daysAway != null ? getUrgencyLabel(daysAway) : null;

  const tripDuration =
    startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
  const tripInProgress = daysAway !== null && daysAway <= 0 && (tripDuration === null || daysAway > -tripDuration);
  const tripJustEnded = daysAway !== null && tripDuration !== null && daysAway <= -tripDuration;

  const cardHeading = tripInProgress
    ? "Your trip is underway"
    : tripJustEnded
    ? "How did it go?"
    : "Things to sort before you go";

  const cardSubheading = tripInProgress && destinationCity
    ? `You're in ${destinationCity} now`
    : (destinationCity || startDate)
    ? `Based on your trip${destinationCity ? ` to ${destinationCity}` : ""}${startDate ? ` on ${new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}${urgencyLabel && !tripInProgress ? ` — ${urgencyLabel}` : ""}`
    : null;

  useEffect(() => {
    if (!tripId) { setState("hidden"); return; }
    fetch(`/api/trips/${tripId}/booking-intel`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.show || !Array.isArray(data.items) || data.items.length === 0) {
          setState("hidden");
        } else {
          setItems(data.items);
          setState("ready");
        }
      })
      .catch(() => setState("hidden"));
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReviewItinerary = async () => {
    setReviewLoading(true);
    setReviewError(false);
    setReviewObservations(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/review`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { observations: string[] };
      setReviewObservations(data.observations);
    } catch {
      setReviewError(true);
    } finally {
      setReviewLoading(false);
    }
  };

  if (state === "hidden") return null;

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div style={{
        display: "flex",
        borderRadius: "14px",
        overflow: "hidden",
        backgroundColor: "#FFFBF5",
        border: "1px solid rgba(196,102,74,0.15)",
        marginBottom: "20px",
        boxShadow: "0 2px 12px rgba(196,102,74,0.08)",
      }}>
        {/* Left accent bar */}
        <div style={{ width: "4px", backgroundColor: "#C4664A", flexShrink: 0 }} />

        <div style={{ flex: 1, padding: "18px 20px" }}>
          {/* Header */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
              color: "#C4664A", textTransform: "uppercase", display: "block", marginBottom: "4px",
            }}>
              Trip Intelligence
            </span>
            <h3 style={{
              fontSize: "17px", fontWeight: 800, color: "#1B3A5C", margin: "0 0 4px",
              fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
              lineHeight: 1.2,
            }}>
              {cardHeading}
            </h3>
            {cardSubheading && (
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                {cardSubheading}
              </p>
            )}
          </div>

          {/* Body */}
          {state === "loading" ? (
            <div>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <div>
              {[...activeItems, ...(showBooked ? bookedItems : [])].map((item, i, arr) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    padding: "11px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    backgroundColor: STATUS_DOT[item.status],
                    flexShrink: 0, marginTop: "4px",
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C" }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: "10px", fontWeight: 600, color: "#888",
                        backgroundColor: "rgba(0,0,0,0.05)", borderRadius: "999px",
                        padding: "1px 7px", whiteSpace: "nowrap",
                      }}>
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#717171", margin: "0 0 4px", lineHeight: 1.45 }}>
                      {item.reason}
                    </p>
                    {/* CTAs */}
                    {item.status === "booked" && (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#4CAF50" }}>
                        ✓ Booked
                      </span>
                    )}
                    {item.status === "saved" && (
                      <a
                        href={`/trips/${tripId}`}
                        style={{
                          fontSize: "12px", fontWeight: 700, color: "#F59E0B",
                          textDecoration: "none",
                        }}
                      >
                        View saved{item.savedCount != null ? ` (${item.savedCount})` : ""} →
                      </a>
                    )}
                    {item.status === "missing" && item.bookingUrl && (
                      <a
                        href={item.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "12px", fontWeight: 700, color: "#C4664A",
                          textDecoration: "none",
                        }}
                      >
                        Book →
                      </a>
                    )}
                    {item.status === "missing" && !item.bookingUrl && item.category !== "flights" && (
                      <a
                        href={getBookingUrl(item.category, destinationCity ?? "", destinationCountry ?? "", startDate, endDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "12px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}
                      >
                        Book →
                      </a>
                    )}
                    {item.status === "missing" && item.category === "flights" && (
                      <div style={{ marginTop: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          {onAddFlight && (
                            <button
                              onClick={onAddFlight}
                              style={{
                                fontSize: "12px", fontWeight: 600, color: "#C4664A",
                                border: "1px solid #C4664A", borderRadius: "6px",
                                padding: "3px 10px", background: "none", cursor: "pointer",
                                fontFamily: "inherit", whiteSpace: "nowrap",
                              }}
                            >
                              + Add flight manually
                            </button>
                          )}
                          <span style={{ fontSize: "12px", color: "#AAAAAA" }}>or forward confirmation to{" "}
                            <span style={{ fontWeight: 600, color: "#1B3A5C" }}>trips@flokktravel.com</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {bookedItems.length > 0 && (
                <button
                  onClick={() => setShowBooked(v => !v)}
                  style={{ marginTop: "8px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#4CAF50", padding: 0, fontFamily: "inherit" }}
                >
                  {showBooked ? "Hide booked items" : `Show ${bookedItems.length} booked item${bookedItems.length > 1 ? "s" : ""} ✓`}
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          {state === "ready" && (
            <p style={{ fontSize: "11px", color: "#AAA", margin: "12px 0 0", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "10px" }}>
              Updated based on what&apos;s in your trip vault
            </p>
          )}

          {/* Schedule Review */}
          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {reviewObservations === null && !reviewLoading && (
              <button
                onClick={handleReviewItinerary}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#C4664A", fontFamily: "inherit" }}
              >
                Review my itinerary →
              </button>
            )}

            {reviewLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600, fontStyle: "italic" }}>Flokking...</span>
                <span style={{ fontSize: "12px", color: "#AAA" }}>This takes about 10 seconds. Please be patient.</span>
              </div>
            )}

            {reviewError && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Unable to review right now.</p>
                <button
                  onClick={handleReviewItinerary}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "13px", color: "#C4664A", fontFamily: "inherit" }}
                >
                  Try again
                </button>
              </div>
            )}

            {reviewObservations && reviewObservations.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#AAA", textTransform: "uppercase" }}>
                    Itinerary Review
                  </span>
                  <button
                    onClick={() => setReviewObservations(null)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "#BBB", fontFamily: "inherit" }}
                  >
                    Dismiss
                  </button>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {reviewObservations.map((obs, i) => (
                    <li key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ marginTop: "6px", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#C4664A", flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: "13px", color: "#1B3A5C", lineHeight: 1.5 }}>{obs}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleReviewItinerary}
                  style={{ marginTop: "10px", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "#BBB", fontFamily: "inherit" }}
                >
                  Re-run review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
