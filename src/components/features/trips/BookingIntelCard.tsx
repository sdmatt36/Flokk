"use client";

import { useEffect, useState, useMemo } from "react";
import type { IntelItem } from "@/app/api/trips/[id]/booking-intel/route";

const CATEGORY_LABEL: Record<IntelItem["category"], string> = {
  flights: "Flights",
  hotel: "Hotel",
  activities: "Activities",
  tours: "Tours",
  documents: "Documents",
  logistics: "Logistics",
};

const STATUS_DOT: Record<IntelItem["status"], string> = {
  booked: "#4CAF50",
  saved: "#F59E0B",
  missing: "#E53935",
};

function getVisaUrl(country: string | null | undefined, city: string | null | undefined): string {
  const location = ((country ?? "") + " " + (city ?? "")).toLowerCase();
  if (location.includes("ireland")) return "https://www.irishimmigration.ie/coming-to-visit-ireland/";
  if (location.includes("korea") || location.includes("seoul") || location.includes("busan") || location.includes("incheon")) return "https://www.visa.go.kr/openPage.do?MENU_ID=10101";
  if (location.includes("japan") || location.includes("tokyo") || location.includes("osaka") || location.includes("kyoto") || location.includes("okinawa") || location.includes("nara") || location.includes("hiroshima")) return "https://www.mofa.go.jp/j_info/visit/visa/index.html";
  if (location.includes("united kingdom") || location.includes("scotland") || location.includes("england") || location.includes("london") || location.includes("wales")) return "https://www.gov.uk/standard-visitor-visa";
  if (location.includes("australia")) return "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder";
  if (location.includes("thailand") || location.includes("bangkok")) return "https://www.thaievisa.go.th/";
  if (location.includes("sri lanka") || location.includes("colombo")) return "https://eta.gov.lk/slvisa/";
  if (location.includes("france") || location.includes("paris")) return "https://france-visas.gouv.fr/";
  if (location.includes("spain") || location.includes("barcelona") || location.includes("madrid")) return "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Visas.aspx";
  if (location.includes("italy") || location.includes("rome") || location.includes("milan")) return "https://vistoperitalia.esteri.it/home/en";
  if (location.includes("united states") || location.includes("usa")) return "https://travel.state.gov/content/travel/en/us-visas.html";
  return "https://www.iatatravelcentre.com/";
}

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
      return getVisaUrl(destinationCountry, destinationCity);
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

export function BookingIntelCard({ tripId, destinationCity, destinationCountry, startDate, endDate, onAddFlight, onManageTours }: {
  tripId: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  onAddFlight?: () => void;
  onManageTours?: () => void;
}) {
  const [state, setState] = useState<"loading" | "hidden" | "ready">("loading");
  const [items, setItems] = useState<IntelItem[]>([]);
  const [dismissedItems, setDismissedItems] = useState<IntelItem[]>([]);
  const [showBooked, setShowBooked] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [pendingDismiss, setPendingDismiss] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewObservations, setReviewObservations] = useState<string[] | null>(null);
  const [reviewError, setReviewError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
          setItems(data.items as IntelItem[]);
          setDismissedItems(Array.isArray(data.dismissedItems) ? data.dismissedItems as IntelItem[] : []);
          setState("ready");
        }
      })
      .catch(() => setState("hidden"));
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = async (item: IntelItem) => {
    // Optimistic remove
    setItems(prev => prev.filter(i => i.id !== item.id));
    setDismissedItems(prev => [...prev, { ...item, dismissed: true }]);
    setPendingDismiss(null);

    try {
      const res = await fetch(`/api/trips/${tripId}/intel-dismissals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Restore on failure
      setItems(prev => [...prev, item]);
      setDismissedItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const handleRestore = async (item: IntelItem) => {
    // Optimistic restore
    setDismissedItems(prev => prev.filter(i => i.id !== item.id));
    setItems(prev => [...prev, { ...item, dismissed: false }]);

    try {
      const res = await fetch(`/api/trips/${tripId}/intel-dismissals/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDismissedItems(prev => [...prev, item]);
    }
  };

  const renderCta = (item: IntelItem) => {
    const { actionType, status, bookingUrl, savedCount, category } = item;

    if (!actionType) return null;

    if (actionType === "add") {
      return (
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
      );
    }

    if (actionType === "manage") {
      return (
        <button
          onClick={onManageTours}
          style={{ fontSize: "12px", fontWeight: 700, color: status === "booked" ? "#4CAF50" : "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
        >
          Manage →
        </button>
      );
    }

    if (actionType === "view" && status === "booked") {
      return (
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#4CAF50" }}>
          ✓ Booked
        </span>
      );
    }

    if (actionType === "view") {
      return (
        <a
          href={`/trips/${tripId}`}
          style={{ fontSize: "12px", fontWeight: 700, color: "#F59E0B", textDecoration: "none" }}
        >
          View saved{savedCount != null ? ` (${savedCount})` : ""} →
        </a>
      );
    }

    if (actionType === "build") {
      return (
        <a
          href={`/tour${tripId ? `?tripId=${tripId}` : ""}`}
          style={{ fontSize: "12px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}
        >
          Build →
        </a>
      );
    }

    // "link" or "book" → external link
    const href = actionType === "link"
      ? (bookingUrl ?? getVisaUrl(destinationCountry, destinationCity))
      : (bookingUrl ?? getBookingUrl(category, destinationCity ?? "", destinationCountry ?? "", startDate, endDate));

    const label = actionType === "link" ? "Link →" : "Book →";

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: "12px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}
      >
        {label}
      </a>
    );
  };

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: collapsed ? 0 : 14 }}>
            <div>
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
            <button
              type="button"
              onClick={() => setCollapsed(c => !c)}
              style={{ padding: "4px 10px", fontSize: 12, color: "#666", background: "transparent", border: "1px solid #D4C4B8", borderRadius: 4, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          {!collapsed && (
          <>
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
                    {/* CTA */}
                    {renderCta(item)}
                  </div>

                  {/* Dismiss control */}
                  <div style={{ flexShrink: 0, marginTop: "2px" }}>
                    {pendingDismiss === item.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", color: "#888" }}>Dismiss?</span>
                        <button
                          onClick={() => setPendingDismiss(null)}
                          style={{ fontSize: "11px", color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDismiss(item)}
                          style={{ fontSize: "11px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                        >
                          Yes
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingDismiss(item.id)}
                        aria-label="Dismiss"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#BBBBBB", fontSize: "14px", lineHeight: 1, fontFamily: "inherit" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#C4664A"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#BBBBBB"; }}
                      >
                        ×
                      </button>
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

              {dismissedItems.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => setShowDismissed(v => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#AAAAAA", padding: 0, fontFamily: "inherit" }}
                  >
                    {showDismissed ? "Hide dismissed" : `Show ${dismissedItems.length} dismissed item${dismissedItems.length > 1 ? "s" : ""}`}
                  </button>
                  {showDismissed && (
                    <div style={{ marginTop: "8px" }}>
                      {dismissedItems.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex", gap: "10px", alignItems: "flex-start",
                            padding: "8px 0",
                            borderBottom: "1px solid rgba(0,0,0,0.04)",
                            opacity: 0.6,
                          }}
                        >
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#D1D5DB", flexShrink: 0, marginTop: "4px" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280" }}>{item.title}</span>
                          </div>
                          <button
                            onClick={() => handleRestore(item)}
                            style={{ fontSize: "11px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", flexShrink: 0, marginTop: "2px" }}
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
          </>
          )}
        </div>
      </div>
    </>
  );
}
