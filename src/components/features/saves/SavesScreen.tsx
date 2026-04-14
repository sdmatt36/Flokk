"use client";

import { useState, useEffect, useRef } from "react";
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
};

type PlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
};

const FILTER_PILLS = ["All", "Food & Drink", "Culture", "Experiences", "Lodging", "Adventure", "Nature", "Shopping", "Entertainment", "Wellness", "Nightlife", "Other", "Unorganized"];

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
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
};

function SaveCard({ save, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId }: SaveCardProps) {
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

function CardGrid({ cards, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId }: {
  cards: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
}) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: "16px" }}>
      {cards.map((save) => (
        <SaveCard key={save.id} save={save} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={onTripClick} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} onIdentifyPlace={onIdentifyPlace} onRateClick={onRateClick} ratedItemId={ratedItemId} />
      ))}
    </div>
  );
}

// ─── SavesScreen ──────────────────────────────────────────────────────────────

export function SavesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [saves, setSaves] = useState<Save[]>([]);
  const [availableTrips, setAvailableTrips] = useState<{ id: string; title: string; destinationCity: string | null; destinationCountry: string | null }[]>([]);
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
  const [manualCategory, setManualCategory] = useState("food");
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

  const unorganizedCount = saves.filter((s) => s.assigned === null).length;

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
        setManualCategory("food");
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

  const CATEGORY_ALIASES: Record<string, string[]> = {
    "Food & Drink": ["food", "food & drink"],
    "Culture": ["culture"],
    "Experiences": ["experiences", "activity"],
    "Lodging": ["lodging"],
    "Adventure": ["adventure"],
    "Nature": ["nature", "outdoor"],
    "Shopping": ["shopping"],
    "Entertainment": ["entertainment"],
    "Wellness": ["wellness"],
    "Nightlife": ["nightlife"],
    "Other": ["other"],
  };

  // Card matching: search + category filter (ignores assigned/unassigned axis)
  const matchesFilter = (s: Save): boolean => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      s.title.toLowerCase().includes(searchLower) ||
      s.location.toLowerCase().includes(searchLower) ||
      (s.assigned?.toLowerCase().includes(searchLower) ?? false);
    const matchesCategory =
      activeFilter === "All" || activeFilter === "Unorganized"
        ? true
        : (CATEGORY_ALIASES[activeFilter] ?? [activeFilter]).some(alias =>
            s.tags.some(t => t.toLowerCase() === alias.toLowerCase())
          );
    const matchesDietary =
      dietaryFilter === "Vegetarian"
        ? s.tags.includes("VG") || s.tags.includes("VGN")
        : dietaryFilter === "Vegan"
        ? s.tags.includes("VGN")
        : true;
    return matchesSearch && matchesCategory && matchesDietary;
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

        {/* ACTIVE TRIP BANNER — only shown when there are relevant unorganized saves for the active trip */}
        {(() => {
          if (availableTrips.length === 0) return null;
          const activeTrip = availableTrips[0];
          const tripCity = activeTrip.destinationCity?.toLowerCase() ?? "";
          const tripCountry = activeTrip.destinationCountry?.toLowerCase() ?? "";
          const relevantUnassigned = saves.filter((s) => {
            if (s.assigned !== null) return false;
            const saveCity = s.destinationCity?.toLowerCase() ?? "";
            const saveCountry = s.destinationCountry?.toLowerCase() ?? "";
            return (tripCity && saveCity && saveCity.includes(tripCity)) ||
                   (tripCountry && saveCountry && saveCountry.includes(tripCountry));
          });
          if (relevantUnassigned.length === 0) return null;
          const unassignedCount = relevantUnassigned.length;
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
              <p style={{ fontSize: "12px", color: "#717171", marginTop: "4px", marginLeft: "20px" }}>
                You have {unassignedCount} unorganized {unassignedCount === 1 ? "save" : "saves"} — review them for this trip?
              </p>
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
                onClick={(e) => { e.stopPropagation(); setActiveFilter(pill); if (pill !== "Food & Drink") setDietaryFilter(null); }}
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

        {activeFilter === "Food & Drink" && (
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
                title={tripName}
                badge={TRIP_FLAGS[tripName]}
                count={cards.length}
                action={matchedTrip ? { label: "View trip →", onClick: handleViewTrip } : undefined}
              />
              <CardGrid cards={cards} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={handleViewTrip} onCardClick={(id) => setModalItemId(id)} availableTrips={availableTrips} onDeleted={handleItemDeleted} onIdentifyPlace={setIdentifyingItem} onRateClick={(id, title) => { setRatingModal({ id, title }); setRatingValue(0); setRatingNotes(""); }} ratedItemId={ratedItemId} />
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
            <CardGrid cards={unorganizedCards} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={(name) => { const t = availableTrips.find((tr) => tr.title === name); if (t) router.push(`/trips/${t.id}`); }} onCardClick={(id) => setModalItemId(id)} availableTrips={availableTrips} onDeleted={handleItemDeleted} onIdentifyPlace={setIdentifyingItem} onRateClick={(id, title) => { setRatingModal({ id, title }); setRatingValue(0); setRatingNotes(""); }} ratedItemId={ratedItemId} />
          </div>
        )}

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
                {[
                  { value: "food", label: "Food & Drink" },
                  { value: "culture", label: "Culture" },
                  { value: "experiences", label: "Experiences" },
                  { value: "lodging", label: "Lodging" },
                  { value: "adventure", label: "Adventure" },
                  { value: "nature", label: "Nature" },
                  { value: "shopping", label: "Shopping" },
                  { value: "entertainment", label: "Entertainment" },
                  { value: "wellness", label: "Wellness" },
                  { value: "nightlife", label: "Nightlife" },
                  { value: "other", label: "Other" },
                ].map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
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

            {manualCategory === "food" && (
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
                  const res = await fetch(`/api/saves/${ratingModal.id}/rate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating: ratingValue, notes: ratingNotes.trim() || undefined }),
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
