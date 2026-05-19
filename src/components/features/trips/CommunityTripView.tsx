"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Tag, Bookmark, BookmarkCheck, Sparkles, Users, ChevronRight, ChevronDown, X, Calendar, ExternalLink, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CommunityTripMap, type MarkerDef } from "./CommunityTripMap";
import Link from "next/link";
import { RecommendationDrawer, type DrawerRec } from "./RecommendationDrawer";
import { parseDateForDisplay } from "@/lib/dates";
import { getDestinationCoords } from "@/lib/destination-coords";
import { getTripCoverImage } from "@/lib/destination-images";

export type ActivityItem = {
  id: string;
  rawTitle: string | null;
  rawDescription: string | null;
  placePhotoUrl?: string | null;
  mediaThumbnailUrl?: string | null;
  categoryTags: string[];
  dayIndex: number | null;
  lat?: number | null;
  lng?: number | null;
  sourceUrl?: string | null;
};

type DayEntry = {
  dayNum: number;
  dateLabel: string;
  items: ActivityItem[];
};

type ViewerMember = {
  role: "ADULT" | "CHILD";
  name?: string | null;
  birthDate?: string | null;
};

// Curated per-destination recommendations (not in the seed itinerary)
const DESTINATION_RECS: Record<string, Array<{
  title: string; location: string; tags: string; match: string;
  img: string; saved: number; lat: number; lng: number;
}>> = {
  Kyoto: [
    { title: "Kiyomizudera Temple", location: "Higashiyama, Kyoto", tags: "Culture · Free · 1.5 hrs", match: "UNESCO site · Hilltop views · All ages", img: "/images/kiyomizudera-temple.jpg", saved: 3210, lat: 34.9948, lng: 135.7851 },
    { title: "Tea Ceremony in Gion", location: "Gion, Kyoto", tags: "Culture · $30 · 1 hr", match: "Traditional experience · Hands-on · Ages 5+", img: "/images/tea-ceremony-kyoto.jpg", saved: 1870, lat: 35.0033, lng: 135.7764 },
    { title: "Toei Kyoto Studio Park", location: "Uzumasa, Kyoto", tags: "Kids · $15 · Half day", match: "Samurai & ninja shows · Ages 4+ · Unique to Kyoto", img: "/images/toei-kyoto-studio.jpg", saved: 940, lat: 35.0189, lng: 135.7047 },
    { title: "Nishiki Market Street Food", location: "Central Kyoto", tags: "Food · Free · 1–2 hrs", match: "Street snacks · Covered arcade · All ages", img: "/images/nishiki-market.jpg", saved: 2650, lat: 35.0042, lng: 135.7657 },
    { title: "Kibune Shrine & River Walk", location: "Kibune, Kyoto", tags: "Outdoor · Free · 2 hrs", match: "Nature · Lantern-lit path · All ages", img: "/images/kibune-shrine.jpg", saved: 1140, lat: 35.1113, lng: 135.7488 },
    { title: "Fushimi Momoyama Castle", location: "Fushimi, Kyoto", tags: "History · $5 · 1.5 hrs", match: "Samurai history · Hilltop · Kids love the walls", img: "/images/fushimi-momoyama-castle.jpg", saved: 810, lat: 34.9441, lng: 135.7730 },
  ],
  Madrid: [
    { title: "Santiago Bernabéu Stadium Tour", location: "Chamartín, Madrid", tags: "Sports · $35 · 1.5 hrs", match: "Football fans · Ages 6+ · Unique experience", img: "/images/bernabeu-stadium.jpg", saved: 2890, lat: 40.4531, lng: -3.6883 },
    { title: "Aquópolis Water Park", location: "Villanueva de la Cañada", tags: "Kids · $30 · Full day", match: "Summer essential · Ages 3+ · Waterslides", img: "/images/aquopolis-waterpark.jpg", saved: 1560, lat: 40.4449, lng: -3.9972 },
    { title: "Reina Sofía Museum", location: "Atocha, Madrid", tags: "Culture · $12 · 2 hrs", match: "Guernica · Modern art · Ages 8+", img: "/images/reina-sofia-museum.jpg", saved: 2140, lat: 40.4080, lng: -3.6944 },
    { title: "Parque de Atracciones", location: "Casa de Campo, Madrid", tags: "Kids · $35 · Half day", match: "Rides & roller coasters · Ages 3+ · Family classic", img: "/images/parque-atracciones.jpg", saved: 1230, lat: 40.4085, lng: -3.7517 },
    { title: "Flamenco Show at Corral de la Morería", location: "Opera, Madrid", tags: "Culture · $45 · 1.5 hrs", match: "Authentic tablao · Evening · Ages 7+", img: "/images/flamenco-show.jpg", saved: 1740, lat: 40.4150, lng: -3.7126 },
    { title: "Chocolatería San Ginés", location: "Sol, Madrid", tags: "Food · $8 · 30 min", match: "Best churros con chocolate in Madrid · All ages", img: "/images/chocolateria-san-gines.jpg", saved: 3380, lat: 40.4157, lng: -3.7077 },
  ],
  Lisbon: [
    { title: "Lisbon Oceanarium", location: "Parque das Nações", tags: "Kids · $20 · 2 hrs", match: "Best aquarium in Europe · Ages 2+ · Otters!", img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80", saved: 4110, lat: 38.7633, lng: -9.0933 },
    { title: "Quinta da Regaleira, Sintra", location: "Sintra", tags: "Culture · $12 · 2 hrs", match: "Mystical underground well · UNESCO · Ages 6+", img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80", saved: 2870, lat: 38.7967, lng: -9.3992 },
    { title: "Cristo Rei Statue", location: "Almada (across the river)", tags: "Views · $8 · 1 hr", match: "Panoramic Lisbon views · Iconic · All ages", img: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=400&auto=format&fit=crop&q=80", saved: 1950, lat: 38.6757, lng: -9.1721 },
    { title: "National Tile Museum", location: "Xabregas, Lisbon", tags: "Culture · $7 · 1.5 hrs", match: "Azulejo art · Portuguese history · Ages 8+", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop&q=80", saved: 1320, lat: 38.7198, lng: -9.1232 },
    { title: "Cabo da Roca", location: "Sintra Coast", tags: "Outdoor · Free · 1 hr", match: "Westernmost point of Europe · Dramatic cliffs · All ages", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&auto=format&fit=crop&q=80", saved: 2540, lat: 38.7808, lng: -9.4997 },
    { title: "Surf Lesson in Cascais", location: "Cascais Beach", tags: "Outdoor · $50 · 2 hrs", match: "Atlantic surf · Ages 8+ · Beginner-friendly", img: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&auto=format&fit=crop&q=80", saved: 1680, lat: 38.6979, lng: -9.4193 },
  ],
};

type RelatedTrip = { id: string | null; city: string; country: string; img: string; tags: string[] };

const RELATED_TRIPS_BY_DEST: Record<string, RelatedTrip[]> = {
  Kyoto: [
    { id: "cmtrip-madrid-jun25", city: "Madrid", country: "Spain", img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Culture"] },
    { id: "cmtrip-lisbon-jul25", city: "Lisbon", country: "Portugal", img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80", tags: ["Adventure", "History"] },
    { id: null, city: "Tokyo", country: "Japan", img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kids"] },
    { id: null, city: "Osaka", country: "Japan", img: "https://images.unsplash.com/photo-1589452271712-64b8a66c3570?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Kids"] },
  ],
  Madrid: [
    { id: "cmtrip-kyoto-may25", city: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kid-friendly"] },
    { id: "cmtrip-lisbon-jul25", city: "Lisbon", country: "Portugal", img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80", tags: ["Adventure", "History"] },
    { id: null, city: "Seville", country: "Spain", img: "https://images.unsplash.com/photo-1558642891-54be180ea339?w=400&auto=format&fit=crop&q=80", tags: ["History", "Culture"] },
    { id: null, city: "Barcelona", country: "Spain", img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&auto=format&fit=crop&q=80", tags: ["Beach", "Culture"] },
  ],
  Lisbon: [
    { id: "cmtrip-kyoto-may25", city: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kid-friendly"] },
    { id: "cmtrip-madrid-jun25", city: "Madrid", country: "Spain", img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Culture"] },
    { id: null, city: "Porto", country: "Portugal", img: "https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?w=400&auto=format&fit=crop&q=80", tags: ["Food", "History"] },
    { id: null, city: "Seville", country: "Spain", img: "https://images.unsplash.com/photo-1558642891-54be180ea339?w=400&auto=format&fit=crop&q=80", tags: ["History", "Culture"] },
  ],
};

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildDays(items: ActivityItem[], startDate: string | null): DayEntry[] {
  const byDay = new Map<number, ActivityItem[]>();
  for (const item of items) {
    if (item.dayIndex === null || item.dayIndex === 0) continue;
    const arr = byDay.get(item.dayIndex) ?? [];
    arr.push(item);
    byDay.set(item.dayIndex, arr);
  }
  const dayNums = Array.from(byDay.keys()).sort((a, b) => a - b);
  return dayNums.map((dayNum) => {
    let dateLabel = `Day ${dayNum}`;
    if (startDate) {
      const start = parseDateForDisplay(startDate);
      const base = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (dayNum - 1));
      dateLabel = `${DAY_NAMES_SHORT[base.getDay()]} ${MONTH_NAMES_SHORT[base.getMonth()]} ${base.getDate()}`;
    }
    return { dayNum, dateLabel, items: byDay.get(dayNum) ?? [] };
  });
}

function buildAllMarkers(days: DayEntry[]): MarkerDef[] {
  const markers: MarkerDef[] = [];
  let num = 0;
  for (const day of days) {
    for (const item of day.items) {
      if (item.lat != null && item.lng != null) {
        num++;
        markers.push({ num, label: item.rawTitle ?? `Stop ${num}`, lat: item.lat!, lng: item.lng! });
      }
    }
  }
  return markers;
}

// Build markers from ALL items with coordinates (not filtered by dayIndex)
function buildMarkersFromItems(items: ActivityItem[]): MarkerDef[] {
  const markers: MarkerDef[] = [];
  let num = 0;
  for (const item of items) {
    if (item.lat != null && item.lng != null) {
      num++;
      markers.push({ num, label: item.rawTitle ?? `Stop ${num}`, lat: item.lat!, lng: item.lng! });
    }
  }
  return markers;
}

function computeCenter(
  items: ActivityItem[],
  destinationCity: string | null,
  destinationCountry: string | null,
): [number, number] {
  const pts = items.filter((i) => i.lat != null && i.lng != null && i.dayIndex !== 0);
  if (pts.length > 0) {
    const avgLng = pts.reduce((sum, p) => sum + p.lng!, 0) / pts.length;
    const avgLat = pts.reduce((sum, p) => sum + p.lat!, 0) / pts.length;
    return [avgLng, avgLat];
  }
  return getDestinationCoords(destinationCity, destinationCountry);
}

function getMemberSummary(members: ViewerMember[]): string {
  const adults = members.filter((m) => m.role === "ADULT").length;
  const children = members.filter((m) => m.role === "CHILD");
  const childAges = children
    .map((m) => {
      if (!m.birthDate) return null;
      const age = Math.floor((Date.now() - new Date(m.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
      return age;
    })
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);

  const parts: string[] = [];
  parts.push(`${adults} adult${adults !== 1 ? "s" : ""}`);
  if (children.length > 0) {
    const ageStr = childAges.length > 0 ? ` (ages ${childAges.join(" & ")})` : "";
    parts.push(`${children.length} kid${children.length !== 1 ? "s" : ""}${ageStr}`);
  }
  return parts.join(" + ");
}

// ── Item detail modal ─────────────────────────────────────────────────────────

const BOOKABLE_CATEGORIES = ["hotel", "restaurant", "food", "activity", "cafe", "bar", "accommodation", "resort"];

function ItemDetailModal({
  item,
  destinationCity,
  destinationCountry,
  isSaved,
  isSaving,
  onSave,
  onClose,
  isLoggedIn,
  matchingTrips,
  onAddToItinerary,
}: {
  item: ActivityItem;
  destinationCity: string | null;
  destinationCountry: string | null;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isLoggedIn: boolean;
  matchingTrips: Array<{ id: string; title: string }>;
  onAddToItinerary: (tripId?: string) => Promise<void>;
}) {
  const router = useRouter();
  const photoUrl = item.placePhotoUrl ?? item.mediaThumbnailUrl ?? getTripCoverImage(destinationCity, destinationCountry, null);
  const [adding, setAdding] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const isBookable = item.categoryTags.some((tag) =>
    BOOKABLE_CATEGORIES.some((cat) => tag.toLowerCase().includes(cat))
  );

  async function handleAddClick() {
    if (!isLoggedIn) {
      router.push("/sign-in");
      return;
    }
    if (matchingTrips.length > 1) {
      setShowPicker(true);
      return;
    }
    await doAdd(matchingTrips[0]?.id);
  }

  async function doAdd(tripId?: string) {
    setAdding(true);
    setShowPicker(false);
    await onAddToItinerary(tripId);
    setAdding(false);
    const name = tripId
      ? (matchingTrips.find((t) => t.id === tripId)?.title ?? "your trip")
      : matchingTrips.length === 0 ? "your library" : "your trip";
    setAddedName(name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />

      {/* Modal */}
      <div style={{ position: "relative", zIndex: 51, backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "540px", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>

        {/* Close button — fixed to top-right */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "14px", right: "14px", zIndex: 10, width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", lineHeight: 1 }}
        >
          ×
        </button>

        {/* Photo header */}
        <div style={{ height: "200px", flexShrink: 0, backgroundImage: `url('${photoUrl}')`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
          {item.categoryTags.length > 0 && (
            <div style={{ position: "absolute", bottom: "14px", left: "14px", display: "flex", gap: "6px" }}>
              {item.categoryTags.slice(0, 2).map((tag) => (
                <span key={tag} style={{ backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px" }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 32px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#1B3A5C", lineHeight: 1.2, marginBottom: "10px", fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}>
            {item.rawTitle}
          </h2>

          {item.rawDescription && (
            <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.65, marginBottom: "18px" }}>
              {item.rawDescription}
            </p>
          )}

          {/* CTA stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Visit website */}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "13px", backgroundColor: "#fff", color: "#1B3A5C", border: "2px solid #1B3A5C", borderRadius: "12px", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}
              >
                Visit website <ExternalLink size={13} />
              </a>
            )}

            {/* Book this */}
            {item.sourceUrl && isBookable && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "13px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}
              >
                Book this →
              </a>
            )}

            {/* Add to my itinerary */}
            {addedName ? (
              <div style={{ textAlign: "center", padding: "13px", backgroundColor: "rgba(74,124,89,0.1)", border: "1.5px solid rgba(74,124,89,0.3)", borderRadius: "12px", fontSize: "14px", fontWeight: 700, color: "#4a7c59" }}>
                Added to {addedName} ✓
              </div>
            ) : showPicker ? (
              <div style={{ border: "2px solid #C4664A", borderRadius: "12px", overflow: "hidden" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", padding: "10px 14px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Which trip?</p>
                {matchingTrips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => doAdd(trip.id)}
                    disabled={adding}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: "14px", fontWeight: 600, color: "#1a1a1a", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {trip.title}
                  </button>
                ))}
                <button
                  onClick={() => doAdd(undefined)}
                  disabled={adding}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: "13px", color: "#717171", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Save without assigning
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddClick}
                disabled={adding}
                style={{ width: "100%", padding: "13px", backgroundColor: "transparent", color: "#C4664A", border: "2px solid #C4664A", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: adding ? "default" : "pointer", fontFamily: "inherit", boxSizing: "border-box" }}
              >
                {adding ? "Adding…" : "Add to my itinerary"}
              </button>
            )}

            {/* Save for later */}
            <button
              onClick={onSave}
              disabled={isSaved || isSaving}
              style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: isSaved ? "#4a7c59" : "#aaa", border: "none", borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: isSaved ? "default" : "pointer", fontFamily: "inherit" }}
            >
              {isSaving ? "Saving…" : isSaved ? "Saved to library ✓" : "Save for later"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Clone modal ──────────────────────────────────────────────────────────────

function CloneModal({
  sourceTripId,
  defaultTitle,
  onClose,
}: {
  sourceTripId: string;
  defaultTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [importActivities, setImportActivities] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!title.trim()) { setError("Please enter a trip name."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trips/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTripId, title: title.trim(), startDate: startDate || undefined, endDate: endDate || undefined, importActivities }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      router.push(`/trips/${data.tripId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", backgroundColor: "#fff", borderRadius: "20px", padding: "28px 24px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#999", padding: "4px" }}>
          <X size={20} />
        </button>

        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1a1a1a", marginBottom: "6px" }}>Add to my trips</h2>
        <p style={{ fontSize: "13px", color: "#717171", marginBottom: "24px" }}>Create your own version of this trip to plan and customize.</p>

        {/* Trip name */}
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Trip name
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "15px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", marginBottom: "16px" }}
        />

        {/* Dates */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Start date</label>
            <div style={{ position: "relative" }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
              />
              <Calendar size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#999", pointerEvents: "none" }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>End date</label>
            <div style={{ position: "relative" }}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
              />
              <Calendar size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#999", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {/* Import toggle */}
        <button
          onClick={() => setImportActivities((v) => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #E5E5E5", background: importActivities ? "rgba(196,102,74,0.04)" : "#fff", cursor: "pointer", marginBottom: "20px" }}
        >
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", textAlign: "left" }}>Import all activities</p>
            <p style={{ fontSize: "12px", color: "#717171", textAlign: "left" }}>Copy the full itinerary into your trip</p>
          </div>
          <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${importActivities ? "#C4664A" : "#DDD"}`, backgroundColor: importActivities ? "#C4664A" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {importActivities && <span style={{ color: "#fff", fontSize: "12px", fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
        </button>

        {error && <p style={{ fontSize: "13px", color: "#C4664A", marginBottom: "12px" }}>{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{ width: "100%", padding: "14px", backgroundColor: loading ? "#E8A98F" : "#C4664A", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "Creating…" : "Create my version"}
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", padding: "12px", fontSize: "14px", color: "#717171", cursor: "pointer", marginTop: "4px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Sortable wrapper for community trip owner drag-reorder ────────────────────
function SortableCommunityItem({ id, children }: { id: string; children: (handle: { listeners: any; attributes: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {children({ listeners, attributes })}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function CommunityTripView({
  items,
  startDate,
  endDate,
  tripId,
  tripTitle,
  destinationCity,
  destinationCountry,
  viewerMembers,
  isOwner = false,
}: {
  items: ActivityItem[];
  startDate: string | null;
  endDate?: string | null;
  tripId: string;
  tripTitle: string;
  destinationCity: string | null;
  destinationCountry?: string | null;
  viewerMembers: ViewerMember[];
  isOwner?: boolean;
}) {
  const [tab, setTab] = useState<"itinerary" | "recommended">("itinerary");
  const [openDay, setOpenDay] = useState(-1); // -1 = all collapsed; show all markers on load
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set());
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [drawerRec, setDrawerRec] = useState<DrawerRec | null>(null);
  const [recAddedTitles, setRecAddedTitles] = useState<Set<string>>(new Set());
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);
  // Live items: start from server-rendered props, refresh client-side with no-store to pick up backfill results
  const [liveItems, setLiveItems] = useState<ActivityItem[]>(items);
  const [userTrips, setUserTrips] = useState<Array<{ id: string; title: string; destinationCity: string | null }>>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleCommunityDragEnd(event: DragEndEvent, dayItems: ActivityItem[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = dayItems.findIndex(a => a.id === String(active.id));
    const newIndex = dayItems.findIndex(a => a.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(dayItems, oldIndex, newIndex);
    const dayItemIds = new Set(dayItems.map(d => d.id));
    setLiveItems(prev => [...prev.filter(p => !dayItemIds.has(p.id)), ...reordered]);
    reordered.forEach((item, i) => {
      fetch(`/api/saves/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      }).catch(e => console.error("[communityDragSort]", e));
    });
  }

  useEffect(() => {
    if (!leftPanelRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setLeftHeight(entry.contentRect.height);
    });
    ro.observe(leftPanelRef.current);
    return () => ro.disconnect();
  }, []);

  // Fresh fetch with no-store to get enriched lat/lng for map pins
  useEffect(() => {
    fetch(`/api/saves?tripId=${tripId}&public=true`, { cache: "no-store" })
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ saves }: { saves: any[] }) => {
        if (Array.isArray(saves) && saves.length > 0) {
          setLiveItems(saves.map((s) => ({
            id: s.id,
            rawTitle: s.rawTitle,
            rawDescription: s.rawDescription,
            placePhotoUrl: s.placePhotoUrl ?? null,
            mediaThumbnailUrl: s.mediaThumbnailUrl,
            categoryTags: s.categoryTags ?? [],
            dayIndex: s.dayIndex,
            lat: s.lat,
            lng: s.lng,
            sourceUrl: s.sourceUrl,
          })));
        }
      })
      .catch(() => {});
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user's trips for the "add to itinerary" matching logic in the detail modal
  useEffect(() => {
    fetch("/api/trips")
      .then((r) => {
        if (r.ok) { setIsLoggedIn(true); return r.json(); }
        setIsLoggedIn(false);
        return { trips: [] };
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => setUserTrips(Array.isArray(data.trips) ? data.trips : []))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const days = buildDays(liveItems, startDate);
  const mapCenter = computeCenter(liveItems, destinationCity, destinationCountry ?? null);
  // Show only the open day's items on the map; fall back to all if no day is open
  const activeMarkers = openDay >= 0 && days[openDay]
    ? buildMarkersFromItems(days[openDay].items)
    : buildMarkersFromItems(liveItems);

  const recDayPills: { dayIndex: number; label: string }[] = (() => {
    if (!startDate) return [];
    const startD = parseDateForDisplay(startDate);
    if (isNaN(startD.getTime())) return [];
    const endD = endDate ? parseDateForDisplay(endDate) : startD;
    if (isNaN(endD.getTime())) return [];
    const diffDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    const n = Math.max(1, diffDays + 1);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
      return { dayIndex: i, label: `Day ${i + 1} · ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}` };
    });
  })();

  const recs = DESTINATION_RECS[destinationCity ?? ""] ?? [];
  const relatedTrips = RELATED_TRIPS_BY_DEST[destinationCity ?? ""] ?? [];
  const matchingTrips = userTrips.filter(
    (t) => t.destinationCity?.toLowerCase() === destinationCity?.toLowerCase()
  );

  const memberSummary = getMemberSummary(viewerMembers);

  async function handleAddToItinerary(tripId?: string): Promise<void> {
    if (!selectedItem) return;
    const itemId = selectedItem.id;
    const saveRes = await fetch("/api/saves/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceItemId: itemId }),
    });
    if (!saveRes.ok) return;
    const { savedItem } = await saveRes.json() as { savedItem?: { id: string } };
    if (tripId && savedItem?.id) {
      await fetch(`/api/saves/${savedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
    }
    setSavedSet((prev) => new Set(prev).add(itemId));
  }

  async function handleSaveActivity(itemId: string) {
    if (savedSet.has(itemId) || savingSet.has(itemId)) return;
    setSavingSet((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch("/api/saves/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemId: itemId }),
      });
      if (res.ok) {
        setSavedSet((prev) => new Set(prev).add(itemId));
      }
    } finally {
      setSavingSet((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }

  async function handleStealDay(dayItems: ActivityItem[]) {
    for (const item of dayItems) {
      await handleSaveActivity(item.id);
    }
  }

  const TABS = ["itinerary", "recommended"] as const;
  const TAB_LABELS = { itinerary: "Itinerary", recommended: "Recommended" };

  return (
    <div>
      {/* "Add to my trips" CTA bar */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.4 }}>
          Love this trip? Make it yours.
        </p>
        <button
          onClick={() => setShowCloneModal(true)}
          style={{ flexShrink: 0, backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "999px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Steal This Itinerary
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "0 20px" }}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, paddingTop: "4px", paddingBottom: "12px", fontSize: "15px", fontWeight: 600, color: active ? "#1a1a1a" : "#717171", backgroundColor: "transparent", border: "none", borderBottom: active ? "2.5px solid #C4664A" : "2.5px solid transparent", marginBottom: "-1px", cursor: "pointer" }}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Itinerary tab */}
      {tab === "itinerary" && (
        <div style={{ padding: "0 24px", overflowX: "hidden" }}>
          {/* Split layout — matches Okinawa exactly */}
          <div className="flex flex-col md:flex-row" style={{ gap: "24px", alignItems: "flex-start", paddingTop: "20px" }}>

            {/* Left panel: accordion */}
            <div ref={leftPanelRef} className="w-full md:w-[58%]" style={{ minWidth: 0 }}>
              <div style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", backgroundColor: "#fff" }}>
                {days.map((day, i) => {
                  const isOpen = openDay === i;
                  return (
                    <div key={i} style={{ borderBottom: i < days.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>

                      {/* Header row */}
                      <div
                        onClick={() => setOpenDay(isOpen ? -1 : i)}
                        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: "10px", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>Day {day.dayNum}</span>
                          <span style={{ fontSize: "13px", color: "#717171", whiteSpace: "nowrap" }}>{day.dateLabel}</span>
                          {!isOpen && day.items.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", overflow: "hidden", minWidth: 0 }}>
                              {day.items.slice(0, 2).map((item) => (
                                <span key={item.id} style={{ fontSize: "11px", background: "rgba(0,0,0,0.06)", color: "#666", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>
                                  {(item.rawTitle ?? "").length > 18 ? (item.rawTitle ?? "").slice(0, 18) + "…" : item.rawTitle}
                                </span>
                              ))}
                            </div>
                          )}
                          {!isOpen && day.items.length === 0 && (
                            <span style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>No activities</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                          <span style={{ fontSize: "13px", color: "#717171" }}>{day.items.length} stop{day.items.length !== 1 ? "s" : ""}</span>
                          {!isOwner && day.items.length > 0 && (() => {
                            const allSaved = day.items.every(it => savedSet.has(it.id));
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStealDay(day.items); }}
                                disabled={allSaved}
                                style={{ fontSize: "11px", fontWeight: 700, color: allSaved ? "#4a7c59" : "#fff", backgroundColor: allSaved ? "rgba(74,124,89,0.1)" : "#C4664A", border: allSaved ? "1px solid rgba(74,124,89,0.3)" : "none", borderRadius: "999px", padding: "3px 10px", cursor: allSaved ? "default" : "pointer", whiteSpace: "nowrap" }}
                              >
                                {allSaved ? "Flokked!" : "Steal this day"}
                              </button>
                            );
                          })()}
                          <ChevronDown size={16} style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }} />
                        </div>
                      </div>

                      {/* Expandable body */}
                      <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: isOpen ? "visible" : "hidden", transition: "max-height 0.3s ease" }}>
                        <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {isOwner ? (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleCommunityDragEnd(event, day.items)}
                            >
                              <SortableContext
                                items={day.items.map(item => item.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {day.items.map((item, idx) => {
                                  const saved = savedSet.has(item.id);
                                  const saving = savingSet.has(item.id);
                                  return (
                                    <SortableCommunityItem key={item.id} id={item.id}>
                                      {({ listeners, attributes }) => (
                                        <div style={{ display: "flex", alignItems: "stretch", gap: "0" }}>
                                          <div onClick={e => e.stopPropagation()} {...attributes} {...listeners}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", flexShrink: 0, cursor: "grab", touchAction: "none" }}>
                                            <GripVertical size={16} style={{ color: "#999" }} />
                                          </div>
                                          <div
                                            onClick={() => setSelectedItem(item)}
                                            style={{ flex: 1, display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", borderRadius: "10px", padding: "8px", margin: "-8px", transition: "background-color 0.1s" }}
                                            className="hover:bg-black/[0.02]"
                                          >
                                            {(item.placePhotoUrl ?? item.mediaThumbnailUrl) ? (
                                              <div style={{ width: "56px", height: "56px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${item.placePhotoUrl ?? item.mediaThumbnailUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                            ) : (
                                              <div style={{ width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, backgroundColor: "rgba(196,102,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span style={{ fontSize: "14px", fontWeight: 800, color: "#C4664A" }}>{idx + 1}</span>
                                              </div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{item.rawTitle}</p>
                                              {item.rawDescription && (
                                                <p style={{ fontSize: "12px", color: "#717171", marginTop: "2px", lineHeight: 1.4 }}>{item.rawDescription}</p>
                                              )}
                                              {item.categoryTags.length > 0 && (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
                                                  {item.categoryTags.slice(0, 3).map((tag) => (
                                                    <span key={tag} style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: "11px", padding: "2px 8px", borderRadius: "999px" }}>{tag}</span>
                                                  ))}
                                                </div>
                                              )}
                                              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleSaveActivity(item.id); }}
                                                  disabled={saved || saving}
                                                  style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: saved ? "rgba(74,124,89,0.1)" : "#C4664A", border: saved ? "1.5px solid rgba(74,124,89,0.3)" : "none", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: saved ? "#4a7c59" : "#fff", cursor: saved ? "default" : "pointer" }}
                                                >
                                                  {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                                                  {saving ? "Flokking…" : saved ? "Flokked" : "Flokk It"}
                                                </button>
                                                {item.lat != null && item.lng != null && (
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setFlyTarget({ lat: item.lat!, lng: item.lng! }); }}
                                                    style={{ display: "flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
                                                  >
                                                    <MapPin size={11} />
                                                    Map
                                                  </button>
                                                )}
                                                {item.sourceUrl && (
                                                  <a
                                                    href={item.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none" }}
                                                  >
                                                    <ExternalLink size={11} />
                                                    Book this
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </SortableCommunityItem>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {day.items.map((item, idx) => {
                                const saved = savedSet.has(item.id);
                                const saving = savingSet.has(item.id);
                                return (
                                  <div key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", borderRadius: "10px", padding: "8px", margin: "-8px", transition: "background-color 0.1s" }}
                                    className="hover:bg-black/[0.02]"
                                  >
                                    {(item.placePhotoUrl ?? item.mediaThumbnailUrl) ? (
                                      <div style={{ width: "56px", height: "56px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${item.placePhotoUrl ?? item.mediaThumbnailUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                    ) : (
                                      <div style={{ width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, backgroundColor: "rgba(196,102,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: "14px", fontWeight: 800, color: "#C4664A" }}>{idx + 1}</span>
                                      </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{item.rawTitle}</p>
                                      {item.rawDescription && (
                                        <p style={{ fontSize: "12px", color: "#717171", marginTop: "2px", lineHeight: 1.4 }}>{item.rawDescription}</p>
                                      )}
                                      {item.categoryTags.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
                                          {item.categoryTags.slice(0, 3).map((tag) => (
                                            <span key={tag} style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: "11px", padding: "2px 8px", borderRadius: "999px" }}>{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleSaveActivity(item.id); }}
                                          disabled={saved || saving}
                                          style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: saved ? "rgba(74,124,89,0.1)" : "#C4664A", border: saved ? "1.5px solid rgba(74,124,89,0.3)" : "none", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: saved ? "#4a7c59" : "#fff", cursor: saved ? "default" : "pointer" }}
                                        >
                                          {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                                          {saving ? "Flokking…" : saved ? "Flokked" : "Flokk It"}
                                        </button>
                                        {item.lat != null && item.lng != null && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setFlyTarget({ lat: item.lat!, lng: item.lng! }); }}
                                            style={{ display: "flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
                                          >
                                            <MapPin size={11} />
                                            Map
                                          </button>
                                        )}
                                        {item.sourceUrl && (
                                          <a
                                            href={item.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none" }}
                                          >
                                            <ExternalLink size={11} />
                                            Book this
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>{/* end left panel */}

            {/* Right panel: map — stacks below on mobile, sticky sidebar on desktop */}
            <div className="w-full md:w-[42%]" style={{ position: "sticky", top: 0, height: leftHeight ? `${leftHeight}px` : "300px", minHeight: "260px", maxHeight: "600px" }}>
              <CommunityTripMap
                allMarkers={activeMarkers}
                center={mapCenter}
                flyTarget={flyTarget}
                onFlyTargetConsumed={() => setFlyTarget(null)}
              />
            </div>{/* end right panel */}

          </div>
        </div>
      )}

      {/* Recommended tab */}
      {tab === "recommended" && (
        <div style={{ padding: "20px" }}>
          {/* Viewer context bar */}
          <div style={{ background: "rgba(196,102,74,0.07)", borderLeft: "3px solid #C4664A", padding: "12px 16px", marginBottom: "24px", borderRadius: "0 8px 8px 0" }}>
            <span style={{ fontSize: "12px", color: "#717171" }}>
              Showing recommendations for {memberSummary || "your family"} visiting {destinationCity ?? "this destination"}
            </span>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Recommended for your trip</p>
            <p style={{ fontSize: "13px", color: "#717171" }}>Curated picks families like yours love in {destinationCity ?? "this city"}</p>
          </div>

          {recs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <Sparkles size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Recommendations coming soon</p>
              <p style={{ fontSize: "13px", color: "#717171" }}>We&apos;re curating top picks for {destinationCity ?? "this destination"}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recs.map((rec) => (
                <div
                  key={rec.title}
                  onClick={() => setDrawerRec(rec)}
                  style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #F0F0F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", display: "flex", flexDirection: "row", cursor: "pointer" }}
                >
                  {/* Left: image */}
                  <div style={{ width: "112px", minWidth: "112px", height: "112px", flexShrink: 0, backgroundImage: `url('${rec.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  {/* Right: content */}
                  <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</p>
                      <p style={{ fontSize: "12px", color: "#717171", marginBottom: "2px" }}>
                        {rec.location.split(",")[0]} · {rec.tags.split(" · ")[0]}
                      </p>
                      <p style={{ fontSize: "12px", color: "#717171" }}>
                        {rec.tags.split(" · ")[1] ?? ""}{rec.tags.split(" · ")[2] ? " · " + rec.tags.split(" · ")[2] : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); if (!recAddedTitles.has(rec.title)) setDrawerRec(rec); }}
                        style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", backgroundColor: recAddedTitles.has(rec.title) ? "rgba(74,124,89,0.1)" : "#C4664A", color: recAddedTitles.has(rec.title) ? "#4a7c59" : "#fff", border: recAddedTitles.has(rec.title) ? "1px solid rgba(74,124,89,0.2)" : "none", cursor: recAddedTitles.has(rec.title) ? "default" : "pointer", whiteSpace: "nowrap" }}
                      >
                        {recAddedTitles.has(rec.title) ? "Saved ✓" : "+ Itinerary"}
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setDrawerRec(rec); }}
                        style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", backgroundColor: "#fff", color: "#1B3A5C", border: "1.5px solid #E0E0E0", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Learn more
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* More trips like this — always visible */}
      <div style={{ padding: "28px 20px 32px", borderTop: "1px solid #F0F0F0", marginTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>More trips families like yours loved</p>
          <Link href="/discover" style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
            See all <ChevronRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "12px" }}>
          {relatedTrips.map((trip) => (
            <Link
              key={`${trip.city}-${trip.country}`}
              href={trip.id ? `/trips/${trip.id}` : "/discover"}
              style={{ textDecoration: "none", display: "block", cursor: "pointer" }}
            >
              <div style={{ height: "160px", borderRadius: "14px", overflow: "hidden", position: "relative", backgroundImage: `url('${trip.img}')`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%)" }} />
                <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 2, pointerEvents: "none" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.city}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>{trip.country}</p>
                </div>
                <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 2, display: "flex", gap: "4px", flexWrap: "wrap", pointerEvents: "none" }}>
                  {trip.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: "999px", padding: "2px 7px", backdropFilter: "blur(4px)" }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recommendation drawer */}
      <RecommendationDrawer
        item={drawerRec}
        tripId={tripId}
        dayPills={recDayPills}
        onClose={() => setDrawerRec(null)}
        onAddedToDay={(_, title) => {
          setRecAddedTitles(prev => new Set([...prev, title]));
          setTimeout(() => setDrawerRec(null), 1200);
        }}
      />

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry ?? null}
          isSaved={savedSet.has(selectedItem.id)}
          isSaving={savingSet.has(selectedItem.id)}
          onSave={() => handleSaveActivity(selectedItem.id)}
          onClose={() => setSelectedItem(null)}
          isLoggedIn={isLoggedIn}
          matchingTrips={matchingTrips}
          onAddToItinerary={handleAddToItinerary}
        />
      )}

      {/* Clone modal */}
      {showCloneModal && (
        <CloneModal
          sourceTripId={tripId}
          defaultTitle={tripTitle}
          onClose={() => setShowCloneModal(false)}
        />
      )}
    </div>
  );
}
