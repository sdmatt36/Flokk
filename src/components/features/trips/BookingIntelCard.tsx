"use client";

import { useEffect, useState } from "react";

type BookingItem = {
  title: string;
  reason: string;
  urgency: "now" | "soon" | "when ready";
  bookingUrl: string | null;
  category: "flights" | "hotel" | "activities" | "documents" | "logistics";
};

const CATEGORY_LABEL: Record<BookingItem["category"], string> = {
  flights: "Flights",
  hotel: "Hotel",
  activities: "Activities",
  documents: "Documents",
  logistics: "Logistics",
};

const URGENCY_DOT: Record<BookingItem["urgency"], string> = {
  now: "#E53935",
  soon: "#F59E0B",
  "when ready": "#4CAF50",
};

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

export function BookingIntelCard({ tripId, destinationCity, startDate }: {
  tripId: string;
  destinationCity?: string | null;
  startDate?: string | null;
}) {
  const [state, setState] = useState<"loading" | "hidden" | "ready">("loading");
  const [items, setItems] = useState<BookingItem[]>([]);
  const [daysAway, setDaysAway] = useState<number | null>(null);

  useEffect(() => {
    if (!tripId) { setState("hidden"); return; }
    fetch(`/api/trips/${tripId}/booking-intel`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.show || !Array.isArray(data.items) || data.items.length === 0) {
          setState("hidden");
        } else {
          setItems(data.items);
          setDaysAway(data.daysAway ?? null);
          setState("ready");
        }
      })
      .catch(() => setState("hidden"));
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "hidden") return null;

  const dateLabel = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

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
              Things to sort before you go
            </h3>
            {(destinationCity || dateLabel) && (
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                Based on your trip
                {destinationCity ? ` to ${destinationCity}` : ""}
                {dateLabel ? ` on ${dateLabel}` : ""}
                {daysAway != null ? ` — ${daysAway} day${daysAway !== 1 ? "s" : ""} away` : ""}
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
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    padding: "11px 0",
                    borderBottom: i < items.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  {/* Urgency dot */}
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    backgroundColor: URGENCY_DOT[item.urgency],
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
                    {item.bookingUrl && (
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {state === "ready" && (
            <p style={{ fontSize: "11px", color: "#AAA", margin: "12px 0 0", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "10px" }}>
              Updated based on what&apos;s in your trip vault
            </p>
          )}
        </div>
      </div>
    </>
  );
}
