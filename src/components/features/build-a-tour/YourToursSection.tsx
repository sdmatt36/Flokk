"use client";

import { useState } from "react";
import { TourActionMenu } from "@/components/tours/TourActionMenu";

type SavedTourEntry = {
  id: string;
  title: string;
  createdAt: string;
  stopCount: number;
  transport: string;
  destinationCountry: string | null;
  destinationDisplayName: string;
  coverImage: string | null;
};

type Props = {
  savedTours: Record<string, SavedTourEntry[]>;
  onLoadTour: (id: string) => void;
  onDelete: (id: string) => void;
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

export default function YourToursSection({ savedTours, onLoadTour, onDelete }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // All groups sorted alphabetically by display name
  const groups = Object.entries(savedTours).sort(([, a], [, b]) =>
    a[0].destinationDisplayName.localeCompare(b[0].destinationDisplayName)
  );

  const totalCount = groups.reduce((n, [, tours]) => n + tours.length, 0);

  if (totalCount === 0) {
    return (
      <div className="mt-6">
        <p style={{ fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>
          No tours yet. Build your first one above.
        </p>
      </div>
    );
  }

  const activeGroup = selectedKey ? groups.find(([k]) => k === selectedKey) : null;
  const displayedCards = activeGroup
    ? activeGroup[1].map((tour) => ({ type: "tour" as const, groupKey: activeGroup[0], tour }))
    : groups.map(([groupKey, tours]) => ({ type: "destination" as const, groupKey, tours }));

  return (
    <div style={{ marginTop: "24px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "#C4664A", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
            YOUR TOURS
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}>
            Picking up where you left off
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <select
            value={selectedKey ?? ""}
            onChange={(e) => setSelectedKey(e.target.value || null)}
            style={{
              padding: "9px 14px",
              border: "1px solid #E0E0E0",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "DM Sans, system-ui, sans-serif",
              color: "#1B3A5C",
              background: "white",
              minWidth: "200px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All destinations ({totalCount})</option>
            {groups.map(([groupKey, tours]) => (
              <option key={groupKey} value={groupKey}>
                {tours[0].destinationDisplayName} ({tours.length})
              </option>
            ))}
          </select>
          <a href="#" style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}>
            See all →
          </a>
        </div>
      </div>

      {/* Card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {displayedCards.map((item) => {
          if (item.type === "destination") {
            const { groupKey, tours } = item;
            const dest = tours[0];
            const coverImage = dest.coverImage ?? FALLBACK_IMAGE;
            const lastTitle = dest.title ? truncate(dest.title, 30) : null;
            const subtitle = lastTitle ? `Last: ${lastTitle}` : `Last tour: ${relativeDate(dest.createdAt)}`;
            return (
              <div
                key={groupKey}
                onClick={() => setSelectedKey(groupKey)}
                style={{
                  position: "relative",
                  aspectRatio: "4/3",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  backgroundImage: `url(${coverImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3EDE3",
                }}
              >
                {/* Gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)" }} />

                {/* Tour count chip */}
                <div style={{
                  position: "absolute", top: "10px", left: "10px",
                  padding: "4px 10px",
                  background: "rgba(27,58,92,0.92)",
                  borderRadius: "14px",
                  fontSize: "11px", fontWeight: 500, color: "white",
                  fontFamily: "DM Sans, system-ui, sans-serif",
                }}>
                  {tours.length} {tours.length === 1 ? "tour" : "tours"}
                </div>

                {/* Bottom content */}
                <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 700, color: "white", margin: "0 0 2px", lineHeight: 1.2 }}>
                    {dest.destinationDisplayName}
                  </p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.9)", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                    {subtitle}
                  </p>
                </div>
              </div>
            );
          }

          // Individual tour card
          const { groupKey, tour } = item;
          const coverImage = tour.coverImage ?? FALLBACK_IMAGE;
          return (
            <div
              key={tour.id}
              style={{
                position: "relative",
                aspectRatio: "4/3",
                borderRadius: "12px",
                overflow: "hidden",
                cursor: "pointer",
                backgroundImage: `url(${coverImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#F3EDE3",
              }}
            >
              {/* Gradient overlay */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)" }} />

              {/* Stop count chip */}
              <div style={{
                position: "absolute", top: "10px", left: "10px",
                padding: "4px 10px",
                background: "rgba(27,58,92,0.92)",
                borderRadius: "14px",
                fontSize: "11px", fontWeight: 500, color: "white",
                fontFamily: "DM Sans, system-ui, sans-serif",
              }}>
                {tour.stopCount} stops
              </div>

              {/* Action menu — top right */}
              <div style={{ position: "absolute", top: "8px", right: "8px" }} onClick={(e) => e.stopPropagation()}>
                <TourActionMenu tourId={tour.id} onDelete={onDelete} anchorPosition="pill" />
              </div>

              {/* Clickable overlay to load tour */}
              <div
                style={{ position: "absolute", inset: 0 }}
                onClick={() => onLoadTour(tour.id)}
              />

              {/* Bottom content */}
              <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px", pointerEvents: "none" }}>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 700, color: "white", margin: "0 0 2px", lineHeight: 1.2 }}>
                  {tour.title || "Untitled tour"}
                </p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.9)", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                  {tour.stopCount} stops · {tour.transport} · {relativeDate(tour.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Back link when filtered */}
      {selectedKey && (
        <button
          onClick={() => setSelectedKey(null)}
          style={{ marginTop: "12px", fontSize: "13px", color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}
        >
          ← All destinations
        </button>
      )}
    </div>
  );
}
