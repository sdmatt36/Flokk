"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Tag, Bookmark, BookmarkCheck, Sparkles, Users, ChevronRight, ChevronDown, X, Calendar } from "lucide-react";
import { CommunityTripMap, type MarkerDef } from "./CommunityTripMap";
import Link from "next/link";

export type ActivityItem = {
  id: string;
  rawTitle: string | null;
  rawDescription: string | null;
  categoryTags: string[];
  dayIndex: number | null;
  lat?: number | null;
  lng?: number | null;
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
    { title: "Kiyomizudera Temple", location: "Higashiyama, Kyoto", tags: "Culture · Free · 1.5 hrs", match: "UNESCO site · Hilltop views · All ages", img: "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=400&auto=format&fit=crop&q=80", saved: 3210, lat: 34.9948, lng: 135.7851 },
    { title: "Tea Ceremony in Gion", location: "Gion, Kyoto", tags: "Culture · $30 · 1 hr", match: "Traditional experience · Hands-on · Ages 5+", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop&q=80", saved: 1870, lat: 35.0033, lng: 135.7764 },
    { title: "Toei Kyoto Studio Park", location: "Uzumasa, Kyoto", tags: "Kids · $15 · Half day", match: "Samurai & ninja shows · Ages 4+ · Unique to Kyoto", img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&auto=format&fit=crop&q=80", saved: 940, lat: 35.0189, lng: 135.7047 },
    { title: "Nishiki Market Street Food", location: "Central Kyoto", tags: "Food · Free · 1–2 hrs", match: "Street snacks · Covered arcade · All ages", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=80", saved: 2650, lat: 35.0042, lng: 135.7657 },
    { title: "Kibune Shrine & River Walk", location: "Kibune, Kyoto", tags: "Outdoor · Free · 2 hrs", match: "Nature · Lantern-lit path · All ages", img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&auto=format&fit=crop&q=80", saved: 1140, lat: 35.1113, lng: 135.7488 },
    { title: "Fushimi Momoyama Castle", location: "Fushimi, Kyoto", tags: "History · $5 · 1.5 hrs", match: "Samurai history · Hilltop · Kids love the walls", img: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=400&auto=format&fit=crop&q=80", saved: 810, lat: 34.9441, lng: 135.7730 },
  ],
  Madrid: [
    { title: "Santiago Bernabéu Stadium Tour", location: "Chamartín, Madrid", tags: "Sports · $35 · 1.5 hrs", match: "Football fans · Ages 6+ · Unique experience", img: "https://images.unsplash.com/photo-1551958219-acbc630e2914?w=400&auto=format&fit=crop&q=80", saved: 2890, lat: 40.4531, lng: -3.6883 },
    { title: "Aquópolis Water Park", location: "Villanueva de la Cañada", tags: "Kids · $30 · Full day", match: "Summer essential · Ages 3+ · Waterslides", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop&q=80", saved: 1560, lat: 40.4449, lng: -3.9972 },
    { title: "Reina Sofía Museum", location: "Atocha, Madrid", tags: "Culture · $12 · 2 hrs", match: "Guernica · Modern art · Ages 8+", img: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=400&auto=format&fit=crop&q=80", saved: 2140, lat: 40.4080, lng: -3.6944 },
    { title: "Parque de Atracciones", location: "Casa de Campo, Madrid", tags: "Kids · $35 · Half day", match: "Rides & roller coasters · Ages 3+ · Family classic", img: "https://images.unsplash.com/photo-1513002749826-77c61bfa41b8?w=400&auto=format&fit=crop&q=80", saved: 1230, lat: 40.4085, lng: -3.7517 },
    { title: "Flamenco Show at Corral de la Morería", location: "Opera, Madrid", tags: "Culture · $45 · 1.5 hrs", match: "Authentic tablao · Evening · Ages 7+", img: "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=400&auto=format&fit=crop&q=80", saved: 1740, lat: 40.4150, lng: -3.7126 },
    { title: "Chocolatería San Ginés", location: "Sol, Madrid", tags: "Food · $8 · 30 min", match: "Best churros con chocolate in Madrid · All ages", img: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&auto=format&fit=crop&q=80", saved: 3380, lat: 40.4157, lng: -3.7077 },
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

function buildDays(items: ActivityItem[], startDate: string | null): DayEntry[] {
  const byDay = new Map<number, ActivityItem[]>();
  for (const item of items) {
    if (item.dayIndex === null || item.dayIndex === 0) continue;
    const arr = byDay.get(item.dayIndex) ?? [];
    arr.push(item);
    byDay.set(item.dayIndex, arr);
  }
  const dayNums = Array.from(byDay.keys()).sort((a, b) => a - b);
  return dayNums.map((d) => {
    let dateLabel = `Day ${d}`;
    if (startDate) {
      const base = new Date(startDate);
      base.setDate(base.getDate() + (d - 1));
      dateLabel = base.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return { dayNum: d, dateLabel, items: byDay.get(d) ?? [] };
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

function computeCenter(items: ActivityItem[]): [number, number] {
  const pts = items.filter((i) => i.lat != null && i.lng != null && i.dayIndex !== 0);
  if (pts.length === 0) return [0, 20];
  const avgLng = pts.reduce((sum, p) => sum + p.lng!, 0) / pts.length;
  const avgLat = pts.reduce((sum, p) => sum + p.lat!, 0) / pts.length;
  return [avgLng, avgLat];
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

// ── Main export ──────────────────────────────────────────────────────────────

export function CommunityTripView({
  items,
  startDate,
  tripId,
  tripTitle,
  destinationCity,
  viewerMembers,
}: {
  items: ActivityItem[];
  startDate: string | null;
  tripId: string;
  tripTitle: string;
  destinationCity: string | null;
  viewerMembers: ViewerMember[];
}) {
  const [tab, setTab] = useState<"itinerary" | "recommended">("itinerary");
  const [openDay, setOpenDay] = useState(0); // 0-indexed; -1 = all collapsed
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set());
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leftPanelRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setLeftHeight(entry.contentRect.height);
    });
    ro.observe(leftPanelRef.current);
    return () => ro.disconnect();
  }, []);

  const days = buildDays(items, startDate);
  const mapCenter = computeCenter(items);
  const allMarkers = buildAllMarkers(days);

  const recs = DESTINATION_RECS[destinationCity ?? ""] ?? [];
  const relatedTrips = RELATED_TRIPS_BY_DEST[destinationCity ?? ""] ?? [];

  const memberSummary = getMemberSummary(viewerMembers);

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
          style={{ flexShrink: 0, backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "999px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          + Add to my trips
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
                          <ChevronDown size={16} style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }} />
                        </div>
                      </div>

                      {/* Expandable body */}
                      <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
                        <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {day.items.map((item, idx) => {
                            const saved = savedSet.has(item.id);
                            const saving = savingSet.has(item.id);
                            return (
                              <div key={item.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                {/* Number badge — mirrors Okinawa's icon box */}
                                <div style={{ width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, backgroundColor: "rgba(196,102,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#C4664A" }}>{idx + 1}</span>
                                </div>
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
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px" }}>
                                    <button
                                      onClick={() => handleSaveActivity(item.id)}
                                      disabled={saved || saving}
                                      style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: saved ? "rgba(74,124,89,0.1)" : "transparent", border: `1.5px solid ${saved ? "rgba(74,124,89,0.3)" : "#C4664A"}`, borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: saved ? "#4a7c59" : "#C4664A", cursor: saved ? "default" : "pointer" }}
                                    >
                                      {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                                      {saving ? "Saving…" : saved ? "Saved" : "Save"}
                                    </button>
                                    {item.lat != null && item.lng != null && (
                                      <button
                                        onClick={() => setFlyTarget({ lat: item.lat!, lng: item.lng! })}
                                        style={{ display: "flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
                                      >
                                        <MapPin size={11} />
                                        Map
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>{/* end left panel */}

            {/* Right panel: sticky map — height synced to accordion via ResizeObserver */}
            <div className="hidden md:block md:w-[42%]" style={{ position: "sticky", top: 0, height: leftHeight ? `${leftHeight}px` : "600px" }}>
              <CommunityTripMap
                allMarkers={allMarkers}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {recs.map((rec) => (
                <div key={rec.title} style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1px solid #EEEEEE", borderLeft: "3px solid rgba(196,102,74,0.3)", padding: "12px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "10px", flexShrink: 0, backgroundImage: `url('${rec.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "3px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a" }}>{rec.title}</p>
                    </div>
                    <p style={{ fontSize: "12px", color: "#717171", marginBottom: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                      <MapPin size={10} />
                      {rec.location}
                    </p>
                    <p style={{ fontSize: "12px", color: "#555", marginBottom: "4px" }}>{rec.tags}</p>
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Sparkles size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
                      {rec.match}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => { setTab("itinerary"); setFlyTarget({ lat: rec.lat, lng: rec.lng }); }}
                        style={{ display: "flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
                      >
                        <MapPin size={11} />
                        View on map
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <Users size={11} style={{ color: "#AAAAAA" }} />
                        <span style={{ fontSize: "11px", color: "#AAAAAA" }}>{rec.saved.toLocaleString()} families saved</span>
                      </div>
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
            <Link key={`${trip.city}-${trip.country}`} href={trip.id ? `/trips/${trip.id}` : "/discover"} style={{ textDecoration: "none" }}>
              <div style={{ height: "160px", borderRadius: "14px", overflow: "hidden", position: "relative", backgroundImage: `url('${trip.img}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%)" }} />
                <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 2 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.city}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>{trip.country}</p>
                </div>
                <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 2, display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {trip.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: "999px", padding: "2px 7px", backdropFilter: "blur(4px)" }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

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
