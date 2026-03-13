"use client";

import { useState, useRef, useEffect } from "react";
import { type LucideIcon } from "lucide-react";
import {
  BedDouble,
  Plane,
  Utensils,
  Compass,
  MapPin,
  Users,
  Instagram,
  Play,
  Link as LinkIcon,
  Camera,
  Mail,
  Car,
  GripVertical,
  Plus,
  Sparkles,
  Landmark,
  TreePine,
  Sun,
  Cloud,
  CloudRain,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  FileText,
  Baby,
  Shirt,
  Backpack,
  Square,
  CheckSquare,
  Moon,
  Waves,
  Weight,
  Share2,
  ChevronDown,
  DollarSign,
  Star,
} from "lucide-react";
import { TripMap } from "@/components/features/trips/TripMap";

type Tab = "saved" | "itinerary" | "recommended" | "packing";

// ── Shared sub-components ────────────────────────────────────────────────────

function SourceIcon({ type }: { type: string }) {
  const s = { size: 14, strokeWidth: 2 };
  switch (type) {
    case "INSTAGRAM": return <Instagram {...s} style={{ color: "#E1306C" }} />;
    case "TIKTOK":    return <Play {...s} style={{ color: "#1a1a1a" }} />;
    case "GOOGLE_MAPS": return <MapPin {...s} style={{ color: "#C4664A" }} />;
    case "IN_APP":    return <Compass {...s} style={{ color: "#6B8F71" }} />;
    case "EMAIL_IMPORT": return <Mail {...s} style={{ color: "#717171" }} />;
    case "PHOTO_IMPORT": return <Camera {...s} style={{ color: "#717171" }} />;
    default:          return <LinkIcon {...s} style={{ color: "#717171" }} />;
  }
}

function CategoryIcon({ tags }: { tags: string[] }) {
  const all = tags.join(" ");
  if (/food|dining|restaurant|street/.test(all)) return <Utensils size={15} style={{ color: "#C4664A" }} />;
  if (/history|culture|castle|temple|heritage/.test(all)) return <Landmark size={15} style={{ color: "#6B8F71" }} />;
  if (/outdoor|nature|park|beach|hike/.test(all)) return <TreePine size={15} style={{ color: "#6B8F71" }} />;
  return <MapPin size={15} style={{ color: "#717171" }} />;
}

// ── Itinerary sub-components ─────────────────────────────────────────────────

function NoteField() {
  const [val, setVal] = useState("");
  return (
    <textarea
      value={val}
      onChange={(e) => setVal(e.target.value)}
      placeholder="Add notes for this day..."
      rows={2}
      style={{
        width: "100%",
        marginTop: "10px",
        padding: "8px 10px",
        fontSize: "13px",
        color: "#555",
        backgroundColor: "#F5F5F5",
        border: "none",
        borderRadius: "8px",
        resize: "none",
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    />
  );
}

function FilledSlot({
  time,
  title,
  subtitle,
  img,
  icon,
  iconBg = "#e4dfd6",
  tags,
}: {
  time?: string;
  title: string;
  subtitle: string;
  img?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  tags?: string[];
}) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      {/* TODO: Implement drag-and-drop reordering
           Suggested library: @dnd-kit/core
           Behavior:
             - Drag within a day to reorder activities
             - Drag between day cards to move to different day
             - On drop, recalculate travel time connectors
             - Persist order to trip state / database
           Priority: Phase 1 polish, post-beta */}
      <GripVertical size={14} style={{ color: "#d0cbc2", flexShrink: 0 }} />
      {img ? (
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "8px",
            flexShrink: 0,
            backgroundImage: `url('${img}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : (
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "8px",
            flexShrink: 0,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{title}</p>
        <p style={{ fontSize: "12px", color: "#717171", marginTop: "2px" }}>{subtitle}</p>
        {tags && tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: "rgba(0,0,0,0.05)",
                  color: "#666",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  display: "inline-block",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {time && (
        <span style={{ fontSize: "12px", color: "#717171", flexShrink: 0 }}>{time}</span>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      style={{
        height: "56px",
        border: "1.5px dashed rgba(196,102,74,0.3)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        cursor: "pointer",
        color: "#C4664A",
      }}
    >
      <Plus size={14} />
      <span style={{ fontSize: "13px", fontWeight: 600 }}>Add activity</span>
    </div>
  );
}

function TravelConnector({ duration }: { duration: string }) {
  return (
    <div
      style={{
        margin: "2px 0 2px 22px",
        paddingLeft: "16px",
        borderLeft: "1.5px dashed #ddd",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        minHeight: "18px",
      }}
    >
      <Car size={10} style={{ color: "#717171" }} />
      <span style={{ fontSize: "11px", color: "#717171" }}>{duration}</span>
    </div>
  );
}

function DayCard({
  dayNum,
  dateStr,
  weatherIcon,
  weatherTemp,
  dayCost,
  children,
}: {
  dayNum: number;
  dateStr: string;
  weatherIcon: React.ReactNode;
  weatherTemp: string;
  dayCost: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "#FAFAFA",
        borderRadius: "14px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        borderLeft: "3px solid rgba(196,102,74,0.3)",
        padding: "14px 14px 10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#1a1a1a" }}>Day {dayNum}</span>
          <span style={{ fontSize: "12px", color: "#ccc" }}>·</span>
          <span style={{ fontSize: "12px", color: "#717171" }}>{dateStr}</span>
          <span style={{ fontSize: "12px", color: "#ccc" }}>·</span>
          {weatherIcon}
          <span style={{ fontSize: "12px", color: "#717171" }}>{weatherTemp}</span>
        </div>
        <span style={{ fontSize: "13px", color: "#717171", fontWeight: 500, flexShrink: 0 }}>{dayCost}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {children}
      </div>
      <NoteField />
    </div>
  );
}

function AIBanner() {
  return (
    <div
      style={{
        backgroundColor: "rgba(196,102,74,0.07)",
        border: "1.5px solid rgba(196,102,74,0.22)",
        borderRadius: "12px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Sparkles size={16} style={{ color: "#C4664A", flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>3 open days spotted</p>
          <p style={{ fontSize: "12px", color: "#717171" }}>Want AI to suggest family activities?</p>
        </div>
      </div>
      <button
        style={{
          backgroundColor: "#C4664A",
          color: "#fff",
          border: "none",
          borderRadius: "20px",
          padding: "7px 14px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Suggest
      </button>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
  "Day 1 — Sun May 4",
  "Day 2 — Mon May 5",
  "Day 3 — Tue May 6",
  "Day 4 — Wed May 7",
  "Day 5 — Thu May 8",
];

function AssignDayControl({ cardTitle, dayAssignments, openDayDropdown, setOpenDayDropdown, setDayAssignments }: {
  cardTitle: string;
  dayAssignments: Record<string, string>;
  openDayDropdown: string | null;
  setOpenDayDropdown: (v: string | null) => void;
  setDayAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const assigned = dayAssignments[cardTitle];
  if (assigned) {
    return <span style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600 }}>{assigned}</span>;
  }
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpenDayDropdown(openDayDropdown === cardTitle ? null : cardTitle); }}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#C4664A" }}
      >
        + Assign to day
      </button>
      {openDayDropdown === cardTitle && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderRadius: "8px", zIndex: 50, minWidth: "200px", overflow: "hidden" }}
        >
          {DAY_OPTIONS.map((day) => (
            <button
              key={day}
              onClick={(e) => { e.stopPropagation(); setDayAssignments((prev) => ({ ...prev, [cardTitle]: day })); setOpenDayDropdown(null); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: "13px", color: "#1a1a1a", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFFFFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            >
              {day}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type TripSavedItemForDisplay = {
  id: string;
  rawTitle: string | null;
  mediaThumbnailUrl: string | null;
  categoryTags: string[];
  sourceType: string;
  savedAt: string;
  destinationCity: string | null;
  destinationCountry: string | null;
};

function SavedContent({ tripId }: { tripId?: string }) {
  const [items, setItems] = useState<TripSavedItemForDisplay[]>([]);
  const [loadingItems, setLoadingItems] = useState(!!tripId);

  useEffect(() => {
    if (!tripId) { setLoadingItems(false); return; }
    function fetchItems() {
      fetch(`/api/saves?tripId=${tripId}`)
        .then(r => r.json())
        .then(data => { setItems(data.saves ?? []); setLoadingItems(false); })
        .catch(() => setLoadingItems(false));
    }
    fetchItems();
    window.addEventListener("flokk:refresh", fetchItems);
    return () => window.removeEventListener("flokk:refresh", fetchItems);
  }, [tripId]);

  // Deduplicate by id (guards against double-writes in DB)
  const dedupedItems = items.filter((item, idx, arr) => arr.findIndex(i => i.id === item.id) === idx);

  // Group by first category tag, sorted alphabetically
  const grouped: Record<string, TripSavedItemForDisplay[]> = {};
  for (const item of dedupedItems) {
    const cat = item.categoryTags[0] ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  const SOURCE_LABEL: Record<string, string> = {
    INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
    MANUAL: "Web", IN_APP: "In-app", EMAIL_IMPORT: "Email", PHOTO_IMPORT: "Photo",
  };

  if (loadingItems) {
    return <div style={{ textAlign: "center", padding: "32px", color: "#999", fontSize: "14px" }}>Loading…</div>;
  }

  if (dedupedItems.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📌</div>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Nothing saved yet</p>
        <p style={{ fontSize: "13px", color: "#717171" }}>Drop a link or save a recommendation to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {sortedGroups.map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{cat}</span>
            <span style={{ fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{catItems.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {catItems.map(item => {
              const location = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
              return (
                <div key={item.id} style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "3px solid rgba(196,102,74,0.3)", padding: "12px", display: "flex", gap: "12px", alignItems: "flex-start", minHeight: "88px" }}>
                  {item.mediaThumbnailUrl ? (
                    <div style={{ width: "72px", height: "72px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${item.mediaThumbnailUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  ) : (
                    <div style={{ width: "72px", height: "72px", borderRadius: "8px", flexShrink: 0, backgroundColor: "#E8E4DE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Compass size={22} style={{ color: "#999" }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", lineHeight: 1.3 }}>{item.rawTitle ?? "Untitled"}</p>
                    {location && (
                      <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "4px" }}>
                        <MapPin size={10} style={{ color: "#717171", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", color: "#717171" }}>{location}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                      {item.categoryTags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.05)", color: "#666", borderRadius: "20px", padding: "2px 8px" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: "10px", color: "#BBBBBB", marginTop: "4px" }}>
                      via {SOURCE_LABEL[item.sourceType] ?? item.sourceType}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Itinerary tab ─────────────────────────────────────────────────────────────

// TODO: Real-time sync implementation
// When a user saves a new item on mobile:
//   1. SavedItem created via share-to-app
//   2. Inngest extraction pipeline fires
//   3. On completion, check if destination matches
//      any active trip
//   4. If match found, push notification:
//      "You saved [item] — add it to [Trip]?"
//   5. If user confirms, item appears in trip
//      Saved tab and can be dragged to itinerary
//
// Real-time updates via Supabase realtime
// subscriptions on the SavedItem table
// Filter by family_id and matching destination
//
// Priority: Phase 2 feature, design for it now
// Accordion day config — static for now, dynamic in Phase 2
const ACCORDION_DAYS = [
  { dayNum: 1, dateStr: "Sun, May 4",  weatherIcon: <Sun size={12} style={{ color: "#717171" }} />,       temp: "29°C", cost: "$420", previews: ["JAL 917", "Halekulani", "Kokusai-dori"] },
  { dayNum: 2, dateStr: "Mon, May 5",  weatherIcon: <Cloud size={12} style={{ color: "#717171" }} />,      temp: "27°C", cost: "$95",  previews: ["Katsuren Castle"] },
  { dayNum: 3, dateStr: "Tue, May 6",  weatherIcon: <Sun size={12} style={{ color: "#717171" }} />,        temp: "31°C", cost: "$0",   previews: [] },
  { dayNum: 4, dateStr: "Wed, May 7",  weatherIcon: <CloudRain size={12} style={{ color: "#717171" }} />,  temp: "24°C", cost: "$0",   previews: [] },
  { dayNum: 5, dateStr: "Thu, May 8",  weatherIcon: <Sun size={12} style={{ color: "#717171" }} />,        temp: "28°C", cost: "$150", previews: ["Halekulani Checkout"] },
];

function ItineraryContent({ flyTarget, onFlyTargetConsumed }: { flyTarget: { lat: number; lng: number } | null; onFlyTargetConsumed: () => void }) {
  const [openDay, setOpenDay] = useState(0); // -1 = all collapsed
  const [notes, setNotes] = useState(["", "", "", "", ""]);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Sync map height to accordion panel height via ResizeObserver
  // TODO: Real-time sync implementation
  //   - WebSocket or Supabase Realtime channel per trip
  //   - All trip members subscribe on mount, unsubscribe on unmount
  //   - Events: day_updated, item_added, item_reordered, note_changed
  //   - Optimistic updates: apply locally first, reconcile on server ack
  //   - Conflict resolution: last-write-wins per field (sufficient for v1)
  //   - Presence: show avatars of who is currently viewing each day
  //   - Priority: Phase 2 — design state shape now, wire up after MVP
  useEffect(() => {
    if (!leftPanelRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setLeftHeight(entry.contentRect.height);
    });
    ro.observe(leftPanelRef.current);
    return () => ro.disconnect();
  }, []);

  const toggle = (i: number) => setOpenDay((prev) => (prev === i ? -1 : i));

  return (
    <div style={{ overflowX: "hidden" }}>

      {/* Budget bar — trip-level, full width */}
      <div style={{ padding: "16px 0", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fff", marginBottom: "16px", borderRadius: "12px", paddingLeft: "16px", paddingRight: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Trip budget</span>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>$1,312 of $3,500</span>
        </div>
        <div style={{ height: "6px", background: "#eee", borderRadius: "3px", marginBottom: "8px" }}>
          <div style={{ width: "37%", height: "100%", background: "#C4664A", borderRadius: "3px" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#717171" }}>Transportation + lodging booked</span>
          <span style={{ fontSize: "12px", color: "#C4664A", fontWeight: 500 }}>$2,188 remaining</span>
        </div>
      </div>

      {/* Booking status bar — trip-level, full width */}
      <div
        style={{
          backgroundColor: "rgba(196,102,74,0.06)",
          border: "1px solid rgba(196,102,74,0.15)",
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <CheckCircle size={14} style={{ color: "#4a7c59", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "#4a7c59" }}>2 items booked</span>
          </div>
          <span style={{ fontSize: "12px", color: "#ddd" }}>·</span>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <AlertCircle size={14} style={{ color: "#C4664A", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "#C4664A" }}>2 activities need reservations</span>
          </div>
          <span style={{ fontSize: "12px", color: "#ddd" }}>·</span>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Clock size={14} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "#717171" }}>3 days unplanned</span>
          </div>
        </div>
        {/* TODO: "Handle it" opens a slide-up panel showing
            items with requires_booking: true for this trip
            Each item shows: name, booking URL (affiliate_url),
            estimated cost, and a "Book now" CTA
            Priority: Phase 2 — affiliate/booking layer */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            backgroundColor: "transparent", border: "none", padding: 0,
            cursor: "pointer", flexShrink: 0, color: "#C4664A",
            fontSize: "13px", fontWeight: 700,
          }}
        >
          Handle it
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Split content area */}
      <div className="flex flex-col md:flex-row" style={{ gap: "24px", alignItems: "flex-start" }}>

        {/* Left panel: accordion */}
        <div ref={leftPanelRef} className="w-full md:w-[58%]" style={{ minWidth: 0 }}>
          <div style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", backgroundColor: "#fff" }}>
            {ACCORDION_DAYS.map((day, i) => {
              const isOpen = openDay === i;
              return (
                <div key={i} style={{ borderBottom: i < ACCORDION_DAYS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>

                  {/* Header row — always visible */}
                  <div
                    onClick={() => toggle(i)}
                    className="hover:bg-black/[0.02]"
                    style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: "10px", userSelect: "none" }}
                  >
                    {/* Left: day label + date + weather + preview pills (collapsed only) */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>Day {day.dayNum}</span>
                      <span style={{ fontSize: "13px", color: "#717171", whiteSpace: "nowrap" }}>{day.dateStr}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "#717171", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {day.weatherIcon}&nbsp;{day.temp}
                      </div>
                      {!isOpen && day.previews.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", overflow: "hidden", minWidth: 0 }}>
                          {day.previews.map((p) => (
                            <span key={p} style={{ fontSize: "11px", background: "rgba(0,0,0,0.06)", color: "#666", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{p}</span>
                          ))}
                        </div>
                      )}
                      {!isOpen && day.previews.length === 0 && (
                        <span style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>No activities</span>
                      )}
                    </div>
                    {/* Right: cost + chevron */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span style={{ fontSize: "13px", color: "#717171" }}>{day.cost}</span>
                      <ChevronDown size={16} style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }} />
                    </div>
                  </div>

                  {/* Expandable body */}
                  <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
                    <div style={{ padding: "4px 16px 16px" }}>

                      {/* Day 1 */}
                      {i === 0 && (
                        <>
                          <FilledSlot
                            time="14:30"
                            title="Arrive Naha (JAL 917)"
                            subtitle="2h 45m · Economy"
                            icon={<Plane size={20} style={{ color: "#717171" }} />}
                          />
                          <TravelConnector duration="45 min drive" />
                          <FilledSlot
                            time="16:00"
                            title="Halekulani Okinawa"
                            subtitle="Check-in · Onna Village"
                            img="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80"
                          />
                          <TravelConnector duration="20 min drive" />
                          <FilledSlot
                            time="19:30"
                            title="Kokusai-dori Street Food"
                            subtitle="Dinner · Naha"
                            img="https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=200&q=80"
                            tags={["All ages", "Walk-in", "Evening"]}
                          />
                        </>
                      )}

                      {/* Day 2 */}
                      {i === 1 && (
                        <>
                          <FilledSlot
                            time="09:00"
                            title="Katsuren Castle Ruins"
                            subtitle="Uruma · 2 hours · History"
                            icon={<Landmark size={24} style={{ color: "#fff" }} />}
                            iconBg="#c8b89a"
                            tags={["Ages 6+", "Outdoor", "Free"]}
                          />
                          <EmptySlot />
                          <EmptySlot />
                        </>
                      )}

                      {/* Day 3 */}
                      {i === 2 && (
                        <>
                          <AIBanner />
                          <EmptySlot />
                          <EmptySlot />
                          <EmptySlot />
                        </>
                      )}

                      {/* Day 4 */}
                      {i === 3 && (
                        <>
                          <AIBanner />
                          <EmptySlot />
                          <EmptySlot />
                          <EmptySlot />
                        </>
                      )}

                      {/* Day 5 */}
                      {i === 4 && (
                        <>
                          <FilledSlot
                            time="11:00"
                            title="Halekulani Checkout"
                            subtitle="Then to Naha Airport"
                            icon={<BedDouble size={20} style={{ color: "#717171" }} />}
                            tags={["11am checkout", "To airport"]}
                          />
                          <EmptySlot />
                        </>
                      )}

                      {/* Per-day notes */}
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                        <textarea
                          value={notes[i]}
                          onChange={(e) => setNotes((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                          placeholder="Add notes for this day..."
                          rows={2}
                          style={{ width: "100%", resize: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: "#333", background: "rgba(0,0,0,0.02)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>

                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>{/* end left panel */}

        {/* Right panel: map — stacks below on mobile, sticky sidebar on desktop */}
        <div className="w-full md:w-[42%]" style={{ position: "sticky", top: 0, height: leftHeight ? `${leftHeight}px` : "300px", minHeight: "260px", maxHeight: "600px" }}>
          <TripMap activeDay={openDay >= 0 ? openDay : 0} flyTarget={flyTarget} onFlyTargetConsumed={onFlyTargetConsumed} />
        </div>{/* end right panel */}

      </div>
    </div>
  );
}

// ── Packing tab ───────────────────────────────────────────────────────────────

function SmartTag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ backgroundColor: "rgba(196,102,74,0.1)", color: "#C4664A", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
      {icon}{text}
    </span>
  );
}

type PackingItemDef = { id: string; label: string; assignee?: string; tagNode?: React.ReactNode };

const PACKING_ITEMS: { documents: PackingItemDef[]; kids: PackingItemDef[]; clothing: PackingItemDef[]; gear: PackingItemDef[] } = {
  documents: [
    { id: "passports",             label: "Passports",                      assignee: "Matt" },
    { id: "travel-insurance",      label: "Travel insurance",               assignee: "Matt" },
    { id: "rail-passes",           label: "Japan rail passes",              assignee: "Matt" },
    { id: "hotel-confirmations",   label: "Hotel confirmation printouts",   assignee: "Matt" },
  ],
  kids: [
    { id: "sunscreen",       label: "Sunscreen SPF 50+",         assignee: "Both" },
    { id: "insect-repellent",label: "Insect repellent",          assignee: "Both" },
    { id: "motion-sickness", label: "Motion sickness tablets",   assignee: "Sarah" },
    { id: "snacks",          label: "Portable snacks",           assignee: "Sarah" },
    { id: "travel-games",    label: "Travel games / tablet",     assignee: "Kids" },
  ],
  clothing: [
    { id: "swimwear",       label: "Swimwear (beach days)",              assignee: "Everyone" },
    { id: "light-layers",   label: "Light layers (evenings)",            assignee: "Everyone" },
    { id: "walking-shoes",  label: "Comfortable walking shoes",          assignee: "Everyone" },
    { id: "rain-jacket",    label: "Rain jacket (Day 4 forecast)",       assignee: "Everyone",
      tagNode: <SmartTag icon={<CloudRain size={11} />} text="Day 4 · 24°C" /> },
  ],
  gear: [
    { id: "underwater-camera", label: "Underwater camera",        assignee: "Matt" },
    { id: "power-adapter",     label: "Universal power adapter",  assignee: "Matt" },
    { id: "portable-charger",  label: "Portable charger",         assignee: "Sarah" },
  ],
};

const TODDLER_ITEMS: PackingItemDef[] = [
  { id: "stroller",     label: "Foldable travel stroller",       assignee: "Matt",  tagNode: <SmartTag icon={<Baby size={11} />}  text="Ages under 5" /> },
  { id: "white-noise",  label: "Portable white noise machine",   assignee: "Sarah", tagNode: <SmartTag icon={<Moon size={11} />}  text="Sleep aid" /> },
  { id: "snorkel-kids", label: "Snorkel gear (kids sizes)",      assignee: "Matt",  tagNode: <SmartTag icon={<Waves size={11} />} text="Okinawa beaches" /> },
];

function PackingItem({ id, label, assignee, tagNode, checked, onToggle }: PackingItemDef & { checked: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      onClick={() => onToggle(id)}
      style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", background: "none", border: "none", padding: "7px 0", cursor: "pointer", textAlign: "left" }}
    >
      {checked ? (
        <CheckSquare size={18} style={{ color: "#C4664A", flexShrink: 0 }} />
      ) : (
        <Square size={18} style={{ color: "#ccc", flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "14px", color: checked ? "#bbb" : "#1a1a1a", textDecoration: checked ? "line-through" : "none" }}>
          {label}
        </span>
        {assignee && (
          <span style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#666", fontSize: "11px", borderRadius: "999px", padding: "2px 8px", display: "inline-flex", marginLeft: "8px", flexShrink: 0 }}>
            {assignee}
          </span>
        )}
      </span>
      {tagNode}
    </button>
  );
}

function PackingSection({ Icon, photoUrl, gradient, label, count, note, children }: {
  Icon: LucideIcon;
  photoUrl?: string;
  gradient?: string;
  label: string;
  count: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", marginBottom: "24px", display: "flex", flexDirection: "column" }}>
      {/* Desktop: photo/gradient card header */}
      <div className="hidden md:block" style={{ height: "72px", position: "relative", flexShrink: 0, margin: 0, paddingBottom: 0, borderRadius: 0 }}>
        {gradient
          ? <div style={{ position: "absolute", inset: 0, background: gradient }} />
          : <div style={{ position: "absolute", inset: 0, backgroundImage: `url('${photoUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        }
        {!gradient && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.22) 100%)" }} />}
        <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", alignItems: "center", paddingLeft: "20px", paddingRight: "60px" }}>
          <div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: gradient ? "22px" : "18px", color: "#fff", fontWeight: 700, lineHeight: 1.2, textShadow: gradient ? "0 1px 4px rgba(0,0,0,0.2)" : "none" }}>
              {label} <span style={{ fontSize: "13px", fontWeight: 400, opacity: 0.75 }}>· {count}</span>
            </p>
            {note && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginTop: "3px" }}>{note}</p>}
          </div>
        </div>
        <div style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", zIndex: 2, opacity: 0.6 }}>
          <Icon size={20} style={{ color: "#fff" }} />
        </div>
      </div>

      {/* Mobile: plain icon + text header */}
      <div className="flex md:hidden items-center justify-between" style={{ marginBottom: "10px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "5px" }}>
          <Icon size={14} style={{ color: "#717171" }} />{label}
        </span>
        <span style={{ fontSize: "12px", color: "#bbb" }}>{count}</span>
      </div>

      {/* Items card — seamlessly connected below header */}
      <div style={{ flex: 1, backgroundColor: "#FAFAFA", borderLeft: "3px solid rgba(196,102,74,0.3)", padding: "16px 14px 4px", margin: 0, borderTop: "none", borderRadius: 0, boxShadow: "none" }}>
        {children}
      </div>
    </div>
  );
}

function PackingContent() {
  const [checked, setChecked] = useState<Set<string>>(new Set(["passports", "travel-insurance"]));

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allItems = [
    ...PACKING_ITEMS.documents, ...PACKING_ITEMS.kids,
    ...PACKING_ITEMS.clothing,  ...PACKING_ITEMS.gear,
    ...TODDLER_ITEMS,
  ];
  const total = allItems.length;
  const packed = checked.size;
  const progressPct = Math.round((packed / total) * 100);

  return (
    <div>
      {/* Summary row */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <p style={{ fontSize: "13px", color: "#717171" }}>{total} items · {packed} packed</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Weight size={13} style={{ color: "#717171" }} />
              <span style={{ fontSize: "13px", color: "#717171" }}>~14kg</span>
            </div>
            <span style={{ fontSize: "12px", color: "#ccc" }}>·</span>
            <button style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <Share2 size={13} style={{ color: "#C4664A" }} />
              <span style={{ fontSize: "13px", color: "#C4664A" }}>Share list</span>
            </button>
          </div>
        </div>
        <div style={{ height: "4px", backgroundColor: "#EEEEEE", borderRadius: "2px" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, backgroundColor: "#C4664A", borderRadius: "2px", transition: "width 0.2s" }} />
        </div>
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Left: Documents + Kids */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <PackingSection Icon={FileText} photoUrl="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop" label="Documents" count={PACKING_ITEMS.documents.length}>
            {PACKING_ITEMS.documents.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          <PackingSection Icon={Baby} photoUrl="https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600&auto=format&fit=crop" label="Kids" count={PACKING_ITEMS.kids.length}>
            {PACKING_ITEMS.kids.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
        </div>

        {/* Right: Clothing + Gear + Toddler */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <PackingSection Icon={Shirt} gradient="linear-gradient(135deg, #8B6F5E 0%, #C4A882 50%, #D4956A 100%)" label="Clothing" count={PACKING_ITEMS.clothing.length}>
            {PACKING_ITEMS.clothing.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          <PackingSection Icon={Backpack} photoUrl="https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?w=600&auto=format&fit=crop" label="Gear" count={PACKING_ITEMS.gear.length}>
            {PACKING_ITEMS.gear.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          <PackingSection
            Icon={Baby}
            photoUrl="https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=600&auto=format&fit=crop"
            label="Toddler & Young Kids"
            count={TODDLER_ITEMS.length}
            note="Auto-suggested · Ages 4 & 7"
          >
            {TODDLER_ITEMS.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
            {/* AI suggestion row within section */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", margin: "6px 0 4px", padding: "10px 14px", border: "1.5px dashed rgba(196,102,74,0.3)", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={13} style={{ color: "#C4664A", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "#717171" }}>Reef-safe sunscreen recommended for Okinawa</span>
              </div>
              <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C4664A", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>
                + Add
              </button>
            </div>
          </PackingSection>
        </div>

      </div>

      {/* AI suggestion */}
      <div style={{ backgroundColor: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A", borderRadius: "12px", padding: "14px 16px", marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <Sparkles size={14} style={{ color: "#C4664A", flexShrink: 0, marginTop: "2px" }} />
          <p style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: 1.4 }}>
            Based on your itinerary we suggest adding snorkel gear and reef-safe sunscreen
          </p>
        </div>
        <button style={{ backgroundColor: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#C4664A", fontSize: "13px", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
          Add to list →
        </button>
      </div>

      {/* Add item */}
      <button style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "16px", backgroundColor: "transparent", border: "none", padding: "4px 0", cursor: "pointer", color: "#C4664A" }}>
        <Plus size={15} />
        <span style={{ fontSize: "13px", fontWeight: 600 }}>Add an item</span>
      </button>
    </div>
  );
}

// ── Recommended tab ───────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
  {
    title: "Cape Manzamo",
    location: "Onna Village",
    tags: "Outdoor · Free · 1 hr",
    match: "Scenic views · Easy walk · All ages",
    img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&auto=format&fit=crop&q=80",
    saved: 1840,
    lat: 26.3998,
    lng: 127.7159,
  },
  {
    title: "Shuri Castle",
    location: "Naha",
    tags: "Culture · $8 · 2 hrs",
    match: "History & Culture · Ages 5+ · UNESCO site",
    img: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=400&auto=format&fit=crop&q=80",
    saved: 2210,
    lat: 26.2172,
    lng: 127.7197,
  },
  {
    title: "Okinawa World & Cave",
    location: "Nanjo",
    tags: "Activity · $25 · Half day",
    match: "Adventure · Ages 4+ · Kids love this",
    img: "https://images.unsplash.com/photo-1504870712357-65ea720d6078?w=400&auto=format&fit=crop&q=80",
    saved: 1650,
    lat: 26.1613,
    lng: 127.7714,
  },
  {
    title: "American Village Mihama",
    location: "Chatan",
    tags: "Food · Free · 2–3 hrs",
    match: "Street Food · Evening · All ages",
    img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&auto=format&fit=crop&q=80",
    saved: 980,
    lat: 26.3109,
    lng: 127.7540,
  },
  {
    title: "Nago Pineapple Park",
    location: "Nago",
    tags: "Kids · $15 · 1.5 hrs",
    match: "Unique to Okinawa · Ages 3+ · Self-guided tour",
    img: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&auto=format&fit=crop&q=80",
    saved: 760,
    lat: 26.6017,
    lng: 127.9711,
  },
  {
    title: "Onna Village Snorkeling",
    location: "Onna Village",
    tags: "Outdoor · $45 · Half day",
    match: "Beach & Water · Ages 6+ · Gear in packing list",
    img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80",
    saved: 1320,
    lat: 26.4969,
    lng: 127.8574,
  },
];

function RecommendedContent({
  tripId,
  tripStartDate,
  tripEndDate,
  onViewOnMap,
  onSaved,
}: {
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onViewOnMap: (lat: number, lng: number) => void;
  onSaved: (rec: SavedRec) => void;
}) {
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [pendingRec, setPendingRec] = useState<string | null>(null);
  const [pendingDayIndex, setPendingDayIndex] = useState<number | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("");

  function generateDayPillsForRec(start: string | null, end: string | null): { dayIndex: number; label: string }[] {
    if (!start) return [];
    const startD = new Date(start);
    const endD = end ? new Date(end) : startD;
    const n = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(startD);
      d.setDate(startD.getDate() + i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { dayIndex: i + 1, label: `Day ${i + 1} · ${dateStr}` };
    });
  }
  const recDayPills = generateDayPillsForRec(tripStartDate ?? null, tripEndDate ?? null);
  const CATEGORY_OPTIONS_REC = ["Culture", "Food", "Kids", "Lodging", "Outdoor", "Shopping", "Transportation"];

  async function handleSave(rec: typeof RECOMMENDATIONS[0], dayIndex: number | null, category: string) {
    if (savedSet.has(rec.title) || savingTitle === rec.title) return;
    setSavingTitle(rec.title);
    setPendingRec(null);
    try {
      const cat = category || rec.tags.split(" · ")[0];
      await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://flokk.app/rec/${encodeURIComponent(rec.title)}`,
          tripId: tripId ?? undefined,
          title: rec.title,
          description: rec.match,
          thumbnailUrl: rec.img,
          tags: [cat],
          lat: rec.lat,
          lng: rec.lng,
          dayIndex: dayIndex ?? undefined,
        }),
      });
      setSavedSet((prev) => new Set([...prev, rec.title]));
      onSaved({ title: rec.title, location: rec.location, img: rec.img, tags: rec.tags });
      window.dispatchEvent(new Event("flokk:refresh"));
    } finally {
      setSavingTitle(null);
    }
  }

  // Group by category (first segment of tags), sort categories and items alphabetically
  const grouped = RECOMMENDATIONS.reduce((acc, rec) => {
    const cat = rec.tags.split(" · ")[0];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rec);
    return acc;
  }, {} as Record<string, typeof RECOMMENDATIONS>);
  const sortedCategories = Object.keys(grouped).sort();
  sortedCategories.forEach((cat) => grouped[cat].sort((a, b) => a.title.localeCompare(b.title)));

  return (
    <div>
      {/* Family context bar */}
      <div style={{ background: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A", padding: "12px 16px", marginBottom: "24px", borderRadius: "0 8px 8px 0" }}>
        <span style={{ fontSize: "12px", color: "#717171" }}>
          Showing recommendations for 2 adults + 2 kids (ages 7 &amp; 4) · Street Food, Outdoor, Culture interests · Mid-range budget
        </span>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Recommended for your trip</div>
        <div style={{ fontSize: "13px", color: "#717171" }}>Based on your family&apos;s interests and what families like yours loved</div>
      </div>

      {/* Cards grouped by category */}
      {sortedCategories.map((cat) => (
        <div key={cat} style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "10px", marginBottom: "12px", borderBottom: "1px solid #EEEEEE" }}>
            {cat}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {grouped[cat].map((rec) => {
              const isSaved = savedSet.has(rec.title);
              const isSaving = savingTitle === rec.title;
              const isPending = pendingRec === rec.title;
              return (
                <div key={rec.title} style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  <RecCard
                    rec={rec}
                    isSaved={isSaved}
                    isSaving={isSaving}
                    onToggle={() => {
                      if (isSaved || isSaving) return;
                      setPendingRec(rec.title);
                      setPendingDayIndex(null);
                      setPendingCategory(rec.tags.split(" · ")[0]);
                    }}
                    onViewOnMap={(lat, lng) => onViewOnMap(lat, lng)}
                  />
                  {isPending && (
                    <div style={{ backgroundColor: "#FAFAFA", borderRadius: "0 0 12px 12px", border: "1px solid #EEEEEE", borderTop: "none", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {recDayPills.length > 0 && (
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "7px" }}>Which day?</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            <button type="button" onClick={() => setPendingDayIndex(null)} style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "1.5px solid", borderColor: pendingDayIndex === null ? "#C4664A" : "#DDD", backgroundColor: pendingDayIndex === null ? "#C4664A" : "#fff", color: pendingDayIndex === null ? "#fff" : "#666", cursor: "pointer" }}>
                              No specific day
                            </button>
                            {recDayPills.map(({ dayIndex, label }) => (
                              <button type="button" key={dayIndex} onClick={() => setPendingDayIndex(dayIndex)} style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "1.5px solid", borderColor: pendingDayIndex === dayIndex ? "#C4664A" : "#DDD", backgroundColor: pendingDayIndex === dayIndex ? "#C4664A" : "#fff", color: pendingDayIndex === dayIndex ? "#fff" : "#666", cursor: "pointer" }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "7px" }}>Category</p>
                        <select
                          value={pendingCategory}
                          onChange={e => setPendingCategory(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #E0E0E0", fontSize: "13px", color: "#1a1a1a", backgroundColor: "#fff", outline: "none", cursor: "pointer" }}
                        >
                          <option value="">No category</option>
                          {CATEGORY_OPTIONS_REC.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={() => setPendingRec(null)} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "1.5px solid #DDD", backgroundColor: "#fff", fontSize: "12px", fontWeight: 600, color: "#717171", cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button type="button" onClick={() => handleSave(rec, pendingDayIndex, pendingCategory)} style={{ flex: 2, padding: "9px", borderRadius: "8px", border: "none", backgroundColor: "#C4664A", fontSize: "12px", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                          {pendingDayIndex !== null ? `Save to Day ${pendingDayIndex} →` : "Save to trip →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecCard({ rec, isSaved, isSaving, onToggle, onViewOnMap }: { rec: typeof RECOMMENDATIONS[0]; isSaved: boolean; isSaving: boolean; onToggle: () => void; onViewOnMap: (lat: number, lng: number) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "3px solid rgba(196,102,74,0.3)", padding: "12px", display: "flex", gap: "12px", alignItems: "flex-start", minHeight: "110px" }}>
      {imgFailed ? (
        <div style={{ width: "80px", height: "80px", borderRadius: "8px", flexShrink: 0, backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Compass size={24} style={{ color: "#999" }} />
        </div>
      ) : (
        <>
          <div style={{ width: "80px", height: "80px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${rec.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <img src={rec.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
        </>
      )}
              <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>{rec.title}</p>
          <span style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0, marginLeft: "8px", marginTop: "2px" }}>
            <MapPin size={10} style={{ color: "#717171" }} />
            <span style={{ fontSize: "11px", color: "#717171" }}>{rec.location}</span>
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "3px" }}>{rec.tags}</p>
        <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
          <Sparkles size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
          {rec.match}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            onClick={isSaved || isSaving ? undefined : onToggle}
            style={{ fontSize: "12px", fontWeight: 600, color: isSaved ? "#4a7c59" : isSaving ? "#717171" : "#C4664A", backgroundColor: isSaved ? "rgba(74,124,89,0.1)" : isSaving ? "rgba(0,0,0,0.05)" : "transparent", border: isSaved ? "1px solid rgba(74,124,89,0.2)" : isSaving ? "1px solid #ddd" : "none", borderRadius: "20px", padding: (isSaved || isSaving) ? "3px 10px" : "0", cursor: (isSaved || isSaving) ? "default" : "pointer" }}
          >
            {isSaved ? "Saved ✓" : isSaving ? "Saving..." : "+ Save to trip"}
          </span>
          <button
            onClick={() => onViewOnMap(rec.lat, rec.lng)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#C4664A", display: "flex", alignItems: "center", gap: "3px" }}
          >
            <MapPin size={11} style={{ color: "#C4664A" }} />
            View on map
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
          <Users size={12} style={{ color: "#717171", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "#717171" }}>{rec.saved.toLocaleString()} families saved this</span>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type SavedRec = {
  title: string;
  location: string;
  img: string;
  tags: string;
};

export function TripTabContent({ initialTab = "saved", tripId, tripStartDate, tripEndDate }: { initialTab?: Tab; tripId?: string; tripStartDate?: string | null; tripEndDate?: string | null }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div style={{ padding: "0 24px", overflowX: "hidden" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          marginBottom: "20px",
        }}
      >
        {(["Saved", "Itinerary", "Recommended", "Packing"] as const).map((label) => {
          const key = label.toLowerCase() as Tab;
          const active = tab === key;
          return (
            <button
              key={label}
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                paddingTop: "4px",
                paddingBottom: "12px",
                fontSize: "15px",
                fontWeight: 600,
                color: active ? "#1a1a1a" : "#717171",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: active ? "2.5px solid #C4664A" : "2.5px solid transparent",
                marginBottom: "-1px",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "saved" && <SavedContent tripId={tripId} />}
      {tab === "itinerary" && <ItineraryContent flyTarget={flyTarget} onFlyTargetConsumed={() => setFlyTarget(null)} />}
      {tab === "packing" && <PackingContent />}
      {tab === "recommended" && (
        <RecommendedContent
          tripId={tripId}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onViewOnMap={(lat, lng) => { setTab("itinerary"); setFlyTarget({ lat, lng }); }}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
