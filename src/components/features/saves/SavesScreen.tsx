"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { getItemImage } from "@/lib/destination-images";
import {
  Search,
  MapPin,
  Navigation,
  Bookmark,
  Plus,
  Calendar,
  X,
  Plane,
  Trash2,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

type Save = {
  id: string;
  title: string;
  location: string;
  source: string;
  tags: string[];
  assigned: string | null;
  tripId: string | null;
  dayIndex: number | null;
  distance: string | null;
  img: string | null;
};

const FILTER_PILLS = ["All", "Culture", "Food", "Kids", "Lodging", "Outdoor", "Shopping", "Transportation", "Unorganized"];

type ApiItem = {
  id: string;
  rawTitle: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  sourceType: string;
  savedAt: string;
  tripId: string | null;
  dayIndex: number | null;
  trip: { id: string; title: string } | null;
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
  MANUAL: "Manually added", IN_APP: "In-app", EMAIL_IMPORT: "Email", PHOTO_IMPORT: "Photo",
};

function resolveTitle(rawTitle: string | null, city: string | null): string {
  if (!rawTitle) return "Saved place";
  if (rawTitle.startsWith("http")) {
    return city ? `Place in ${city}` : "Saved place";
  }
  return rawTitle;
}

function mapApiItem(item: ApiItem): Save {
  return {
    id: item.id,
    title: resolveTitle(item.rawTitle, item.destinationCity),
    location: [item.destinationCity, item.destinationCountry].filter(Boolean).join(", "),
    source: SOURCE_LABEL_MAP[item.sourceType] ?? item.sourceType,
    tags: item.categoryTags,
    assigned: item.trip?.title ?? null,
    tripId: item.tripId ?? null,
    dayIndex: item.dayIndex ?? null,
    distance: null,
    img: getItemImage(item.mediaThumbnailUrl, item.categoryTags[0] ?? null, item.destinationCity, item.destinationCountry),
  };
}

// ─── SaveCard ─────────────────────────────────────────────────────────────────

type SaveCardProps = {
  save: Save;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string }[];
  onDeleted?: (id: string) => void;
};

function SaveCard({ save, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted }: SaveCardProps) {
  const visibleTags = save.tags.slice(0, 3);
  const extraTags = save.tags.length - visibleTags.length;
  const isDropdownOpen = openDropdown === save.id;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Remove this save?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/saves/${save.id}`, { method: "DELETE" });
      if (res.ok) onDeleted?.(save.id);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div onClick={() => onCardClick(save.id)} style={{ cursor: "pointer" }}>
    <div
      className="group"
      style={{
        backgroundColor: "#FAFAFA",
        borderRadius: "12px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-gray-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 opacity-100"
        style={{ padding: "5px", lineHeight: 0, cursor: deleting ? "default" : "pointer" }}
      >
        <Trash2 size={13} style={{ color: deleting ? "#ccc" : "#9ca3af" }} />
      </button>

      {/* Thumbnail */}
      {save.img ? (
        <div
          style={{
            height: "130px",
            backgroundImage: `url(${save.img})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "6px",
              left: "8px",
              backgroundColor: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "20px",
            }}
          >
            {save.source}
          </div>
        </div>
      ) : (
        <div
          style={{
            height: "130px",
            backgroundColor: "#f1f5f9",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
            {save.tags[0] ?? "Saved place"}
          </span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: "12px" }}>
        {/* Title */}
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: "2px",
            lineHeight: 1.3,
          }}
        >
          {save.title}
        </p>

        {/* Location */}
        {save.location && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              marginBottom: "6px",
            }}
          >
            <MapPin size={10} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#717171" }}>{save.location}</span>
          </div>
        )}

        {/* Itinerary badge */}
        {save.dayIndex != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#4a7c59", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#4a7c59", fontWeight: 600 }}>On itinerary</span>
          </div>
        )}

        {/* Tags */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            marginBottom: "8px",
          }}
        >
          {visibleTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "11px",
                backgroundColor: "rgba(0,0,0,0.05)",
                color: "#666",
                borderRadius: "20px",
                padding: "2px 8px",
              }}
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "rgba(0,0,0,0.05)",
                color: "#666",
                borderRadius: "20px",
                padding: "2px 8px",
              }}
            >
              +{extraTags} more
            </span>
          )}
        </div>

        {/* Assignment row */}
        <div style={{ position: "relative" }}>
          {save.assigned ? (
            <div
              onClick={(e) => { e.stopPropagation(); onTripClick(save.assigned!); }}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
            >
              <Calendar size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: "#C4664A", fontWeight: 500 }}>
                {save.assigned}
              </span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdown(isDropdownOpen ? null : save.id);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: "11px",
                color: "#C4664A",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <Plus size={11} style={{ color: "#C4664A" }} />
              Assign to trip
            </button>
          )}

          {/* Dropdown */}
          {isDropdownOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                backgroundColor: "#fff",
                border: "1px solid rgba(0,0,0,0.1)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                borderRadius: "8px",
                zIndex: 50,
                minWidth: "180px",
                overflow: "hidden",
              }}
            >
              {[...availableTrips.map(t => t.title), "+ Create new trip"].map((trip, idx) => (
                <button
                  key={trip}
                  onClick={(e) => {
                    e.stopPropagation();
                    assignTrip(save.id, trip);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: trip === "+ Create new trip" ? "#C4664A" : "#1a1a1a",
                    fontWeight: trip === "+ Create new trip" ? 600 : 400,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: idx < availableTrips.length ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFFFFF";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  {trip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Distance */}
        {save.distance && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              marginTop: "4px",
            }}
          >
            <Navigation size={10} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#717171" }}>{save.distance}</span>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge, count, action }: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  count: number;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {icon}
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{title}</span>
        {badge && <span style={{ fontSize: "14px" }}>{badge}</span>}
        <span style={{ fontSize: "12px", color: "#717171" }}>{count} {count === 1 ? "save" : "saves"}</span>
      </div>
      {action && (
        <button onClick={action.onClick} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#C4664A", fontWeight: 600, padding: 0, flexShrink: 0 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── CardGrid ─────────────────────────────────────────────────────────────────

function CardGrid({ cards, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted }: {
  cards: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string }[];
  onDeleted?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: "16px" }}>
      {cards.map((save) => (
        <SaveCard key={save.id} save={save} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={onTripClick} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} />
      ))}
    </div>
  );
}

// ─── SavesScreen ──────────────────────────────────────────────────────────────

export function SavesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [saves, setSaves] = useState<Save[]>([]);
  const [availableTrips, setAvailableTrips] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showFabModal, setShowFabModal] = useState(false);
  const [fabUrl, setFabUrl] = useState("");
  const [modalItemId, setModalItemId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/saves").then(r => r.json()),
      fetch("/api/trips").then(r => r.json()),
    ]).then(([savesData, tripsData]) => {
      setSaves((savesData.saves ?? []).map(mapApiItem));
      setAvailableTrips(tripsData.trips ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const unorganizedCount = saves.filter((s) => s.assigned === null).length;

  const assignTrip = (id: string, tripTitle: string) => {
    if (tripTitle === "+ Create new trip") { setOpenDropdown(null); return; }
    const trip = availableTrips.find(t => t.title === tripTitle);
    setSaves((prev) => prev.map((s) => (s.id === id ? { ...s, assigned: tripTitle } : s)));
    setOpenDropdown(null);
    if (trip) {
      fetch(`/api/saves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      }).catch(() => {/* silent */});
    }
  };

  const handleTagsUpdated = (itemId: string, tags: string[]) => {
    setSaves((prev) => prev.map((s) => (s.id === itemId ? { ...s, tags } : s)));
  };

  const handleItemDeleted = (deletedId: string) => {
    setSaves((prev) => prev.filter((s) => s.id !== deletedId));
  };

  // Card matching: search + category filter (ignores assigned/unassigned axis)
  const matchesFilter = (s: Save): boolean => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeFilter === "All" || activeFilter === "Unorganized"
        ? true
        : s.tags.some((t) => t.toLowerCase().includes(activeFilter.toLowerCase()));
    return matchesSearch && matchesCategory;
  };

  // Trip section: hidden when "Unorganized" filter active
  const tripCards = activeFilter === "Unorganized"
    ? []
    : saves.filter((s) => s.assigned !== null && matchesFilter(s)).sort((a, b) => a.title.localeCompare(b.title));

  // Group assigned cards by trip name (each group is already sorted)
  const tripGroups = tripCards.reduce<Record<string, Save[]>>((acc, s) => {
    const key = s.assigned!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Unorganized section sorted alphabetically
  const unorganizedCards = saves
    .filter((s) => s.assigned === null && matchesFilter(s))
    .sort((a, b) => a.title.localeCompare(b.title));
  const showUnorganized = activeFilter !== "All"
    ? unorganizedCards.length > 0  // category or unorganized filter
    : unorganizedCards.length > 0; // "All" — always show if there are any

  const tripGroupEntries = Object.entries(tripGroups);
  const hasNoResults = tripGroupEntries.length === 0 && unorganizedCards.length === 0;

  // Flag emoji per destination (expandable)
  const TRIP_FLAGS: Record<string, string> = {};

  return (
    <div
      onClick={() => setOpenDropdown(null)}
      style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", padding: "24px", paddingBottom: "100px" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* TOP BAR */}
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", fontFamily: "'Playfair Display', Georgia, serif" }}>
            Your saves
          </h1>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>
Your saved places, all in one spot
          </p>
          {/* Search bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.1)", padding: "0 14px", height: "44px" }}>
            <Search size={16} style={{ color: "#717171", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search saves..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#1a1a1a", backgroundColor: "transparent" }}
            />
            {search.length > 0 && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={14} style={{ color: "#717171" }} />
              </button>
            )}
          </div>
        </div>

        {/* ACTIVE TRIP BANNER — only shown when the user has a trip */}
        {availableTrips.length > 0 && (() => {
          const activeTrip = availableTrips[0];
          const unassignedCount = saves.filter((s) => s.assigned === null).length;
          return (
            <div style={{ backgroundColor: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapPin size={14} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Planning {activeTrip.title}</span>
                </div>
                <button onClick={() => router.push(`/trips/${activeTrip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#C4664A", fontWeight: 600, padding: 0 }}>
                  Review now →
                </button>
              </div>
              {unassignedCount > 0 && (
                <p style={{ fontSize: "12px", color: "#717171", marginTop: "4px", marginLeft: "20px" }}>
                  You have {unassignedCount} unorganized {unassignedCount === 1 ? "save" : "saves"} — review them for this trip?
                </p>
              )}
            </div>
          );
        })()}

        {/* FILTER STRIP */}
        <div style={{ display: "flex", overflowX: "auto", gap: "8px", marginBottom: "24px", paddingBottom: "4px", scrollbarWidth: "none" }}>
          {FILTER_PILLS.map((pill) => {
            const isActive = activeFilter === pill;
            return (
              <button
                key={pill}
                onClick={(e) => { e.stopPropagation(); setActiveFilter(pill); }}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "5px", padding: "7px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "#717171", backgroundColor: isActive ? "#C4664A" : "#fff", border: isActive ? "none" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", transition: "all 0.15s ease" }}
              >
                {pill}
                {pill === "Unorganized" && unorganizedCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "18px", height: "18px", borderRadius: "999px", backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "#C4664A", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "0 4px" }}>
                    {unorganizedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SECTIONS */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#999", fontSize: "14px" }}>
            Loading your saves…
          </div>
        )}

        {hasNoResults && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#717171", fontSize: "14px" }}>
            No saves match your search or filter.
          </div>
        )}

        {/* SECTION 1: Trip-grouped saves */}
        {tripGroupEntries.map(([tripName, cards]) => {
          const matchedTrip = availableTrips.find((t) => t.title === tripName);
          const handleViewTrip = () => { if (matchedTrip) router.push(`/trips/${matchedTrip.id}`); };
          return (
            <div key={tripName} style={{ marginBottom: "32px" }}>
              <SectionHeader
                icon={<Plane size={16} style={{ color: "#C4664A" }} />}
                title={tripName}
                badge={TRIP_FLAGS[tripName]}
                count={cards.length}
                action={matchedTrip ? { label: "View trip →", onClick: handleViewTrip } : undefined}
              />
              <CardGrid cards={cards} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={handleViewTrip} onCardClick={(id) => setModalItemId(id)} availableTrips={availableTrips} onDeleted={handleItemDeleted} />
            </div>
          );
        })}

        {/* SECTION 2: Unorganized saves */}
        {showUnorganized && (
          <div>
            <SectionHeader
              icon={<Bookmark size={16} style={{ color: "#C4664A" }} />}
              title="Not yet assigned"
              count={unorganizedCards.length}
              action={{ label: "Assign all →", onClick: () => setActiveFilter("Unorganized") }}
            />
            <CardGrid cards={unorganizedCards} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={(name) => { const t = availableTrips.find((tr) => tr.title === name); if (t) router.push(`/trips/${t.id}`); }} onCardClick={(id) => setModalItemId(id)} availableTrips={availableTrips} onDeleted={handleItemDeleted} />
          </div>
        )}

      </div>

      {/* Save detail modal */}
      {modalItemId && (
        <SaveDetailModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
          onTagsUpdated={handleTagsUpdated}
        />
      )}

      {/* FAB MODAL */}
      {showFabModal && (
        <div
          onClick={() => { setShowFabModal(false); setFabUrl(""); }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "16px",
              width: "360px",
              maxWidth: "calc(100vw - 48px)",
            }}
          >
            <p
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#1a1a1a",
                marginBottom: "16px",
              }}
            >
              Save something new
            </p>
            <input
              type="url"
              value={fabUrl}
              onChange={(e) => setFabUrl(e.target.value)}
              placeholder="Paste a URL or Instagram link..."
              style={{
                display: "block",
                width: "100%",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "14px",
                color: "#1a1a1a",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowFabModal(false); setFabUrl(""); }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "999px",
                  border: "1px solid rgba(0,0,0,0.15)",
                  backgroundColor: "transparent",
                  color: "#717171",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowFabModal(false); setFabUrl(""); }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#C4664A",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowFabModal(true)}
        title="Save something new"
        style={{
          position: "fixed",
          bottom: 88,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#C4664A",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(196,102,74,0.4)",
          cursor: "pointer",
          transition: "transform 0.15s ease",
          zIndex: 90,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Plus size={24} style={{ color: "#fff" }} />
      </button>

    </div>
  );
}
