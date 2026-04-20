"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { getItemImage } from "@/lib/destination-images";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import {
  Search,
  MapPin,
  Navigation,
  Bookmark,
  Plus,
  X,
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
  needsPlaceConfirmation: boolean;
  userRating?: number | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  communitySpotId: string | null;
};

type PlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
};


type ApiItem = {
  id: string;
  rawTitle: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  sourceType: string;
  savedAt: string;
  tripId: string | null;
  dayIndex: number | null;
  trip: { id: string; title: string } | null;
  needsPlaceConfirmation: boolean;
  userRating?: number | null;
  communitySpotId: string | null;
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
    img: getItemImage(item.rawTitle, item.placePhotoUrl, item.mediaThumbnailUrl, item.categoryTags[0] ?? null, item.destinationCity, item.destinationCountry),
    needsPlaceConfirmation: item.needsPlaceConfirmation ?? false,
    userRating: item.userRating ?? undefined,
    destinationCity: item.destinationCity ?? null,
    destinationCountry: item.destinationCountry ?? null,
    communitySpotId: item.communitySpotId ?? null,
  };
}

// ─── Tabbed saves types ───────────────────────────────────────────────────────

type TripRow = {
  id: string;
  title: string;
  destinationCity: string | null;
  cities: string[];
  country: string | null;
  countries: string[];
  startDate: string | null;
  endDate: string | null;
};

interface UpcomingTripSection {
  tripId: string;
  tripName: string;
  destinationCity: string | null;
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  explicitSaves: Save[];
  suggestedSaves: Save[];
}

interface PastCitySection {
  city: string;
  saves: Save[];
}

interface TabbedSavesState {
  upcoming: UpcomingTripSection[];
  past: PastCitySection[];
  unassigned: Save[];
  counts: { upcoming: number; past: number; unassigned: number };
  suggestedTripMap: Map<string, Array<{ id: string; name: string }>>;
}

type SharedCardGridProps = {
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
};

function formatTripDateRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const monthFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (!endIso) return start.toLocaleDateString("en-US", monthFmt);
  const end = new Date(endIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}`;
  }
  return `${start.toLocaleDateString("en-US", monthFmt)} – ${end.toLocaleDateString("en-US", monthFmt)}`;
}

function groupTabbedSaves(saves: Save[], allTrips: TripRow[]): TabbedSavesState {
  const now = new Date();

  const upcomingTrips = allTrips
    .filter((t) => !t.endDate || new Date(t.endDate) >= now)
    .sort((a, b) => {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  const pastTrips = allTrips.filter((t) => t.endDate && new Date(t.endDate) < now);
  const pastTripIds = new Set(pastTrips.map((t) => t.id));

  // Build past city set from cities[] array, falling back to destinationCity
  const pastTripCities = new Set<string>();
  for (const t of pastTrips) {
    const cityList = t.cities.length > 0 ? t.cities : (t.destinationCity ? [t.destinationCity] : []);
    for (const c of cityList) {
      const key = c.trim().toLowerCase();
      if (key) pastTripCities.add(key);
    }
  }

  // Build past country set from countries[] (falls back to country for legacy rows)
  const pastTripCountries = new Set<string>();
  for (const t of pastTrips) {
    const tripCountries = (t.countries && t.countries.length > 0)
      ? t.countries
      : (t.country ? [t.country] : []);
    for (const c of tripCountries) {
      const key = c.trim().toLowerCase();
      if (key) pastTripCountries.add(key);
    }
  }

  // Build upcoming city index: city key → [tripId, ...]
  const upcomingCityIndex = new Map<string, string[]>();
  for (const t of upcomingTrips) {
    const cityList = t.cities.length > 0 ? t.cities : (t.destinationCity ? [t.destinationCity] : []);
    for (const c of cityList) {
      const key = c.trim().toLowerCase();
      if (!key) continue;
      const existing = upcomingCityIndex.get(key) ?? [];
      existing.push(t.id);
      upcomingCityIndex.set(key, existing);
    }
  }

  // Build upcoming country index: country key → [tripId, ...] — iterates countries[] with fallback to country
  const upcomingCountryIndex = new Map<string, string[]>();
  for (const t of upcomingTrips) {
    const tripCountries = (t.countries && t.countries.length > 0)
      ? t.countries
      : (t.country ? [t.country] : []);
    for (const c of tripCountries) {
      const key = c.trim().toLowerCase();
      if (!key) continue;
      const existing = upcomingCountryIndex.get(key) ?? [];
      if (!existing.includes(t.id)) existing.push(t.id);
      upcomingCountryIndex.set(key, existing);
    }
  }

  const upcomingSections: UpcomingTripSection[] = upcomingTrips.map((t) => ({
    tripId: t.id,
    tripName: t.title,
    destinationCity: t.destinationCity,
    cities: t.cities,
    startDate: t.startDate,
    endDate: t.endDate,
    explicitSaves: [],
    suggestedSaves: [],
  }));
  const upcomingTripIndex = new Map(upcomingSections.map((s) => [s.tripId, s]));

  const pastCityMap = new Map<string, Save[]>();
  const unassigned: Save[] = [];
  const suggestedTripMap = new Map<string, Array<{ id: string; name: string }>>();

  for (const save of saves) {
    const cityKey = (save.destinationCity ?? "").trim().toLowerCase();
    const countryKey = (save.destinationCountry ?? "").trim().toLowerCase();

    if (save.tripId && upcomingTripIndex.has(save.tripId)) {
      upcomingTripIndex.get(save.tripId)!.explicitSaves.push(save);
      continue;
    }

    if (save.tripId && pastTripIds.has(save.tripId)) {
      const city = save.destinationCity ?? "Unknown";
      const list = pastCityMap.get(city) ?? [];
      list.push(save);
      pastCityMap.set(city, list);
      continue;
    }

    if (!save.tripId) {
      // Try city match first (cities[] array)
      if (cityKey) {
        const upcomingCityMatches = upcomingCityIndex.get(cityKey) ?? [];
        if (upcomingCityMatches.length > 0) {
          for (const tripId of upcomingCityMatches) {
            upcomingTripIndex.get(tripId)!.suggestedSaves.push(save);
          }
          const options = upcomingCityMatches.map((tid) => ({
            id: tid,
            name: upcomingTripIndex.get(tid)!.tripName,
          }));
          suggestedTripMap.set(save.id, options);
          continue;
        }
        if (pastTripCities.has(cityKey)) {
          const city = save.destinationCity ?? "Unknown";
          const list = pastCityMap.get(city) ?? [];
          list.push(save);
          pastCityMap.set(city, list);
          continue;
        }
      }

      // Fallback: country match (Trip.country vs Save.destinationCountry)
      if (countryKey) {
        const upcomingCountryMatches = upcomingCountryIndex.get(countryKey) ?? [];
        if (upcomingCountryMatches.length > 0) {
          for (const tripId of upcomingCountryMatches) {
            upcomingTripIndex.get(tripId)!.suggestedSaves.push(save);
          }
          const options = upcomingCountryMatches.map((tid) => ({
            id: tid,
            name: upcomingTripIndex.get(tid)!.tripName,
          }));
          suggestedTripMap.set(save.id, options);
          continue;
        }
        if (pastTripCountries.has(countryKey)) {
          const city = save.destinationCity ?? "Unknown";
          const list = pastCityMap.get(city) ?? [];
          list.push(save);
          pastCityMap.set(city, list);
          continue;
        }
      }
    }

    unassigned.push(save);
  }

  for (const section of upcomingSections) {
    section.explicitSaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    section.suggestedSaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }

  const pastSections: PastCitySection[] = Array.from(pastCityMap.entries())
    .map(([city, citySaves]) => ({
      city,
      saves: citySaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));

  unassigned.sort((a, b) => {
    const cityA = (a.destinationCity ?? "").toLowerCase();
    const cityB = (b.destinationCity ?? "").toLowerCase();
    if (cityA !== cityB) {
      if (!cityA) return 1;
      if (!cityB) return -1;
      return cityA.localeCompare(cityB);
    }
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return {
    upcoming: upcomingSections,
    past: pastSections,
    unassigned,
    counts: {
      upcoming: upcomingSections.reduce((sum, s) => sum + s.explicitSaves.length + s.suggestedSaves.length, 0),
      past: pastSections.reduce((sum, s) => sum + s.saves.length, 0),
      unassigned: unassigned.length,
    },
    suggestedTripMap,
  };
}

// ─── ShareActivityButton ──────────────────────────────────────────────────────

function ShareActivityButton({ communitySpotId }: { communitySpotId: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!communitySpotId) return null;
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        const url = `${window.location.origin}/places/${communitySpotId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.warn("Clipboard copy failed", err);
        }
      }}
      style={{
        fontSize: 11,
        color: "#C4664A",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {copied ? "Copied!" : "Share activity"}
    </button>
  );
}

// ─── SaveCard ─────────────────────────────────────────────────────────────────

type SaveCardProps = {
  save: Save;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onAssignCity?: (id: string) => void;
  suggestedForOptions?: Array<{ id: string; name: string }>;
  onAddToTrip?: (saveId: string, options: Array<{ id: string; name: string }>) => void;
  onGrowTripCity?: (saveId: string) => void;
  growTripCityLabel?: string;
  cardContext?: "upcoming_explicit" | "past";
};

function SaveCard({ save, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId, onAssignCity, suggestedForOptions, onAddToTrip, onGrowTripCity, growTripCityLabel, cardContext }: SaveCardProps) {
  const filteredTags = save.tags.filter(t => {
    if (t.toLowerCase() === "other" && save.tags.some(t2 =>
      !["other", "vg", "vgn"].includes(t2.toLowerCase()) && t2.toLowerCase() !== t.toLowerCase()
    )) return false;
    return true;
  });
  const visibleTags = filteredTags.slice(0, 3);
  const extraTags = filteredTags.length - visibleTags.length;
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
    <div id={`save-${save.id}`} onClick={() => onCardClick(save.id)} style={{ cursor: "pointer" }}>
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
          {(save.tags.includes("VGN") || save.tags.includes("VG")) && (
            <div
              style={{
                position: "absolute",
                bottom: "6px",
                right: "8px",
                backgroundColor: "#16a34a",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {save.tags.includes("VGN") ? "VGN" : "VG"}
            </div>
          )}
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
            {categoryLabel(filteredTags[0]) || "Saved place"}
          </span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: "12px" }}>
        {/* Suggested badge */}
        {suggestedForOptions && suggestedForOptions.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", backgroundColor: "rgba(196,102,74,0.1)", borderRadius: "4px", padding: "2px 6px", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.04em" }}>Suggested</span>
          </div>
        )}

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

        {/* Place identification prompt */}
        {save.needsPlaceConfirmation && onIdentifyPlace && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#999" }}>What place is this?</span>
            <button
              onClick={(e) => { e.stopPropagation(); onIdentifyPlace(save.id); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "11px", color: "#C4664A", fontWeight: 600, fontFamily: "inherit" }}
            >
              Identify place →
            </button>
          </div>
        )}

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
              {categoryLabel(tag)}
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
        {cardContext === "past" ? (
          <ShareActivityButton communitySpotId={save.communitySpotId} />
        ) : (
          <div style={{ position: "relative" }}>
            {save.tripId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <a
                  href={`/trips/${save.tripId}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, color: "#fff", backgroundColor: "#C4664A", borderRadius: "999px", padding: "2px 8px", textDecoration: "none" }}
                >
                  {save.assigned ?? "Trip assigned"}
                </a>
                {cardContext === "upcoming_explicit" && (
                  <ShareActivityButton communitySpotId={save.communitySpotId} />
                )}
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
                  maxHeight: "280px",
                  overflowY: "auto",
                }}
              >
                {(() => {
                  const todayStr = new Date().toISOString();
                  // TODO: move isPlacesLibrary filter server-side in a future cleanup prompt
                  const upcoming = availableTrips.filter(t => !t.endDate || t.endDate >= todayStr);
                  const past = availableTrips.filter(t => t.endDate && t.endDate < todayStr);
                  const tripBtn = (title: string, key: string, isLast: boolean) => (
                    <button
                      key={key}
                      onClick={(e) => { e.stopPropagation(); assignTrip(save.id, title); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: "13px", color: "#1a1a1a", fontWeight: 400, background: "none", border: "none", cursor: "pointer", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F9F9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                    >
                      {title}
                    </button>
                  );
                  return (
                    <>
                      {upcoming.map((t, i) => tripBtn(t.title, t.id, i === upcoming.length - 1 && past.length === 0))}
                      {past.length > 0 && (
                        <>
                          <div style={{ padding: "5px 14px", fontSize: "11px", fontWeight: 600, color: "#AAAAAA", backgroundColor: "#F9F9F9", borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            Past trips
                          </div>
                          {past.map((t, i) => tripBtn(t.title, t.id, i === past.length - 1))}
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); assignTrip(save.id, "+ Create new trip"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: "13px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.06)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F9F9"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      >
                        + Create new trip
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

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

        {/* Rate it */}
        {!save.tags.some(t => t.toLowerCase() === "lodging") && onRateClick && (
          <div style={{ marginTop: "8px" }}>
            {ratedItemId === save.id || save.userRating ? (
              <div style={{ display: "flex", gap: "2px" }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} style={{ color: i <= (save.userRating ?? 0) ? "#f59e0b" : "#d1d5db", fontSize: "14px" }}>★</span>
                ))}
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onRateClick(save.id, save.title); }}
                style={{ background: "none", border: "1px solid #d1d5db", borderRadius: "999px", padding: "3px 10px", fontSize: "11px", color: "#717171", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                ★ Rate it
              </button>
            )}
          </div>
        )}

        {/* Assign location */}
        {onAssignCity && (
          <div style={{ marginTop: "8px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAssignCity(save.id); }}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: "999px", padding: "3px 10px", fontSize: "11px", color: "#717171", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              Assign location
            </button>
          </div>
        )}

        {/* Grow-trip-city CTA — single-match save where city not yet in trip */}
        {onGrowTripCity && growTripCityLabel && (
          <div style={{ marginTop: "8px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onGrowTripCity(save.id); }}
              style={{ background: "#C4664A", border: "none", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              {growTripCityLabel}
            </button>
          </div>
        )}

        {/* Add to trip — for suggested saves */}
        {onAddToTrip && suggestedForOptions && suggestedForOptions.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTrip(save.id, suggestedForOptions); }}
              style={{ background: "#C4664A", border: "none", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              + Add to trip
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge, count, action }: {
  icon?: React.ReactNode;
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

function CardGrid({ cards, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId, onAssignCity }: {
  cards: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onAssignCity?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: "16px" }}>
      {cards.map((save) => (
        <SaveCard key={save.id} save={save} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={onTripClick} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} onIdentifyPlace={onIdentifyPlace} onRateClick={onRateClick} ratedItemId={ratedItemId} onAssignCity={onAssignCity} />
      ))}
    </div>
  );
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function sortCardsAlphabetical(a: Save, b: Save): number {
  const titleA = (a.title ?? "").trim();
  const titleB = (b.title ?? "").trim();
  if (titleA && titleB) return titleA.localeCompare(titleB);
  if (titleA) return -1;
  if (titleB) return 1;
  return 0;
}

interface SavesGrouping {
  unassigned: Save[];
  cityGroups: Array<{ city: string; saves: Save[] }>;
  otherPlaces: Save[];
  totalCount: number;
}

function groupSaves(saves: Save[]): SavesGrouping {
  const unassigned: Save[] = [];
  const cityMap = new Map<string, Save[]>();

  for (const save of saves) {
    const city = save.destinationCity?.trim();
    if (!city) {
      unassigned.push(save);
      continue;
    }
    const existing = cityMap.get(city) ?? [];
    existing.push(save);
    cityMap.set(city, existing);
  }

  const cityGroups: Array<{ city: string; saves: Save[] }> = [];
  const otherPlaces: Save[] = [];

  for (const [city, citySaves] of cityMap.entries()) {
    if (citySaves.length >= 3) {
      cityGroups.push({ city, saves: citySaves });
    } else {
      otherPlaces.push(...citySaves);
    }
  }

  cityGroups.sort((a, b) => {
    if (b.saves.length !== a.saves.length) return b.saves.length - a.saves.length;
    return a.city.localeCompare(b.city);
  });

  for (const group of cityGroups) {
    group.saves.sort(sortCardsAlphabetical);
  }

  unassigned.sort(sortCardsAlphabetical);
  otherPlaces.sort(sortCardsAlphabetical);

  return { unassigned, cityGroups, otherPlaces, totalCount: saves.length };
}

// ─── OtherPlacesSection ───────────────────────────────────────────────────────

function OtherPlacesSection({ saves, openDropdown, setOpenDropdown, assignTrip, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId }: {
  saves: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: expanded ? "12px" : 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>Other places</span>
          <span style={{ fontSize: "12px", color: "#717171" }}>{saves.length} {saves.length === 1 ? "save" : "saves"}</span>
        </div>
        <span style={{ fontSize: "14px", color: "#717171", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▾</span>
      </div>
      {expanded && (
        <CardGrid cards={saves} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={() => {}} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} onIdentifyPlace={onIdentifyPlace} onRateClick={onRateClick} ratedItemId={ratedItemId} />
      )}
    </div>
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

const SHOW_MORE_STYLE: React.CSSProperties = {
  marginTop: 12,
  padding: "8px 16px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "white",
  color: "#1B3A5C",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

function UpcomingTabContent({ sections, expandedSections, setExpandedSections, suggestedTripMap, onAddToTrip, onGrowTripCities, sharedProps }: {
  sections: UpcomingTripSection[];
  expandedSections: Set<string>;
  setExpandedSections: (s: Set<string>) => void;
  suggestedTripMap: Map<string, Array<{ id: string; name: string }>>;
  onAddToTrip: (saveId: string, options: Array<{ id: string; name: string }>) => void;
  onGrowTripCities: (saveId: string, tripId: string, newCity: string, currentCities: string[]) => void;
  sharedProps: SharedCardGridProps;
}) {
  if (sections.every((s) => s.explicitSaves.length + s.suggestedSaves.length === 0)) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>No upcoming trips yet. Add one to start planning.</p>;
  }
  return (
    <>
      {sections.map((section) => {
        const totalCount = section.explicitSaves.length + section.suggestedSaves.length;
        if (totalCount === 0) return null;
        const expanded = expandedSections.has(section.tripId);
        const explicitShown = expanded ? section.explicitSaves : section.explicitSaves.slice(0, 3);
        const suggestedShown = expanded ? section.suggestedSaves : section.suggestedSaves.slice(0, Math.max(0, 3 - explicitShown.length));
        return (
          <section key={section.tripId} style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                {section.tripName}
                {section.startDate && (
                  <span style={{ color: "#64748B", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>
                    {formatTripDateRange(section.startDate, section.endDate)}
                  </span>
                )}
              </h3>
              <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0 0" }}>
                {totalCount} {totalCount === 1 ? "save" : "saves"}
                {section.suggestedSaves.length > 0 && ` • ${section.suggestedSaves.length} suggested`}
              </p>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: 16 }}>
              {explicitShown.map((save) => (
                <SaveCard key={save.id} save={save} {...sharedProps} onTripClick={() => {}} cardContext="upcoming_explicit" />
              ))}
              {suggestedShown.map((save) => {
                const options = suggestedTripMap.get(save.id) ?? [];
                const isSingleMatch = options.length === 1;
                const cityNotInTrip = isSingleMatch && !!save.destinationCity && !section.cities.map(c => c.toLowerCase()).includes(save.destinationCity.toLowerCase());
                if (cityNotInTrip) {
                  return (
                    <SaveCard
                      key={save.id}
                      save={save}
                      {...sharedProps}
                      onTripClick={() => {}}
                      onGrowTripCity={(saveId) => onGrowTripCities(saveId, options[0].id, save.destinationCity!, section.cities)}
                      growTripCityLabel={`+ Add ${save.destinationCity} to trip`}
                    />
                  );
                }
                return (
                  <SaveCard
                    key={save.id}
                    save={save}
                    {...sharedProps}
                    onTripClick={() => {}}
                    suggestedForOptions={options.length > 0 ? options : undefined}
                    onAddToTrip={options.length > 0 ? onAddToTrip : undefined}
                  />
                );
              })}
            </div>
            {totalCount > 3 && (
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expandedSections);
                  if (expanded) next.delete(section.tripId); else next.add(section.tripId);
                  setExpandedSections(next);
                }}
                style={SHOW_MORE_STYLE}
              >
                {expanded ? "Show less" : `Show all ${totalCount} saves →`}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

function PastTabContent({ sections, expandedSections, setExpandedSections, sharedProps }: {
  sections: PastCitySection[];
  expandedSections: Set<string>;
  setExpandedSections: (s: Set<string>) => void;
  sharedProps: SharedCardGridProps;
}) {
  if (sections.length === 0) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>No past-trip saves yet.</p>;
  }
  return (
    <>
      {sections.map((section) => {
        const key = `past-${section.city}`;
        const expanded = expandedSections.has(key);
        const shown = expanded ? section.saves : section.saves.slice(0, 3);
        return (
          <section key={section.city} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{section.city}</h3>
              <span style={{ fontSize: 12, color: "#64748B" }}>{section.saves.length} {section.saves.length === 1 ? "save" : "saves"}</span>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: 16 }}>
              {shown.map((save) => (
                <SaveCard key={save.id} save={save} {...sharedProps} onTripClick={() => {}} cardContext="past" />
              ))}
            </div>
            {section.saves.length > 3 && (
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expandedSections);
                  if (expanded) next.delete(key); else next.add(key);
                  setExpandedSections(next);
                }}
                style={SHOW_MORE_STYLE}
              >
                {expanded ? "Show less" : `Show all ${section.saves.length} saves →`}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

function UnassignedTabContent({ items, sharedProps, onAssignCity }: {
  items: Save[];
  sharedProps: SharedCardGridProps;
  onAssignCity: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>Every save is assigned or matched. You&apos;re on top of things.</p>;
  }
  const shown = expanded ? items : items.slice(0, 3);
  return (
    <section>
      <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: 16 }}>
        {shown.map((save) => (
          <SaveCard key={save.id} save={save} {...sharedProps} onTripClick={() => {}} onAssignCity={onAssignCity} />
        ))}
      </div>
      {items.length > 3 && (
        <button type="button" onClick={() => setExpanded(!expanded)} style={SHOW_MORE_STYLE}>
          {expanded ? "Show less" : `Show all ${items.length} saves →`}
        </button>
      )}
    </section>
  );
}

// ─── SavesScreen ──────────────────────────────────────────────────────────────

export function SavesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [saves, setSaves] = useState<Save[]>([]);
  const [availableTrips, setAvailableTrips] = useState<{ id: string; title: string; destinationCity: string | null; destinationCountry: string | null; cities: string[]; country: string | null; countries: string[]; startDate: string | null; endDate: string | null; isPlacesLibrary?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showFabModal, setShowFabModal] = useState(false);
  const [fabUrl, setFabUrl] = useState("");
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [identifyingItem, setIdentifyingItem] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [identifying, setIdentifying] = useState(false);
  const placeSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("food_and_drink");
  const [manualCity, setManualCity] = useState("");
  const [manualRegion, setManualRegion] = useState("");
  const [manualCountry, setManualCountry] = useState("");
  const [manualCityQuery, setManualCityQuery] = useState("");
  const [manualCitySuggestions, setManualCitySuggestions] = useState<{ placeId: string; cityName: string; countryName: string; region: string; description?: string }[]>([]);
  const [manualCityShowDropdown, setManualCityShowDropdown] = useState(false);
  const manualCityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCityDropdownRef = useRef<HTMLDivElement>(null);
  const [manualNotes, setManualNotes] = useState("");
  const [manualWebsite, setManualWebsite] = useState("");
  const [manualIsVegetarian, setManualIsVegetarian] = useState(false);
  const [manualIsVegan, setManualIsVegan] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ id: string; title: string } | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingNotes, setRatingNotes] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratedItemId, setRatedItemId] = useState<string | null>(null);
  const [assignCityItemId, setAssignCityItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "unassigned">("upcoming");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [addToTripModal, setAddToTripModal] = useState<{ saveId: string; options: Array<{ id: string; name: string }> } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/saves").then(r => r.json()),
      fetch("/api/trips?status=ALL").then(r => r.json()),
    ]).then(([savesData, tripsData]) => {
      setSaves((savesData.saves ?? []).map(mapApiItem));
      // TODO: move isPlacesLibrary filter server-side in a future cleanup prompt
      const allTrips = (tripsData.trips ?? []).filter((t: { isPlacesLibrary?: boolean }) => !t.isPlacesLibrary);
      setAvailableTrips(allTrips);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Dismiss city dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (manualCityDropdownRef.current && !manualCityDropdownRef.current.contains(e.target as Node)) {
        setManualCityShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // City autocomplete debounce
  useEffect(() => {
    if (manualCityDebounceRef.current) clearTimeout(manualCityDebounceRef.current);
    if (manualCityQuery.length < 2) {
      setManualCitySuggestions([]);
      setManualCityShowDropdown(false);
      return;
    }
    manualCityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(manualCityQuery)}`);
        const data = await res.json();
        setManualCitySuggestions(Array.isArray(data) ? data : []);
        setManualCityShowDropdown(true);
      } catch {
        setManualCitySuggestions([]);
      }
    }, 400);
    return () => { if (manualCityDebounceRef.current) clearTimeout(manualCityDebounceRef.current); };
  }, [manualCityQuery]);

  function selectManualCity(cityName: string, countryName: string, region: string) {
    setManualCity(cityName);
    setManualRegion(region);
    setManualCountry(countryName);
    setManualCityQuery(countryName ? `${cityName}, ${countryName}` : cityName);
    setManualCitySuggestions([]);
    setManualCityShowDropdown(false);
  }

  const handlePlaceSearch = (query: string) => {
    if (placeSearchTimeout.current) clearTimeout(placeSearchTimeout.current);
    if (query.length < 3) { setPlaceResults([]); return; }
    placeSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setPlaceResults(data.places ?? []);
      } catch { setPlaceResults([]); }
    }, 300);
  };

  const handleSelectPlace = async (place: PlaceResult) => {
    if (!identifyingItem) return;
    setIdentifying(true);
    try {
      const res = await fetch(`/api/saves/${identifyingItem}/identify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawTitle: place.name,
          lat: place.geometry?.location?.lat ?? null,
          lng: place.geometry?.location?.lng ?? null,
          photoReference: place.photos?.[0]?.photo_reference ?? null,
          needsPlaceConfirmation: false,
        }),
      });
      const data = await res.json() as { savedItem?: { placePhotoUrl?: string | null } };
      const photoUrl = data.savedItem?.placePhotoUrl ?? null;
      setSaves((prev) => prev.map((s) =>
        s.id === identifyingItem
          ? { ...s, title: place.name, img: photoUrl ?? s.img, needsPlaceConfirmation: false }
          : s
      ));
    } catch { /* silent */ }
    setIdentifyingItem(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setIdentifying(false);
  };

  const assignTrip = (id: string, tripTitle: string) => {
    if (tripTitle === "+ Create new trip") { setOpenDropdown(null); return; }
    const trip = availableTrips.find(t => t.title === tripTitle);
    setSaves((prev) => prev.map((s) => (s.id === id ? { ...s, assigned: tripTitle, tripId: trip?.id ?? s.tripId } : s)));
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

  const handleAssignCity = async (cityName: string, countryName: string) => {
    if (!assignCityItemId) return;
    const id = assignCityItemId;
    try {
      const res = await fetch(`/api/saves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationCity: cityName, destinationCountry: countryName || null }),
      });
      if (res.ok) {
        setSaves(prev => prev.map(s =>
          s.id === id
            ? { ...s, destinationCity: cityName, destinationCountry: countryName || null, location: [cityName, countryName].filter(Boolean).join(", ") }
            : s
        ));
        setAssignCityItemId(null);
        setManualCityQuery("");
        setManualCity("");
        setManualCountry("");
        setManualCitySuggestions([]);
        setSavedToast("Location assigned");
        setTimeout(() => setSavedToast(null), 3000);
      }
    } catch { /* silent */ }
  };

  const doAssignToTrip = async (saveId: string, tripId: string, tripName: string) => {
    const save = saves.find(s => s.id === saveId);
    const destinationCity = save?.destinationCity ?? null;
    const trip = availableTrips.find(t => t.id === tripId);
    const existingCities = trip?.cities ?? [];
    const cityNotInTrip = destinationCity && !existingCities.map(c => c.toLowerCase()).includes(destinationCity.toLowerCase());

    setSaves(prev => prev.map(s => s.id === saveId ? { ...s, tripId, assigned: tripName } : s));
    if (cityNotInTrip) {
      setAvailableTrips(prev => prev.map(t => t.id === tripId ? { ...t, cities: [...existingCities, destinationCity!] } : t));
    }
    setAddToTripModal(null);
    try {
      if (cityNotInTrip) {
        try {
          await fetch(`/api/trips/${tripId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cities: [...existingCities, destinationCity!] }),
          });
        } catch (e) {
          console.error("[doAssignToTrip] city-grow failed:", e);
        }
      }
      await fetch(`/api/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
    } catch { /* silent */ }
  };

  const handleAddToTrip = (saveId: string, options: Array<{ id: string; name: string }>) => {
    if (options.length === 1) {
      doAssignToTrip(saveId, options[0].id, options[0].name);
    } else {
      setAddToTripModal({ saveId, options });
    }
  };

  const handleGrowTripCities = async (saveId: string, tripId: string, newCity: string, currentCities: string[]) => {
    const newCities = [...currentCities, newCity];
    // Optimistic: assign save to trip and expand trip's city list
    setSaves(prev => prev.map(s => s.id === saveId ? { ...s, tripId, assigned: newCity } : s));
    setAvailableTrips(prev => prev.map(t => t.id === tripId ? { ...t, cities: newCities } : t));
    setSavedToast(`${newCity} added to trip`);
    setTimeout(() => setSavedToast(null), 3000);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cities: newCities }),
      });
      await fetch(`/api/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
    } catch { /* silent */ }
  };

  const handleManualSave = async () => {
    if (!manualName.trim()) return;
    setManualSubmitting(true);
    try {
      const dietaryTags: string[] = [];
      if (manualIsVegan) { dietaryTags.push("VGN"); dietaryTags.push("VG"); }
      else if (manualIsVegetarian) { dietaryTags.push("VG"); }

      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "MANUAL",
          title: manualName.trim(),
          category: manualCategory || null,
          city: manualCity.trim() || null,
          region: manualRegion.trim() || null,
          country: manualCountry.trim() || null,
          notes: manualNotes.trim() || null,
          website: manualWebsite.trim() || null,
          tags: dietaryTags.length > 0 ? dietaryTags : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.savedItem) {
        const tripForItem = data.matchedTrip ? { id: data.matchedTrip.id, title: data.matchedTrip.title } : null;
        setSaves((prev) => [mapApiItem({ ...data.savedItem, trip: tripForItem, needsPlaceConfirmation: false }), ...prev]);
        setShowManualModal(false);
        setManualName("");
        setManualCategory("food_and_drink");
        setManualCity("");
        setManualRegion("");
        setManualCountry("");
        setManualCityQuery("");
        setManualNotes("");
        setManualWebsite("");
        setManualIsVegetarian(false);
        setManualIsVegan(false);
        const toastMsg = data.matchedTrip
          ? `Saved and added to ${data.matchedTrip.title}`
          : "Activity saved";
        setSavedToast(toastMsg);
        setTimeout(() => setSavedToast(null), 3500);
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // Unique cities derived from saves, alphabetical — used for city pill row
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    saves.forEach(s => {
      if (s.destinationCity && s.destinationCity.trim()) cities.add(s.destinationCity.trim());
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [saves]);

  // City filter — applied before category/search
  const cityFiltered = selectedCity
    ? saves.filter(s => s.destinationCity?.trim() === selectedCity)
    : saves;

  // Card matching: search + category filter (ignores assigned/unassigned axis)
  const matchesFilter = (s: Save): boolean => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      s.title.toLowerCase().includes(searchLower) ||
      s.location.toLowerCase().includes(searchLower) ||
      (s.assigned?.toLowerCase().includes(searchLower) ?? false);
    const matchesCategory =
      activeFilter === "All"
        ? true
        : s.tags.some(t => t === activeFilter);
    const matchesDietary =
      dietaryFilter === "Vegetarian"
        ? s.tags.includes("VG") || s.tags.includes("VGN")
        : dietaryFilter === "Vegan"
        ? s.tags.includes("VGN")
        : true;
    return matchesSearch && matchesCategory && matchesDietary;
  };

  const filteredSaves = cityFiltered.filter(matchesFilter);
  const tabbed = groupTabbedSaves(filteredSaves, availableTrips);
  const hasNoResults = !loading && tabbed.counts.upcoming === 0 && tabbed.counts.past === 0 && tabbed.counts.unassigned === 0;

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

        {/* CITY PILL ROW */}
        {availableCities.length > 0 && (
          <div style={{ marginBottom: "12px", width: "100%" }}>
            <div
              style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none", msOverflowStyle: "none", width: "100%" }}
              className="hide-scrollbar"
            >
              <button
                onClick={() => setSelectedCity(null)}
                style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", border: selectedCity === null ? "none" : "1.5px solid #E0E0E0", backgroundColor: selectedCity === null ? "#1B3A5C" : "#fff", color: selectedCity === null ? "#fff" : "#1B3A5C", fontSize: "13px", fontWeight: selectedCity === null ? 700 : 500, lineHeight: "1", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
              >
                All cities
              </button>
              {availableCities.map(city => {
                const isSelected = selectedCity === city;
                return (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(isSelected ? null : city)}
                    style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", border: isSelected ? "none" : "1.5px solid #E0E0E0", backgroundColor: isSelected ? "#1B3A5C" : "#fff", color: isSelected ? "#fff" : "#1B3A5C", fontSize: "13px", fontWeight: isSelected ? 700 : 500, lineHeight: "1", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FILTER STRIP */}
        <div style={{ display: "flex", overflowX: "auto", gap: "8px", marginBottom: "24px", paddingBottom: "4px", scrollbarWidth: "none", width: "100%" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFilter("All"); }}
            style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: activeFilter === "All" ? 600 : 400, color: activeFilter === "All" ? "#fff" : "#717171", backgroundColor: activeFilter === "All" ? "#C4664A" : "#fff", border: activeFilter === "All" ? "none" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            All
          </button>
          {CATEGORIES.map(({ slug, label }) => {
            const isActive = activeFilter === slug;
            return (
              <button
                key={slug}
                onClick={(e) => { e.stopPropagation(); setActiveFilter(slug); if (slug !== "food_and_drink") setDietaryFilter(null); }}
                style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "#717171", backgroundColor: isActive ? "#C4664A" : "#fff", border: isActive ? "none" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", transition: "all 0.15s ease" }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {activeFilter === "food_and_drink" && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '-16px', marginBottom: '24px' }}>
            {["All Food", "Vegetarian", "Vegan"].map(sub => (
              <button
                key={sub}
                onClick={() => setDietaryFilter(sub === "All Food" ? null : sub)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: '1px solid',
                  fontSize: '13px',
                  background: (sub === "All Food" ? dietaryFilter === null : dietaryFilter === sub) ? '#16a34a' : 'white',
                  color: (sub === "All Food" ? dietaryFilter === null : dietaryFilter === sub) ? 'white' : '#16a34a',
                  borderColor: '#16a34a',
                  cursor: 'pointer',
                }}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* TAB BAR */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E5E7EB", marginBottom: 20 }}>
          {([
            { id: "upcoming", label: "Upcoming", count: tabbed.counts.upcoming },
            { id: "past", label: "Past", count: tabbed.counts.past },
            { id: "unassigned", label: "Unassigned", count: tabbed.counts.unassigned },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "2px solid #1B3A5C" : "2px solid transparent",
                color: activeTab === tab.id ? "#1B3A5C" : "#64748B",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

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

        {!loading && (() => {
          const sharedGrid: SharedCardGridProps = {
            openDropdown,
            setOpenDropdown,
            assignTrip,
            onCardClick: (id) => setModalItemId(id),
            availableTrips,
            onDeleted: handleItemDeleted,
            onIdentifyPlace: setIdentifyingItem,
            onRateClick: (id, title) => { setRatingModal({ id, title }); setRatingValue(0); setRatingNotes(""); },
            ratedItemId,
          };
          return (
            <>
              {(search.trim() || activeTab === "upcoming") && (
                <UpcomingTabContent
                  sections={tabbed.upcoming}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  suggestedTripMap={tabbed.suggestedTripMap}
                  onAddToTrip={handleAddToTrip}
                  onGrowTripCities={handleGrowTripCities}
                  sharedProps={sharedGrid}
                />
              )}
              {(search.trim() || activeTab === "past") && (
                <PastTabContent
                  sections={tabbed.past}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  sharedProps={sharedGrid}
                />
              )}
              {(search.trim() || activeTab === "unassigned") && (
                <UnassignedTabContent
                  items={tabbed.unassigned}
                  sharedProps={sharedGrid}
                  onAssignCity={(id) => { setAssignCityItemId(id); setManualCityQuery(""); setManualCity(""); setManualCountry(""); setManualCitySuggestions([]); setManualCityShowDropdown(false); }}
                />
              )}
            </>
          );
        })()}

      </div>

      {/* Place identification modal */}
      {identifyingItem && (
        <div
          onClick={() => { setIdentifyingItem(null); setPlaceQuery(""); setPlaceResults([]); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "360px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1B3A5C", margin: "0 0 4px", fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
              What place is this?
            </h3>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 16px" }}>
              Type the place name and we&apos;ll find it
            </p>
            <input
              type="text"
              value={placeQuery}
              onChange={(e) => { setPlaceQuery(e.target.value); handlePlaceSearch(e.target.value); }}
              placeholder="e.g. Dragon Hill Spa Seoul"
              autoFocus
              style={{ display: "block", width: "100%", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", marginBottom: "8px", boxSizing: "border-box", fontFamily: "inherit" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            />
            {placeResults.length > 0 && (
              <div style={{ border: "1px solid #f0f0f0", borderRadius: "10px", overflow: "hidden", marginBottom: "12px" }}>
                {placeResults.map((place, i) => (
                  <button
                    key={place.place_id}
                    onClick={() => handleSelectPlace(place)}
                    disabled={identifying}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", borderBottom: i < placeResults.length - 1 ? "1px solid #f5f5f5" : "none", fontFamily: "inherit" }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 2px" }}>{place.name}</p>
                    <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{place.formatted_address}</p>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setIdentifyingItem(null); setPlaceQuery(""); setPlaceResults([]); }}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#bbb", padding: "8px 0", fontFamily: "inherit" }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Save detail modal */}
      {modalItemId && (
        <SaveDetailModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
          onTagsUpdated={handleTagsUpdated}
          onAssigned={(itemId, trip) =>
            setSaves(prev => prev.map(s =>
              s.id === itemId ? { ...s, tripId: trip.id || null, assigned: trip.title || null } : s
            ))
          }
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

      {/* Add Activity pill button */}
      <button
        onClick={() => setShowManualModal(true)}
        title="Add activity manually"
        style={{
          position: "fixed",
          bottom: 96,
          right: 92,
          height: 40,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 20,
          backgroundColor: "#fff",
          border: "1.5px solid #1B3A5C",
          color: "#1B3A5C",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          zIndex: 90,
        }}
      >
        + Add Activity
      </button>

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

      {savedToast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {savedToast}
        </div>
      )}

      {/* Manual Activity Modal */}
      {showManualModal && (
        <div
          onClick={() => setShowManualModal(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}
          >
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 20, fontWeight: 700, color: "#1B3A5C", margin: 0 }}>Add Activity</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name *</label>
              <input
                type="text"
                placeholder="e.g. TeamLab Planets"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", backgroundColor: "#fff" }}
              >
                {CATEGORIES.map(({ slug, label }) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }} ref={manualCityDropdownRef}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>City</label>
              <input
                type="text"
                placeholder="e.g. Tokyo"
                value={manualCityQuery}
                onChange={(e) => { setManualCityQuery(e.target.value); setManualCity(e.target.value); setManualRegion(""); setManualCountry(""); }}
                onFocus={() => { if (manualCitySuggestions.length > 0) setManualCityShowDropdown(true); }}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
              {manualCityShowDropdown && manualCitySuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #E8E8E8", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden", marginTop: 4 }}>
                  {manualCitySuggestions.map((s) => (
                    <div
                      key={s.placeId}
                      onMouseDown={() => selectManualCity(s.cityName, s.countryName, s.region ?? "")}
                      style={{ padding: "10px 12px", fontSize: 14, color: "#0A1628", cursor: "pointer", borderBottom: "1px solid #F5F5F5", fontFamily: "Inter, sans-serif" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F5F3"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.cityName}</span>
                      {s.countryName && <span style={{ color: "#717171", marginLeft: 6 }}>{s.countryName}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
              <textarea
                placeholder="Any notes..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={3}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical" }}
              />
            </div>

            {manualCategory === "food_and_drink" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#666", letterSpacing: "0.05em", textTransform: "uppercase" }}>Dietary</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !manualIsVegetarian;
                      setManualIsVegetarian(next);
                      if (!next) setManualIsVegan(false);
                    }}
                    style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid #16a34a", background: manualIsVegetarian ? "#16a34a" : "white", color: manualIsVegetarian ? "white" : "#16a34a", fontSize: "13px", cursor: "pointer" }}
                  >Vegetarian</button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !manualIsVegan;
                      setManualIsVegan(next);
                      if (next) setManualIsVegetarian(true);
                    }}
                    style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid #16a34a", background: manualIsVegan ? "#16a34a" : "white", color: manualIsVegan ? "white" : "#16a34a", fontSize: "13px", cursor: "pointer" }}
                  >Vegan</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</label>
              <input
                type="url"
                placeholder="https://"
                value={manualWebsite}
                onChange={(e) => setManualWebsite(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                onClick={() => { setShowManualModal(false); setManualIsVegetarian(false); setManualIsVegan(false); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={!manualName.trim() || manualSubmitting}
                style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: manualName.trim() ? "#C4664A" : "#E8E8E8", color: manualName.trim() ? "#fff" : "#aaa", fontSize: 14, fontWeight: 600, cursor: manualName.trim() ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
              >
                {manualSubmitting ? "Saving..." : "Save Activity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add-to-trip picker — when save matches multiple upcoming trips */}
      {addToTripModal && (
        <div
          onClick={() => setAddToTripModal(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "320px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: '"Playfair Display", Georgia, serif' }}>
              Add to which trip?
            </h3>
            {addToTripModal.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => doAssignToTrip(addToTripModal.saveId, opt.id, opt.name)}
                style={{ width: "100%", padding: "12px 16px", border: "1px solid #E5E7EB", borderRadius: "8px", background: "white", color: "#1B3A5C", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F5F3"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white"; }}
              >
                {opt.name}
              </button>
            ))}
            <button
              onClick={() => setAddToTripModal(null)}
              style={{ padding: "10px 0", border: "none", background: "transparent", color: "#6B7280", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assign city modal */}
      {assignCityItemId && (
        <div
          onClick={() => { setAssignCityItemId(null); setManualCityQuery(""); setManualCitySuggestions([]); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "360px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1B3A5C", margin: 0, fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
              Assign a location
            </h3>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={manualCityQuery}
                onChange={(e) => { setManualCityQuery(e.target.value); setManualCity(e.target.value); setManualCountry(""); }}
                placeholder="e.g. Tokyo"
                autoFocus
                style={{ display: "block", width: "100%", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              />
              {manualCityShowDropdown && manualCitySuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #E8E8E8", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden", marginTop: 4 }}>
                  {manualCitySuggestions.map((s) => (
                    <div
                      key={s.placeId}
                      onMouseDown={() => selectManualCity(s.cityName, s.countryName, s.region ?? "")}
                      style={{ padding: "10px 12px", fontSize: 14, color: "#0A1628", cursor: "pointer", borderBottom: "1px solid #F5F5F5", fontFamily: "Inter, sans-serif" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F5F3"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.cityName}</span>
                      {s.countryName && <span style={{ color: "#717171", marginLeft: 6 }}>{s.countryName}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setAssignCityItemId(null); setManualCityQuery(""); setManualCitySuggestions([]); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                disabled={!manualCity.trim()}
                onClick={() => handleAssignCity(manualCity.trim(), manualCountry)}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: manualCity.trim() ? "#C4664A" : "#E8E8E8", color: manualCity.trim() ? "#fff" : "#aaa", fontSize: "14px", fontWeight: 600, cursor: manualCity.trim() ? "pointer" : "default", fontFamily: "inherit" }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING MODAL */}
      {ratingModal && (
        <div
          onClick={() => setRatingModal(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
              {ratingModal.title.length > 40 ? ratingModal.title.slice(0, 40) + "…" : ratingModal.title}
            </h2>

            {/* Star selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "28px", color: star <= ratingValue ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Notes */}
            <textarea
              placeholder="What did you think?"
              value={ratingNotes}
              onChange={(e) => setRatingNotes(e.target.value)}
              rows={3}
              style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical" }}
            />

            {/* Save button */}
            <button
              disabled={ratingValue === 0 || ratingSubmitting}
              onClick={async () => {
                if (ratingValue === 0) return;
                setRatingSubmitting(true);
                try {
                  const res = await fetch(`/api/saves/${ratingModal.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userRating: ratingValue, notes: ratingNotes.trim() || undefined }),
                  });
                  if (res.ok) {
                    setRatedItemId(ratingModal.id);
                    setSaves((prev) => prev.map((s) => s.id === ratingModal.id ? { ...s, userRating: ratingValue } : s));
                    setRatingModal(null);
                    setSavedToast("Rating saved!");
                    setTimeout(() => setSavedToast(null), 3000);
                  }
                } finally {
                  setRatingSubmitting(false);
                }
              }}
              style={{ padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: ratingValue > 0 ? "#C4664A" : "#E8E8E8", color: ratingValue > 0 ? "#fff" : "#aaa", fontSize: 14, fontWeight: 600, cursor: ratingValue > 0 ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
            >
              {ratingSubmitting ? "Saving…" : "Save rating"}
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setRatingModal(null)}
              style={{ background: "none", border: "none", padding: 0, fontSize: "13px", color: "#717171", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
