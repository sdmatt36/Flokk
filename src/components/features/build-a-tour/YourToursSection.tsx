"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";

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
  loadingTours: boolean;
  onLoadTour: (id: string) => void;
  onDelete: (id: string) => void;
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";

const DESTINATION_DISPLAY_OVERRIDES: Record<string, string> = {
  "Naha, Japan": "Okinawa, Japan",
};

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

function truncateAtWord(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export default function YourToursSection({ savedTours, loadingTours, onLoadTour, onDelete }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deletingTourId, setDeletingTourId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Groups sorted by most-recently-created tour first
  const groups = Object.entries(savedTours).sort(([, a], [, b]) =>
    new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime()
  );

  const totalCount = groups.reduce((n, [, tours]) => n + tours.length, 0);

  if (loadingTours) return null;

  if (totalCount === 0) {
    return (
      <div style={{ marginTop: "64px" }}>
        <p style={{ fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>
          No tours yet. Build your first one above.
        </p>
      </div>
    );
  }

  // Collapse to 3 in unfiltered view unless expanded
  const visibleGroups = selectedKey ? groups : (showAll ? groups : groups.slice(0, 3));
  const activeGroup = selectedKey ? groups.find(([k]) => k === selectedKey) : null;
  const displayedCards = activeGroup
    ? activeGroup[1].map((tour) => ({ type: "tour" as const, groupKey: activeGroup[0], tour }))
    : visibleGroups.map(([groupKey, tours]) => ({ type: "destination" as const, groupKey, tours }));

  const tourToDelete = deletingTourId
    ? Object.values(savedTours).flat().find(t => t.id === deletingTourId) ?? null
    : null;

  async function handleDeleteConfirm() {
    if (!deletingTourId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tours/${deletingTourId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDelete(deletingTourId);
      setDeletingTourId(null);
    } catch {
      toast.error("Couldn't delete. Try again?");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "64px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "#C4664A", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
            YOUR TOURS
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.2 }}>
            Picking up where you left off
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
                {DESTINATION_DISPLAY_OVERRIDES[tours[0].destinationDisplayName] ?? tours[0].destinationDisplayName} ({tours.length})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAll(true)}
            style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", padding: 0 }}
          >
            See all →
          </button>
        </div>
      </div>

      {/* Card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {displayedCards.map((item) => {
          if (item.type === "destination") {
            const { groupKey, tours } = item;
            const dest = tours[0];
            const coverImage = dest.coverImage ?? FALLBACK_IMAGE;
            const displayName = DESTINATION_DISPLAY_OVERRIDES[dest.destinationDisplayName] ?? dest.destinationDisplayName;
            const lastTitle = dest.title ? truncateAtWord(dest.title, 38) : null;
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
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)" }} />
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
                <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color: "white", margin: "0 0 4px", lineHeight: 1.2 }}>
                    {displayName}
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.95)", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                    {subtitle}
                  </p>
                </div>
              </div>
            );
          }

          // Individual tour card (filtered view)
          const { tour } = item;
          const coverImage = tour.coverImage ?? FALLBACK_IMAGE;
          const isHovered = hoveredCardId === tour.id;
          return (
            <div
              key={tour.id}
              onMouseEnter={() => setHoveredCardId(tour.id)}
              onMouseLeave={() => setHoveredCardId(null)}
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

              {/* Delete button — hover-reveal, always visible on touch */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeletingTourId(tour.id); }}
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 32, height: 32,
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.15s",
                  zIndex: 2,
                }}
                aria-label="Delete tour"
              >
                <X size={16} color="white" />
              </button>

              {/* Clickable overlay to load tour */}
              <div
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
                onClick={() => onLoadTour(tour.id)}
              />

              {/* Bottom content */}
              <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px", pointerEvents: "none" }}>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 700, color: "white", margin: "0 0 4px", lineHeight: 1.2 }}>
                  {tour.title || "Untitled tour"}
                </p>
                <p style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.95)", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                  {tour.stopCount} stops · {tour.transport} · {relativeDate(tour.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapse/expand CTA — only in unfiltered destination view when > 3 groups */}
      {!selectedKey && groups.length > 3 && (
        <div style={{ textAlign: "center", paddingTop: "16px" }}>
          {showAll ? (
            <button
              onClick={() => setShowAll(false)}
              style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, system-ui, sans-serif", padding: "12px 0" }}
            >
              Show less ↑
            </button>
          ) : (
            <button
              onClick={() => setShowAll(true)}
              style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, system-ui, sans-serif", padding: "12px 0" }}
            >
              Show all {groups.length} destinations →
            </button>
          )}
        </div>
      )}

      {/* Back link when filtered */}
      {selectedKey && (
        <button
          onClick={() => setSelectedKey(null)}
          style={{ marginTop: "12px", fontSize: "13px", color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}
        >
          ← All destinations
        </button>
      )}

      {/* Delete confirmation modal */}
      {deletingTourId && (
        <div
          className={MODAL_OVERLAY_CLASSES}
          onClick={() => { if (!deleteLoading) setDeletingTourId(null); }}
        >
          <div
            className={MODAL_PANEL_CLASSES}
            style={{ maxWidth: "440px", padding: "32px 28px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
              Are You Flokkin Sure?
            </h2>
            <p style={{ fontSize: "15px", color: "#555", lineHeight: 1.6, margin: "0 0 28px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
              This will permanently delete &quot;{tourToDelete?.title || "this tour"}&quot;. This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDeletingTourId(null)}
                disabled={deleteLoading}
                style={{ padding: "10px 20px", color: "#555", background: "none", border: "none", fontWeight: 500, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                style={{
                  padding: "10px 24px",
                  background: "#C4664A",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  opacity: deleteLoading ? 0.7 : 1,
                  fontFamily: "inherit",
                  transition: "opacity 0.15s",
                }}
              >
                {deleteLoading ? "Deleting…" : "Delete tour"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
