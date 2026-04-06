"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";

function cleanDisplayDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/^\d[\d,.KkMmBb]*\s*likes?,[\s\S]*?:\s*/i, "");
  s = s.replace(/^[\w.]+\s+on\s+\w+:\s*/i, "");
  s = s.replace(/#\w+/g, "");
  s = s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FEFF}\u{2300}-\u{27FF}]/gu, "");
  s = s.replace(/[\s.,"'"""]+$/, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 200 ? s.substring(0, 200) + "..." : s;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}
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
  Check,
  Settings,
  ChevronDown,
  DollarSign,
  Star,
  Bookmark,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { TripMap } from "@/components/features/trips/TripMap";
import { DropLinkModal } from "@/components/features/home/DropLinkModal";
import { RecommendationDrawer, type DrawerRec } from "@/components/features/trips/RecommendationDrawer";
import { AddFlightModal } from "@/components/flights/AddFlightModal";
import { EditFlightModal } from "@/components/flights/EditFlightModal";
import { AddActivityModal, type ExistingActivity } from "@/components/activities/AddActivityModal";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { parseDateForDisplay } from "@/lib/dates";
import { getTripCoverImage, getItemImage } from "@/lib/destination-images";
import { BookingIntelCard } from "@/components/features/trips/BookingIntelCard";
import { ShareTripButton } from "@/components/features/trips/ShareTripButton";

type Tab = "saved" | "itinerary" | "recommended" | "packing" | "notes" | "vault" | "howwasit";

type Flight = {
  id: string;
  type: string;
  airline: string;
  flightNumber: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration?: string | null;
  cabinClass: string;
  confirmationCode?: string | null;
  seatNumbers?: string | null;
  notes?: string | null;
  dayIndex?: number | null;
  status?: string;
  sortOrder?: number;
};

type Activity = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  address?: string | null;
  website?: string | null;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;
  status: string;
  confirmationCode?: string | null;
  dayIndex?: number | null;
  sortOrder?: number;
  lat?: number | null;
  lng?: number | null;
};

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
  description,
  hours,
  slotKey,
  isExpanded,
  onExpandToggle,
  onRemove,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleListeners,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleAttributes,
}: {
  time?: string;
  title: string;
  subtitle: string;
  img?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  tags?: string[];
  description?: string;
  hours?: string;
  slotKey?: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onRemove?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleListeners?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleAttributes?: any;
}) {
  const [note, setNote] = useState("");
  const isClickable = !!onExpandToggle;

  return (
    <div style={{ marginBottom: "2px" }}>
      <div
        onClick={onExpandToggle}
        style={{
          display: "flex", gap: "10px", alignItems: "center",
          cursor: isClickable ? "pointer" : "default",
          borderRadius: isExpanded ? "8px 8px 0 0" : "8px",
          padding: "4px",
          margin: "-4px",
          transition: "background-color 0.1s",
        }}
        className={isClickable ? "hover:bg-black/[0.02]" : ""}
      >
        <span
          onClick={e => e.stopPropagation()}
          {...(dragHandleAttributes ?? {})}
          {...(dragHandleListeners ?? {})}
          style={{ cursor: dragHandleListeners ? "grab" : "default", flexShrink: 0, lineHeight: 0, display: "flex", alignItems: "center", padding: "2px 4px", borderRadius: "4px" }}
        >
          <GripVertical size={16} style={{ color: dragHandleListeners ? "#777" : "#ccc" }} />
        </span>
        {img ? (
          <div
            style={{
              width: "56px", height: "56px", borderRadius: "8px", flexShrink: 0,
              backgroundImage: `url('${img}')`, backgroundSize: "cover", backgroundPosition: "center",
            }}
          />
        ) : (
          <div
            style={{
              width: "56px", height: "56px", borderRadius: "8px", flexShrink: 0,
              backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
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
                <span key={tag} style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: "11px", padding: "2px 8px", borderRadius: "999px", display: "inline-block" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {time && <span style={{ fontSize: "12px", color: "#717171", flexShrink: 0 }}>{time}</span>}
        {isClickable && (
          <ChevronDown size={14} style={{ color: "#aaa", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
        )}
      </div>

      {/* Inline expanded detail */}
      {isExpanded && (
        <div style={{ backgroundColor: "#F9F9F9", borderRadius: "0 0 8px 8px", padding: "12px 16px", borderTop: "1px solid #E8E8E8", display: "flex", flexDirection: "column", gap: "8px" }}>
          {description && <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5, margin: 0 }}>{description}</p>}
          {hours && (
            <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
              <span style={{ fontWeight: 600, color: "#555" }}>Hours: </span>{hours}
            </p>
          )}
          <div>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note..."
              style={{ width: "100%", fontSize: "13px", color: "#555", border: "1px solid #E8E8E8", borderRadius: "6px", padding: "6px 10px", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {onRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ alignSelf: "flex-start", fontSize: "12px", color: "#e53e3e", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
            >
              Remove from itinerary
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function EmptySlot({ onClick }: { onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
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

function AIBanner({ onSuggest }: { onSuggest: () => void }) {
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
        onClick={onSuggest}
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
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  categoryTags: string[];
  sourceType: string;
  savedAt: string;
  destinationCity: string | null;
  destinationCountry: string | null;
};

// ── Static Okinawa saved items ─────────────────────────────────────────────

type SavedDisplayItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  statusBooked: boolean;
  families: string;
  img: string;
  icon: React.ReactNode;
  bookUrl?: string;
  websiteUrl?: string;
  description?: string;
  isLodging?: boolean;
  lodgingDates?: { checkin: string | null; checkout: string | null };
  categoryTags?: string[];
};


const TRIP_DAYS = [
  { dayIndex: 0, label: "Day 1", date: "Sun May 4", shortDate: "Sun May 4" },
  { dayIndex: 1, label: "Day 2", date: "Mon May 5", shortDate: "Mon May 5" },
  { dayIndex: 2, label: "Day 3", date: "Tue May 6", shortDate: "Tue May 6" },
  { dayIndex: 3, label: "Day 4", date: "Wed May 7", shortDate: "Wed May 7" },
  { dayIndex: 4, label: "Day 5", date: "Thu May 8", shortDate: "Thu May 8" },
];

// Convert "HH:MM" to minutes since midnight for sorting; null/undefined → Infinity (float to bottom)
function timeToMinutes(t: string | null | undefined): number {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Format "HH:MM" → "6:30 PM"
function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Returns a display time for an item. If the item has a real startTime, returns it.
// For untimed saves/activities, infers a sensible default based on when other items are scheduled:
// all before noon → place after at 2 PM; all after noon → place before at 9 AM; mixed → 12 PM.
// Returns null for non-save/activity types (flights, trains, lodging) so they never show approx times.
function getDisplayTime(
  startTime: string | null | undefined,
  itemType: string,
  allDayItems: { startTime?: string | null }[]
): string | null {
  if (startTime) return startTime;
  if (itemType !== "saved" && itemType !== "activity") return null;

  const timedItems = allDayItems.filter(i => i.startTime != null && i.startTime !== "");
  if (timedItems.length === 0) return "10:00";

  const allBeforeNoon = timedItems.every(i => parseInt(i.startTime!.split(":")[0], 10) < 12);
  const allAfterNoon = timedItems.every(i => parseInt(i.startTime!.split(":")[0], 10) >= 12);

  if (allBeforeNoon) return "14:00";
  if (allAfterNoon) return "09:00";
  return "12:00";
}

function generateTripDays(
  startDate: string | null,
  endDate: string | null
): { dayIndex: number; label: string; date: string; shortDate: string }[] {
  if (!startDate) return TRIP_DAYS;
  const start = parseDateForDisplay(startDate);
  if (isNaN(start.getTime())) return TRIP_DAYS;
  const end = endDate ? parseDateForDisplay(endDate) : start;
  if (isNaN(end.getTime())) return TRIP_DAYS;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const n = Math.max(1, diff + 1);
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateStr = `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    const shortDateStr = `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return { dayIndex: i, label: `Day ${i + 1}`, date: dateStr, shortDate: shortDateStr };
  });
}

function SavedDayPickerModal({ itemTitle, tripStartDate, tripEndDate, onConfirm, onClose }: {
  itemTitle: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onConfirm: (dayIndex: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const days = generateTripDays(tripStartDate ?? null, tripEndDate ?? null);
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 32px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>Which day?</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#999", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>Add <strong>{itemTitle}</strong> to your itinerary</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {days.map(({ dayIndex, label, date }) => (
            <button
              key={dayIndex}
              type="button"
              onClick={e => { e.stopPropagation(); setSelected(dayIndex); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: "12px", border: "1.5px solid",
                borderColor: selected === dayIndex ? "#C4664A" : "#EEEEEE",
                backgroundColor: selected === dayIndex ? "rgba(196,102,74,0.06)" : "#fff",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{label}</span>
              <span style={{ fontSize: "13px", color: "#717171" }}>{date}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { if (selected !== null) onConfirm(selected); }}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px", border: "none",
            backgroundColor: selected !== null ? "#C4664A" : "#E0E0E0",
            color: selected !== null ? "#fff" : "#aaa",
            fontSize: "15px", fontWeight: 700, cursor: selected !== null ? "pointer" : "default",
          }}
        >
          {selected !== null ? `Add to ${days[selected]?.label ?? `Day ${selected + 1}`} →` : "Select a day"}
        </button>
      </div>
    </div>,
    document.body
  );
}

function LodgingDateModal({ itemTitle, onConfirm, onClose }: {
  itemTitle: string;
  onConfirm: (checkin: string, checkout: string) => void;
  onClose: () => void;
}) {
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 32px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>When are you staying?</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#999", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>Add <strong>{itemTitle}</strong> to your itinerary</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#555", display: "block", marginBottom: "4px" }}>Check-in</label>
            <input
              type="date"
              value={checkin}
              onChange={e => setCheckin(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #EEEEEE", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#555", display: "block", marginBottom: "4px" }}>Check-out</label>
            <input
              type="date"
              value={checkout}
              onChange={e => setCheckout(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #EEEEEE", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (checkin && checkout) onConfirm(checkin, checkout); }}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px", border: "none",
            backgroundColor: checkin && checkout ? "#C4664A" : "#E0E0E0",
            color: checkin && checkout ? "#fff" : "#aaa",
            fontSize: "15px", fontWeight: 700, cursor: checkin && checkout ? "pointer" : "default",
          }}
        >
          Add to itinerary
        </button>
      </div>
    </div>,
    document.body
  );
}

function SavedDetailModal({ item, onClose, onAddToItinerary, onMarkBooked, onDelete, assignedDay }: {
  item: SavedDisplayItem;
  onClose: () => void;
  onAddToItinerary?: () => void;
  onMarkBooked?: () => void;
  onDelete?: () => void;
  assignedDay?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = item.title.replace(/^www\./, "").charAt(0).toUpperCase();
  const categoryLabel = item.categoryTags?.slice(0, 2).join(" · ") ?? "";
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Hero */}
        <div style={{ position: "relative" }}>
          {!imgFailed && item.img ? (
            <>
              <div style={{ height: "200px", backgroundImage: `url('${item.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
            </>
          ) : (
            <div style={{ height: "160px", background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "48px", fontWeight: 900, color: "rgba(255,255,255,0.35)" }}>{initial}</span>
            </div>
          )}
          <button onClick={onClose} style={{ position: "absolute", top: "12px", right: "12px", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", lineHeight: 1 }}>×</button>
          {item.statusBooked && (
            <span style={{ position: "absolute", bottom: "12px", left: "12px", fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(74,124,89,0.9)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>Booked ✓</span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 20px 24px" }}>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>{item.title}</p>
          {categoryLabel && (
            <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, backgroundColor: "rgba(196,102,74,0.1)", color: "#C4664A", borderRadius: "999px", padding: "2px 10px", marginBottom: "8px" }}>{categoryLabel}</span>
          )}
          {item.detail && <p style={{ fontSize: "13px", color: "#717171", marginBottom: "12px" }}>{item.detail}</p>}
          {item.description && (
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "16px" }}>{item.description}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {item.bookUrl && (
              <button type="button" onClick={() => window.open(item.bookUrl, "_blank")}
                style={{ padding: "12px", borderRadius: "12px", border: "none", backgroundColor: "#C4664A", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                Book now
              </button>
            )}
            {!item.bookUrl && item.websiteUrl && (
              <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", padding: "12px", borderRadius: "12px", border: "none", backgroundColor: "#1B3A5C", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", textAlign: "center", textDecoration: "none" }}>
                Visit site →
              </a>
            )}
            {!item.statusBooked && onMarkBooked && (
              <button type="button" onClick={onMarkBooked}
                style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: "transparent", border: "1.5px solid #C4664A", fontSize: "14px", fontWeight: 700, color: "#C4664A", cursor: "pointer" }}>
                Book it →
              </button>
            )}
            {assignedDay !== undefined ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", borderRadius: "999px", backgroundColor: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.2)" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#4a7c59" }}>✓ Added to Day {assignedDay + 1}</span>
              </div>
            ) : onAddToItinerary && (
              <button type="button" onClick={onAddToItinerary}
                style={{ padding: "11px", borderRadius: "999px", backgroundColor: "transparent", border: "1.5px solid #C4664A", fontSize: "13px", fontWeight: 700, color: "#C4664A", cursor: "pointer" }}>
                + Add to itinerary
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete}
                style={{ padding: "10px", borderRadius: "999px", backgroundColor: "transparent", border: "1px solid rgba(220,53,69,0.25)", fontSize: "13px", fontWeight: 600, color: "#dc3545", cursor: "pointer" }}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Renders ALL savedItem types including URL saves,
// manual saves, and activity saves created via the Activity button.
// ActivityCard is for manualActivity DB rows only.
function SavedHorizCard({ item, isDesktop: _isDesktop, onAddToItinerary, onBook, onLearnMore, assignedDay, onDelete }: {
  item: SavedDisplayItem;
  isDesktop: boolean;
  onAddToItinerary: () => void;
  onBook: () => void;
  onLearnMore: () => void;
  assignedDay?: number;
  onDelete?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImg = !!item.img && !imgFailed;
  const initial = item.title.replace(/^www\./, "").charAt(0).toUpperCase();
  const subtitleParts = [
    item.categoryTags?.slice(0, 1)[0],
    item.detail,
  ].filter(Boolean);
  const subtitle = subtitleParts.length > 1 ? subtitleParts.join(" · ") : subtitleParts[0] ?? "";
  return (
    <div
      onClick={onLearnMore}
      style={{ backgroundColor: "#fff", borderRadius: "14px", border: "1px solid #EEEEEE", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: "10px", cursor: "pointer" }}
    >
      {/* Header: thumbnail or navy gradient with initial */}
      {hasImg ? (
        <>
          <div style={{ height: "80px", backgroundImage: `url('${item.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
        </>
      ) : (
        <div style={{ height: "60px", background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "22px", fontWeight: 900, color: "rgba(255,255,255,0.55)", letterSpacing: "-0.5px" }}>{initial}</span>
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        {/* Title + booked badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "2px" }}>
          <p style={{ fontSize: "14px", fontWeight: 800, color: "#1B3A5C", lineHeight: 1.3, flex: 1, minWidth: 0 }}>{item.title}</p>
          {item.statusBooked && (
            <span style={{ fontSize: "10px", fontWeight: 600, borderRadius: "999px", padding: "2px 8px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)", whiteSpace: "nowrap", flexShrink: 0 }}>Booked</span>
          )}
        </div>
        {/* Subtitle: category + detail */}
        {subtitle && (
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "10px", lineHeight: 1.4 }}>{subtitle}</p>
        )}
        {/* Action row */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
          {assignedDay !== undefined ? (
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)", whiteSpace: "nowrap" }}>
              ✓ Day {assignedDay + 1}
            </span>
          ) : (
            <button type="button" onClick={e => { e.stopPropagation(); onAddToItinerary(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add to itinerary
            </button>
          )}
          {item.bookUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); onBook(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Book</button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onLearnMore(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Learn more</button>
          {onDelete && (
            <button type="button" onClick={e => { e.stopPropagation(); onDelete(); }} style={{ fontSize: "10px", padding: "4px 7px", borderRadius: "999px", border: "1px solid rgba(220,53,69,0.25)", backgroundColor: "transparent", color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center", marginLeft: "auto" }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SAVED_FILTER_PILLS = ["All", "Culture", "Food", "Kids", "Lodging", "Outdoor", "Shopping", "Transportation", "Unorganized"];

// ── Real saved items helpers ──────────────────────────────────────────────────

type ApiSavedItem = {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  rawTitle: string | null;
  rawDescription: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  extractedCheckin: string | null;
  extractedCheckout: string | null;
  isBooked: boolean;
  dayIndex?: number | null;
};

function inferSavedCategory(item: ApiSavedItem): string {
  const haystack = [...item.categoryTags, item.rawTitle ?? "", item.sourceUrl ?? ""].join(" ").toLowerCase();
  if (/lodg|hotel|resort|hostel|airbnb\.com|booking\.com|vrbo|accommodation/.test(haystack)) return "LODGING";
  if (/flight|airline|airfare|transport|koreanair|asiana|united\.com|delta\.com|aa\.com|jal\.|ana\.|singaporeair|cathaypacific|qatarairways|emirates\.com|etihad|lufthansa|airfrance|britishairways|ba\.com|southwest|ryanair|easyjet|google\.com\/travel\/flights/.test(haystack)) return "AIRFARE";
  if (/restaurant|food|dining|eat|cafe|market|bar|kitchen|street food/.test(haystack)) return "RESTAURANTS";
  return "ACTIVITIES";
}

function apiToDisplayItem(item: ApiSavedItem): SavedDisplayItem {
  const cat = inferSavedCategory(item);
  const urlHost = (item.sourceUrl ?? "").replace(/^https?:\/\//, "").split("/")[0];
  let detail = "";
  if (cat === "LODGING" && (item.extractedCheckin || item.extractedCheckout)) {
    detail = [item.extractedCheckin, item.extractedCheckout].filter(Boolean).join(" → ");
  } else {
    const desc = item.rawDescription ?? "";
    detail = desc.length > 0 ? desc.slice(0, 80) : urlHost;
  }
  const icon = cat === "LODGING" ? <BedDouble size={18} style={{ color: "#C4664A" }} />
    : cat === "AIRFARE" ? <Plane size={18} style={{ color: "#C4664A" }} />
    : cat === "RESTAURANTS" ? <Utensils size={18} style={{ color: "#C4664A" }} />
    : <Compass size={18} style={{ color: "#C4664A" }} />;
  const isBookable = item.sourceUrl ? /airbnb\.com|booking\.com|hotels\.com|expedia\.com/.test(item.sourceUrl) : false;
  const LODGING_TAGS = /lodging|accommodation|hotel|airbnb|hostel/i;
  const tagsStr = item.categoryTags.join(" ");
  const isLodging = LODGING_TAGS.test(tagsStr);
  // Use domain as fallback if rawTitle is missing or looks like a raw URL
  const safeTitle = (item.rawTitle && !item.rawTitle.startsWith("http")) ? item.rawTitle : urlHost;
  return {
    id: item.id,
    title: safeTitle,
    detail,
    status: item.isBooked ? "Booked" : "Saved",
    statusBooked: item.isBooked,
    families: "",
    img: getItemImage(item.rawTitle, item.placePhotoUrl, item.mediaThumbnailUrl, item.categoryTags[0] ?? null, item.destinationCity, item.destinationCountry),
    icon,
    bookUrl: isBookable ? (item.sourceUrl ?? undefined) : undefined,
    websiteUrl: item.sourceUrl ?? undefined,
    description: item.rawDescription ?? "",
    isLodging,
    lodgingDates: { checkin: item.extractedCheckin, checkout: item.extractedCheckout },
    categoryTags: item.categoryTags,
  };
}

function SavedContent({ tripId: tripIdProp, tripStartDate, tripEndDate, tripTitle, onSwitchToItinerary }: { tripId?: string; tripStartDate?: string | null; tripEndDate?: string | null; tripTitle?: string; onSwitchToItinerary?: () => void }) {
  const isDesktop = useIsDesktop();
  const [dayPickerItem, setDayPickerItem] = useState<SavedDisplayItem | null>(null);
  const [lodgingDateItem, setLodgingDateItem] = useState<SavedDisplayItem | null>(null);
  const [detailItem, setDetailItem] = useState<SavedDisplayItem | null>(null);
  const [assignedDays, setAssignedDays] = useState<Record<string, number>>({});
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leftSections, setLeftSections] = useState<{ category: string; items: SavedDisplayItem[] }[]>([]);
  const [rightSections, setRightSections] = useState<{ category: string; items: SavedDisplayItem[] }[]>([]);
  const [dropLinkOpen, setDropLinkOpen] = useState(false);
  const [allScheduled, setAllScheduled] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  const fetchSaves = useCallback(() => {
    if (!tripIdProp) { setLoading(false); return; }
    fetch(`/api/saves?tripId=${tripIdProp}`, { cache: "no-store" })
      .then(r => r.json())
      .then(({ saves }: { saves: ApiSavedItem[] }) => {
        if (!saves?.length) {
          setLeftSections([]);
          setRightSections([]);
          setAllScheduled(false);
          setLoading(false);
          return;
        }
        const groups: Record<string, SavedDisplayItem[]> = {};
        const preAssigned: Record<string, number> = {};
        let scheduledCount = 0;
        for (const s of saves) {
          const cat = inferSavedCategory(s);
          if (cat === "AIRFARE") continue; // flights are managed in the Itinerary tab
          const display = apiToDisplayItem(s);
          if (s.dayIndex != null) { preAssigned[display.title] = s.dayIndex; scheduledCount++; }
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(display);
        }
        setAllScheduled(false);
        setAssignedDays(preAssigned);
        const left: { category: string; items: SavedDisplayItem[] }[] = [];
        const right: { category: string; items: SavedDisplayItem[] }[] = [];
        const LEFT_CATS = ["LODGING", "AIRFARE"];
        for (const [cat, items] of Object.entries(groups)) {
          if (LEFT_CATS.includes(cat)) left.push({ category: cat, items });
          else right.push({ category: cat, items });
        }
        setLeftSections(left);
        setRightSections(right);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tripIdProp]);

  useEffect(() => {
    fetchSaves();
    window.addEventListener("flokk:refresh", fetchSaves);
    return () => window.removeEventListener("flokk:refresh", fetchSaves);
  }, [fetchSaves]);

  function handleAddToItinerary(item: SavedDisplayItem) {
    if (item.isLodging && item.lodgingDates?.checkin && item.lodgingDates?.checkout) {
      // Auto-assign: push to localStorage at day 0 (Day 1)
      try {
        const key = ITINERARY_KEY(tripIdProp);
        const existing: RecAddition[] = JSON.parse(localStorage.getItem(key) ?? "[]");
        existing.push({ dayIndex: 0, title: item.title, location: item.detail, img: item.img, savedItemId: item.id, sortOrder: existing.length });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) { console.error("[ItineraryWrite] localStorage write failed:", e); }
      // Persist dayIndex to DB so itinerary tab can show it
      if (item.id) {
        fetch(`/api/saves/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayIndex: 0 }),
        }).catch(e => console.error("[ItineraryWrite] DB persist failed:", e));
      }
      setAssignedDays(prev => ({ ...prev, [item.title]: 0 }));
      setInlineToast(`Added · ${item.lodgingDates.checkin} → ${item.lodgingDates.checkout}`);
      setTimeout(() => setInlineToast(null), 3000);
    } else if (item.isLodging) {
      setLodgingDateItem(item);
    } else {
      setDayPickerItem(item);
    }
  }
  function handleBook(item: SavedDisplayItem) { const url = item.bookUrl ?? item.websiteUrl; if (url) window.open(url, "_blank"); }
  function handleLearnMore(item: SavedDisplayItem) { setDetailItem(item); }
  function handleDeleteSave(item: SavedDisplayItem) {
    if (!item.id) return;
    fetch(`/api/saves/${item.id}`, { method: "DELETE" })
      .then(() => fetchSaves())
      .catch(e => console.error("[delete save]", e));
  }

  function renderSection(section: { category: string; items: SavedDisplayItem[] }) {
    return (
      <div key={section.category} style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{section.category}</span>
          <span style={{ fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{section.items.length}</span>
        </div>
        {section.items.map(item => (
          <SavedHorizCard
            key={item.title + item.detail}
            item={item}
            isDesktop={isDesktop}
            onAddToItinerary={() => handleAddToItinerary(item)}
            onBook={() => handleBook(item)}
            onLearnMore={() => handleLearnMore(item)}
            assignedDay={assignedDays[item.title]}
            onDelete={() => handleDeleteSave(item)}
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "#999" }}>Loading saved items…</p>
      </div>
    );
  }

  const hasSaves = leftSections.length > 0 || rightSections.length > 0;

  const tripAsModalEntry = tripIdProp
    ? [{ id: tripIdProp, title: tripTitle ?? "This trip", startDate: tripStartDate ?? null, endDate: tripEndDate ?? null }]
    : [];

  if (!hasSaves) {
    return (
      <>
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          {allScheduled ? (
            <>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(74,124,89,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <span style={{ fontSize: "22px" }}>✓</span>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>All saved — everything is in your itinerary</p>
              <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>All your saved places have been assigned to days.</p>
              {onSwitchToItinerary && (
                <button
                  onClick={onSwitchToItinerary}
                  style={{ fontSize: "14px", fontWeight: 600, padding: "10px 24px", borderRadius: "999px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  View itinerary →
                </button>
              )}
            </>
          ) : (
            <>
              <Bookmark size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>No saves yet</p>
              <p style={{ fontSize: "14px", color: "#717171", marginBottom: "20px" }}>Save hotels, restaurants, and activities directly to this trip.</p>
              {tripIdProp && (
                <button
                  onClick={() => setDropLinkOpen(true)}
                  style={{ fontSize: "14px", fontWeight: 600, padding: "10px 24px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  Drop a link
                </button>
              )}
            </>
          )}
        </div>
        {dropLinkOpen && (
          <DropLinkModal
            trips={tripAsModalEntry}
            initialTripId={tripIdProp}
            lockedTripId={tripIdProp}
            onClose={() => setDropLinkOpen(false)}
            onSaved={() => { setDropLinkOpen(false); fetchSaves(); }}
          />
        )}
      </>
    );
  }

  const filterSaveItem = (itm: SavedDisplayItem): boolean => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unorganized") return !itm.categoryTags || itm.categoryTags.length === 0;
    return (itm.categoryTags ?? []).some(t => t.toLowerCase().includes(activeFilter.toLowerCase()));
  };
  const displayedLeft = leftSections.map(s => ({ ...s, items: s.items.filter(filterSaveItem) })).filter(s => s.items.length > 0);
  const displayedRight = rightSections.map(s => ({ ...s, items: s.items.filter(filterSaveItem) })).filter(s => s.items.length > 0);

  return (
    <div>
      {/* FILTER STRIP */}
      <div style={{ display: "flex", overflowX: "auto", gap: "8px", marginBottom: "16px", paddingBottom: "4px", scrollbarWidth: "none" }}>
        {SAVED_FILTER_PILLS.map((pill) => {
          const isActive = activeFilter === pill;
          return (
            <button
              key={pill}
              onClick={() => setActiveFilter(pill)}
              style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "#717171", backgroundColor: isActive ? "#C4664A" : "#fff", border: isActive ? "none" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap" }}
            >
              {pill}
            </button>
          );
        })}
      </div>

      {/* SAVES GRID — filtered */}
      {displayedLeft.length === 0 && displayedRight.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 24px", color: "#717171", fontSize: "14px" }}>
          No saves match this filter.
        </div>
      ) : (() => {
        const all = [...displayedLeft, ...displayedRight];
        const col1 = all.filter((_, i) => i % 2 === 0);
        const col2 = all.filter((_, i) => i % 2 !== 0);
        return (
          <div className="tab-card-grid">
            <div>{col1.map(renderSection)}</div>
            <div>{col2.map(renderSection)}</div>
          </div>
        );
      })()}

      {/* Drop a link button */}
      {tripIdProp && (
        <button
          onClick={() => setDropLinkOpen(true)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            width: "100%", padding: "12px", marginTop: "8px",
            border: "1.5px dashed rgba(196,102,74,0.4)", borderRadius: "12px",
            backgroundColor: "transparent", color: "#C4664A",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={14} />
          Drop a link
        </button>
      )}
      {dropLinkOpen && (
        <DropLinkModal
          trips={tripAsModalEntry}
          initialTripId={tripIdProp}
          lockedTripId={tripIdProp}
          onClose={() => setDropLinkOpen(false)}
          onSaved={() => { setDropLinkOpen(false); fetchSaves(); }}
        />
      )}

      {inlineToast && (
        <button
          onClick={() => { if (onSwitchToItinerary) onSwitchToItinerary(); }}
          style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1a1a1a", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, whiteSpace: "nowrap", border: "none", cursor: onSwitchToItinerary ? "pointer" : "default" }}
        >
          {inlineToast}
        </button>
      )}
      {dayPickerItem && (
        <SavedDayPickerModal
          itemTitle={dayPickerItem.title}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onConfirm={(dayIndex) => {
            try {
              const key = ITINERARY_KEY(tripIdProp);
              const existing: RecAddition[] = JSON.parse(localStorage.getItem(key) ?? "[]");
              existing.push({ dayIndex, title: dayPickerItem.title, location: dayPickerItem.detail, img: dayPickerItem.img, savedItemId: dayPickerItem.id, sortOrder: existing.length });
              localStorage.setItem(key, JSON.stringify(existing));
            } catch (e) { console.error("[ItineraryWrite] localStorage write failed:", e); }
            if (dayPickerItem.id) {
              fetch(`/api/saves/${dayPickerItem.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dayIndex }),
              }).catch(e => console.error("[ItineraryWrite] DB persist failed:", e));
            }
            setAssignedDays(prev => ({ ...prev, [dayPickerItem.title]: dayIndex }));
            setInlineToast(`Added to Day ${dayIndex + 1} — tap to view itinerary →`);
            setTimeout(() => setInlineToast(null), 4000);
            setDayPickerItem(null);
          }}
          onClose={() => setDayPickerItem(null)}
        />
      )}
      {lodgingDateItem && (
        <LodgingDateModal
          itemTitle={lodgingDateItem.title}
          onConfirm={(checkin, checkout) => {
            try {
              const key = ITINERARY_KEY(tripIdProp);
              const existing: RecAddition[] = JSON.parse(localStorage.getItem(key) ?? "[]");
              existing.push({ dayIndex: 0, title: lodgingDateItem.title, location: lodgingDateItem.detail, img: lodgingDateItem.img, savedItemId: lodgingDateItem.id, sortOrder: existing.length });
              localStorage.setItem(key, JSON.stringify(existing));
            } catch (e) { console.error("[ItineraryWrite] localStorage write failed:", e); }
            if (lodgingDateItem.id) {
              fetch(`/api/saves/${lodgingDateItem.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dayIndex: 0 }),
              }).catch(e => console.error("[ItineraryWrite] DB persist failed:", e));
            }
            setAssignedDays(prev => ({ ...prev, [lodgingDateItem.title]: 0 }));
            setInlineToast(`Added · ${checkin} → ${checkout}`);
            setTimeout(() => setInlineToast(null), 3000);
            setLodgingDateItem(null);
          }}
          onClose={() => setLodgingDateItem(null)}
        />
      )}
      {detailItem && (
        <SavedDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          assignedDay={assignedDays[detailItem.title]}
          onAddToItinerary={assignedDays[detailItem.title] === undefined ? () => {
            const captured = detailItem;
            setDetailItem(null);
            handleAddToItinerary(captured);
          } : undefined}
          onMarkBooked={() => {
            if (detailItem.id) {
              fetch(`/api/saves/${detailItem.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isBooked: true }),
              }).then(() => fetchSaves()).catch(e => console.error("[markBooked]", e));
            }
            setDetailItem(null);
          }}
          onDelete={() => { handleDeleteSave(detailItem); setDetailItem(null); }}
        />
      )}
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

function TaskModal({ onClose }: { onClose: () => void }) {
  const NEEDS_BOOKING = [
    { title: "Ocean Expo Park Churaumi Aquarium", note: "Tickets recommended in advance — sells out in May", url: "https://churaumi.okinawa/en/", price: "¥2,180 / adult" },
    { title: "Katsuren Castle Ruins", note: "No booking required, but check opening hours", url: "https://www.katsuren-jo.jp/", price: "¥600 / adult" },
  ];
  const EMPTY_DAYS = [
    { dateStr: "Tue, May 6", dayNum: 3 },
    { dateStr: "Wed, May 7", dayNum: 4 },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", padding: "24px 20px 32px", paddingBottom: "env(safe-area-inset-bottom, 32px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>What needs attention</p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#999", padding: "4px" }}>×</button>
        </div>

        {/* Needs booking */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Needs reservation</p>
        {NEEDS_BOOKING.map(item => (
          <div key={item.title} style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1px solid #EEEEEE", padding: "14px", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>{item.title}</p>
                <p style={{ fontSize: "12px", color: "#717171", marginBottom: "8px" }}>{item.note}</p>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#4a7c59" }}>{item.price}</span>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "8px 14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>Book →</a>
            </div>
          </div>
        ))}

        {/* Empty days */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 10px" }}>Unplanned days</p>
        {EMPTY_DAYS.map(day => (
          <div key={day.dayNum} style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1.5px dashed #E0E0E0", padding: "14px", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>Day {day.dayNum} — {day.dateStr}</p>
              <p style={{ fontSize: "12px", color: "#aaa" }}>Nothing planned yet</p>
            </div>
            <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: "999px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Add saves →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  NRT: { lat: 35.7720, lng: 140.3929 }, HND: { lat: 35.5494, lng: 139.7798 },
  KIX: { lat: 34.4347, lng: 135.2440 }, OKA: { lat: 26.1958, lng: 127.6461 },
  ICN: { lat: 37.4602, lng: 126.4407 }, GMP: { lat: 37.5583, lng: 126.7906 },
  PUS: { lat: 35.1795, lng: 128.9381 }, CJU: { lat: 33.5113, lng: 126.4929 },
  CDG: { lat: 49.0097, lng: 2.5479 },   LHR: { lat: 51.4700, lng: -0.4543 },
  LGW: { lat: 51.1537, lng: -0.1821 },  BCN: { lat: 41.2974, lng: 2.0833 },
  LIS: { lat: 38.7756, lng: -9.1354 },  MAD: { lat: 40.4983, lng: -3.5676 },
  FCO: { lat: 41.8003, lng: 12.2389 },  AMS: { lat: 52.3105, lng: 4.7683 },
  FRA: { lat: 50.0379, lng: 8.5622 },   ZRH: { lat: 47.4647, lng: 8.5492 },
  PRG: { lat: 50.1008, lng: 14.2600 },  VIE: { lat: 48.1103, lng: 16.5697 },
  DUB: { lat: 53.4213, lng: -6.2700 },  CPH: { lat: 55.6180, lng: 12.6508 },
  BKK: { lat: 13.6900, lng: 100.7501 }, DMK: { lat: 13.9126, lng: 100.6070 },
  SIN: { lat: 1.3644, lng: 103.9915 },  HKG: { lat: 22.3080, lng: 113.9185 },
  TPE: { lat: 25.0797, lng: 121.2342 }, MNL: { lat: 14.5086, lng: 121.0197 },
  KUL: { lat: 2.7456, lng: 101.7072 },  CGK: { lat: -6.1275, lng: 106.6537 },
  DPS: { lat: -8.7482, lng: 115.1670 }, CMB: { lat: 7.1806, lng: 79.8841 },
  DEL: { lat: 28.5562, lng: 77.1000 },  BOM: { lat: 19.0896, lng: 72.8656 },
  DXB: { lat: 25.2532, lng: 55.3657 },  AUH: { lat: 24.4330, lng: 54.6511 },
  LAX: { lat: 33.9425, lng: -118.4081 }, JFK: { lat: 40.6413, lng: -73.7781 },
  EWR: { lat: 40.6895, lng: -74.1745 }, ORD: { lat: 41.9742, lng: -87.9073 },
  SFO: { lat: 37.6213, lng: -122.3790 }, MIA: { lat: 25.7959, lng: -80.2870 },
  YUL: { lat: 45.4706, lng: -73.7408 }, YYZ: { lat: 43.6777, lng: -79.6248 },
  SYD: { lat: -33.9399, lng: 151.1753 }, MEL: { lat: -37.6733, lng: 144.8430 },
  GRU: { lat: -23.4356, lng: -46.4731 }, EZE: { lat: -34.8222, lng: -58.5358 },
  CPT: { lat: -33.9648, lng: 18.6017 },  JNB: { lat: -26.1392, lng: 28.2460 },
  CAI: { lat: 30.1219, lng: 31.4056 },   RAK: { lat: 31.6069, lng: -8.0363 },
};

type RecAddition = { dayIndex: number; title: string; location: string; img?: string; savedItemId?: string; lat?: number | null; lng?: number | null; isBooked?: boolean; sortOrder: number; startTime?: string | null; categoryTags?: string[] };

// Unified sortable item — combines SavedItems, ManualActivities, and Flights into one sortable list per day
type ItineraryItemLocal = {
  id: string;
  type: string;
  title: string;
  scheduledDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  fromAirport: string | null;
  toAirport: string | null;
  fromCity: string | null;
  toCity: string | null;
  confirmationCode: string | null;
  notes: string | null;
  address: string | null;
  totalCost: number | null;
  currency: string | null;
  passengers: string[];
  dayIndex: number | null;
  latitude: number | null;
  longitude: number | null;
  arrivalLat?: number | null;
  arrivalLng?: number | null;
  sortOrder: number;
  bookingUrl?: string | null;
  needsVerification?: boolean | null;
};

type UnifiedDayItem = {
  sortId: string;  // "saved_xxx" | "activity_xxx" | "flight_xxx" | "itinerary_xxx"
  itemType: "saved" | "activity" | "flight" | "itinerary";
  sortOrder: number;
  rawId: string;
  startTime?: string | null;   // for time-based sorting and transit
  lat?: number | null;          // for transit routing
  lng?: number | null;
  recAddition?: RecAddition;
  activity?: Activity;
  flight?: Flight;
  itineraryItem?: ItineraryItemLocal;
};

const ITINERARY_KEY = (tripId?: string) => `flokk_itinerary_additions_${tripId ?? "default"}`;

const BUDGET_RANGE_OPTIONS = [
  { value: "BUDGET", label: "Budget — Under $3,000" },
  { value: "MID", label: "Mid-range — $3,000–$8,000" },
  { value: "PREMIUM", label: "Premium — $8,000–$20,000" },
  { value: "LUXURY", label: "Luxury — $20,000+" },
];

function BudgetPromptBanner({ tripId }: { tripId?: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!selected || !tripId) return;
    setSaving(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetRange: selected }),
      });
      setSaved(true);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    const label = BUDGET_RANGE_OPTIONS.find(o => o.value === selected)?.label ?? selected;
    return (
      <div style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: "rgba(107,143,113,0.08)", border: "1px solid rgba(107,143,113,0.2)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <CheckCircle size={14} style={{ color: "#4a7c59", flexShrink: 0 }} />
        <span style={{ fontSize: "13px", color: "#4a7c59", fontWeight: 600 }}>Budget set: {label}</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: "14px 16px", borderRadius: "12px", backgroundColor: "#FAFAFA", border: "1.5px dashed #E0E0E0", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DollarSign size={15} style={{ color: "#717171", flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "1px" }}>No budget set</p>
            <p style={{ fontSize: "12px", color: "#717171" }}>Set a trip budget to track spending</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "20px", border: "none", backgroundColor: "#C4664A", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
        >
          Set budget
        </button>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 32px" }}>
            <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a", marginBottom: "16px" }}>Set a trip budget</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {BUDGET_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelected(opt.value)}
                  style={{ padding: "12px 16px", borderRadius: "12px", border: "1.5px solid", borderColor: selected === opt.value ? "#C4664A" : "#EEEEEE", backgroundColor: selected === opt.value ? "rgba(196,102,74,0.06)" : "#fff", cursor: "pointer", textAlign: "left", fontSize: "14px", fontWeight: 600, color: "#1a1a1a" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleSave}
              disabled={!selected || saving}
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", backgroundColor: selected ? "#C4664A" : "#E0E0E0", color: selected ? "#fff" : "#aaa", fontSize: "15px", fontWeight: 700, cursor: selected ? "pointer" : "default" }}
            >
              {saving ? "Saving..." : "Save budget →"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Budget bar (FIX 5) ────────────────────────────────────────────────────────

function BudgetBar({ tripId, budgetTotal, budgetSpent, budgetCurrency, loaded, onBudgetSaved }: {
  tripId?: string;
  budgetTotal: number | null;
  budgetSpent: number;
  budgetCurrency: string;
  loaded: boolean;
  onBudgetSaved: (total: number, currency: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [inputTotal, setInputTotal] = useState("");
  const [inputCurrency, setInputCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!tripId) return;
    const total = parseFloat(inputTotal);
    if (isNaN(total) || total <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetTotal: total, budgetCurrency: inputCurrency }),
      });
      const d = await res.json();
      onBudgetSaved(d.budgetTotal ?? total, d.budgetCurrency ?? inputCurrency);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  if (budgetSpent <= 0 && budgetTotal == null) return null;

  const currencies = ["USD", "GBP", "EUR", "JPY", "KRW", "AUD"];
  const pct = budgetTotal && budgetTotal > 0 ? Math.min(100, (budgetSpent / budgetTotal) * 100) : 0;

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "16px 18px", marginBottom: "16px" }}>
      {budgetTotal != null ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>
              {budgetCurrency} {budgetSpent.toLocaleString()} of {budgetCurrency} {budgetTotal.toLocaleString()} tracked
            </span>
            <span style={{ fontSize: "12px", color: "#717171" }}>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: "6px", borderRadius: "999px", backgroundColor: "#EEEEEE", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: "999px", backgroundColor: "#C4664A", width: `${pct}%`, transition: "width 0.4s ease" }} />
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#1B3A5C", fontWeight: 500 }}>
            {budgetCurrency} {budgetSpent.toLocaleString()} tracked so far
          </span>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setInputCurrency(budgetCurrency); }}
              style={{ fontSize: "12px", color: "#C4664A", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, whiteSpace: "nowrap" }}
            >
              + Set budget
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={inputCurrency}
            onChange={(e) => setInputCurrency(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #E0E0E0", fontSize: "13px", color: "#1B3A5C", backgroundColor: "#fff" }}
          >
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            min="0"
            step="100"
            value={inputTotal}
            onChange={(e) => setInputTotal(e.target.value)}
            placeholder="Total budget"
            style={{ flex: 1, minWidth: "100px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #E0E0E0", fontSize: "13px", color: "#1B3A5C", outline: "none" }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputTotal}
            style={{ padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: inputTotal ? "#C4664A" : "#E0E0E0", color: inputTotal ? "#fff" : "#aaa", fontSize: "13px", fontWeight: 700, cursor: inputTotal ? "pointer" : "default" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setShowForm(false)}
            style={{ fontSize: "12px", color: "#aaa", background: "none", border: "none", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Activity detail modal ─────────────────────────────────────────────────────
function ActivityDetailModal({ activity, onClose, onEdit, onRemove, onMarkBooked, onAddToItinerary }: {
  activity: Activity;
  onClose: () => void;
  onEdit: () => void;
  onRemove?: () => void;
  onMarkBooked?: () => void;
  onAddToItinerary?: () => void;
}) {
  const a = activity;
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 500, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 20px 0", gap: "12px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1B3A5C", lineHeight: 1.2, fontFamily: '"Playfair Display", Georgia, serif', flex: 1 }}>
            {a.title}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1, flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 24px" }}>
          {/* Status */}
          <span style={{ display: "inline-block", fontSize: "12px", fontWeight: 700, backgroundColor: a.status === "booked" ? "rgba(74,124,89,0.1)" : a.status === "confirmed" ? "rgba(27,58,92,0.08)" : "rgba(0,0,0,0.06)", color: a.status === "booked" ? "#4a7c59" : a.status === "confirmed" ? "#1B3A5C" : "#717171", borderRadius: "999px", padding: "3px 10px", marginBottom: "14px" }}>
            {a.status === "booked" ? "Booked" : a.status === "confirmed" ? "Confirmed" : "Interested"}
          </span>

          {/* Date / time / venue */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
            {a.date && (
              <p style={{ fontSize: "14px", color: "#333" }}>
                <span style={{ color: "#999", marginRight: "6px" }}>Date</span>
                {a.date}{a.time ? ` · ${a.time}${a.endTime ? ` – ${a.endTime}` : ""}` : ""}
              </p>
            )}
            {a.venueName && (
              <p style={{ fontSize: "14px", color: "#333" }}>
                <span style={{ color: "#999", marginRight: "6px" }}>Venue</span>
                {a.venueName}
              </p>
            )}
            {a.confirmationCode && (
              <p style={{ fontSize: "14px", color: "#333" }}>
                <span style={{ color: "#999", marginRight: "6px" }}>Confirmation</span>
                <span style={{ fontFamily: "monospace" }}>{a.confirmationCode}</span>
              </p>
            )}
          </div>

          {/* Notes */}
          {a.notes && (
            <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.6, marginBottom: "14px", padding: "10px 12px", backgroundColor: "rgba(0,0,0,0.03)", borderRadius: "8px" }}>
              {a.notes}
            </p>
          )}

          {/* Website */}
          {a.website && (
            <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "14px", fontWeight: 600, color: "#C4664A", textDecoration: "none", marginBottom: "20px" }}>
              Visit site →
            </a>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "4px", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            {onAddToItinerary && a.dayIndex == null && (
              <button
                onClick={() => { onAddToItinerary(); onClose(); }}
                style={{ width: "100%", padding: "12px", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid #C4664A", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                + Add to itinerary
              </button>
            )}
            <button
              onClick={onEdit}
              style={{ width: "100%", padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Edit activity
            </button>
            {a.status !== "booked" && onMarkBooked && (
              <button
                onClick={onMarkBooked}
                style={{ width: "100%", padding: "12px", backgroundColor: "transparent", color: "#4a7c59", border: "2px solid rgba(74,124,89,0.4)", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Mark as booked ✓
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: "#e53e3e", border: "none", borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Remove from day
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ItineraryContent({ flyTarget, onFlyTargetConsumed, tripId, tripStartDate, tripEndDate, onSwitchToRecommended, onEditActivity, onActivityAdded, destinationCity, destinationCountry, flights = [], activities = [], onRemoveActivityFromDay, onMarkActivityBooked, onRemoveFlightFromDay, onAddFlight, budgetTotal, budgetSpent, budgetCurrency, budgetLoaded, onBudgetSaved }: {
  flyTarget: { lat: number; lng: number } | null;
  onFlyTargetConsumed: () => void;
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onSwitchToRecommended?: () => void;
  onActivityAdded?: () => void;
  onEditActivity?: (a: Activity) => void;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  flights?: Flight[];
  activities?: Activity[];
  onRemoveActivityFromDay?: (id: string) => void;
  onMarkActivityBooked?: (id: string) => void;
  onRemoveFlightFromDay?: (id: string) => void;
  onAddFlight?: () => void;
  budgetTotal: number | null;
  budgetSpent: number;
  budgetCurrency: string;
  budgetLoaded: boolean;
  onBudgetSaved: (total: number, currency: string) => void;
}) {
  const isDesktop = useIsDesktop();
  const [openDay, setOpenDay] = useState(0); // -1 = all collapsed
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [addActivityDefaultDate, setAddActivityDefaultDate] = useState<string | undefined>();
  const [notes, setNotes] = useState<string[]>([]);
  const [recAdditions, setRecAdditions] = useState<RecAddition[]>([]);
  // Local copies of activities/flights so drag-reorder can update them independently of parent prop
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);
  const [localFlights, setLocalFlights] = useState<Flight[]>([]);
  const [localItineraryItems, setLocalItineraryItems] = useState<ItineraryItemLocal[]>([]);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationIndex, setVerificationIndex] = useState(0);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [selectedItineraryItem, setSelectedItineraryItem] = useState<ItineraryItemLocal | null>(null);
  const [editActivityTitle, setEditActivityTitle] = useState("");
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailRemover, setDetailRemover] = useState<(() => void) | null>(null);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  // Lodging edit: stores { id, rawTitle, startTime, websiteUrl, notes } fetched on demand
  const [editingLodging, setEditingLodging] = useState<{ id: string; rawTitle: string; extractedCheckin: string; extractedCheckout: string; websiteUrl: string; notes: string } | null>(null);
  const [lodgingSaving, setLodgingSaving] = useState(false);
  const [dragErrorToast, setDragErrorToast] = useState<string | null>(null);
  const [conflictToast, setConflictToast] = useState<string | null>(null);
  const [dismissedConflictDays, setDismissedConflictDays] = useState<Set<number>>(new Set());
  const [autoSortConfirmDay, setAutoSortConfirmDay] = useState<number | null>(null);
  const [openMoveMenuId, setOpenMoveMenuId] = useState<string | null>(null);
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const moveMenuRef = useRef<HTMLDivElement | null>(null);

  // Close move menu on mousedown outside the dropdown
  useEffect(() => {
    if (!openMoveMenuId) return;
    const handler = (e: MouseEvent) => {
      if (moveMenuRef.current && moveMenuRef.current.contains(e.target as Node)) return;
      setOpenMoveMenuId(null);
      setMoveMenuAnchor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMoveMenuId]);

  // Pre-compute trip days at component level so the portal dropdown can reference them
  const tripDaysAll = generateTripDays(tripStartDate ?? null, tripEndDate ?? null);

  // Pending auto-sort day: set by onSaved when a timed activity is added.
  // Consumed after the next localActivities update so the new item is included.
  const pendingAutoSortDayRef = useRef<number | null>(null);

  // Sync local copies from props (new items added, etc.)
  useEffect(() => { setLocalActivities(activities); }, [activities]);
  useEffect(() => { setLocalFlights(flights); }, [flights]);

  // ── Time-aware sort key ───────────────────────────────────────────────────
  // Returns minutes-since-midnight for the item's effective time.
  // Structural anchors (arrival flights, check-in, check-out, departure flights)
  // use fixed virtual times so they remain stable at the boundaries of each day.
  // Activities and saves with an actual startTime sort by clock time.
  // Untimed activities default to 720 (noon) as a stable midday position.
  //
  //  FLIGHT arrival  →  arrivalTime or 0  (always first)
  //  LODGING check-in → 900  (15:00 default)
  //  timed activity   →  actual HH:MM in minutes
  //  untimed activity → 720  (noon)
  //  TRAIN            →  departureTime or 660  (11:00 default)
  //  LODGING check-out → 720  (12:00 default)
  //  FLIGHT departure → departureTime + 1440  (always last, beyond 24h)
  function toSortKey(item: UnifiedDayItem): number {
    function timeToMin(t: string | null | undefined): number | null {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    }
    const dest = (destinationCity ?? "").toLowerCase().trim();
    function matchesDest(city: string | null | undefined): boolean {
      if (!dest || !city) return false;
      const c = city.toLowerCase();
      return c.includes(dest) || dest.split(/[\s,/-]+/).some(w => w.length > 2 && c.includes(w));
    }
    if (item.itemType === "itinerary" && item.itineraryItem) {
      const it = item.itineraryItem;
      if (it.type === "FLIGHT") {
        const isArrival = matchesDest(it.toCity) || matchesDest(it.toAirport);
        if (isArrival) return timeToMin(it.arrivalTime) ?? 0;
        return 1440 + (timeToMin(it.departureTime) ?? 0);
      }
      if (it.type === "LODGING") {
        if (it.title.toLowerCase().includes("check-out")) return timeToMin(it.departureTime) ?? 720;
        return timeToMin(it.departureTime) ?? 900;
      }
      if (it.type === "TRAIN") return timeToMin(it.departureTime) ?? 660;
      return timeToMin(it.departureTime ?? it.arrivalTime) ?? 720;
    }
    if (item.itemType === "flight" && item.flight) {
      const f = item.flight;
      const isArrival = f.type === "outbound" || matchesDest(f.toCity) || matchesDest(f.toAirport);
      if (isArrival) return timeToMin(f.arrivalTime) ?? 0;
      return 1440 + (timeToMin(f.departureTime) ?? 0);
    }
    // Activity or save: use actual startTime if present, else noon
    return timeToMin(item.startTime) ?? 720;
  }

  /** Build the sorted UnifiedDayItem list for any given dayIndex (extracted from render) */
  function buildDayItems(targetDayIndex: number): UnifiedDayItem[] {
    // Build a set of normalized titles from ItineraryItems on this day so we can
    // dedup SavedItems/RecAdditions that represent the same booking. Hotel items
    // are stored as "Check-in: Foo" / "Check-out: Foo" — strip that prefix when
    // comparing so a RecAddition titled "Foo" is still correctly suppressed.
    const itineraryTitlesForDay = new Set(
      localItineraryItems
        .filter(it => it.dayIndex === targetDayIndex)
        .flatMap(it => {
          const lower = it.title.trim().toLowerCase();
          const normalized = lower.replace(/^check-(?:in|out):\s*/, "");
          return normalized !== lower ? [lower, normalized] : [lower];
        })
    );

    // True if a TRAIN ItineraryItem exists on this day
    const hasTrainItineraryOnDay = localItineraryItems.some(
      it => it.dayIndex === targetDayIndex && it.type === "TRAIN"
    );

    return [
      ...recAdditions.filter(a => {
        if (a.dayIndex !== targetDayIndex) return false;
        // Skip if an ItineraryItem already covers this booking
        if (itineraryTitlesForDay.has(a.title.trim().toLowerCase())) return false;
        // Suppress Rail.Ninja / train saved items when a TRAIN ItineraryItem exists on the same day
        if (hasTrainItineraryOnDay) {
          const cats = (a.categoryTags ?? []).join(" ").toLowerCase();
          const titleLower = a.title.trim().toLowerCase();
          if (/train|transit|rail/i.test(cats) || /rail\.ninja|train/i.test(titleLower)) return false;
        }
        return true;
      }).map(a => ({
        sortId: `saved_${a.savedItemId ?? a.title}`,
        itemType: "saved" as const,
        sortOrder: a.sortOrder ?? 0,
        rawId: a.savedItemId ?? "",
        startTime: a.startTime ?? null,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        recAddition: a,
      })),
      ...localActivities.filter(a => a.dayIndex === targetDayIndex).map(a => ({
        sortId: `activity_${a.id}`,
        itemType: "activity" as const,
        sortOrder: a.sortOrder ?? 0,
        rawId: a.id,
        startTime: a.time ?? null,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        activity: a,
      })),
      ...localFlights.filter(f => {
        if (f.dayIndex !== targetDayIndex) return false;
        // Skip Flight records that are covered by a FLIGHT ItineraryItem (email-imported)
        // to avoid showing the same booking twice. Match by confirmationCode or fromAirport+toAirport+dayIndex.
        return !localItineraryItems.some(it =>
          it.type === "FLIGHT" && (
            (f.confirmationCode && it.confirmationCode && f.confirmationCode === it.confirmationCode) ||
            (it.fromAirport && it.toAirport && it.fromAirport === f.fromAirport && it.toAirport === f.toAirport && it.dayIndex === f.dayIndex)
          )
        );
      }).map(f => {
        const arrCoords = AIRPORT_COORDS[(f.toAirport ?? "").toUpperCase().trim()];
        return {
          sortId: `flight_${f.id}`,
          itemType: "flight" as const,
          sortOrder: f.sortOrder ?? 0,
          rawId: f.id,
          startTime: f.departureTime ?? null,
          lat: arrCoords?.lat ?? null,
          lng: arrCoords?.lng ?? null,
          flight: f,
        };
      }),
    ...localItineraryItems.filter(it => it.dayIndex === targetDayIndex).map(it => ({
        sortId: `itinerary_${it.id}`,
        itemType: "itinerary" as const,
        sortOrder: it.sortOrder ?? 0,
        rawId: it.id,
        startTime: it.departureTime ?? null,
        lat: it.latitude ?? null,
        lng: it.longitude ?? null,
        itineraryItem: it,
      })),
    // Sort purely by sortOrder — semantic weight is baked into the initial sortOrder
    // values on first load (see initialization effects below), so manual reordering
    // always wins without the semantic weight overriding on every re-render.
    ].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }


  // ── Conflict detection ────────────────────────────────────────────────────
  function timeToMinutes(time: string): number {
    const parts = time.split(":");
    return Number(parts[0]) * 60 + (Number(parts[1]) || 0);
  }

  function detectDayConflicts(items: UnifiedDayItem[]): string[] {
    const warnings: string[] = [];

    const itItems = items
      .filter(i => i.itemType === "itinerary" && i.itineraryItem)
      .map(i => ({ unified: i, it: i.itineraryItem! }));

    const checkOuts = itItems.filter(({ it }) => it.type === "LODGING" && /check-out/i.test(it.title));

    // Departures: TRAIN items + FLIGHT items with high sortOrder (departure flights)
    const departures = itItems.filter(({ it, unified }) =>
      it.type === "TRAIN" ||
      (it.type === "FLIGHT" && (unified.sortOrder ?? 0) >= 85)
    );

    // Flight model records (non-itinerary) also count as potential departures
    const flightRecordDeps = items.filter(i => i.itemType === "flight" && i.flight?.departureTime);

    // Rule 1: check-out present on same day as any departure
    for (const { it: checkout } of checkOuts) {
      const checkoutTime = checkout.departureTime; // null for most LODGING — no checkout time stored
      for (const { it: dep } of departures) {
        if (!dep.departureTime) continue;
        if (checkoutTime) {
          if (timeToMinutes(checkoutTime) > timeToMinutes(dep.departureTime)) {
            warnings.push(
              `Check-out is scheduled after your ${dep.type === "FLIGHT" ? "flight" : "train"} departure at ${dep.departureTime}`
            );
          }
        } else {
          warnings.push(
            `Confirm checkout time before your ${dep.type === "FLIGHT" ? "flight" : "train"} at ${dep.departureTime}`
          );
        }
      }
      for (const depItem of flightRecordDeps) {
        const dt = depItem.flight!.departureTime;
        if (!dt) continue;
        if (checkoutTime) {
          if (timeToMinutes(checkoutTime) > timeToMinutes(dt)) {
            warnings.push(`Check-out is scheduled after your flight departure at ${dt}`);
          }
        } else {
          warnings.push(`Confirm checkout time before your flight at ${dt}`);
        }
      }
    }

    // Rule 2: hotel check-in time before flight arrival time (only when both times are set)
    const arrivalFlights = itItems.filter(({ it, unified }) =>
      it.type === "FLIGHT" && (unified.sortOrder ?? 100) <= 15 && !!it.arrivalTime
    );
    const checkIns = itItems.filter(({ it }) =>
      it.type === "LODGING" && !/check-out/i.test(it.title) && !!it.departureTime
    );
    for (const { it: arrival } of arrivalFlights) {
      for (const { it: checkin } of checkIns) {
        if (timeToMinutes(checkin.departureTime!) < timeToMinutes(arrival.arrivalTime!)) {
          warnings.push(`Hotel check-in is before your flight arrives at ${arrival.arrivalTime}`);
        }
      }
    }

    // Rule 3: multiple departure flights from different origin airports
    const depFlights = itItems.filter(({ it, unified }) =>
      it.type === "FLIGHT" && (unified.sortOrder ?? 0) >= 85 && !!it.fromAirport
    );
    if (depFlights.length > 1) {
      const origins = [...new Set(depFlights.map(({ it }) => it.fromAirport).filter(Boolean))];
      if (origins.length > 1) {
        warnings.push(`Multiple departing flights from different airports on this day`);
      }
    }

    return warnings;
  }

  function showConflictToast(msg: string) {
    setConflictToast(msg);
    setTimeout(() => setConflictToast(null), 4000);
  }

  // Computes hypothetical conflicts for source/dest days after a cross-day move,
  // using current state (before setState is called). Called from handleCrossDayMove.
  function checkConflictsAfterMove(sortId: string, sourceDayIdx: number, destDayIdx: number): void {
    const movedItem = buildDayItems(sourceDayIdx).find(i => i.sortId === sortId);
    const futureSourceItems = buildDayItems(sourceDayIdx).filter(i => i.sortId !== sortId);
    const futureDestItems = movedItem
      ? [...buildDayItems(destDayIdx), movedItem]
      : buildDayItems(destDayIdx);

    const destConflicts = detectDayConflicts(futureDestItems);
    if (destConflicts.length > 0) {
      const dayLabel = tripDaysAll[destDayIdx]?.label ?? `Day ${destDayIdx + 1}`;
      showConflictToast(`Heads up: scheduling conflict on ${dayLabel} — check the day for details`);
      return;
    }
    const sourceConflicts = detectDayConflicts(futureSourceItems);
    if (sourceConflicts.length > 0) {
      const dayLabel = tripDaysAll[sourceDayIdx]?.label ?? `Day ${sourceDayIdx + 1}`;
      showConflictToast(`Heads up: scheduling conflict on ${dayLabel} — check the day for details`);
    }
  }

  /** Simple array move helper (replaces arrayMove from @dnd-kit/sortable) */
  function localArrayMove<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  }

  function handleReorder(sortId: string, direction: "up" | "down") {
    // Determine which day this item lives on
    let dayIdx: number | null = null;
    if (sortId.startsWith("saved_")) {
      const rawId = sortId.slice(6);
      dayIdx = recAdditions.find(r => (r.savedItemId ?? r.title) === rawId)?.dayIndex ?? null;
    } else if (sortId.startsWith("activity_")) {
      dayIdx = localActivities.find(a => a.id === sortId.slice(9))?.dayIndex ?? null;
    } else if (sortId.startsWith("flight_")) {
      dayIdx = localFlights.find(f => f.id === sortId.slice(7))?.dayIndex ?? null;
    } else if (sortId.startsWith("itinerary_")) {
      dayIdx = localItineraryItems.find(it => it.id === sortId.slice(10))?.dayIndex ?? null;
    }
    if (dayIdx === null) return;

    const dayItems = buildDayItems(dayIdx);
    const currentIndex = dayItems.findIndex(it => it.sortId === sortId);
    if (currentIndex === -1) return;
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= dayItems.length) return;
    console.log("[reorder] moving item at index", currentIndex, "to", newIndex, "in day", dayIdx, "sortId:", sortId);

    const reordered = localArrayMove(dayItems, currentIndex, newIndex);
    reordered.forEach((item, i) => {
      if (item.itemType === "saved" && item.rawId) {
        setRecAdditions(prev => prev.map(r => r.savedItemId === item.rawId ? { ...r, sortOrder: i } : r));
        fetch(`/api/saves/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }).catch(console.error);
      } else if (item.itemType === "activity" && item.rawId) {
        setLocalActivities(prev => prev.map(a => a.id === item.rawId ? { ...a, sortOrder: i } : a));
        fetch(`/api/trips/${tripId}/activities/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }).catch(console.error);
      } else if (item.itemType === "flight" && item.rawId) {
        setLocalFlights(prev => prev.map(f => f.id === item.rawId ? { ...f, sortOrder: i } : f));
        fetch(`/api/trips/${tripId}/flights/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }).catch(console.error);
      } else if (item.itemType === "itinerary" && item.rawId) {
        setLocalItineraryItems(prev => prev.map(it => it.id === item.rawId ? { ...it, sortOrder: i } : it));
        fetch(`/api/trips/${tripId}/itinerary/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) }).catch(console.error);
      }
    });
  }

  function handleCrossDayMove(sortId: string, newDayIndex: number) {
    function showDragError() {
      setDragErrorToast("Could not move item. Please try again.");
      setTimeout(() => setDragErrorToast(null), 3000);
    }
    // Determine source day for post-move conflict checking
    let sourceDayIndex: number | null = null;
    if (sortId.startsWith("saved_")) {
      const rawId = sortId.slice(6);
      sourceDayIndex = recAdditions.find(r => (r.savedItemId ?? r.title) === rawId)?.dayIndex ?? null;
    } else if (sortId.startsWith("activity_")) {
      sourceDayIndex = localActivities.find(a => a.id === sortId.slice(9))?.dayIndex ?? null;
    } else if (sortId.startsWith("flight_")) {
      sourceDayIndex = localFlights.find(f => f.id === sortId.slice(7))?.dayIndex ?? null;
    } else if (sortId.startsWith("itinerary_")) {
      sourceDayIndex = localItineraryItems.find(it => it.id === sortId.slice(10))?.dayIndex ?? null;
    }
    if (sourceDayIndex !== null && sourceDayIndex !== newDayIndex) {
      checkConflictsAfterMove(sortId, sourceDayIndex, newDayIndex);
    }
    // Open the destination day so the user sees the item arrive
    setOpenDay(newDayIndex);
    if (sortId.startsWith("saved_")) {
      const rawId = sortId.slice(6);
      const prev = recAdditions;
      setRecAdditions(p => p.map(r => (r.savedItemId ?? r.title) === rawId ? { ...r, dayIndex: newDayIndex } : r));
      if (rawId) fetch(`/api/saves/${rawId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex: newDayIndex }),
      }).then(r => { if (!r.ok) throw new Error(); })
        .catch(() => { setRecAdditions(prev); showDragError(); });
    } else if (sortId.startsWith("activity_")) {
      const id = sortId.slice(9);
      const prev = localActivities;
      setLocalActivities(p => p.map(a => a.id === id ? { ...a, dayIndex: newDayIndex } : a));
      fetch(`/api/trips/${tripId}/activities/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex: newDayIndex }),
      }).then(r => { if (!r.ok) throw new Error(); })
        .catch(() => { setLocalActivities(prev); showDragError(); });
    } else if (sortId.startsWith("flight_")) {
      const id = sortId.slice(7);
      const prev = localFlights;
      setLocalFlights(p => p.map(f => f.id === id ? { ...f, dayIndex: newDayIndex } : f));
      fetch(`/api/trips/${tripId}/flights/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex: newDayIndex }),
      }).then(r => { if (!r.ok) throw new Error(); })
        .catch(() => { setLocalFlights(prev); showDragError(); });
    } else if (sortId.startsWith("itinerary_")) {
      const id = sortId.slice(10);
      const prev = localItineraryItems;
      setLocalItineraryItems(p => p.map(it => it.id === id ? { ...it, dayIndex: newDayIndex } : it));
      fetch(`/api/trips/${tripId}/itinerary/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex: newDayIndex }),
      }).then(r => { if (!r.ok) throw new Error(); })
        .catch(() => { setLocalItineraryItems(prev); showDragError(); });
    }
  }

  const handleDeleteBookingItem = async (itemId: string) => {
    console.log("[delete] Removing itinerary item:", itemId);
    setLocalItineraryItems(prev => prev.filter(it => it.id !== itemId));
    const res = await fetch(`/api/trips/${tripId}/itinerary/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      console.error("[delete booking item] failed, reloading");
      window.location.reload();
    }
  };


  function toggleSlot(key: string) {
    setExpandedSlotKey(prev => prev === key ? null : key);
  }
  const [suggToast, setSuggToast] = useState(false);

  // Load rec additions from DB on mount (key prop forces remount after each save)
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/itinerary`)
      .then(r => r.json())
      .then(({ items }: { items: Array<{ id: string; rawTitle: string | null; rawDescription: string | null; placePhotoUrl?: string | null; mediaThumbnailUrl: string | null; destinationCity?: string | null; destinationCountry?: string | null; dayIndex: number | null; sortOrder?: number; lat?: number | null; lng?: number | null; isBooked?: boolean; startTime?: string | null; categoryTags?: string[] }> }) => {
        if (!items?.length) return;
        const mapped = items.map(item => ({
          dayIndex: item.dayIndex ?? 0,
          title: item.rawTitle ?? "",
          location: item.rawDescription ?? "",
          img: getItemImage(item.rawTitle ?? null, item.placePhotoUrl ?? null, item.mediaThumbnailUrl, (item.categoryTags ?? [])[0] ?? null, item.destinationCity, item.destinationCountry),
          savedItemId: item.id,
          lat: item.lat ?? null,
          lng: item.lng ?? null,
          isBooked: item.isBooked ?? false,
          sortOrder: item.sortOrder ?? 0,
          startTime: item.startTime ?? null,
          categoryTags: item.categoryTags ?? [],
        }));
        // If all sortOrders are 0 (seeded trips), assign sequential values and persist
        const allZero = mapped.length > 0 && mapped.every(item => item.sortOrder === 0);
        if (allZero) {
          const initialized = mapped.map((item, i) => ({ ...item, sortOrder: i }));
          setRecAdditions(initialized);
          initialized.forEach((item) => {
            if (item.savedItemId) {
              fetch(`/api/saves/${item.savedItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: item.sortOrder }),
              }).catch(e => console.error("[initSortOrder saved]", e));
            }
          });
        } else {
          setRecAdditions(mapped);
        }
      })
      .catch(e => console.error("[ItineraryRead] API fetch failed:", e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch email-imported ItineraryItems (LODGING, TRAIN, FLIGHT, etc.)
  // On first load (all sortOrders = 0), assign time-aware initial sortOrders
  // so the default day order is sensible, then persist to DB.
  // After that, sortOrder is the single source of truth — handleReorder just
  // swaps sortOrder values and re-renders in the new order.
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/itinerary-items`)
      .then(r => r.json())
      .then(({ items }: { items: ItineraryItemLocal[] }) => {
        if (!Array.isArray(items) || items.length === 0) return;
        const allZero = items.every(it => (it.sortOrder ?? 0) === 0);
        if (allZero) {
          // Group by dayIndex, sort each day by time-aware key, assign sortOrder
          const byDay = new Map<number, ItineraryItemLocal[]>();
          for (const it of items) {
            const d = it.dayIndex ?? 0;
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d)!.push(it);
          }
          const initialized = [...items];
          for (const dayItems of byDay.values()) {
            // Compute time-aware sort key using a temporary UnifiedDayItem wrapper
            const withWeight = dayItems.map(it => ({
              it,
              w: toSortKey({ sortId: `itinerary_${it.id}`, itemType: "itinerary" as const, sortOrder: 0, rawId: it.id, itineraryItem: it }),
            }));
            withWeight.sort((a, b) => a.w - b.w);
            withWeight.forEach(({ it }, i) => {
              const idx = initialized.findIndex(x => x.id === it.id);
              if (idx !== -1) initialized[idx] = { ...initialized[idx], sortOrder: i };
              fetch(`/api/trips/${tripId}/itinerary/${it.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: i }),
              }).catch(e => console.error("[initSortOrder itinerary]", e));
            });
          }
          setLocalItineraryItems(initialized);
        } else {
          setLocalItineraryItems(items);
        }
      })
      .catch(() => {});
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize sortOrder for activities if all are 0 (seeded trips)
  useEffect(() => {
    if (!tripId || localActivities.length === 0) return;
    const allZero = localActivities.every(a => (a.sortOrder ?? 0) === 0);
    if (!allZero) return;
    setLocalActivities(prev => prev.map((a, i) => ({ ...a, sortOrder: i })));
    localActivities.forEach((a, i) => {
      fetch(`/api/trips/${tripId}/activities/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      }).catch(e => console.error("[initSortOrder activity]", e));
    });
  }, [localActivities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sort a day after a timed activity is added (PART B).
  // pendingAutoSortDayRef is set by the onSaved callback in AddActivityModal.
  // This effect fires after localActivities updates with the new item.
  useEffect(() => {
    const dayToSort = pendingAutoSortDayRef.current;
    if (dayToSort === null || !tripId) return;
    pendingAutoSortDayRef.current = null;
    const items = buildDayItems(dayToSort);
    const sorted = [...items].sort((a, b) => toSortKey(a) - toSortKey(b));
    sorted.forEach((item, idx) => {
      if (item.itemType === "saved" && item.rawId) {
        setRecAdditions(prev => prev.map(r => r.savedItemId === item.rawId ? { ...r, sortOrder: idx } : r));
        fetch(`/api/saves/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
      } else if (item.itemType === "activity" && item.rawId) {
        setLocalActivities(prev => prev.map(a => a.id === item.rawId ? { ...a, sortOrder: idx } : a));
        fetch(`/api/trips/${tripId}/activities/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
      } else if (item.itemType === "flight" && item.rawId) {
        setLocalFlights(prev => prev.map(f => f.id === item.rawId ? { ...f, sortOrder: idx } : f));
        fetch(`/api/trips/${tripId}/flights/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
      } else if (item.itemType === "itinerary" && item.rawId) {
        setLocalItineraryItems(prev => prev.map(it => it.id === item.rawId ? { ...it, sortOrder: idx } : it));
        fetch(`/api/trips/${tripId}/itinerary/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
      }
    });
  }, [localActivities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize sortOrder for flights if all are 0 (seeded trips)
  useEffect(() => {
    if (!tripId || localFlights.length === 0) return;
    const allZero = localFlights.every(f => (f.sortOrder ?? 0) === 0);
    if (!allZero) return;
    setLocalFlights(prev => prev.map((f, i) => ({ ...f, sortOrder: i })));
    localFlights.forEach((f, i) => {
      fetch(`/api/trips/${tripId}/flights/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      }).catch(e => console.error("[initSortOrder flight]", e));
    });
  }, [localFlights.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Return a directions URL that deep-links into native maps on iOS/Android */
  function getDirectionsUrl(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (isIOS) {
      return `maps://maps.apple.com/?saddr=${lat1},${lng1}&daddr=${lat2},${lng2}`;
    }
    if (isAndroid) {
      return `intent://maps.google.com/maps/dir/${lat1},${lng1}/${lat2},${lng2}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
    }
    return `https://www.google.com/maps/dir/${lat1},${lng1}/${lat2},${lng2}`;
  }

  /** Haversine distance in km between two lat/lng points */
  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Synchronous transit estimate between two coordinates */
  function computeTransit(lat1: number, lng1: number, lat2: number, lng2: number): { mode: string; duration: string; directionsUrl: string } {
    const km = haversineKm(lat1, lng1, lat2, lng2);
    let mode: string;
    let mins: number;
    if (km < 1) {
      mode = "Walk";
      mins = Math.round((km * 1000) / 80);
    } else if (km < 5) {
      mode = "Transit";
      mins = Math.round((km * 1000) / 300);
    } else {
      mode = "Transit";
      mins = Math.round((km * 1000) / 500);
    }
    return {
      mode,
      duration: `~${mins} min`,
      directionsUrl: getDirectionsUrl(lat1, lng1, lat2, lng2),
    };
  }

  const [showTaskModal, setShowTaskModal] = useState(false);
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

      {/* AI suggest toast */}
      {suggToast && (
        <div style={{ marginBottom: "12px", backgroundColor: "#FDF6F3", border: "1.5px solid rgba(196,102,74,0.25)", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>AI suggestions coming soon</p>
            <p style={{ fontSize: "12px", color: "#717171" }}>For now, browse the Recommended tab to add activities to your itinerary.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {onSwitchToRecommended && (
              <button onClick={onSwitchToRecommended} style={{ fontSize: "12px", fontWeight: 700, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                Recommended →
              </button>
            )}
            <button onClick={() => setSuggToast(false)} style={{ fontSize: "16px", lineHeight: 1, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>×</button>
          </div>
        </div>
      )}

      {/* Drag error toast */}
      {dragErrorToast && (
        <div style={{ marginBottom: "12px", backgroundColor: "#FDF0EE", border: "1.5px solid rgba(196,102,74,0.35)", borderRadius: "12px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{dragErrorToast}</span>
          <button onClick={() => setDragErrorToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C4664A", padding: "0 0 0 12px", fontSize: "16px", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Conflict toast — amber, fixed bottom-center, auto-dismisses after 4s */}
      {conflictToast && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, backgroundColor: "#FFFBEB", border: "1.5px solid #D97706", borderRadius: "10px", padding: "10px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: "340px", width: "calc(100% - 32px)", pointerEvents: "none" }}>
          <span style={{ fontSize: "13px", color: "#92400E", fontWeight: 500 }}>{conflictToast}</span>
        </div>,
        document.body
      )}

      {/* Budget prompt or bar */}
      <BudgetPromptBanner tripId={tripId} />

      {/* Booking intelligence card — shown when trip is within 90 days and missing flights/hotel */}
      {tripId && (
        <BookingIntelCard
          tripId={tripId}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          startDate={tripStartDate}
          endDate={tripEndDate}
          onAddFlight={onAddFlight}
        />
      )}

      {/* Budget bar — shown when budgetSpent > 0 or budgetTotal is set */}
      <BudgetBar tripId={tripId} budgetTotal={budgetTotal} budgetSpent={budgetSpent} budgetCurrency={budgetCurrency} loaded={budgetLoaded} onBudgetSaved={onBudgetSaved} />

      {/* Split content area */}
      <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", gap: "24px", alignItems: "flex-start" }}>

        {/* Map — top on mobile (order -1), right column on desktop */}
        {!isDesktop && (
          <div style={{ width: "100%", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ height: "192px", borderRadius: "12px", overflow: "hidden" }}>
              <TripMap
                activeDay={openDay >= 0 ? openDay : null}
                flyTarget={flyTarget}
                onFlyTargetConsumed={onFlyTargetConsumed}
                tripId={tripId}
                destinationCity={destinationCity}
                destinationCountry={destinationCountry}
                savedItems={recAdditions.filter(a => a.lat != null && a.lng != null) as { title: string; lat: number; lng: number; dayIndex?: number | null }[]}
                activities={localActivities.filter(a => a.lat != null && a.lng != null).map(a => ({ title: a.title, lat: a.lat!, lng: a.lng!, dayIndex: a.dayIndex }))}
                importedBookingPins={[...localItineraryItems]
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .filter(it => it.latitude != null && it.longitude != null && it.latitude !== 0 && it.longitude !== 0)
                  .map(it => ({ id: it.id, title: it.title, type: it.type, dayIndex: it.dayIndex ?? null, latitude: it.latitude!, longitude: it.longitude!, arrivalLat: it.arrivalLat ?? null, arrivalLng: it.arrivalLng ?? null }))}
              />
            </div>
            <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "6px", textAlign: "center" }}>
              Map updates as you navigate days
            </p>
          </div>
        )}

        {/* Left panel: accordion */}
        <div ref={leftPanelRef} style={{ width: isDesktop ? "58%" : "100%", minWidth: 0 }}>
          {(() => {
            const tripDays = generateTripDays(tripStartDate ?? null, tripEndDate ?? null);
            if (tripDays.length === 0) {
              return (
                <div style={{ padding: "32px", textAlign: "center", color: "#999", fontSize: "14px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)" }}>
                  No trip dates set. Add dates to see your itinerary.
                </div>
              );
            }
            const itemsNeedingVerification = localItineraryItems.filter(i => i.needsVerification === true);
            return (
              <>
                {itemsNeedingVerification.length > 0 && (
                  <div style={{ marginBottom: "12px", padding: "14px 16px", backgroundColor: "#FFFBEB", border: "1px solid #D97706", borderRadius: "12px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#92400E", lineHeight: 1.4 }}>
                      We want to make sure we Flokked this correctly —{" "}
                      {itemsNeedingVerification.length} booking{itemsNeedingVerification.length > 1 ? "s need" : " needs"} a quick check.
                    </p>
                    <button
                      onClick={() => { setVerificationIndex(0); setVerificationModalOpen(true); }}
                      style={{ marginTop: "8px", fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                    >
                      Review now →
                    </button>
                  </div>
                )}
              <div style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", backgroundColor: "#fff" }}>
                {tripDays.map(({ dayIndex, label, date, shortDate }, i) => {
                  const isOpen = openDay === i;
                  const allDayItems = buildDayItems(dayIndex);
                  const dayConflicts = detectDayConflicts(allDayItems);
                  const hasConflict = dayConflicts.length > 0 && !dismissedConflictDays.has(dayIndex);
                  return (
                    <div key={i} style={{ borderBottom: i < tripDays.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>

                      {/* Header row */}
                      <div
                        onClick={() => toggle(i)}
                        className="hover:bg-black/[0.02]"
                        style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                          <span style={{ fontSize: "15px", fontWeight: 800, color: "#1B3A5C", whiteSpace: "nowrap" }}>{label}</span>
                          <span style={{ fontSize: "13px", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{date}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                          {(() => {
                            const timedItems = allDayItems.filter(i => i.startTime);
                            if (timedItems.length >= 1) {
                              const firstTime = formatTime(timedItems[0].startTime);
                              const lastTime = timedItems.length >= 2 ? formatTime(timedItems[timedItems.length - 1].startTime) : null;
                              const timeRange = lastTime ? `${firstTime} — ${lastTime}` : firstTime;
                              return (
                                <span style={{ fontSize: "11px", color: "#888" }}>
                                  {shortDate} · {timeRange}
                                </span>
                              );
                            }
                            return allDayItems.length > 0 ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#1B3A5C", backgroundColor: "rgba(27,58,92,0.08)", borderRadius: "999px", padding: "3px 10px" }}>
                                {allDayItems.length} {allDayItems.length === 1 ? "stop" : "stops"}
                              </span>
                            ) : null;
                          })()}
                          {hasConflict && (
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#D97706", flexShrink: 0, display: "inline-block" }} title="Scheduling conflict" />
                          )}
                          <ChevronDown size={16} style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease", flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Expandable body */}
                      <div style={{ maxHeight: isOpen ? "3000px" : "0", overflow: isOpen ? "visible" : "hidden", transition: "max-height 0.3s ease" }}>
                        <div style={{ padding: "4px 12px 16px" }}>

                          {/* Conflict warning banner */}
                          {isOpen && hasConflict && (
                            <div style={{ borderLeft: "3px solid #D97706", backgroundColor: "#FFFBEB", borderRadius: "0 8px 8px 0", padding: "10px 12px", marginBottom: "10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                              <div style={{ flex: 1 }}>
                                {dayConflicts.map((w, wi) => (
                                  <p key={wi} style={{ fontSize: "13px", color: "#1B3A5C", lineHeight: 1.4, margin: 0, marginBottom: wi < dayConflicts.length - 1 ? "4px" : 0 }}>{w}</p>
                                ))}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); setDismissedConflictDays(prev => { const next = new Set(prev); next.add(dayIndex); return next; }); }}
                                style={{ fontSize: "12px", color: "#92400E", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, fontWeight: 500 }}
                              >Dismiss</button>
                            </div>
                          )}

                          {/* All day items */}
                          <div>
                              {allDayItems.flatMap((item, idx) => {
                                const next = allDayItems[idx + 1];

                                // Transit: use arrival coords for TRAIN/FLIGHT preceding items.
                                // No startTime requirement — any two consecutive items with valid coords within 50km show transit.
                                const isVTC = (lat: number | null | undefined, lng: number | null | undefined) =>
                                  lat != null && lng != null && typeof lat === "number" && typeof lng === "number" &&
                                  lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
                                const prevIt = item.itineraryItem;
                                const useArrivalCoords = (prevIt?.type === "TRAIN" || prevIt?.type === "FLIGHT") &&
                                  isVTC(prevIt?.arrivalLat, prevIt?.arrivalLng);
                                const fromLat = useArrivalCoords ? prevIt!.arrivalLat! : (item.lat ?? null);
                                const fromLng = useArrivalCoords ? prevIt!.arrivalLng! : (item.lng ?? null);
                                // For FLIGHT next items, use departure airport coords (not arrival)
                                // so transit "Baymond → PUS" uses PUS coords, not NRT
                                const nextItItem = next?.itineraryItem;
                                const nextFlightItem = next?.flight;
                                const nextFromAirport = (nextItItem?.type === "FLIGHT" ? nextItItem.fromAirport : nextFlightItem?.fromAirport)?.toUpperCase().trim() ?? "";
                                const depCoords = nextFromAirport ? AIRPORT_COORDS[nextFromAirport] : null;
                                const toLat = depCoords?.lat ?? (next?.lat ?? null);
                                const toLng = depCoords?.lng ?? (next?.lng ?? null);

                                const prevHasCoords = isVTC(fromLat, fromLng);
                                const nextHasCoords = isVTC(toLat, toLng);
                                const distanceBetweenItems = prevHasCoords && nextHasCoords
                                  ? haversineKm(fromLat!, fromLng!, toLat!, toLng!)
                                  : 999;

                                return [
                                <div key={item.sortId} style={{ display: "flex", alignItems: "stretch", marginBottom: "8px" }}>
                                  {/* Up/down reorder controls */}
                                  <div style={{ width: "22px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", paddingRight: "4px" }}>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorder(item.sortId, "up"); }}
                                      disabled={idx === 0}
                                      style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#D8D8D8" : "#C4664A", fontSize: "13px", lineHeight: 1, padding: "1px 0", fontWeight: 700 }}
                                    >↑</button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorder(item.sortId, "down"); }}
                                      disabled={idx === allDayItems.length - 1}
                                      style={{ background: "none", border: "none", cursor: idx === allDayItems.length - 1 ? "default" : "pointer", color: idx === allDayItems.length - 1 ? "#D8D8D8" : "#C4664A", fontSize: "13px", lineHeight: 1, padding: "1px 0", fontWeight: 700 }}
                                    >↓</button>
                                  </div>

                                  {/* Saved item card */}
                                      {item.itemType === "saved" && item.recAddition && (() => {
                                        const a = item.recAddition;
                                        return (
                                          <div
                                            onClick={a.savedItemId ? () => {
                                              setDetailItemId(a.savedItemId!);
                                              setDetailRemover(() => () => {
                                                if (a.savedItemId) {
                                                  fetch(`/api/saves/${a.savedItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayIndex: null }) }).catch(e => console.error("[removeFromDay]", e));
                                                }
                                                setRecAdditions(prev => prev.filter(r => r.savedItemId !== a.savedItemId));
                                                setDetailItemId(null);
                                                setDetailRemover(null);
                                              });
                                            } : undefined}
                                            style={{ flex: 1, display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: a.savedItemId ? "pointer" : "default" }}
                                          >
                                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "rgba(196,102,74,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <span style={{ fontSize: "12px", fontWeight: 800, color: "#C4664A" }}>{idx + 1}</span>
                                            </div>
                                            {a.img && (
                                              <div style={{ width: "52px", height: "52px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${a.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{a.title}</p>
                                                {a.savedItemId && (
                                                  <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                                                    <button
                                                      onClick={async e => {
                                                        e.stopPropagation();
                                                        try {
                                                          const res = await fetch(`/api/saves/${a.savedItemId}`);
                                                          const data = await res.json() as { item: { rawTitle: string | null; extractedCheckin: string | null; extractedCheckout: string | null; websiteUrl: string | null; notes: string | null } };
                                                          const it = data.item;
                                                          setEditingLodging({ id: a.savedItemId!, rawTitle: it.rawTitle ?? a.title, extractedCheckin: it.extractedCheckin ?? "", extractedCheckout: it.extractedCheckout ?? "", websiteUrl: it.websiteUrl ?? "", notes: it.notes ?? "" });
                                                        } catch { /* ignore */ }
                                                      }}
                                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "2px", lineHeight: 1 }}
                                                      title="Edit"
                                                    >
                                                      <Pencil size={14} />
                                                    </button>
                                                    <button
                                                      onClick={async e => {
                                                        e.stopPropagation();
                                                        if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
                                                        await fetch(`/api/saves/${a.savedItemId}`, { method: "DELETE" });
                                                        setRecAdditions(prev => prev.filter(r => r.savedItemId !== a.savedItemId));
                                                      }}
                                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", lineHeight: 1 }}
                                                      title="Delete"
                                                    >
                                                      <Trash2 size={14} />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              {(() => {
                                                const loc = a.location ?? "";
                                                const arrMatch = loc.match(/arrives\s+(\d{1,2}:\d{2})/i);
                                                const arrTime = arrMatch ? formatTime(arrMatch[1]) : null;
                                                const cleanLoc = loc.replace(/\s*·\s*departs\s+\d{1,2}:\d{2}/i, "").replace(/\s*·\s*arrives\s+\d{1,2}:\d{2}/i, "").trim();
                                                const rawDisplayTime = getDisplayTime(a.startTime, "saved", allDayItems);
                                                const depFormatted = rawDisplayTime ? formatTime(rawDisplayTime) : null;
                                                const isDefaultTime = !a.startTime && depFormatted != null;
                                                return (
                                                  <>
                                                    {depFormatted && (
                                                      <p style={{ fontSize: "12px", color: isDefaultTime ? "#AAAAAA" : "#C4664A", fontWeight: 600, lineHeight: 1.4 }}>
                                                        {depFormatted}{arrTime ? ` → ${arrTime}` : ""}{isDefaultTime ? " (approx)" : ""}
                                                      </p>
                                                    )}
                                                    {cleanLoc && <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4 }} suppressHydrationWarning={true}>{cleanDisplayDescription(cleanLoc)}</p>}
                                                  </>
                                                );
                                              })()}
                                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: a.isBooked ? "rgba(74,124,89,0.1)" : "rgba(0,0,0,0.06)", color: a.isBooked ? "#4a7c59" : "#888", borderRadius: "999px", padding: "2px 8px" }}>
                                                  {a.isBooked ? "Booked ✓" : "Added"}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Flight card */}
                                      {item.itemType === "flight" && item.flight && (() => {
                                        const f = item.flight;
                                        const depTime = formatTime(f.departureTime) ?? f.departureTime;
                                        const arrTime = f.arrivalTime ? (formatTime(f.arrivalTime) ?? f.arrivalTime) : null;
                                        return (
                                          <div style={{ flex: 1, display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "rgba(27,58,92,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <Plane size={12} style={{ color: "#1B3A5C" }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{f.fromAirport} → {f.toAirport} · {f.airline} {f.flightNumber}</p>
                                                <button
                                                  onClick={e => { e.stopPropagation(); setEditingFlight(f); }}
                                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: "2px", lineHeight: 1, flexShrink: 0 }}
                                                  title="Edit flight"
                                                >
                                                  <Pencil size={16} />
                                                </button>
                                              </div>
                                              <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4 }}>
                                                <span>Departs </span>
                                                <span style={depTime ? {} : { color: "#BBBBBB" }}>{depTime ?? "Time TBC"}</span>
                                                <span> · Arrives </span>
                                                <span style={arrTime ? {} : { color: "#BBBBBB" }}>{arrTime ?? "Time TBC"}</span>
                                                {f.duration ? <span> · {f.duration}</span> : null}
                                              </p>
                                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: f.status === "booked" ? "rgba(27,58,92,0.1)" : "rgba(0,0,0,0.06)", color: f.status === "booked" ? "#1B3A5C" : "#888", borderRadius: "999px", padding: "2px 8px" }}>
                                                  {f.status === "booked" ? "Booked" : "Saved"}
                                                </span>
                                                {f.confirmationCode && (
                                                  <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace" }}>{f.confirmationCode}</span>
                                                )}
                                              </div>
                                              {onRemoveFlightFromDay && (
                                                <button onClick={e => { e.stopPropagation(); onRemoveFlightFromDay(f.id); }} style={{ fontSize: "11px", color: "#e53e3e", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "4px 0 0" }}>Remove from day</button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Activity card */}
                                      {item.itemType === "activity" && item.activity && (() => {
                                        const a = item.activity;
                                        return (
                                          <div onClick={() => setDetailActivity(a)} style={{ flex: 1, display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "rgba(107,143,113,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <Compass size={12} style={{ color: "#6B8F71" }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{a.title}</p>
                                                {onEditActivity && (
                                                  <button
                                                    onClick={e => { e.stopPropagation(); onEditActivity(a); }}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: "2px", lineHeight: 1, flexShrink: 0 }}
                                                    title="Edit activity"
                                                  >
                                                    <Pencil size={16} />
                                                  </button>
                                                )}
                                              </div>
                                              {(a.time || a.venueName) && (
                                                <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4 }}>{a.time ?? ""}{a.endTime ? ` – ${a.endTime}` : ""}{a.venueName ? ` · ${a.venueName}` : ""}</p>
                                              )}
                                              {a.website && (
                                                <a href={a.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#C4664A", fontWeight: 600, textDecoration: "none", marginTop: "3px" }}>
                                                  {/ticket|concert|game|sport|baseball|soccer|football|theater|theatre|show|stadium|arena/i.test(a.title) ? "Book tickets →" : "Visit site →"}
                                                </a>
                                              )}
                                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: a.status === "booked" ? "rgba(74,124,89,0.1)" : a.status === "confirmed" ? "rgba(27,58,92,0.08)" : "rgba(0,0,0,0.06)", color: a.status === "booked" ? "#4a7c59" : a.status === "confirmed" ? "#1B3A5C" : "#717171", borderRadius: "999px", padding: "2px 8px" }}>
                                                  {a.status === "booked" ? "Booked" : a.status === "confirmed" ? "Confirmed" : "Interested"}
                                                </span>
                                                {a.confirmationCode && <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace" }}>{a.confirmationCode}</span>}
                                                {a.status !== "booked" && onMarkActivityBooked && (
                                                  <button onClick={e => { e.stopPropagation(); onMarkActivityBooked(a.id); }} style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Mark booked →</button>
                                                )}
                                              </div>
                                              {a.notes && <p style={{ fontSize: "12px", color: "#888", marginTop: "4px", fontStyle: "italic" }}>{a.notes}</p>}
                                              {onRemoveActivityFromDay && (
                                                <button onClick={e => { e.stopPropagation(); onRemoveActivityFromDay(a.id); }} style={{ fontSize: "11px", color: "#e53e3e", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "4px 0 0" }}>Remove from day</button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      {/* ItineraryItem card (email-imported confirmed booking) */}
                                      {item.itemType === "itinerary" && item.itineraryItem && (() => {
                                        const it = item.itineraryItem;
                                        // Shared card shell: white bg, terracotta left border, no icon/emoji
                                        const cardStyle: React.CSSProperties = { flex: 1, backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderLeft: "3px solid #C4664A", borderRadius: "12px", padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
                                        const bookedBadge = <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", borderRadius: "999px", padding: "2px 8px" }}>Booked</span>;
                                        const pencilBtn = (onClick: () => void) => (
                                          <button onClick={e => { e.stopPropagation(); onClick(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px", flexShrink: 0 }} title="Edit">
                                            <Pencil size={14} />
                                          </button>
                                        );
                                        function formatDateShort(d: string | null): string | null {
                                          if (!d) return null;
                                          try {
                                            const dt = new Date(d + "T12:00:00");
                                            const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
                                            const mo = dt.toLocaleDateString("en-US", { month: "short" });
                                            return `${wd} ${mo} ${dt.getDate()}`;
                                          } catch { return d; }
                                        }

                                        // ── FLIGHT ───────────────────────────────────────────────────────
                                        if (it.type === "FLIGHT") {
                                          const matchFlight = it.confirmationCode
                                            ? localFlights.find(f => f.confirmationCode === it.confirmationCode)
                                            : localFlights.find(f => f.fromAirport === it.fromAirport && f.toAirport === it.toAirport && f.dayIndex === it.dayIndex);
                                          const from = it.fromAirport || matchFlight?.fromAirport || "";
                                          const to = it.toAirport || matchFlight?.toAirport || "";
                                          const route = from && to ? `${from} → ${to}` : (from || to || it.title);
                                          const airlineLabel = matchFlight?.airline && matchFlight?.flightNumber
                                            ? `${matchFlight.airline} · ${matchFlight.flightNumber}` : null;
                                          const depTime = it.departureTime;
                                          const arrTime = it.arrivalTime;
                                          const paxLabel = it.passengers.length > 0
                                            ? it.passengers.length <= 2
                                              ? it.passengers.join(", ")
                                              : `${it.passengers.length} passengers`
                                            : null;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{route}</p>
                                                  {airlineLabel && <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "3px" }}>{airlineLabel}</p>}
                                                  <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>
                                                    Departs <span style={depTime ? {} : { color: "#BBBBBB" }}>{depTime ?? "Time TBC"}</span>
                                                    {" · "}Arrives <span style={arrTime ? {} : { color: "#BBBBBB" }}>{arrTime ?? "Time TBC"}</span>
                                                  </p>
                                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                    {bookedBadge}
                                                    {it.confirmationCode && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {it.confirmationCode}</span>}
                                                    {paxLabel && <span style={{ fontSize: "11px", color: "#999" }}>{paxLabel}</span>}
                                                    <button onClick={e => { e.stopPropagation(); e.preventDefault(); if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); }} style={{ fontSize: "11px", color: "#bbb", background: "none", border: "none", padding: 0, cursor: "pointer", marginLeft: "2px" }}>Remove</button>
                                                  </div>
                                                </div>
                                                {matchFlight && pencilBtn(() => setEditingFlight(matchFlight))}
                                              </div>
                                            </div>
                                          );
                                        }

                                        // ── LODGING ──────────────────────────────────────────────────────
                                        if (it.type === "LODGING") {
                                          const isCheckOut = /^check-out:/i.test(it.title);
                                          const hotelName = it.title.replace(/^check-in:\s*/i, "").replace(/^check-out:\s*/i, "");
                                          const dateLabel = isCheckOut ? "Check-out" : "Check-in";
                                          const dateFormatted = formatDateShort(it.scheduledDate);
                                          const costLabel = it.totalCost != null ? `${it.currency ?? ""} ${it.totalCost.toLocaleString()}`.trim() : null;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{hotelName}</p>
                                                  {dateFormatted && (
                                                    <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>
                                                      {dateLabel} · {dateFormatted}
                                                    </p>
                                                  )}
                                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                    {bookedBadge}
                                                    {it.confirmationCode && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {it.confirmationCode}</span>}
                                                    {costLabel && <span style={{ fontSize: "11px", color: "#999" }}>{costLabel}</span>}
                                                    <button onClick={e => { e.stopPropagation(); e.preventDefault(); if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); }} style={{ fontSize: "11px", color: "#bbb", background: "none", border: "none", padding: 0, cursor: "pointer", marginLeft: "2px" }}>Remove</button>
                                                  </div>
                                                </div>
                                                {pencilBtn(() => setSelectedItineraryItem(it))}
                                              </div>
                                            </div>
                                          );
                                        }

                                        // ── TRAIN ────────────────────────────────────────────────────────
                                        if (it.type === "TRAIN") {
                                          const trainRoute = it.fromCity && it.toCity ? `${it.fromCity} → ${it.toCity}` : it.title;
                                          const operator = it.fromCity && it.toCity && it.title !== trainRoute ? it.title : null;
                                          const depTime = it.departureTime;
                                          const arrTime = it.arrivalTime;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{trainRoute}</p>
                                                  {operator && <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "3px" }}>{operator}</p>}
                                                  {(depTime || arrTime) && (
                                                    <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>
                                                      Departs <span style={depTime ? {} : { color: "#BBBBBB" }}>{depTime ?? "Time TBC"}</span>
                                                      {" · "}Arrives <span style={arrTime ? {} : { color: "#BBBBBB" }}>{arrTime ?? "Time TBC"}</span>
                                                    </p>
                                                  )}
                                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                    {bookedBadge}
                                                    {it.confirmationCode && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {it.confirmationCode}</span>}
                                                    <button onClick={e => { e.stopPropagation(); e.preventDefault(); if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); }} style={{ fontSize: "11px", color: "#bbb", background: "none", border: "none", padding: 0, cursor: "pointer", marginLeft: "2px" }}>Remove</button>
                                                  </div>
                                                </div>
                                                {pencilBtn(() => setSelectedItineraryItem(it))}
                                              </div>
                                            </div>
                                          );
                                        }

                                        // ── OTHER (ACTIVITY, RESTAURANT, CAR_RENTAL, etc.) ───────────────
                                        const typeLabel = it.type.charAt(0) + it.type.slice(1).toLowerCase().replace(/_/g, " ");
                                        const isActivity = it.type === "ACTIVITY";
                                        return (
                                          <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => { if (it.type === "ACTIVITY") setEditActivityTitle(it.title ?? ""); setSelectedItineraryItem(it); }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                              <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{it.title}</p>
                                                {it.notes && <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>{it.notes}</p>}
                                                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                  {bookedBadge}
                                                  {!isActivity && <span style={{ fontSize: "11px", color: "#999" }}>{typeLabel}</span>}
                                                  {it.confirmationCode && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {it.confirmationCode}</span>}
                                                  {it.totalCost != null && <span style={{ fontSize: "11px", color: "#999" }}>{it.currency ?? ""} {it.totalCost.toLocaleString()}</span>}
                                                  <button onClick={e => { e.stopPropagation(); e.preventDefault(); if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); }} style={{ fontSize: "11px", color: "#bbb", background: "none", border: "none", padding: 0, cursor: "pointer", marginLeft: "2px" }}>Remove</button>
                                                </div>
                                              </div>
                                              {pencilBtn(() => { if (it.type === "ACTIVITY") setEditActivityTitle(it.title ?? ""); setSelectedItineraryItem(it); })}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                  {/* Move to day — button only; dropdown rendered via portal below */}
                                  <div style={{ flexShrink: 0, marginLeft: "6px", display: "flex", alignItems: "center" }}>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (openMoveMenuId === item.sortId) {
                                          setOpenMoveMenuId(null);
                                          setMoveMenuAnchor(null);
                                        } else {
                                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setMoveMenuAnchor({ top: rect.bottom + 4, left: rect.right, width: rect.width });
                                          setOpenMoveMenuId(item.sortId);
                                        }
                                      }}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#AAAAAA", padding: "4px 5px", borderRadius: "6px", fontWeight: 500, whiteSpace: "nowrap", lineHeight: 1 }}
                                    >Move</button>
                                  </div>
                                </div>,
                                prevHasCoords && nextHasCoords && distanceBetweenItems <= 50 ? (
                                  (() => {
                                    const transit = computeTransit(fromLat!, fromLng!, toLat!, toLng!);
                                    return (
                                      <div key={`transit_${idx}`} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 28px 6px", marginBottom: "2px" }}>
                                        <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                        <span style={{ fontSize: "11px", color: "#888", whiteSpace: "nowrap" }}>
                                          {transit.mode} · {transit.duration}
                                        </span>
                                        <a href={transit.directionsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                                          Directions →
                                        </a>
                                        <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                      </div>
                                    );
                                  })()
                                ) : null,
                                ];
                              })}
                          </div>

                          {/* Auto-sort day link */}
                          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
                            {autoSortConfirmDay === dayIndex ? (
                              <span style={{ fontSize: "12px", color: "#AAAAAA", padding: "4px 0" }}>Day re-sorted</span>
                            ) : (
                              <button
                                onClick={() => {
                                  const items = buildDayItems(dayIndex);
                                  const withWeight = items.map(item => ({ item, w: toSortKey(item) }));
                                  withWeight.sort((a, b) => a.w - b.w);
                                  withWeight.forEach(({ item }, idx) => {
                                    if (item.itemType === "saved" && item.rawId) {
                                      setRecAdditions(prev => prev.map(r => r.savedItemId === item.rawId ? { ...r, sortOrder: idx } : r));
                                      fetch(`/api/saves/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
                                    } else if (item.itemType === "activity" && item.rawId) {
                                      setLocalActivities(prev => prev.map(a => a.id === item.rawId ? { ...a, sortOrder: idx } : a));
                                      fetch(`/api/trips/${tripId}/activities/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
                                    } else if (item.itemType === "flight" && item.rawId) {
                                      setLocalFlights(prev => prev.map(f => f.id === item.rawId ? { ...f, sortOrder: idx } : f));
                                      fetch(`/api/trips/${tripId}/flights/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
                                    } else if (item.itemType === "itinerary" && item.rawId) {
                                      setLocalItineraryItems(prev => prev.map(it => it.id === item.rawId ? { ...it, sortOrder: idx } : it));
                                      fetch(`/api/trips/${tripId}/itinerary/${item.rawId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }) }).catch(console.error);
                                    }
                                  });
                                  setAutoSortConfirmDay(dayIndex);
                                  setTimeout(() => setAutoSortConfirmDay(prev => prev === dayIndex ? null : prev), 2000);
                                }}
                                style={{ fontSize: "12px", color: "#AAAAAA", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}
                              >Auto-sort day</button>
                            )}
                          </div>

                          {/* + Add activity dashed button */}
                          <button
                            onClick={() => {
                              console.log("add activity clicked", { tripId, dayIndex });
                              let defaultDate: string | undefined;
                              if (tripStartDate && dayIndex !== undefined && dayIndex !== null) {
                                try {
                                  // Use parseDateForDisplay to handle both date-only and ISO datetime strings
                                  const start = parseDateForDisplay(tripStartDate);
                                  start.setDate(start.getDate() + dayIndex);
                                  // Use local date methods to avoid UTC offset shifting the date back one day
                                  const y = start.getFullYear();
                                  const m = String(start.getMonth() + 1).padStart(2, "0");
                                  const d = String(start.getDate()).padStart(2, "0");
                                  defaultDate = `${y}-${m}-${d}`;
                                } catch { /* fall through — modal opens without default date */ }
                              }
                              setAddActivityDefaultDate(defaultDate);
                              setShowAddActivityModal(true);
                            }}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px", marginTop: "4px", border: "1.5px dashed rgba(196,102,74,0.35)", borderRadius: "10px", background: "none", cursor: "pointer", color: "#C4664A", fontSize: "13px", fontWeight: 600 }}
                          >
                            <Plus size={14} />
                            Add activity
                          </button>

                          {/* Per-day notes */}
                          <div style={{ marginTop: "10px" }}>
                            <textarea
                              value={notes[i] ?? ""}
                              onChange={(e) => setNotes((prev) => {
                                const next = [...prev];
                                next[i] = e.target.value;
                                return next;
                              })}
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
              </>
            );
          })()}
        </div>{/* end left panel */}

        {/* Move-to-day portal dropdown — rendered at document.body to escape overflow:hidden containers */}
        {typeof window !== "undefined" && openMoveMenuId && moveMenuAnchor && createPortal(
          <div
            ref={moveMenuRef}
            style={{
              position: "fixed",
              top: moveMenuAnchor.top,
              left: Math.max(8, moveMenuAnchor.left - 160),
              zIndex: 9999,
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              minWidth: "160px",
              maxHeight: "300px",
              overflowY: "auto",
              padding: "4px 0",
            }}
          >
            {tripDaysAll.map(d => {
              // Extract current day from the openMoveMenuId's context — find the item
              const activeSortId = openMoveMenuId;
              let currentDayIndex: number | null = null;
              if (activeSortId.startsWith("saved_")) {
                const rawId = activeSortId.slice(6);
                currentDayIndex = recAdditions.find(r => (r.savedItemId ?? r.title) === rawId)?.dayIndex ?? null;
              } else if (activeSortId.startsWith("activity_")) {
                currentDayIndex = localActivities.find(a => a.id === activeSortId.slice(9))?.dayIndex ?? null;
              } else if (activeSortId.startsWith("flight_")) {
                currentDayIndex = localFlights.find(f => f.id === activeSortId.slice(7))?.dayIndex ?? null;
              } else if (activeSortId.startsWith("itinerary_")) {
                currentDayIndex = localItineraryItems.find(it => it.id === activeSortId.slice(10))?.dayIndex ?? null;
              }
              const isCurrent = d.dayIndex === currentDayIndex;
              return (
                <button
                  key={d.dayIndex}
                  disabled={isCurrent}
                  onClick={() => {
                    handleCrossDayMove(activeSortId, d.dayIndex);
                    setOpenMoveMenuId(null);
                    setMoveMenuAnchor(null);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    width: "100%", background: "none", border: "none",
                    cursor: isCurrent ? "default" : "pointer",
                    fontSize: "12px",
                    color: isCurrent ? "#C4664A" : "#333",
                    padding: "8px 14px",
                    textAlign: "left",
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  <span style={{ width: "10px", flexShrink: 0, fontSize: "10px" }}>{isCurrent ? "✓" : ""}</span>
                  <span>{d.label} — {d.shortDate}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}

        {/* Right panel: map — desktop sticky sidebar only (mobile map renders above) */}
        {isDesktop && <div style={{ width: "42%", position: "sticky", top: 0, height: leftHeight ? `${leftHeight}px` : "500px", minHeight: "260px", maxHeight: "600px" }}>
          <TripMap
            activeDay={openDay >= 0 ? openDay : null}
            flyTarget={flyTarget}
            onFlyTargetConsumed={onFlyTargetConsumed}
            tripId={tripId}
            destinationCity={destinationCity}
            destinationCountry={destinationCountry}
            savedItems={recAdditions.filter(a => a.lat != null && a.lng != null) as { title: string; lat: number; lng: number; dayIndex?: number | null }[]}
            activities={localActivities.filter(a => a.lat != null && a.lng != null).map(a => ({ title: a.title, lat: a.lat!, lng: a.lng!, dayIndex: a.dayIndex }))}
            importedBookingPins={[...localItineraryItems]
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .filter(it => it.latitude != null && it.longitude != null && it.latitude !== 0 && it.longitude !== 0)
              .map(it => ({ id: it.id, title: it.title, type: it.type, dayIndex: it.dayIndex ?? null, latitude: it.latitude!, longitude: it.longitude!, arrivalLat: it.arrivalLat ?? null, arrivalLng: it.arrivalLng ?? null }))}
          />
        </div>}{/* end right panel (desktop only) */}

      </div>

      {showTaskModal && <TaskModal onClose={() => setShowTaskModal(false)} />}
      {detailItemId && (
        <SaveDetailModal
          itemId={detailItemId}
          onClose={() => { setDetailItemId(null); setDetailRemover(null); }}
          onMarkedBooked={(id) => setRecAdditions(prev => prev.map(a => a.savedItemId === id ? { ...a, isBooked: true } : a))}
          onRemoveFromDay={detailRemover ?? undefined}
          onTimeSet={(id, time) => setRecAdditions(prev => prev.map(a => a.savedItemId === id ? { ...a, startTime: time } : a))}
        />
      )}
      {detailActivity && (
        <ActivityDetailModal
          activity={detailActivity}
          onClose={() => setDetailActivity(null)}
          onEdit={() => { setDetailActivity(null); onEditActivity?.(detailActivity); }}
          onRemove={onRemoveActivityFromDay ? () => { setDetailActivity(null); onRemoveActivityFromDay(detailActivity.id); } : undefined}
          onMarkBooked={onMarkActivityBooked ? () => { setDetailActivity(null); onMarkActivityBooked(detailActivity.id); } : undefined}
        />
      )}
      {showAddActivityModal && tripId && (
        <AddActivityModal
          tripId={tripId}
          defaultDate={addActivityDefaultDate}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          onClose={() => { setShowAddActivityModal(false); setAddActivityDefaultDate(undefined); }}
          onSaved={(saved) => {
            setShowAddActivityModal(false);
            setAddActivityDefaultDate(undefined);
            // If the new activity has a startTime, queue an auto-sort for its day
            const act = saved as unknown as { time?: string | null; dayIndex?: number | null };
            if (act?.time && act?.dayIndex != null) {
              pendingAutoSortDayRef.current = act.dayIndex;
            }
            onActivityAdded?.();
          }}
        />
      )}
      {editingFlight && tripId && (
        <EditFlightModal
          flight={editingFlight}
          tripId={tripId}
          onClose={() => setEditingFlight(null)}
          onSaved={(updated) => {
            setLocalFlights(prev => prev.map(f => f.id === updated.id ? updated : f));
            setEditingFlight(null);
          }}
        />
      )}
      {editingLodging && createPortal(
        <div
          onClick={() => setEditingLodging(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", padding: "24px 20px 40px", paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Edit Hotel / Lodging</p>
              <button onClick={() => setEditingLodging(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>×</button>
            </div>
            {(["rawTitle", "extractedCheckin", "extractedCheckout", "websiteUrl", "notes"] as const).map(field => {
              const labels: Record<string, string> = { rawTitle: "Hotel Name", extractedCheckin: "Check-in Date", extractedCheckout: "Check-out Date", websiteUrl: "Website URL", notes: "Notes" };
              const types: Record<string, string> = { rawTitle: "text", extractedCheckin: "date", extractedCheckout: "date", websiteUrl: "url", notes: "textarea" };
              const val = editingLodging[field];
              return (
                <div key={field} style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "5px", display: "block" }}>{labels[field]}</label>
                  {types[field] === "textarea" ? (
                    <textarea
                      rows={3}
                      value={val}
                      onChange={e => setEditingLodging(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }}
                    />
                  ) : (
                    <input
                      type={types[field]}
                      value={val}
                      onChange={e => setEditingLodging(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              );
            })}
            <button
              onClick={async () => {
                if (!editingLodging) return;
                setLodgingSaving(true);
                try {
                  await fetch(`/api/saves/${editingLodging.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      rawTitle: editingLodging.rawTitle,
                      extractedCheckin: editingLodging.extractedCheckin || null,
                      extractedCheckout: editingLodging.extractedCheckout || null,
                      websiteUrl: editingLodging.websiteUrl || null,
                      notes: editingLodging.notes,
                    }),
                  });
                  setRecAdditions(prev => prev.map(a =>
                    a.savedItemId === editingLodging.id
                      ? { ...a, title: editingLodging.rawTitle }
                      : a
                  ));
                  setEditingLodging(null);
                } catch { /* ignore */ } finally {
                  setLodgingSaving(false);
                }
              }}
              disabled={lodgingSaving}
              style={{ width: "100%", padding: "14px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              {lodgingSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>,
        document.body
      )}
      {selectedItineraryItem && (() => {
        const sit = selectedItineraryItem;
        function fmtDateModal(d: string | null): string | null {
          if (!d) return null;
          try {
            const dt = new Date(d + "T12:00:00");
            return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          } catch { return d; }
        }
        const typeLabel = sit.type.charAt(0) + sit.type.slice(1).toLowerCase().replace(/_/g, " ");
        const rowStyle: React.CSSProperties = { fontSize: "13px", color: "#1a1a1a", fontWeight: 500 };
        const lblStyle: React.CSSProperties = { fontSize: "11px", color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
        const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", marginBottom: "16px" };
        const titleStyle: React.CSSProperties = { fontSize: "22px", fontWeight: 800, color: "#1B3A5C", marginBottom: "14px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 };
        return (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center", padding: isDesktop ? "16px" : "0" }}
            onClick={() => setSelectedItineraryItem(null)}
          >
            <div
              style={{ backgroundColor: "#fff", width: "100%", maxWidth: isDesktop ? "440px" : undefined, borderRadius: isDesktop ? "16px" : "20px 20px 0 0", padding: "24px", maxHeight: "85vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>{typeLabel}</span>
                <button onClick={() => setSelectedItineraryItem(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#AAAAAA" }}>
                  <X size={20} />
                </button>
              </div>

              {sit.type === "FLIGHT" && (() => {
                const from = sit.fromAirport || sit.fromCity || "";
                const to = sit.toAirport || sit.toCity || "";
                const route = from && to ? `${from} → ${to}` : (from || to || sit.title);
                const paxLabel = sit.passengers.length > 0
                  ? sit.passengers.length <= 2 ? sit.passengers.join(", ") : `${sit.passengers.length} passengers`
                  : null;
                return (
                  <div>
                    <p style={titleStyle}>{route}</p>
                    <div style={gridStyle}>
                      {sit.scheduledDate && <><span style={lblStyle}>Date</span><span style={rowStyle}>{fmtDateModal(sit.scheduledDate)}</span></>}
                      {sit.departureTime && <><span style={lblStyle}>Departs</span><span style={rowStyle}>{sit.departureTime}</span></>}
                      {sit.arrivalTime && <><span style={lblStyle}>Arrives</span><span style={rowStyle}>{sit.arrivalTime}</span></>}
                      {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                      {paxLabel && <><span style={lblStyle}>Passengers</span><span style={rowStyle}>{paxLabel}</span></>}
                    </div>
                  </div>
                );
              })()}

              {sit.type === "LODGING" && (() => {
                const hotelName = sit.title.replace(/^check-in:\s*/i, "").replace(/^check-out:\s*/i, "");
                const isCheckOut = /^check-out:/i.test(sit.title);
                const costLabel = sit.totalCost != null ? `${sit.currency ?? ""} ${sit.totalCost.toLocaleString()}`.trim() : null;
                const guestsLabel = sit.passengers.length > 0
                  ? sit.passengers.length <= 2 ? sit.passengers.join(", ") : `${sit.passengers.length} guests`
                  : null;
                return (
                  <div>
                    <p style={titleStyle}>{hotelName}</p>
                    <div style={gridStyle}>
                      <span style={lblStyle}>{isCheckOut ? "Check-out" : "Check-in"}</span>
                      <span style={rowStyle}>{fmtDateModal(sit.scheduledDate) ?? "—"}</span>
                      {sit.address && <><span style={lblStyle}>Address</span><span style={rowStyle}>{sit.address}</span></>}
                      {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                      {costLabel && <><span style={lblStyle}>Total</span><span style={rowStyle}>{costLabel}</span></>}
                      {guestsLabel && <><span style={lblStyle}>Guests</span><span style={rowStyle}>{guestsLabel}</span></>}
                    </div>
                    {sit.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(sit.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textAlign: "center", backgroundColor: "#C4664A", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                      >
                        Open in Maps
                      </a>
                    )}
                  </div>
                );
              })()}

              {sit.type === "TRAIN" && (() => {
                const trainRoute = sit.fromCity && sit.toCity ? `${sit.fromCity} → ${sit.toCity}` : sit.title;
                const operator = sit.fromCity && sit.toCity && sit.title !== trainRoute ? sit.title : null;
                return (
                  <div>
                    <p style={titleStyle}>{trainRoute}</p>
                    <div style={gridStyle}>
                      {operator && <><span style={lblStyle}>Operator</span><span style={rowStyle}>{operator}</span></>}
                      {sit.scheduledDate && <><span style={lblStyle}>Date</span><span style={rowStyle}>{fmtDateModal(sit.scheduledDate)}</span></>}
                      {sit.departureTime && <><span style={lblStyle}>Departs</span><span style={rowStyle}>{sit.departureTime}</span></>}
                      {sit.arrivalTime && <><span style={lblStyle}>Arrives</span><span style={rowStyle}>{sit.arrivalTime}</span></>}
                      {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                    </div>
                  </div>
                );
              })()}

              {sit.type === "ACTIVITY" && (() => {
                const costLabel = sit.totalCost != null ? `${sit.currency ?? ""} ${sit.totalCost.toLocaleString()}`.trim() : null;
                const guestsLabel = sit.passengers.length > 0
                  ? sit.passengers.length <= 2 ? sit.passengers.join(", ") : `${sit.passengers.length} guests`
                  : null;
                return (
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#999999", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Activity name</span>
                    <input
                      type="text"
                      value={editActivityTitle}
                      onChange={e => setEditActivityTitle(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{ ...titleStyle, display: "block", width: "100%", border: "none", borderBottom: "2px solid #C4664A", padding: "8px 10px", paddingBottom: "8px", outline: "none", background: "#F9F9F9", fontFamily: "'Playfair Display', Georgia, serif", boxSizing: "border-box", cursor: "text" }}
                      placeholder="Activity name..."
                    />
                    <span style={{ fontSize: "11px", color: "#BBBBBB", display: "block", marginTop: "4px", marginBottom: "16px" }}>Tap above to edit</span>
                    <div style={gridStyle}>
                      {sit.scheduledDate && <><span style={lblStyle}>Date</span><span style={rowStyle}>{fmtDateModal(sit.scheduledDate)}</span></>}
                      {sit.departureTime && <><span style={lblStyle}>Time</span><span style={rowStyle}>{sit.departureTime}</span></>}
                      {sit.address && <><span style={lblStyle}>Meeting point</span><span style={rowStyle}>{sit.address}</span></>}
                      {sit.notes && !/^\d{1,2}:\d{2}$/.test(sit.notes) && !/^departs/i.test(sit.notes) && !/^\d{1,2}:\d{2}\s*·/.test(sit.notes) && <><span style={lblStyle}>Operator</span><span style={rowStyle}>{sit.notes}</span></>}
                      {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                      {costLabel && <><span style={lblStyle}>Total</span><span style={rowStyle}>{costLabel}</span></>}
                      {guestsLabel && <><span style={lblStyle}>Guests</span><span style={rowStyle}>{guestsLabel}</span></>}
                    </div>
                    {sit.bookingUrl && (
                      <a
                        href={sit.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textAlign: "center", backgroundColor: "#1B3A5C", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                      >
                        View booking →
                      </a>
                    )}
                    {sit.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(sit.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textAlign: "center", backgroundColor: "#C4664A", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                      >
                        Open in Maps
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        const newTitle = editActivityTitle.trim();
                        if (!newTitle || newTitle === sit.title) { setSelectedItineraryItem(null); return; }
                        await fetch(`/api/trips/${tripId}/itinerary/${sit.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: newTitle }),
                        });
                        setLocalItineraryItems(prev => prev.map(item => item.id === sit.id ? { ...item, title: newTitle } : item));
                        setSelectedItineraryItem(null);
                      }}
                      style={{ display: "block", width: "100%", marginTop: "12px", padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Save changes
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── Verification Modal ── */}
      {verificationModalOpen && (() => {
        const itemsNeedingVerification = localItineraryItems.filter(i => i.needsVerification === true);
        const item = itemsNeedingVerification[verificationIndex];
        if (!item) return null;
        const isLast = verificationIndex === itemsNeedingVerification.length - 1;
        const lblStyle: React.CSSProperties = { fontSize: "11px", color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
        const valStyle: React.CSSProperties = { fontSize: "13px", color: "#1B3A5C", fontWeight: 500, textAlign: "right" };
        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: "16px" }}
            onClick={() => setVerificationModalOpen(false)}
          >
            <div
              style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "440px", maxHeight: "85vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#D97706", marginBottom: "4px" }}>
                {verificationIndex + 1} of {itemsNeedingVerification.length}
              </p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", marginBottom: "18px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>
                Did we get this right?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", marginBottom: "20px" }}>
                <span style={lblStyle}>Type</span><span style={valStyle}>{item.type.charAt(0) + item.type.slice(1).toLowerCase()}</span>
                <span style={lblStyle}>Title</span><span style={valStyle}>{item.title}</span>
                {item.departureTime && <><span style={lblStyle}>Time</span><span style={valStyle}>{item.departureTime}</span></>}
                {item.address && <><span style={lblStyle}>Location</span><span style={valStyle}>{item.address}</span></>}
                {item.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...valStyle, fontWeight: 700 }}>{item.confirmationCode}</span></>}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={async () => {
                    await fetch(`/api/trips/${tripId}/itinerary/${item.id}/verify`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ verified: true }),
                    });
                    setLocalItineraryItems(prev => prev.map(it => it.id === item.id ? { ...it, needsVerification: false } : it));
                    if (isLast) {
                      setVerificationModalOpen(false);
                      setVerificationIndex(0);
                    } else {
                      setVerificationIndex(v => v + 1);
                    }
                  }}
                  style={{ flex: 1, padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Looks right
                </button>
                <button
                  onClick={() => setVerificationModalOpen(false)}
                  style={{ flex: 1, padding: "12px", backgroundColor: "#fff", color: "#1B3A5C", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Fix it
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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

const TRIP_TYPE_OPTIONS = [
  { value: "beach", label: "Beach" },
  { value: "city", label: "City" },
  { value: "hiking", label: "Hiking" },
  { value: "ski", label: "Ski" },
  { value: "road_trip", label: "Road Trip" },
  { value: "fast_travel", label: "Fast Travel" },
];

const TRIP_TYPE_PACKING: Record<string, { documents: PackingItemDef[]; kids: PackingItemDef[]; clothing: PackingItemDef[]; gear: PackingItemDef[] }> = {
  city: {
    documents: PACKING_ITEMS.documents,
    kids: [
      { id: "sunscreen-city", label: "Sunscreen SPF 50+" },
      { id: "snacks-city", label: "Portable snacks" },
      { id: "travel-games-city", label: "Travel games / tablet" },
      { id: "backpack-kids", label: "Kids daypack" },
    ],
    clothing: [
      { id: "walking-shoes-city", label: "Comfortable walking shoes" },
      { id: "layers-city", label: "Light layers for A/C" },
      { id: "smart-casual", label: "Smart casual outfit (restaurants)" },
      { id: "rain-city", label: "Packable rain jacket" },
    ],
    gear: [
      { id: "power-adapter-city", label: "Universal power adapter" },
      { id: "portable-charger-city", label: "Portable charger" },
      { id: "city-map-app", label: "Offline maps downloaded" },
    ],
  },
  beach: PACKING_ITEMS as typeof PACKING_ITEMS,
  hiking: {
    documents: PACKING_ITEMS.documents,
    kids: [
      { id: "sunscreen-hike", label: "Sunscreen SPF 50+" },
      { id: "insect-hike", label: "Insect repellent" },
      { id: "snacks-hike", label: "Energy snacks / trail mix" },
      { id: "first-aid", label: "Basic first aid kit" },
    ],
    clothing: [
      { id: "hiking-boots", label: "Hiking boots / trail shoes" },
      { id: "moisture-wicking", label: "Moisture-wicking base layers" },
      { id: "fleece-hike", label: "Fleece mid-layer" },
      { id: "waterproof-hike", label: "Waterproof jacket" },
      { id: "hat-hike", label: "Sun hat / buff" },
    ],
    gear: [
      { id: "daypack", label: "Daypack (20-30L)" },
      { id: "trekking-poles", label: "Trekking poles" },
      { id: "water-bottles", label: "Reusable water bottles" },
      { id: "headlamp", label: "Headlamp + batteries" },
    ],
  },
  ski: {
    documents: PACKING_ITEMS.documents,
    kids: [
      { id: "helmet-ski", label: "Ski helmet (kids)" },
      { id: "goggles-kids", label: "Ski goggles (kids)" },
      { id: "hand-warmers", label: "Hand warmers" },
      { id: "lip-balm-ski", label: "SPF lip balm" },
    ],
    clothing: [
      { id: "ski-jacket", label: "Insulated ski jacket" },
      { id: "ski-pants", label: "Waterproof ski pants" },
      { id: "base-layers-ski", label: "Thermal base layers" },
      { id: "ski-gloves", label: "Waterproof gloves / mittens" },
      { id: "wool-socks-ski", label: "Wool ski socks" },
      { id: "neck-gaiter", label: "Neck gaiter / balaclava" },
    ],
    gear: [
      { id: "boot-bag", label: "Ski boot bag" },
      { id: "lock-ski", label: "Ski lock" },
      { id: "portable-charger-ski", label: "Portable charger (cold weather)" },
    ],
  },
  road_trip: {
    documents: [
      ...PACKING_ITEMS.documents,
      { id: "car-insurance", label: "Car insurance / rental docs" },
      { id: "road-maps", label: "Offline maps / GPS" },
    ],
    kids: [
      { id: "car-snacks", label: "Car snacks (plenty)" },
      { id: "tablet-road", label: "Tablets / headphones" },
      { id: "car-games", label: "Car games / activity books" },
      { id: "motion-road", label: "Motion sickness tablets" },
    ],
    clothing: [
      { id: "comfy-road", label: "Comfortable travel clothes" },
      { id: "layers-road", label: "Layers for varied weather" },
      { id: "walking-road", label: "Walking shoes" },
    ],
    gear: [
      { id: "car-charger", label: "Car charging cables" },
      { id: "cooler-road", label: "Soft cooler / thermos" },
      { id: "emergency-kit", label: "Car emergency kit" },
      { id: "power-bank-road", label: "Power bank" },
    ],
  },
  fast_travel: {
    documents: PACKING_ITEMS.documents,
    kids: [
      { id: "snacks-fast", label: "Portable snacks" },
      { id: "tablet-fast", label: "Tablet / headphones" },
    ],
    clothing: [
      { id: "carry-on-outfits", label: "3 versatile outfits" },
      { id: "layers-fast", label: "Light layers" },
      { id: "walking-fast", label: "One pair comfortable shoes" },
    ],
    gear: [
      { id: "carry-on-bag", label: "Carry-on bag only" },
      { id: "packing-cubes", label: "Packing cubes" },
      { id: "charger-fast", label: "Portable charger" },
    ],
  },
};

type DbPackingItem = {
  id: string;
  category: string;
  name: string;
  assignedTo: string;
  notes: string | null;
  packed: boolean;
  sortOrder: number;
};

const PACKING_CATEGORIES = ["Documents", "Clothing", "Toiletries", "Kids", "Tech", "Health", "Gear"];

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Documents: FileText,
  Clothing: Shirt,
  Toiletries: Backpack,
  Kids: Baby,
  Tech: Backpack,
  Health: Backpack,
  Gear: Backpack,
};

function PackingContent({
  tripId,
  destinationCity,
  destinationCountry,
  tripStartDate,
  tripEndDate,
}: {
  tripId?: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}) {
  const [packingItems, setPackingItems] = useState<DbPackingItem[]>([]);
  const [packingLoading, setPackingLoading] = useState(true);
  const [packingGenerating, setPackingGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`);
      if (!res.ok) return;
      const data = await res.json();
      setPackingItems(data.items ?? []);
    } finally {
      setPackingLoading(false);
    }
  }, [tripId]);

  const generate = async () => {
    if (!tripId) return;
    setPackingGenerating(true);
    setGenerateError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch(`/api/trips/${tripId}/packing/generate`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      await fetchItems();
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      setGenerateError(isAbort ? "Request timed out. Try again." : "Could not generate packing list. Try again.");
    } finally {
      setPackingGenerating(false);
    }
  };

  // Load from DB on mount; auto-generate if empty
  const didAutoGenerate = useRef(false);
  useEffect(() => {
    if (!tripId) return;
    (async () => {
      setPackingLoading(true);
      try {
        const res = await fetch(`/api/trips/${tripId}/packing`);
        if (!res.ok) return;
        const data = await res.json();
        const items: DbPackingItem[] = data.items ?? [];
        setPackingItems(items);
        if (items.length === 0 && !didAutoGenerate.current) {
          didAutoGenerate.current = true;
          setPackingLoading(false);
          await generate();
          return;
        }
      } finally {
        setPackingLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handleToggle = async (item: DbPackingItem) => {
    const newPacked = !item.packed;
    setPackingItems(prev => prev.map(i => i.id === item.id ? { ...i, packed: newPacked } : i));
    await fetch(`/api/trips/${tripId}/packing/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packed: newPacked }),
    });
  };

  const handleAddItem = async (category: string) => {
    if (!newItemName.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const newItem: DbPackingItem = {
      id: tempId,
      category,
      name: newItemName.trim(),
      assignedTo: "Everyone",
      notes: null,
      packed: false,
      sortOrder: packingItems.filter(i => i.category === category).length,
    };
    setPackingItems(prev => [...prev, newItem]);
    setNewItemName("");
    setAddingToCategory(null);
    const res = await fetch(`/api/trips/${tripId}/packing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: newItem.category,
        name: newItem.name,
        assignedTo: newItem.assignedTo,
        notes: newItem.notes,
        sortOrder: newItem.sortOrder,
      }),
    });
    const data = await res.json();
    setPackingItems(prev => prev.map(i => i.id === tempId ? data.item : i));
  };

  const total = packingItems.length;
  const packedCount = packingItems.filter(i => i.packed).length;
  const progressPct = total > 0 ? Math.round((packedCount / total) * 100) : 0;

  // Group by category
  const allCategories = [
    ...PACKING_CATEGORIES,
    ...[...new Set(packingItems.map(i => i.category))].filter(c => !PACKING_CATEGORIES.includes(c)),
  ];

  if (packingLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "14px" }}>
        <p style={{ fontSize: "14px", color: "#717171" }}>Loading...</p>
      </div>
    );
  }

  if (packingGenerating) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "14px" }}>
        <Sparkles size={22} style={{ color: "#C4664A" }} />
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a" }}>Flokking your packing list...</p>
        <p style={{ fontSize: "13px", color: "#717171" }}>Tailored to {destinationCity ?? "your destination"}</p>
      </div>
    );
  }

  if (generateError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: "12px" }}>
        <p style={{ fontSize: "13px", color: "#D97706" }}>{generateError}</p>
        <button onClick={generate} style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer" }}>
          Try again →
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>Packing list</p>
          {(destinationCity || destinationCountry) && (
            <p style={{ fontSize: "13px", color: "#717171" }}>
              {[destinationCity, destinationCountry].filter(Boolean).join(", ")}
              {tripStartDate && tripEndDate && (() => {
                const nights = Math.round((new Date(tripEndDate).getTime() - new Date(tripStartDate).getTime()) / (1000 * 60 * 60 * 24));
                return ` · ${nights} nights`;
              })()}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <button
            onClick={() => { setAddingToCategory(null); setNewItemName(""); setShowAddModal(true); }}
            style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", background: "none", border: "none", cursor: "pointer" }}
          >
            + Add to list
          </button>
          <button
            onClick={generate}
            style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer" }}
          >
            <Sparkles size={13} style={{ color: "#C4664A" }} />
            Regenerate
          </button>
        </div>
      </div>

      {/* Add item modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", margin: "0 16px", width: "100%", maxWidth: "360px" }}>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#1B3A5C", fontFamily: "Playfair Display, serif", marginBottom: "16px" }}>Add to packing list</p>
            <input
              autoFocus
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { handleAddItem(addingToCategory ?? "Other"); setShowAddModal(false); }
                if (e.key === "Escape") { setShowAddModal(false); setNewItemName(""); setAddingToCategory(null); }
              }}
              placeholder="Item name..."
              style={{ width: "100%", border: "1px solid #E0E0E0", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#1B3A5C", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
            />
            <select
              value={addingToCategory ?? "Other"}
              onChange={(e) => setAddingToCategory(e.target.value)}
              style={{ width: "100%", border: "1px solid #E0E0E0", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#1B3A5C", outline: "none", marginBottom: "16px", backgroundColor: "#fff", boxSizing: "border-box" }}
            >
              {["Documents", "Clothing", "Toiletries", "Kids", "Tech", "Health", "Gear", "Other"].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => { handleAddItem(addingToCategory ?? "Other"); setShowAddModal(false); }}
                style={{ flex: 1, padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", borderRadius: "12px", fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Add to list
              </button>
              <button
                onClick={() => { setShowAddModal(false); setNewItemName(""); setAddingToCategory(null); }}
                style={{ flex: 1, padding: "12px", border: "1px solid #E0E0E0", color: "#1B3A5C", borderRadius: "12px", fontSize: "14px", fontWeight: 600, backgroundColor: "#fff", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <p style={{ fontSize: "13px", color: "#717171" }}>{total} items · {packedCount} packed</p>
            <p style={{ fontSize: "13px", color: "#717171" }}>{progressPct}%</p>
          </div>
          <div style={{ height: "4px", backgroundColor: "#EEEEEE", borderRadius: "2px" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, backgroundColor: "#C4664A", borderRadius: "2px", transition: "width 0.2s" }} />
          </div>
        </div>
      )}

      {/* Category sections — CSS columns for balanced height */}
      <div className="columns-1 md:columns-2 gap-3">
        {allCategories.map((cat) => {
          const items = packingItems.filter(i => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="break-inside-avoid mb-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
                <span className="text-xs font-semibold text-[#1B3A5C] uppercase tracking-wider">
                  {cat}
                </span>
                <span className="text-xs text-gray-400">{items.filter(i => i.packed).length}/{items.length}</span>
              </div>
              <div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggle(item)}
                    className="flex items-start gap-3 w-full px-4 py-1.5 border-b border-gray-50 last:border-0 text-left cursor-pointer bg-transparent hover:bg-gray-50 transition-colors"
                    style={{ border: "none", borderBottom: "1px solid #F9F9F9" }}
                  >
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0, marginTop: "2px",
                      border: item.packed ? "none" : "1.5px solid #D0D0D0",
                      backgroundColor: item.packed ? "#C4664A" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item.packed && (
                        <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className={item.packed ? "text-sm text-gray-400 line-through" : "text-sm text-[#1B3A5C]"}>{item.name}</p>
                      {(item.notes || (item.assignedTo && item.assignedTo !== "Everyone")) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[item.assignedTo !== "Everyone" ? item.assignedTo : null, item.notes || null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {/* Inline add item */}
              {addingToCategory === cat ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderTop: "1px solid #F5F5F5" }}>
                  <input
                    autoFocus
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddItem(cat);
                      if (e.key === "Escape") { setAddingToCategory(null); setNewItemName(""); }
                    }}
                    placeholder="Item name..."
                    style={{ flex: 1, fontSize: "14px", color: "#1B3A5C", border: "none", outline: "none", backgroundColor: "transparent" }}
                  />
                  <button onClick={() => handleAddItem(cat)} style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer" }}>Add</button>
                  <button onClick={() => { setAddingToCategory(null); setNewItemName(""); }} style={{ fontSize: "13px", color: "#aaa", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingToCategory(cat)}
                  style={{ width: "100%", textAlign: "left", padding: "8px 16px", fontSize: "13px", color: "#bbb", background: "none", border: "none", borderTop: "1px solid #F5F5F5", cursor: "pointer" }}
                >
                  + Add item
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recommended tab ───────────────────────────────────────────────────────────

type RecItem = {
  city: string;
  title: string;
  location: string;
  tags: string;
  match: string;
  img: string;
  saved: number;
  lat: number;
  lng: number;
  description: string;
  hours: string;
  ages: string;
  website: string;
  bookUrl: string;
};

const RECOMMENDATIONS: RecItem[] = [
  // ── Okinawa ─────────────────────────────────────────────────────────────────
  {
    city: "Okinawa",
    title: "Cape Manzamo",
    location: "Onna Village",
    tags: "Outdoor · Free · 1 hr",
    match: "Scenic views · Easy walk · All ages",
    img: "https://upload.wikimedia.org/wikipedia/commons/5/53/Onna_Okinawa_Japan_Cape-Manzamo-01.jpg",
    saved: 1840,
    lat: 26.3998,
    lng: 127.7159,
    description: "One of Okinawa's most iconic coastal landmarks — the naturally formed elephant-trunk rock arch sits at the tip of Manzamo Cape. An easy 10-minute walk from the parking area leads to sweeping views over the East China Sea.",
    hours: "Always open (parking lot: 8:00am – 6:00pm)",
    ages: "All ages",
    website: "https://www.visitokinawa.jp/information/cape-manzamo",
    bookUrl: "https://www.visitokinawa.jp/information/cape-manzamo",
  },
  {
    city: "Okinawa",
    title: "Shuri Castle",
    location: "Naha",
    tags: "Culture · $8 · 2 hrs",
    match: "History & Culture · Ages 5+ · UNESCO site",
    img: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Shuri_Castle_-_Light_up.JPG",
    saved: 2210,
    lat: 26.2172,
    lng: 127.7197,
    description: "The restored palace of the Ryukyu Kingdom, Shuri Castle is a striking red-lacquered fortress on a hilltop in Naha. A UNESCO World Heritage Site that blends Japanese, Chinese, and Southeast Asian influences — currently being restored after a 2019 fire.",
    hours: "8:30am – 6:00pm (Apr–Jun, Oct–Nov); 8:30am – 7:00pm (Jul–Sep); 8:30am – 5:30pm (Dec–Mar)",
    ages: "Ages 5+",
    website: "https://www.shurijo-park.go.jp",
    bookUrl: "https://www.shurijo-park.go.jp/ticket.html",
  },
  {
    city: "Okinawa",
    title: "Okinawa World & Cave",
    location: "Nanjo",
    tags: "Activity · $25 · Half day",
    match: "Adventure · Ages 4+ · Kids love this",
    img: "/images/okinawa-world-cave.jpg",
    saved: 1650,
    lat: 26.1613,
    lng: 127.7714,
    description: "Okinawa World combines the spectacular Gyokusendo Cave — a 5km limestone cavern — with a Ryukyuan culture village, habu snake show, and local crafts demonstrations. The cave walkthrough is a family highlight.",
    hours: "9:00am – 5:00pm daily",
    ages: "Ages 4+",
    website: "https://www.gyokusendo.co.jp/okinawaworld",
    bookUrl: "https://www.gyokusendo.co.jp/okinawaworld/ticket/",
  },
  {
    city: "Okinawa",
    title: "American Village Mihama",
    location: "Chatan",
    tags: "Food · Free · 2–3 hrs",
    match: "Street Food · Evening · All ages",
    img: "/images/american-village-mihama.jpg",
    saved: 980,
    lat: 26.3109,
    lng: 127.7540,
    description: "A retro-American themed shopping and entertainment district right by the beach in Chatan. Great for evening strolls, street food, sunset views over the ocean, and browsing quirky shops and open-air restaurants.",
    hours: "Shops from 11:00am; restaurants until 11:00pm",
    ages: "All ages",
    website: "https://www.okinawa-americanvillage.com",
    bookUrl: "https://www.okinawa-americanvillage.com",
  },
  {
    city: "Okinawa",
    // TODO: replace with real Nago Pineapple Park photo when a reliable source is available
    title: "Nago Pineapple Park",
    location: "Nago",
    tags: "Kids · $15 · 1.5 hrs",
    match: "Unique to Okinawa · Ages 3+ · Self-guided tour",
    img: "/images/okinawa-world-cave.jpg",
    saved: 760,
    lat: 26.6017,
    lng: 127.9711,
    description: "Ride a pineapple-shaped cart through tropical gardens, taste pineapple wine, and learn about Okinawa's pineapple farming heritage. A quirky, fun family stop in the north on the way to Churaumi Aquarium.",
    hours: "9:00am – 6:00pm (last entry 5:00pm)",
    ages: "Ages 3+",
    website: "https://www.nagopineapplepark.com",
    bookUrl: "https://www.nagopineapplepark.com",
  },
  {
    city: "Okinawa",
    title: "Onna Village Snorkeling",
    location: "Onna Village",
    tags: "Outdoor · $45 · Half day",
    match: "Beach & Water · Ages 6+ · Gear in packing list",
    img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80",
    saved: 1320,
    lat: 26.4969,
    lng: 127.8574,
    description: "Crystal-clear waters off Onna Village offer some of Okinawa's best snorkeling with coral reefs and tropical fish. Most operators provide full gear and a guide, making it accessible for first-timers and kids from age 6.",
    hours: "Tours typically 9:00am – 3:00pm (weather dependent)",
    ages: "Ages 6+",
    website: "https://www.visitokinawa.jp",
    bookUrl: "https://www.veltra.com/en/asia/japan/okinawa/",
  },
  // ── Kyoto ───────────────────────────────────────────────────────────────────
  {
    city: "Kyoto",
    title: "Kiyomizudera Temple",
    location: "Higashiyama, Kyoto",
    tags: "Culture · Free · 1.5 hrs",
    match: "UNESCO site · Hilltop views · All ages",
    img: "/images/kiyomizudera-temple.jpg",
    saved: 3210,
    lat: 34.9948,
    lng: 135.7851,
    description: "One of Japan's most celebrated temples, Kiyomizudera perches on a forested hillside above eastern Kyoto. The wooden stage extending over the cliffside offers sweeping views across the city, especially stunning in cherry blossom and autumn leaf seasons.",
    hours: "6:00am – 6:00pm (open until 9:30pm during special illumination events)",
    ages: "All ages",
    website: "https://www.kiyomizudera.or.jp",
    bookUrl: "https://www.kiyomizudera.or.jp/en/",
  },
  {
    city: "Kyoto",
    title: "Tea Ceremony in Gion",
    location: "Gion, Kyoto",
    tags: "Culture · $30 · 1 hr",
    match: "Traditional experience · Hands-on · Ages 5+",
    img: "/images/tea-ceremony-kyoto.jpg",
    saved: 1870,
    lat: 35.0033,
    lng: 135.7764,
    description: "Experience the meditative art of Japanese tea ceremony in one of Gion's preserved machiya townhouses. Wear a kimono, learn proper etiquette from a tea master, and savour matcha with seasonal wagashi sweets — a highlight for families with curious kids.",
    hours: "Sessions daily 10:00am – 5:00pm; book in advance",
    ages: "Ages 5+",
    website: "https://en.kyoto.travel/activity/detail/1",
    bookUrl: "https://www.viator.com/Kyoto/d332-ttd",
  },
  {
    city: "Kyoto",
    title: "Toei Kyoto Studio Park",
    location: "Uzumasa, Kyoto",
    tags: "Kids · $15 · Half day",
    match: "Samurai & ninja shows · Ages 4+ · Unique to Kyoto",
    img: "/images/toei-kyoto-studio.jpg",
    saved: 940,
    lat: 35.0189,
    lng: 135.7047,
    description: "Japan's only open-air film studio park lets you walk through Edo-period streets, watch live samurai sword-fight shows, and even dress up as a ninja or princess. Active film and TV sets mean you might catch actual filming happening.",
    hours: "9:00am – 5:00pm (closed some Wednesdays; check schedule)",
    ages: "Ages 4+",
    website: "https://www.toei-eigamura.com/global/en/",
    bookUrl: "https://www.toei-eigamura.com/global/en/ticket/",
  },
  {
    city: "Kyoto",
    title: "Nishiki Market Street Food",
    location: "Central Kyoto",
    tags: "Food · Free · 1–2 hrs",
    match: "Street snacks · Covered arcade · All ages",
    img: "/images/nishiki-market.jpg",
    saved: 2650,
    lat: 35.0042,
    lng: 135.7657,
    description: "Dubbed 'Kyoto's Kitchen', this 400-year-old covered shopping street stretches five blocks and is packed with vendors selling pickled vegetables, fresh tofu, grilled skewers, and Kyoto specialties. Perfect for a leisurely morning snack crawl with kids.",
    hours: "Most shops 9:00am – 6:00pm (some close Wednesday)",
    ages: "All ages",
    website: "https://www.nishiki-market.com",
    bookUrl: "https://www.nishiki-market.com",
  },
  {
    city: "Kyoto",
    title: "Kibune Shrine & River Walk",
    location: "Kibune, Kyoto",
    tags: "Outdoor · Free · 2 hrs",
    match: "Nature · Lantern-lit path · All ages",
    img: "/images/kibune-shrine.jpg",
    saved: 1140,
    lat: 35.1113,
    lng: 135.7488,
    description: "A scenic 30-minute bus ride from central Kyoto leads to the misty Kibune valley, where stone lanterns line the path to Kibune Shrine. In summer, restaurants serve kaiseki meals on platforms built over the cool mountain stream.",
    hours: "Shrine: 6:00am – 8:00pm; Kawadoko dining: May–Sept",
    ages: "All ages",
    website: "https://kifune.or.jp/en/",
    bookUrl: "https://kifune.or.jp/en/",
  },
  {
    city: "Kyoto",
    title: "Fushimi Momoyama Castle",
    location: "Fushimi, Kyoto",
    tags: "History · $5 · 1.5 hrs",
    match: "Samurai history · Hilltop · Kids love the walls",
    img: "/images/fushimi-momoyama-castle.jpg",
    saved: 810,
    lat: 34.9441,
    lng: 135.7730,
    description: "Toyotomi Hideyoshi's hilltop castle commands panoramic views over southern Kyoto and is surprisingly crowd-free compared to Nijo or Himeji. Walk the stone walls, explore the replica keep, and enjoy the quiet park atmosphere — a great off-the-beaten-path pick.",
    hours: "9:00am – 5:00pm (closed Tuesdays)",
    ages: "Ages 4+",
    website: "https://www.kyokanko.or.jp",
    bookUrl: "https://www.kyokanko.or.jp",
  },
];

type FallbackItem = {
  id: string;
  rawTitle: string | null;
  rawDescription: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  categoryTags: string[];
  sourceUrl: string | null;
  lat: number | null;
  lng: number | null;
};

function RecommendedContent({
  tripId,
  tripStartDate,
  tripEndDate,
  destinationCity,
  destinationCountry,
  onViewOnMap,
  onSaved,
  onRefreshItinerary,
}: {
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  onViewOnMap: (lat: number, lng: number) => void;
  onSaved: (rec: SavedRec) => void;
  onRefreshItinerary?: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [drawerRec, setDrawerRec] = useState<DrawerRec | null>(null);
  const [fallbackItems, setFallbackItems] = useState<FallbackItem[]>([]);
  const [fallbackLoaded, setFallbackLoaded] = useState(false);

  function generateDayPillsForRec(start: string | null, end: string | null): { dayIndex: number; label: string }[] {
    if (!start) return [];
    const startD = parseDateForDisplay(start);
    if (isNaN(startD.getTime())) return [];
    const endD = end ? parseDateForDisplay(end) : startD;
    if (isNaN(endD.getTime())) return [];
    const diffDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    const n = Math.max(1, diffDays + 1);
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
      const dateStr = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
      return { dayIndex: i, label: `Day ${i + 1} · ${dateStr}` };
    });
  }
  const recDayPills = generateDayPillsForRec(tripStartDate ?? null, tripEndDate ?? null);

  // Filter recommendations by destination city — match rec.city exactly (case-insensitive).
  // If no destinationCity is provided, return empty array so we show the "no recs yet" state.
  const hasDestination = !!(destinationCity || destinationCountry);
  const cityLower = (destinationCity ?? "").toLowerCase().trim();
  const filteredRecs = !hasDestination ? [] : RECOMMENDATIONS.filter(rec =>
    rec.city.toLowerCase() === cityLower
  );
  const matchesDestination = filteredRecs.length > 0;

  // Fetch fallback community saves when static recs are absent
  useEffect(() => {
    if (matchesDestination || !destinationCity || fallbackLoaded) return;
    setFallbackLoaded(true);
    fetch(`/api/recommendations/fallback?city=${encodeURIComponent(destinationCity)}`)
      .then(r => r.json())
      .then((items: FallbackItem[]) => setFallbackItems(Array.isArray(items) ? items : []))
      .catch(() => {});
  }, [matchesDestination, destinationCity, fallbackLoaded]);

  // Group by category (first segment of tags), sort categories and items alphabetically
  const grouped = filteredRecs.reduce((acc, rec) => {
    const cat = rec.tags.split(" · ")[0];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rec);
    return acc;
  }, {} as Record<string, typeof RECOMMENDATIONS>);
  const sortedCategories = Object.keys(grouped).sort();
  sortedCategories.forEach((cat) => grouped[cat].sort((a, b) => a.title.localeCompare(b.title)));

  if (!matchesDestination) {
    const dest = hasDestination ? [destinationCity, destinationCountry].filter(Boolean).join(", ") : "this destination";
    const city = destinationCity ?? dest;
    return (
      <div>
        {fallbackItems.length > 0 ? (
          <>
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>Popular in {city}</p>
              <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5 }}>
                Saved by families who&apos;ve visited {city}. More personalised recommendations appear as more families visit {city}.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "16px" }}>
              {fallbackItems.map(item => {
                const tag = item.categoryTags?.[0] ?? "Explore";
                const isSaved = savedSet.has(item.id);
                const placeName = item.rawTitle?.startsWith("http") ? `Place in ${city}` : (item.rawTitle ?? "Saved place");
                const coverImg = getItemImage(item.rawTitle, item.placePhotoUrl, item.mediaThumbnailUrl, item.categoryTags[0] ?? null, destinationCity, destinationCountry);
                const initial = placeName.charAt(0).toUpperCase();
                return (
                  <div key={item.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
                    {/* Header image */}
                    <div style={{ height: "160px", position: "relative", flexShrink: 0, overflow: "hidden", backgroundColor: "#1B3A5C" }}>
                      {coverImg ? (
                        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${coverImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "40px", fontWeight: 800, color: "rgba(255,255,255,0.25)" }}>{initial}</span>
                        </div>
                      )}
                      {/* Category pill */}
                      <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "999px", padding: "3px 10px" }}>{tag}</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", marginBottom: "4px", lineHeight: 1.3 }}>{placeName}</p>
                      {(destinationCity || destinationCountry) && (
                        <p style={{ fontSize: "13px", color: "#AAAAAA", marginBottom: "6px" }}>
                          {[destinationCity, destinationCountry].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {item.rawDescription && cleanDisplayDescription(item.rawDescription).length >= 10 && (
                        <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5, marginBottom: "10px", flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties} suppressHydrationWarning={true}>{cleanDisplayDescription(item.rawDescription)}</p>
                      )}
                      <button
                        type="button"
                        disabled={isSaved}
                        onClick={async () => {
                          if (!tripId || isSaved) return;
                          try {
                            await fetch("/api/saves/activity", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sourceItemId: item.id }),
                            });
                            setSavedSet(prev => new Set([...prev, item.id]));
                          } catch { /* ignore */ }
                        }}
                        style={{ width: "100%", marginTop: "auto", padding: "10px", borderRadius: "10px", border: `1.5px solid ${isSaved ? "#4a7c59" : "#C4664A"}`, background: "none", color: isSaved ? "#4a7c59" : "#C4664A", fontSize: "13px", fontWeight: 700, cursor: isSaved ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                      >
                        {isSaved ? "Saved ✓" : "Add to trip"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Compass size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
              No recommendations for {dest} yet
            </p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>
              We&apos;re constantly adding new destinations. Check back soon — or be the first to contribute a trip from {dest}.
            </p>
          </div>
        )}
      </div>
    );
  }

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

      {/* All cards in one flat 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : "1fr", gap: "16px" }}>
        {filteredRecs.map((rec) => {
          const isSaved = savedSet.has(rec.title);
          return (
            <RecCard
              key={rec.title}
              rec={rec}
              isSaved={isSaved}
              onToggle={() => { if (!isSaved) setDrawerRec(rec as DrawerRec); }}
              onOpenDetail={() => setDrawerRec(rec as DrawerRec)}
            />
          );
        })}
      </div>

      {/* Community contribution banner */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ marginTop: "28px", backgroundColor: "#1B3A5C", borderRadius: "14px", padding: "20px 20px 20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}
      >
        <div>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>Been here? Help the next family.</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            Your first-hand tips get surfaced to families just like yours — and earn you Pioneer tier points.
          </p>
        </div>
        <Link
          href={`/trips/past/new${destinationCity ? `?destination=${encodeURIComponent(destinationCity)}${destinationCountry ? `&country=${encodeURIComponent(destinationCountry)}` : ""}` : ""}`}
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0, backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none" }}
        >
          Contribute →
        </Link>
      </div>

      {/* Rec detail drawer */}
      <RecommendationDrawer
        item={drawerRec}
        tripId={tripId}
        dayPills={recDayPills}
        onClose={() => setDrawerRec(null)}
        onAddedToDay={(dayIndex, title) => {
          setSavedSet(prev => new Set([...prev, title]));
          onRefreshItinerary?.();
          setTimeout(() => setDrawerRec(null), 1200);
        }}
      />
    </div>
  );
}

function RecCard({ rec, isSaved, onToggle, onOpenDetail }: { rec: RecItem; isSaved: boolean; onToggle: () => void; onOpenDetail: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      onClick={onOpenDetail}
      style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0", overflow: "hidden", display: "flex", flexDirection: "row", cursor: "pointer" }}
    >
      {/* Left: image */}
      {imgFailed ? (
        <div style={{ width: "112px", minWidth: "112px", height: "112px", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Compass size={24} style={{ color: "#ccc" }} />
        </div>
      ) : (
        <>
          <div style={{ width: "112px", minWidth: "112px", height: "112px", backgroundImage: `url('${rec.img}')`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
          <img src={rec.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
        </>
      )}
      {/* Right: content */}
      <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</p>
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "1px" }}>
            {rec.location.split(",")[0]} · {rec.tags.split(" · ")[0]}
          </p>
          <p style={{ fontSize: "12px", color: "#717171" }}>
            {rec.tags.split(" · ")[1] ?? ""}{rec.tags.split(" · ")[2] ? " · " + rec.tags.split(" · ")[2] : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (!isSaved) onToggle(); }}
            style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", backgroundColor: isSaved ? "rgba(74,124,89,0.1)" : "#C4664A", color: isSaved ? "#4a7c59" : "#fff", border: isSaved ? "1px solid rgba(74,124,89,0.2)" : "none", cursor: isSaved ? "default" : "pointer", whiteSpace: "nowrap" }}
          >
            {isSaved ? "Saved ✓" : "+ Itinerary"}
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenDetail(); }}
            style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", backgroundColor: "#fff", color: "#1B3A5C", border: "1.5px solid #E0E0E0", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Learn more
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Flight card ───────────────────────────────────────────────────────────────

function FlightCard({ flight, onDelete, onMarkBooked, onEdit }: { flight: Flight; onDelete: () => void; onMarkBooked?: () => void; onEdit?: () => void }) {
  const cabinLabel: Record<string, string> = { economy: "Economy", premium_economy: "Prem. Economy", business: "Business", first: "First" };
  const typeLabel: Record<string, string> = { outbound: "Outbound", return: "Return", connection: "Connection" };
  const isBooked = flight.status === "booked";
  return (
    <div style={{ backgroundColor: "#fff", border: `1.5px solid ${isBooked ? "#D8E4F0" : "#EEEEEE"}`, borderRadius: "14px", padding: "14px 16px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Route row */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>{flight.fromAirport}</span>
            <Plane size={14} style={{ color: "#C4664A", flexShrink: 0 }} />
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>{flight.toAirport}</span>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(196,102,74,0.1)", color: "#C4664A", borderRadius: "999px", padding: "2px 8px", fontWeight: 600 }}>
              {typeLabel[flight.type] ?? flight.type}
            </span>
            <span style={{ fontSize: "11px", backgroundColor: isBooked ? "rgba(27,58,92,0.1)" : "rgba(0,0,0,0.06)", color: isBooked ? "#1B3A5C" : "#888", borderRadius: "999px", padding: "2px 8px", fontWeight: 600 }}>
              {isBooked ? "Booked" : "Saved"}
            </span>
          </div>
          {/* Cities */}
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "6px" }}>{flight.fromCity} → {flight.toCity}</p>
          {/* Times */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "6px" }}>
            <div>
              <p style={{ fontSize: "11px", color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Departs</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{flight.departureDate} · {flight.departureTime}</p>
            </div>
            {(flight.arrivalDate || flight.arrivalTime) && (
              <div>
                <p style={{ fontSize: "11px", color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Arrives</p>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{flight.arrivalDate ?? ""}{flight.arrivalDate && flight.arrivalTime ? " · " : ""}{flight.arrivalTime ?? ""}</p>
              </div>
            )}
            {flight.duration && (
              <div>
                <p style={{ fontSize: "11px", color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Duration</p>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{flight.duration}</p>
              </div>
            )}
          </div>
          {/* Meta */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {flight.airline && <span style={{ fontSize: "12px", color: "#555" }}>{flight.airline} · {flight.flightNumber}</span>}
            {!flight.airline && <span style={{ fontSize: "12px", color: "#555" }}>{flight.flightNumber}</span>}
            <span style={{ fontSize: "12px", color: "#555" }}>· {cabinLabel[flight.cabinClass] ?? flight.cabinClass}</span>
            {flight.confirmationCode && <span style={{ fontSize: "12px", color: "#555" }}>· {flight.confirmationCode}</span>}
            {flight.seatNumbers && <span style={{ fontSize: "12px", color: "#555" }}>· Seats: {flight.seatNumbers}</span>}
            {!isBooked && onMarkBooked && (
              <button
                onClick={onMarkBooked}
                style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Mark as booked →
              </button>
            )}
          </div>
          {flight.notes && (
            <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", fontStyle: "italic" }}>{flight.notes}</p>
          )}
          {flight.dayIndex != null && (
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)", display: "inline-block", marginTop: "6px" }}>
              ✓ Day {flight.dayIndex + 1}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
          {onEdit && (
            <button
              onClick={onEdit}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: "2px", lineHeight: 1 }}
              title="Edit flight"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px", lineHeight: 1 }}
            title="Remove flight"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onDelete, onEdit, onMarkBooked, onAddToItinerary }: { activity: Activity; onDelete: () => void; onEdit: () => void; onMarkBooked?: () => void; onAddToItinerary?: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const isBooked = activity.status === "booked";
  const isConfirmed = activity.status === "confirmed";
  const statusColor = isBooked ? "#4a7c59" : isConfirmed ? "#1B3A5C" : "#717171";
  const statusBg = isBooked ? "rgba(107,143,113,0.1)" : isConfirmed ? "rgba(27,58,92,0.08)" : "rgba(0,0,0,0.06)";
  const statusLabel = isBooked ? "Booked" : isConfirmed ? "Confirmed" : "Interested";
  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px 16px", marginBottom: "10px", cursor: "pointer" }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#1B3A5C", lineHeight: 1.2, flex: 1, minWidth: 0 }}>{activity.title}</p>
          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: statusBg, color: statusColor, borderRadius: "999px", padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {statusLabel}
          </span>
        </div>
        {/* Date + venue */}
        <p style={{ fontSize: "13px", color: "#717171", marginBottom: "4px" }}>
          {[activity.date, activity.time ? `${activity.time}${activity.endTime ? ` – ${activity.endTime}` : ""}` : null, activity.venueName].filter(Boolean).join(" · ")}
        </p>
        {activity.website && (
          <a href={activity.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#C4664A", fontWeight: 600, textDecoration: "none", marginBottom: "4px" }}>
            {/ticket|concert|game|sport|baseball|soccer|football|theater|theatre|show|stadium|arena/i.test(activity.title) ? "Book tickets →" : "Visit site →"}
          </a>
        )}
        {activity.notes && (
          <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic", marginBottom: "0" }}>{activity.notes}</p>
        )}
        {/* Bottom action row */}
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
          {activity.dayIndex != null ? (
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)" }}>
              ✓ Day {activity.dayIndex + 1}
            </span>
          ) : onAddToItinerary && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onAddToItinerary(); }}
              style={{ fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", cursor: "pointer" }}
            >
              + Add to itinerary
            </button>
          )}
          {!isBooked && onMarkBooked && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onMarkBooked(); }}
              style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "999px", border: "1.5px solid rgba(107,143,113,0.35)", backgroundColor: "transparent", color: "#4a7c59", cursor: "pointer" }}
            >
              Mark booked ✓
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setShowDetail(false); onEdit(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "4px", lineHeight: 1 }}
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "4px", lineHeight: 1 }}
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      {showDetail && (
        <ActivityDetailModal
          activity={activity}
          onClose={() => setShowDetail(false)}
          onRemove={() => { onDelete(); setShowDetail(false); }}
          onEdit={() => { setShowDetail(false); onEdit(); }}
          onMarkBooked={onMarkBooked ? () => { onMarkBooked(); setShowDetail(false); } : undefined}
          onAddToItinerary={onAddToItinerary ? () => { onAddToItinerary(); setShowDetail(false); } : undefined}
        />
      )}
    </>
  );
}

// ── How Was It? post-trip capture ─────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{ fontSize: "24px", cursor: "pointer", color: star <= value ? "#C4664A" : "#e5e7eb", lineHeight: 1 }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

type HowWasItItem = {
  id: string;
  title: string;
  type: string;
  itemKind: "itinerary" | "save";
  rating: number;
  notes: string;
  wouldReturn: boolean | null;
  alreadySaved: boolean;
};

const STAR_LABELS: Record<number, string> = {
  1: "1 — Poor",
  2: "2 — Below average",
  3: "3 — Good",
  4: "4 — Very good",
  5: "5 — Excellent",
};

const EXCLUDE_SAVE_TAGS = /flight|airfare|airline|lodging|accommodation|hotel|transportation/i;

function HowWasItContent({ tripId, destinationCity, postTripCaptureComplete, onComplete, onNavigateToItinerary }: {
  tripId: string;
  destinationCity?: string | null;
  postTripCaptureComplete: boolean;
  onComplete: () => void;
  onNavigateToItinerary: () => void;
}) {
  const [items, setItems] = useState<HowWasItItem[]>([]);
  const [done, setDone] = useState(postTripCaptureComplete);
  const [submitting, setSubmitting] = useState(false);
  const [spurName, setSpurName] = useState("");
  const [spurType, setSpurType] = useState("Activity");
  const [spurTip, setSpurTip] = useState("");
  const [spurSaving, setSpurSaving] = useState(false);
  const [spurSaved, setSpurSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/itinerary-items`).then(r => r.ok ? r.json() : {}),
      fetch(`/api/saves?tripId=${tripId}`).then(r => r.ok ? r.json() : { saves: [] }),
      fetch(`/api/trips/${tripId}/ratings`).then(r => r.ok ? r.json() : { ratings: [] }),
    ]).then(([itinData, savesData, ratingData]) => {
      const itinItems: { id: string; title?: string | null; type?: string }[] = Array.isArray(itinData) ? itinData : ((itinData as { items?: unknown[] }).items ?? []);
      const savedRatingIds = new Set<string>((ratingData.ratings ?? []).map((r: { itineraryItemId?: string }) => r.itineraryItemId).filter(Boolean));

      // LODGING: exclude check-out items; strip "Check-in: " prefix from title
      // ACTIVITY: include all
      const itinRated: HowWasItItem[] = itinItems
        .filter(it =>
          (it.type === "ACTIVITY") ||
          (it.type === "LODGING" && !it.title?.toLowerCase().startsWith("check-out"))
        )
        .map(it => ({
          id: it.id,
          title: (it.title?.replace(/^check-in:\s*/i, "") ?? it.title ?? "Untitled").trim(),
          type: it.type ?? "",
          itemKind: "itinerary" as const,
          rating: 0,
          notes: "",
          wouldReturn: null,
          alreadySaved: savedRatingIds.has(it.id),
        }));

      // SavedItems assigned to trip — exclude flight/lodging/transportation tags
      const saveItems: HowWasItItem[] = ((savesData.saves ?? []) as { id: string; rawTitle?: string | null; categoryTags?: string[] }[])
        .filter(s => !s.categoryTags?.some(t => EXCLUDE_SAVE_TAGS.test(t)))
        .map(s => ({
          id: s.id,
          title: s.rawTitle ?? "Untitled",
          type: "save",
          itemKind: "save" as const,
          rating: 0,
          notes: "",
          wouldReturn: null,
          alreadySaved: false,
        }));

      setItems([...itinRated, ...saveItems]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleSubmitAll() {
    setSubmitting(true);
    const toSubmit = items.filter(it => it.rating > 0 && !it.alreadySaved);
    await Promise.all(toSubmit.map(it =>
      fetch(`/api/trips/${tripId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(it.itemKind === "itinerary" ? { itineraryItemId: it.id } : {}),
          placeName: it.title,
          placeType: it.type.toLowerCase(),
          rating: it.rating,
          notes: it.notes || undefined,
          wouldReturn: it.wouldReturn ?? undefined,
        }),
      })
    ));
    await fetch(`/api/trips/${tripId}/post-trip-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postTripCaptureComplete: true }),
    });
    setDone(true);
    onComplete();
    setSubmitting(false);
    setTimeout(() => onNavigateToItinerary(), 2000);
  }

  async function handleAddSpur() {
    if (!spurName.trim()) return;
    setSpurSaving(true);
    await fetch("/api/saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://example.com/spur?name=${encodeURIComponent(spurName)}`, tripId, title: spurName.trim(), tags: [spurType.toLowerCase()] }),
    });
    setSpurName("");
    setSpurType("Activity");
    setSpurTip("");
    setSpurSaved(true);
    setSpurSaving(false);
    setTimeout(() => setSpurSaved(false), 3000);
  }

  if (done) {
    return (
      <div style={{ maxWidth: "560px", padding: "32px 0", textAlign: "center" }}>
        <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "8px" }}>Your ratings are in.</p>
        <p style={{ fontSize: "14px", color: "#717171" }}>Other Flokkers planning {destinationCity ? `${destinationCity} ` : ""}will thank you.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>

      {/* Section 1 — Rate bookings */}
      <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>
        How did it go{destinationCity ? ` in ${destinationCity}` : ""}?
      </p>
      <p style={{ fontSize: "13px", color: "#717171", marginBottom: "20px" }}>Rate what you experienced — it helps other Flokkers plan.</p>

      {items.length === 0 && (
        <p style={{ fontSize: "13px", color: "#bbb", marginBottom: "24px" }}>No activities or hotels found for this trip.</p>
      )}

      {items.map(item => {
        const badgeLabel = item.type === "LODGING"
          ? "Rate your stay at"
          : item.itemKind === "save"
            ? "Rate your visit to"
            : "Rate your experience at";
        return (
          <div key={item.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", marginBottom: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
              {badgeLabel}
            </p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "8px" }}>
              {item.title}
            </p>
            {item.alreadySaved ? (
              <p style={{ fontSize: "12px", color: "#6B8F71", fontWeight: 600 }}>Rated</p>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: item.rating > 0 ? "#C4664A" : "#9ca3af", marginBottom: "8px", fontWeight: item.rating > 0 ? 600 : 400 }}>
                  {item.rating > 0 ? STAR_LABELS[item.rating] : "Tap to rate"}
                </p>
                <StarRating value={item.rating} onChange={v => setItems(prev => prev.map(i => i.id === item.id ? { ...i, rating: v } : i))} />
                <textarea
                  value={item.notes}
                  onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
                  placeholder="Anything Flokkers should know?"
                  style={{ width: "100%", fontSize: "13px", color: "#374151", border: "none", borderBottom: "1px solid #e5e7eb", background: "transparent", resize: "none", outline: "none", padding: "8px 0", marginTop: "8px", fontFamily: "inherit", boxSizing: "border-box" }}
                  rows={2}
                />
                <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  {([true, false] as const).map(val => {
                    const selected = item.wouldReturn === val;
                    return (
                      <button
                        key={String(val)}
                        onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, wouldReturn: selected ? null : val } : i))}
                        style={{ fontSize: "13px", fontWeight: 600, padding: "4px 12px", borderRadius: "4px", border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: selected ? (val ? "#C4664A" : "#1B3A5C") : "#fff", color: selected ? "#fff" : "#374151", borderColor: selected ? (val ? "#C4664A" : "#1B3A5C") : "#e5e7eb" }}
                      >
                        {val ? "Yes" : "No"}
                      </button>
                    );
                  })}
                  <span style={{ fontSize: "12px", color: "#bbb", alignSelf: "center", marginLeft: "4px" }}>Would you go back?</span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Section 2 — Spur-of-moment */}
      <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginTop: "8px", marginBottom: "12px" }}>Anything not in your itinerary?</p>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", marginBottom: "24px" }}>
        <input
          type="text"
          value={spurName}
          onChange={e => setSpurName(e.target.value)}
          placeholder="Restaurant, spot, experience..."
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", marginBottom: "8px", fontFamily: "inherit" }}
        />
        <select
          value={spurType}
          onChange={e => setSpurType(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", marginBottom: "8px", fontFamily: "inherit", backgroundColor: "#fff" }}
        >
          {["Restaurant", "Hotel", "Activity", "Attraction", "Other"].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          type="text"
          value={spurTip}
          onChange={e => setSpurTip(e.target.value)}
          placeholder="Quick tip for other Flokkers... (optional)"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", marginBottom: "12px", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleAddSpur}
            disabled={spurSaving || !spurName.trim()}
            style={{ padding: "10px 20px", backgroundColor: spurName.trim() ? "#C4664A" : "#e5e7eb", color: spurName.trim() ? "#fff" : "#aaa", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: spurName.trim() ? "pointer" : "default", fontFamily: "inherit" }}
          >
            {spurSaving ? "Adding..." : "Add it"}
          </button>
          {spurSaved && <span style={{ fontSize: "13px", color: "#6B8F71", fontWeight: 600 }}>Added!</span>}
        </div>
      </div>

      {/* Section 3 — All done */}
      <button
        onClick={handleSubmitAll}
        disabled={submitting}
        style={{ width: "100%", padding: "14px", backgroundColor: submitting ? "#999" : "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "inherit" }}
      >
        {submitting ? "Saving..." : "All done — share my ratings"}
      </button>

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

export function TripTabContent({ initialTab = "saved", tripId, tripTitle, tripStartDate, tripEndDate, destinationCity, destinationCountry, initialIsAnonymous = true, shareToken, tripStatus, initialPostTripCaptureStarted = false, initialPostTripCaptureComplete = false }: { initialTab?: Tab; tripId?: string; tripTitle?: string; tripStartDate?: string | null; tripEndDate?: string | null; destinationCity?: string | null; destinationCountry?: string | null; initialIsAnonymous?: boolean; shareToken?: string; tripStatus?: string; initialPostTripCaptureStarted?: boolean; initialPostTripCaptureComplete?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [postTripCaptureStarted, setPostTripCaptureStarted] = useState(initialPostTripCaptureStarted);
  const [postTripCaptureComplete, setPostTripCaptureComplete] = useState(initialPostTripCaptureComplete);
  const [showPostTripModal, setShowPostTripModal] = useState(false);
  useEffect(() => {
    if (tripStatus === "COMPLETED" && !initialPostTripCaptureStarted) {
      const t = setTimeout(() => setShowPostTripModal(true), 1000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [itineraryVersion, setItineraryVersion] = useState(0);
  const [dropLinkOpen, setDropLinkOpen] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ExistingActivity | null>(null);
  const [activityDayPickerItem, setActivityDayPickerItem] = useState<Activity | null>(null);
  const [activityToast, setActivityToast] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityDefaultDate, setActivityDefaultDate] = useState<string | undefined>(undefined);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [editingFlightVaultDocId, setEditingFlightVaultDocId] = useState<string | null>(null);
  const [editingVaultDoc, setEditingVaultDoc] = useState<{ id: string; label: string; content: Record<string, unknown> } | null>(null);
  const [vaultDocSaving, setVaultDocSaving] = useState(false);
  const [editActivityName, setEditActivityName] = useState<string | null>(null);
  const [vaultActivityItem, setVaultActivityItem] = useState<ItineraryItemLocal | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(initialIsAnonymous);
  const [anonymousSaved, setAnonymousSaved] = useState(false);
  const [showTripSettings, setShowTripSettings] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [dateSaving, setDateSaving] = useState(false);

  // Budget state — lives at top level so it survives tab switches
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [budgetSpent, setBudgetSpent] = useState<number>(0);
  const [budgetCurrency, setBudgetCurrency] = useState<string>("USD");
  const [budgetLoaded, setBudgetLoaded] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/budget`)
      .then(r => r.json())
      .then(data => {
        if (data.budgetTotal !== null && data.budgetTotal !== undefined) setBudgetTotal(data.budgetTotal);
        if (data.budgetCurrency) setBudgetCurrency(data.budgetCurrency);
        setBudgetSpent(data.budgetSpent ?? 0);
        setBudgetLoaded(true);
      })
      .catch(err => { console.error('Budget fetch failed:', err); setBudgetLoaded(true); });
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFlights = useCallback(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/flights`)
      .then(r => r.json())
      .then((data: Flight[]) => setFlights(Array.isArray(data) ? data : []))
      .catch(e => console.error("[fetchFlights]", e));
  }, [tripId]);

  const fetchActivities = useCallback(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/activities`)
      .then(r => r.json())
      .then((data: Activity[]) => setActivities(Array.isArray(data) ? data : []))
      .catch(e => console.error("[fetchActivities]", e));
  }, [tripId]);

  useEffect(() => {
    fetchFlights();
    fetchActivities();
    window.addEventListener("flokk:refresh", fetchFlights);
    window.addEventListener("flokk:refresh", fetchActivities);
    return () => {
      window.removeEventListener("flokk:refresh", fetchFlights);
      window.removeEventListener("flokk:refresh", fetchActivities);
    };
  }, [fetchFlights, fetchActivities]);

  function handleDeleteFlight(flightId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/flights/${flightId}`, { method: "DELETE" })
      .then(() => fetchFlights())
      .catch(e => console.error("[deleteFlight]", e));
  }

  function handleMarkBooked(flightId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/flights/${flightId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "booked" }),
    })
      .then(() => setFlights(prev => prev.map(f => f.id === flightId ? { ...f, status: "booked" } : f)))
      .catch(e => console.error("[markBooked]", e));
  }

  function handleDeleteActivity(activityId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/activities/${activityId}`, { method: "DELETE" })
      .then(() => fetchActivities())
      .catch(e => console.error("[deleteActivity]", e));
  }

  function handleMarkActivityBooked(activityId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "booked" }),
    })
      .then(() => setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: "booked" } : a)))
      .catch(e => console.error("[markActivityBooked]", e));
  }

  function handleRemoveActivityFromDay(activityId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIndex: null }),
    })
      .then(() => setActivities(prev => prev.map(a => a.id === activityId ? { ...a, dayIndex: null } : a)))
      .catch(e => console.error("[removeActivityFromDay]", e));
  }

  function handleRemoveFlightFromDay(flightId: string) {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/flights/${flightId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIndex: null }),
    })
      .then(() => setFlights(prev => prev.map(f => f.id === flightId ? { ...f, dayIndex: null } : f)))
      .catch(e => console.error("[removeFlightFromDay]", e));
  }

  async function handleAnonymousToggle(checked: boolean) {
    setIsAnonymous(!checked);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAnonymous: !checked }),
      });
      setAnonymousSaved(true);
      setTimeout(() => setAnonymousSaved(false), 1500);
    } catch {
      setIsAnonymous(checked);
    }
  }

  // ── Notes state ───────────────────────────────────────────────────────────
  type TripNote = { id: string; content: string; checked: boolean; createdAt: string };
  const [tripNotes, setTripNotes] = useState<TripNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  useEffect(() => {
    if (tab !== "notes" || !tripId) return;
    fetch(`/api/trips/${tripId}/notes`)
      .then(r => r.json())
      .then(d => setTripNotes(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [tripId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddNote() {
    if (!newNote.trim() || isAddingNote || !tripId) return;
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: TripNote = await res.json();
      setTripNotes(prev => [...prev, saved]);
      setNewNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleToggleNote(id: string, checked: boolean) {
    await fetch(`/api/trips/${tripId}/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !checked }),
    });
    setTripNotes(prev => prev.map(n => n.id === id ? { ...n, checked: !n.checked } : n));
  }

  async function handleDeleteNote(id: string) {
    await fetch(`/api/trips/${tripId}/notes/${id}`, { method: "DELETE" });
    setTripNotes(prev => prev.filter(n => n.id !== id));
  }

  // ── Vault state ──────────────────────────────────────────────────────────
  type VaultContact = { id: string; name: string; role?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; notes?: string | null };
  type VaultDocument = { id: string; label: string; type: string; url?: string | null; content?: string | null };
  type VaultKeyInfo = { id: string; label: string; value: string };

  const [contacts, setContacts] = useState<VaultContact[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [keyInfo, setKeyInfo] = useState<VaultKeyInfo[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddKeyInfo, setShowAddKeyInfo] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", role: "", phone: "", whatsapp: "", email: "" });
  const [newDoc, setNewDoc] = useState({ label: "", type: "link", url: "", content: "" });
  const [newKeyInfo, setNewKeyInfo] = useState({ label: "", value: "" });

  useEffect(() => {
    if (tab !== "vault" || !tripId) return;
    Promise.all([
      fetch(`/api/trips/${tripId}/vault/contacts`).then(r => r.json()),
      fetch(`/api/trips/${tripId}/vault/documents`).then(r => r.json()),
      fetch(`/api/trips/${tripId}/vault/keyinfo`).then(r => r.json()),
    ]).then(([c, d, k]) => {
      setContacts(Array.isArray(c) ? c : []);
      setDocuments(Array.isArray(d) ? d : []);
      setKeyInfo(Array.isArray(k) ? k : []);
    }).catch(console.error);
  }, [tripId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const tripAsModalEntry = tripId
    ? [{ id: tripId, title: tripTitle ?? "This trip", startDate: tripStartDate ?? null, endDate: tripEndDate ?? null }]
    : [];

  return (
    <div style={{ padding: "0 24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Tab bar + actions — single row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch" as const,
            scrollbarWidth: "none" as const,
            msOverflowStyle: "none" as const,
          }}
        >
          {(["Saved", "Itinerary", "Recommended", "Packing", "Notes", "Vault"] as const).map((label) => {
            const key = label.toLowerCase() as Tab;
            const active = tab === key;
            return (
              <button
                key={label}
                onClick={() => setTab(key)}
                style={{
                  flexShrink: 0,
                  paddingTop: "10px",
                  paddingBottom: "12px",
                  paddingLeft: "16px",
                  paddingRight: "16px",
                  fontSize: "14px",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#C4664A" : "#717171",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: active ? "2.5px solid #C4664A" : "2.5px solid transparent",
                  marginBottom: "-1px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
          {tripStatus === "COMPLETED" && !postTripCaptureComplete && (
            <button
              onClick={() => setTab("howwasit")}
              style={{
                flexShrink: 0,
                paddingTop: "10px",
                paddingBottom: "12px",
                paddingLeft: "16px",
                paddingRight: "16px",
                fontSize: "14px",
                fontWeight: tab === "howwasit" ? 700 : 500,
                color: tab === "howwasit" ? "#C4664A" : "#717171",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: tab === "howwasit" ? "2.5px solid #C4664A" : "2.5px solid transparent",
                marginBottom: "-1px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              How was it?{!postTripCaptureComplete && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#D97706", display: "inline-block", marginLeft: "6px", verticalAlign: "middle" }} />}
            </button>
          )}
        </div>
        {tripId && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", flexShrink: 0 }}>
            <button
              onClick={() => setDropLinkOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "6px 14px",
                backgroundColor: "#C4664A", color: "#fff",
                border: "none", borderRadius: "20px",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Plus size={13} /> Save Link
            </button>
            {shareToken && tripId && (
              <ShareTripButton
                shareToken={shareToken}
                tripId={tripId}
                tripTitle={tripTitle ?? "this trip"}
              />
            )}
            <button
              onClick={() => {
                setEditStartDate(tripStartDate ? new Date(tripStartDate + (tripStartDate.includes('T') ? '' : 'T12:00:00')).toISOString().split('T')[0] : '');
                setEditEndDate(tripEndDate ? new Date(tripEndDate + (tripEndDate.includes('T') ? '' : 'T12:00:00')).toISOString().split('T')[0] : '');
                setShowTripSettings(true);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "30px", height: "30px",
                backgroundColor: "transparent", color: "#AAAAAA",
                border: "1.5px solid #EEEEEE", borderRadius: "50%",
                cursor: "pointer", flexShrink: 0,
              }}
              title="Trip settings"
            >
              <Settings size={14} />
            </button>
          </div>
        )}
      </div>

      {dropLinkOpen && (
        <DropLinkModal
          trips={tripAsModalEntry}
          initialTripId={tripId}
          lockedTripId={tripId}
          onClose={() => setDropLinkOpen(false)}
          onSaved={() => {
            setDropLinkOpen(false);
            window.dispatchEvent(new Event("flokk:refresh"));
          }}
        />
      )}

      {showFlightModal && tripId && (
        <AddFlightModal
          tripId={tripId}
          onClose={() => setShowFlightModal(false)}
          onSaved={() => { setShowFlightModal(false); fetchFlights(); }}
        />
      )}

      {editingFlight && tripId && (
        <EditFlightModal
          flight={editingFlight}
          tripId={tripId}
          onClose={() => { setEditingFlight(null); setEditingFlightVaultDocId(null); }}
          onSaved={(updated) => {
            setFlights(prev => prev.map(f => f.id === updated.id ? updated : f));
            if (editingFlightVaultDocId) {
              const updatedContent = JSON.stringify({
                type: "flight",
                vendorName: updated.airline,
                flightNumber: updated.flightNumber,
                airline: updated.airline,
                fromAirport: updated.fromAirport,
                toAirport: updated.toAirport,
                fromCity: updated.fromCity,
                toCity: updated.toCity,
                departureDate: updated.departureDate,
                departureTime: updated.departureTime,
                arrivalDate: updated.arrivalDate ?? null,
                arrivalTime: updated.arrivalTime ?? null,
                confirmationCode: updated.confirmationCode ?? null,
              });
              fetch(`/api/trips/${tripId}/vault/documents/${editingFlightVaultDocId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: updatedContent }),
              }).then(() => {
                setDocuments(prev => prev.map(d =>
                  d.id === editingFlightVaultDocId ? { ...d, content: updatedContent } : d
                ));
              }).catch(() => {});
            }
            setEditingFlight(null);
            setEditingFlightVaultDocId(null);
          }}
        />
      )}

      {(showActivityModal || editingActivity) && tripId && (
        <AddActivityModal
          tripId={tripId}
          existingActivity={editingActivity ?? undefined}
          defaultDate={activityDefaultDate}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          onClose={() => { setShowActivityModal(false); setEditingActivity(null); setActivityDefaultDate(undefined); }}
          onSaved={(updated) => {
            setShowActivityModal(false);
            setEditingActivity(null);
            if (updated && editingActivity) {
              setActivities(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
            } else {
              fetchActivities();
            }
          }}
        />
      )}

      {activityDayPickerItem && (
        <SavedDayPickerModal
          itemTitle={activityDayPickerItem.title}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onConfirm={(dayIndex) => {
            const actId = activityDayPickerItem.id;
            if (tripId && actId) {
              fetch(`/api/trips/${tripId}/activities/${actId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dayIndex }),
              })
                .then(() => {
                  setActivities(prev => prev.map(a => a.id === actId ? { ...a, dayIndex } : a));
                  setActivityToast(`Added to Day ${dayIndex + 1} →`);
                  setTimeout(() => setActivityToast(null), 4000);
                })
                .catch(e => console.error("[activityDayAssign]", e));
            }
            setActivityDayPickerItem(null);
          }}
          onClose={() => setActivityDayPickerItem(null)}
        />
      )}

      {activityToast && (
        <button
          onClick={() => { setTab("itinerary"); setActivityToast(null); }}
          style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1a1a1a", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}
        >
          {activityToast}
        </button>
      )}

      {tab === "saved" && (
        <SavedContent tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} tripTitle={tripTitle} onSwitchToItinerary={() => setTab("itinerary")} />
      )}
      {tab === "itinerary" && <ItineraryContent key={itineraryVersion} flyTarget={flyTarget} onFlyTargetConsumed={() => setFlyTarget(null)} tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} onSwitchToRecommended={() => setTab("recommended")} onActivityAdded={fetchActivities} onEditActivity={(a) => setEditingActivity(a)} destinationCity={destinationCity} destinationCountry={destinationCountry} flights={flights} activities={activities} onRemoveActivityFromDay={handleRemoveActivityFromDay} onMarkActivityBooked={handleMarkActivityBooked} onRemoveFlightFromDay={handleRemoveFlightFromDay} onAddFlight={() => setShowFlightModal(true)} budgetTotal={budgetTotal} budgetSpent={budgetSpent} budgetCurrency={budgetCurrency} budgetLoaded={budgetLoaded} onBudgetSaved={(total, currency) => { setBudgetTotal(total); setBudgetCurrency(currency); }} />}
      {tab === "packing" && <PackingContent tripId={tripId} destinationCity={destinationCity} destinationCountry={destinationCountry} tripStartDate={tripStartDate} tripEndDate={tripEndDate} />}
      {tab === "notes" && (
        <div style={{ maxWidth: "600px" }}>
          {/* Header */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>Trip notes</p>
            <p style={{ fontSize: "13px", color: "#717171" }}>Reminders, things to check, ideas — everything in one place.</p>
          </div>

          {/* Add note input */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAddNote(); }}
              placeholder="Add a note or reminder..."
              style={{
                flex: 1,
                border: "1.5px solid #E8E8E8",
                borderRadius: "12px",
                padding: "11px 14px",
                fontSize: "14px",
                color: "#1a1a1a",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAddingNote}
              style={{
                padding: "11px 18px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: newNote.trim() && !isAddingNote ? "#1B3A5C" : "#E0E0E0",
                color: newNote.trim() && !isAddingNote ? "#fff" : "#aaa",
                fontSize: "13px",
                fontWeight: 700,
                cursor: newNote.trim() && !isAddingNote ? "pointer" : "default",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              + Add
            </button>
          </div>

          {/* Notes list */}
          {tripNotes.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", border: "1.5px dashed #E0E0E0", borderRadius: "16px" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>No notes yet.</p>
              <p style={{ fontSize: "13px", color: "#717171" }}>Add reminders, things to check, or anything related to this trip.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {[...tripNotes]
                .sort((a, b) => Number(a.checked) - Number(b.checked))
                .map(note => (
                  <div
                    key={note.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      backgroundColor: note.checked ? "#FAFAFA" : "#fff",
                      border: "1px solid",
                      borderColor: note.checked ? "#F0F0F0" : "#EEEEEE",
                      marginBottom: "4px",
                    }}
                    className="group"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleNote(note.id, note.checked)}
                      style={{
                        flexShrink: 0,
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: `2px solid ${note.checked ? "#1B3A5C" : "#C8C8C8"}`,
                        backgroundColor: note.checked ? "#1B3A5C" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        marginTop: "1px",
                        transition: "all 0.15s",
                      }}
                    >
                      {note.checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Text */}
                    <span style={{
                      flex: 1,
                      fontSize: "14px",
                      color: note.checked ? "#aaa" : "#1a1a1a",
                      textDecoration: note.checked ? "line-through" : "none",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}>
                      {note.content}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      style={{
                        flexShrink: 0,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#D0D0D0",
                        padding: "2px",
                        lineHeight: 1,
                        marginTop: "1px",
                      }}
                      title="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Done count */}
          {tripNotes.filter(n => n.checked).length > 0 && (
            <p style={{ fontSize: "12px", color: "#aaa", marginTop: "12px", textAlign: "center" }}>
              {tripNotes.filter(n => n.checked).length} of {tripNotes.length} done
            </p>
          )}
        </div>
      )}

      {tab === "vault" && (
        <div style={{ maxWidth: "640px", display: "flex", flexDirection: "column", gap: "32px" }}>

          {/* ── IMPORTED BOOKINGS ── */}
          {documents.filter(d => d.type === "booking").length > 0 && (
            <div>
              <div style={{ marginBottom: "14px" }}>
                <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>Imported Bookings</p>
                <p style={{ fontSize: "12px", color: "#717171" }}>Automatically populated from your confirmation emails</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {documents.filter(d => d.type === "booking").map(d => {
                  let booking: Record<string, unknown> = {};
                  try { booking = JSON.parse(d.content ?? "{}"); } catch { /* ignore */ }
                  const typeLabel = (booking.type as string | undefined)?.toUpperCase() ?? "BOOKING";
                  const rows: { label: string; value: string }[] = [];
                  if (booking.fromCity && booking.toCity) {
                    rows.push({ label: "Route", value: `${booking.fromCity} → ${booking.toCity}` });
                  } else if (booking.fromAirport && booking.toAirport) {
                    rows.push({ label: "Route", value: `${booking.fromAirport} → ${booking.toAirport}` });
                  }
                  function fmtVaultDate(d: unknown): string {
                    if (!d) return "";
                    try {
                      const dt = new Date(String(d) + "T12:00:00");
                      return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    } catch { return String(d); }
                  }
                  if (booking.activityName) rows.push({ label: "Activity", value: String(booking.activityName) });
                  if (booking.departureDate) rows.push({ label: "Departure", value: `${fmtVaultDate(booking.departureDate)}${booking.departureTime ? ` at ${booking.departureTime}` : ""}` });
                  if (booking.arrivalDate) rows.push({ label: "Arrival", value: `${fmtVaultDate(booking.arrivalDate)}${booking.arrivalTime ? ` at ${booking.arrivalTime}` : ""}` });
                  if (booking.checkIn) rows.push({ label: "Check-in", value: fmtVaultDate(booking.checkIn) });
                  if (booking.checkOut) rows.push({ label: "Check-out", value: fmtVaultDate(booking.checkOut) });
                  if (booking.address) rows.push({ label: "Address", value: String(booking.address) });
                  if (booking.confirmationCode) rows.push({ label: "Confirmation", value: String(booking.confirmationCode) });
                  if (booking.totalCost) rows.push({ label: "Total", value: `${booking.totalCost}${booking.currency ? ` ${booking.currency}` : ""}` });
                  if (booking.contactPhone) rows.push({ label: "Phone", value: String(booking.contactPhone) });
                  if (Array.isArray(booking.guestNames) && booking.guestNames.length > 0) rows.push({ label: "Guests", value: (booking.guestNames as string[]).join(", ") });
                  // For flight-type docs, find matching Flight record
                  const matchedFlight = (booking.type as string) === "flight"
                    ? flights.find(f => f.flightNumber === (booking.flightNumber as string))
                    : null;

                  function handleVaultEdit() {
                    if (matchedFlight) {
                      setEditingFlightVaultDocId(d.id);
                      setEditingFlight(matchedFlight);
                    } else {
                      // Generic vault doc edit
                      const parsed = (() => { try { return JSON.parse(d.content ?? "{}"); } catch { return {}; } })();
                      setEditingVaultDoc({ id: d.id, label: d.label, content: parsed as Record<string, unknown> });
                      if ((booking.type as string) === "activity") {
                        setEditActivityName((booking.activityName as string | null) || d.label || "");
                      } else {
                        setEditActivityName(null);
                      }
                    }
                  }

                  const isActivityVault = (booking.type as string) === "activity";
                  function handleVaultActivityTap() {
                    if (!isActivityVault) return;
                    const synth: ItineraryItemLocal = {
                      id: d.id,
                      type: "ACTIVITY",
                      title: (booking.activityName as string | null) || (booking.vendorName as string | null) || d.label,
                      scheduledDate: (booking.departureDate as string | null) ?? null,
                      departureTime: (booking.departureTime as string | null) ?? null,
                      arrivalTime: null,
                      fromAirport: null, toAirport: null, fromCity: null, toCity: null,
                      confirmationCode: (booking.confirmationCode as string | null) ?? null,
                      notes: (booking.vendorName as string | null) ?? null,
                      address: (booking.address as string | null) ?? null,
                      totalCost: typeof booking.totalCost === "number" ? booking.totalCost : null,
                      currency: (booking.currency as string | null) ?? null,
                      passengers: Array.isArray(booking.guestNames) ? (booking.guestNames as string[]) : [],
                      dayIndex: null, latitude: null, longitude: null, sortOrder: 0,
                      bookingUrl: d.url ?? null,
                    };
                    setVaultActivityItem(synth);
                  }

                  const isTrainVault = (booking.type as string) === "train";
                  function handleVaultTrainTap() {
                    if (!isTrainVault) return;
                    const fromCity = (booking.fromCity as string | null) ?? null;
                    const toCity = (booking.toCity as string | null) ?? null;
                    const synth: ItineraryItemLocal = {
                      id: d.id,
                      type: "TRAIN",
                      title: fromCity && toCity ? `${fromCity} → ${toCity}` : d.label,
                      scheduledDate: (booking.departureDate as string | null) ?? null,
                      departureTime: (booking.departureTime as string | null) ?? null,
                      arrivalTime: (booking.arrivalTime as string | null) ?? null,
                      fromAirport: null, toAirport: null,
                      fromCity,
                      toCity,
                      confirmationCode: (booking.confirmationCode as string | null) ?? null,
                      notes: (booking.vendorName as string | null) ?? null,
                      address: null,
                      totalCost: typeof booking.totalCost === "number" ? booking.totalCost : null,
                      currency: (booking.currency as string | null) ?? null,
                      passengers: Array.isArray(booking.guestNames) ? (booking.guestNames as string[]) : [],
                      dayIndex: null, latitude: null, longitude: null, sortOrder: 0,
                      bookingUrl: d.url ?? null,
                    };
                    setVaultActivityItem(synth);
                  }

                  const isTappableVault = isActivityVault || isTrainVault;
                  return (
                    <div key={d.id} style={{ backgroundColor: "#fff", border: "1px solid rgba(196,102,74,0.2)", borderRadius: "14px", padding: "16px", position: "relative", ...(isTappableVault ? { cursor: "pointer" } : {}) }} onClick={isActivityVault ? handleVaultActivityTap : isTrainVault ? handleVaultTrainTap : undefined}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#C4664A", backgroundColor: "rgba(196,102,74,0.08)", borderRadius: "999px", padding: "2px 8px" }}>{typeLabel}</span>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a" }}>
                          {(booking.type as string) === "flight"
                            ? (booking.fromAirport && booking.toAirport)
                              ? `${booking.fromAirport} → ${booking.toAirport}`
                              : (booking.fromCity && booking.toCity)
                              ? `${booking.fromCity} → ${booking.toCity}`
                              : "Flight details"
                            : (booking.type as string) === "train" && booking.fromCity && booking.toCity
                            ? `${booking.fromCity} → ${booking.toCity}`
                            : d.label}
                        </span>
                      </div>
                      {isActivityVault && (
                        <input
                          type="text"
                          defaultValue={(booking.activityName as string | null) || d.label}
                          onClick={e => e.stopPropagation()}
                          onBlur={async (e) => {
                            const newTitle = e.target.value.trim();
                            if (!newTitle || newTitle === ((booking.activityName as string | null) || d.label)) return;
                            const updatedContent = JSON.stringify({ ...(booking as Record<string, unknown>), activityName: newTitle });
                            await fetch(`/api/trips/${tripId}/vault/documents/${d.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ label: newTitle, content: updatedContent }),
                            });
                            setDocuments(prev => prev.map(doc => doc.id === d.id ? { ...doc, label: newTitle, content: updatedContent } : doc));
                          }}
                          style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", border: "none", borderBottom: "2px solid #C4664A", background: "transparent", width: "100%", outline: "none", cursor: "text", paddingBottom: "4px", marginBottom: "8px", boxSizing: "border-box" as const }}
                          placeholder="Activity name..."
                        />
                      )}
                      {rows.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px" }}>
                          {rows.map(r => (
                            <>
                              <span key={`lbl_${r.label}`} style={{ fontSize: "11px", color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{r.label}</span>
                              <span key={`val_${r.label}`} style={{ fontSize: "13px", color: "#1a1a1a", fontWeight: 500 }}>{r.value}</span>
                            </>
                          ))}
                        </div>
                      )}
                      {(booking.type as string) === "flight" && (
                        <p style={{ fontSize: "11px", color: "#BBBBBB", marginTop: "10px" }}>Re-forward confirmation to update times</p>
                      )}
                      {(booking.type as string) === "lodging" && typeof booking.address === "string" && booking.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(booking.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: "10px", fontSize: "12px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                        >
                          Open in Maps →
                        </a>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleVaultEdit(); }} style={{ position: "absolute", top: "12px", right: "36px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px" }} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={async (e) => { e.stopPropagation(); if (!window.confirm("Remove this booking? This cannot be undone.")) return; const res = await fetch(`/api/trips/${tripId}/vault/documents/${d.id}`, { method: "DELETE" }); if (res.ok) { setDocuments(p => p.filter(x => x.id !== d.id)); setItineraryVersion(v => v + 1); } }} style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px" }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── CONTACTS ── */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>Contacts</p>
                <p style={{ fontSize: "12px", color: "#717171" }}>Hotel, driver, guide — everyone on this trip</p>
              </div>
              <button onClick={() => setShowAddContact(v => !v)} style={{ fontSize: "13px", color: "#C4664A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {showAddContact ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showAddContact && (
              <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: "14px", padding: "16px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input type="text" value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder="Name *" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                  <input type="text" value={newContact.role} onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))} placeholder="Role (e.g. Driver)" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input type="tel" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                  <input type="tel" value={newContact.whatsapp} onChange={e => setNewContact(p => ({ ...p, whatsapp: e.target.value }))} placeholder="WhatsApp number" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                </div>
                <input type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="Email" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={!newContact.name.trim()}
                    onClick={async () => {
                      if (!newContact.name.trim() || !tripId) return;
                      const res = await fetch(`/api/trips/${tripId}/vault/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newContact) });
                      if (!res.ok) return;
                      const saved = await res.json();
                      setContacts(p => [...p, saved]);
                      setShowAddContact(false);
                      setNewContact({ name: "", role: "", phone: "", whatsapp: "", email: "" });
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: newContact.name.trim() ? "#1B3A5C" : "#E0E0E0", color: newContact.name.trim() ? "#fff" : "#aaa", fontSize: "13px", fontWeight: 700, cursor: newContact.name.trim() ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Save contact
                  </button>
                  <button onClick={() => { setShowAddContact(false); setNewContact({ name: "", role: "", phone: "", whatsapp: "", email: "" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {contacts.length === 0 && !showAddContact ? (
              <p style={{ fontSize: "13px", color: "#bbb", fontStyle: "italic" }}>Add your hotel, driver, or tour guide</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {contacts.map(c => (
                  <div key={c.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{c.name}</span>
                        {c.role && <span style={{ fontSize: "11px", color: "#717171", backgroundColor: "#F5F5F5", borderRadius: "999px", padding: "2px 8px" }}>{c.role}</span>}
                      </div>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {c.phone && <span style={{ fontSize: "13px", color: "#555" }}>📞 {c.phone}</span>}
                        {c.whatsapp && <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#25D366", fontWeight: 600 }}>WhatsApp →</a>}
                        {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: "13px", color: "#1B3A5C" }}>{c.email}</a>}
                      </div>
                    </div>
                    <button onClick={async () => { await fetch(`/api/trips/${tripId}/vault/contacts/${c.id}`, { method: "DELETE" }); setContacts(p => p.filter(x => x.id !== c.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", flexShrink: 0 }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── DOCUMENTS & LINKS ── */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>Documents & Links</p>
                <p style={{ fontSize: "12px", color: "#717171" }}>Booking confirmations, tickets, spreadsheets</p>
              </div>
              <button onClick={() => setShowAddDoc(v => !v)} style={{ fontSize: "13px", color: "#C4664A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {showAddDoc ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showAddDoc && (
              <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: "14px", padding: "16px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Quick suggestion pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {["Booking confirmation", "Travel insurance", "Visa copy", "Budget spreadsheet", "Packing list", "Flight itinerary"].map(s => (
                    <button key={s} onClick={() => setNewDoc(p => ({ ...p, label: s }))} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "999px", border: `1px solid ${newDoc.label === s ? "#1B3A5C" : "#E0E0E0"}`, backgroundColor: newDoc.label === s ? "rgba(27,58,92,0.08)" : "#fff", color: newDoc.label === s ? "#1B3A5C" : "#717171", cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                  ))}
                </div>
                <input type="text" value={newDoc.label} onChange={e => setNewDoc(p => ({ ...p, label: e.target.value }))} placeholder="Label *" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                {/* Type toggle */}
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["link", "note"] as const).map(t => (
                    <button key={t} onClick={() => setNewDoc(p => ({ ...p, type: t }))} style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `1.5px solid ${newDoc.type === t ? "#1B3A5C" : "#E8E8E8"}`, backgroundColor: newDoc.type === t ? "#1B3A5C" : "#fff", color: newDoc.type === t ? "#fff" : "#717171", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {t === "link" ? "🔗 Link / URL" : "📝 Note"}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "11px", color: "#bbb", fontStyle: "italic", margin: 0 }}>📎 File attachments coming soon</p>
                {newDoc.type === "link" ? (
                  <input type="url" value={newDoc.url} onChange={e => setNewDoc(p => ({ ...p, url: e.target.value }))} placeholder="https://..." style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                ) : (
                  <textarea value={newDoc.content} onChange={e => setNewDoc(p => ({ ...p, content: e.target.value }))} placeholder="Paste your note, confirmation number, or details here..." rows={4} style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", resize: "vertical" }} />
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={!newDoc.label.trim()}
                    onClick={async () => {
                      if (!newDoc.label.trim() || !tripId) return;
                      const res = await fetch(`/api/trips/${tripId}/vault/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newDoc) });
                      if (!res.ok) return;
                      const saved = await res.json();
                      setDocuments(p => [...p, saved]);
                      setShowAddDoc(false);
                      setNewDoc({ label: "", type: "link", url: "", content: "" });
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: newDoc.label.trim() ? "#1B3A5C" : "#E0E0E0", color: newDoc.label.trim() ? "#fff" : "#aaa", fontSize: "13px", fontWeight: 700, cursor: newDoc.label.trim() ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Save document
                  </button>
                  <button onClick={() => { setShowAddDoc(false); setNewDoc({ label: "", type: "link", url: "", content: "" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {documents.filter(d => d.type !== "booking").length === 0 && !showAddDoc ? (
              <p style={{ fontSize: "13px", color: "#bbb", fontStyle: "italic" }}>Save booking confirmations, visa copies, tickets…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {documents.filter(d => d.type !== "booking").map(d => (
                  <div key={d.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px" }}>{d.type === "link" ? "🔗" : "📝"}</span>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{d.label}</span>
                      </div>
                      {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1B3A5C", wordBreak: "break-all" }}>{d.url}</a>}
                      {d.content && <p style={{ fontSize: "12px", color: "#555", marginTop: "4px", whiteSpace: "pre-wrap" }}>{d.content}</p>}
                    </div>
                    <button onClick={async () => { await fetch(`/api/trips/${tripId}/vault/documents/${d.id}`, { method: "DELETE" }); setDocuments(p => p.filter(x => x.id !== d.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", flexShrink: 0 }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── KEY INFO ── */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>Key Info</p>
                <p style={{ fontSize: "12px", color: "#717171" }}>WiFi passwords, check-in times, PIN codes, addresses</p>
              </div>
              <button onClick={() => setShowAddKeyInfo(v => !v)} style={{ fontSize: "13px", color: "#C4664A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {showAddKeyInfo ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showAddKeyInfo && (
              <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: "14px", padding: "16px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Quick suggestion pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {["WiFi password", "Check-in time", "Check-out time", "Hotel address", "Emergency contact", "Insurance policy #"].map(s => (
                    <button key={s} onClick={() => setNewKeyInfo(p => ({ ...p, label: s }))} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "999px", border: `1px solid ${newKeyInfo.label === s ? "#1B3A5C" : "#E0E0E0"}`, backgroundColor: newKeyInfo.label === s ? "rgba(27,58,92,0.08)" : "#fff", color: newKeyInfo.label === s ? "#1B3A5C" : "#717171", cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input type="text" value={newKeyInfo.label} onChange={e => setNewKeyInfo(p => ({ ...p, label: e.target.value }))} placeholder="Label *  (e.g. WiFi password)" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                  <input type="text" value={newKeyInfo.value} onChange={e => setNewKeyInfo(p => ({ ...p, value: e.target.value }))} placeholder="Value *" style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={!newKeyInfo.label.trim() || !newKeyInfo.value.trim()}
                    onClick={async () => {
                      if (!newKeyInfo.label.trim() || !newKeyInfo.value.trim() || !tripId) return;
                      const res = await fetch(`/api/trips/${tripId}/vault/keyinfo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newKeyInfo) });
                      if (!res.ok) return;
                      const saved = await res.json();
                      setKeyInfo(p => [...p, saved]);
                      setShowAddKeyInfo(false);
                      setNewKeyInfo({ label: "", value: "" });
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: newKeyInfo.label.trim() && newKeyInfo.value.trim() ? "#1B3A5C" : "#E0E0E0", color: newKeyInfo.label.trim() && newKeyInfo.value.trim() ? "#fff" : "#aaa", fontSize: "13px", fontWeight: 700, cursor: newKeyInfo.label.trim() && newKeyInfo.value.trim() ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Save
                  </button>
                  <button onClick={() => { setShowAddKeyInfo(false); setNewKeyInfo({ label: "", value: "" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {keyInfo.length === 0 && !showAddKeyInfo ? (
              <p style={{ fontSize: "13px", color: "#bbb", fontStyle: "italic" }}>WiFi passwords, check-in times, PINs, addresses…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {keyInfo.map(k => (
                  <div key={k.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: "12px", color: "#717171", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</span>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginTop: "2px", wordBreak: "break-all" }}>{k.value}</p>
                    </div>
                    <button onClick={async () => { await fetch(`/api/trips/${tripId}/vault/keyinfo/${k.id}`, { method: "DELETE" }); setKeyInfo(p => p.filter(x => x.id !== k.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", flexShrink: 0 }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {tab === "howwasit" && tripId && (
        <HowWasItContent
          tripId={tripId}
          destinationCity={destinationCity}
          postTripCaptureComplete={postTripCaptureComplete}
          onComplete={() => setPostTripCaptureComplete(true)}
          onNavigateToItinerary={() => setTab("itinerary")}
        />
      )}

      {tab === "recommended" && (
        <RecommendedContent
          tripId={tripId}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          onViewOnMap={(lat, lng) => { setTab("itinerary"); setFlyTarget({ lat, lng }); }}
          onSaved={() => {}}
          onRefreshItinerary={() => setItineraryVersion(v => v + 1)}
        />
      )}

      {vaultActivityItem && (() => {
        const sit = vaultActivityItem;
        function fmtDateModal(d: string | null): string | null {
          if (!d) return null;
          try {
            const dt = new Date(d + "T12:00:00");
            return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          } catch { return d; }
        }
        const rowStyle: React.CSSProperties = { fontSize: "13px", color: "#1a1a1a", fontWeight: 500 };
        const lblStyle: React.CSSProperties = { fontSize: "11px", color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
        const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", marginBottom: "16px" };
        const titleStyle: React.CSSProperties = { fontSize: "22px", fontWeight: 800, color: "#1B3A5C", marginBottom: "14px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 };
        const costLabel = sit.totalCost != null ? `${sit.currency ?? ""} ${sit.totalCost.toLocaleString()}`.trim() : null;
        const guestsLabel = sit.passengers.length > 0
          ? sit.passengers.length <= 2 ? sit.passengers.join(", ") : `${sit.passengers.length} guests`
          : null;
        const isDesktop = window.innerWidth >= 768;
        return (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center", padding: isDesktop ? "16px" : "0" }}
            onClick={() => setVaultActivityItem(null)}
          >
            <div
              style={{ backgroundColor: "#fff", width: "100%", maxWidth: isDesktop ? "440px" : undefined, borderRadius: isDesktop ? "16px" : "20px 20px 0 0", padding: "24px", maxHeight: "85vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>
                  {sit.type === "TRAIN" ? "Train" : "Activity"}
                </span>
                <button onClick={() => setVaultActivityItem(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#AAAAAA" }}>
                  <X size={20} />
                </button>
              </div>
              <p style={titleStyle}>{sit.title}</p>
              <div style={gridStyle}>
                {sit.type === "TRAIN" ? (
                  <>
                    {sit.notes && !/^\d{1,2}:\d{2}$/.test(sit.notes) && !/^departs/i.test(sit.notes) && !/^\d{1,2}:\d{2}\s*·/.test(sit.notes) && <><span style={lblStyle}>Operator</span><span style={rowStyle}>{sit.notes}</span></>}
                    {(sit.scheduledDate || sit.departureTime) && (
                      <><span style={lblStyle}>Departure</span>
                      <span style={rowStyle}>{[fmtDateModal(sit.scheduledDate), sit.departureTime ? `at ${sit.departureTime}` : null].filter(Boolean).join(" ")}</span></>
                    )}
                    {sit.arrivalTime && (
                      <><span style={lblStyle}>Arrival</span>
                      <span style={rowStyle}>{[fmtDateModal(sit.scheduledDate), `at ${sit.arrivalTime}`].filter(Boolean).join(" ")}</span></>
                    )}
                    {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                    {costLabel && <><span style={lblStyle}>Total</span><span style={rowStyle}>{costLabel}</span></>}
                    {guestsLabel && <><span style={lblStyle}>Passengers</span><span style={rowStyle}>{guestsLabel}</span></>}
                  </>
                ) : (
                  <>
                    {sit.scheduledDate && <><span style={lblStyle}>Date</span><span style={rowStyle}>{fmtDateModal(sit.scheduledDate)}</span></>}
                    {sit.departureTime && <><span style={lblStyle}>Time</span><span style={rowStyle}>{sit.departureTime}</span></>}
                    {sit.address && <><span style={lblStyle}>Meeting point</span><span style={rowStyle}>{sit.address}</span></>}
                    {sit.notes && !/^\d{1,2}:\d{2}$/.test(sit.notes) && !/^departs/i.test(sit.notes) && !/^\d{1,2}:\d{2}\s*·/.test(sit.notes) && <><span style={lblStyle}>Operator</span><span style={rowStyle}>{sit.notes}</span></>}
                    {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                    {costLabel && <><span style={lblStyle}>Total</span><span style={rowStyle}>{costLabel}</span></>}
                    {guestsLabel && <><span style={lblStyle}>Guests</span><span style={rowStyle}>{guestsLabel}</span></>}
                  </>
                )}
              </div>
              {sit.bookingUrl && (
                <a
                  href={sit.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", textAlign: "center", backgroundColor: "#1B3A5C", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                >
                  View booking →
                </a>
              )}
              {sit.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(sit.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", textAlign: "center", backgroundColor: "#C4664A", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                >
                  Open in Maps
                </a>
              )}
              {sit.type === "TRAIN" && sit.fromCity && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(sit.fromCity + " train station")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", textAlign: "center", backgroundColor: "#C4664A", color: "#fff", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                >
                  Open Departure Station in Maps
                </a>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Post-trip capture modal ── */}
      {showPostTripModal && createPortal(
        <div
          onClick={() => setShowPostTripModal(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: "440px", padding: "32px" }}
          >
            <p style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "12px", lineHeight: 1.3 }}>
              Welcome back{destinationCity ? ` from ${destinationCity}` : ""}
            </p>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "28px", lineHeight: 1.6 }}>
              How did it go? Rate what you experienced — it takes 2 minutes and helps other families plan.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={async () => {
                  if (!tripId) return;
                  await fetch(`/api/trips/${tripId}/post-trip-status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postTripCaptureStarted: true }) });
                  setPostTripCaptureStarted(true);
                  setShowPostTripModal(false);
                  setTab("howwasit");
                }}
                style={{ flex: 1, padding: "13px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Share how it went
              </button>
              <button
                onClick={() => setShowPostTripModal(false)}
                style={{ padding: "13px 20px", backgroundColor: "transparent", color: "#717171", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Generic Vault Booking Edit Modal ── */}
      {editingVaultDoc && tripId && (() => {
        const doc = editingVaultDoc;
        const c = doc.content;
        const fields: Array<{ key: string; label: string; type?: string }> = [];
        const t = String(c.type ?? "");
        if (t === "flight" || t === "train") {
          fields.push(
            { key: "vendorName", label: "Vendor / Airline" },
            { key: "flightNumber", label: "Flight / Train #" },
            { key: "fromCity", label: "From City" },
            { key: "toCity", label: "To City" },
            { key: "fromAirport", label: "From Airport" },
            { key: "toAirport", label: "To Airport" },
            { key: "departureDate", label: "Departure Date", type: "date" },
            { key: "departureTime", label: "Departure Time", type: "time" },
            { key: "arrivalDate", label: "Arrival Date", type: "date" },
            { key: "arrivalTime", label: "Arrival Time", type: "time" },
            { key: "confirmationCode", label: "Confirmation" },
          );
        } else {
          fields.push(
            { key: "vendorName", label: "Vendor Name" },
            { key: "checkIn", label: "Check-in Date", type: "date" },
            { key: "checkOut", label: "Check-out Date", type: "date" },
            { key: "confirmationCode", label: "Confirmation" },
            { key: "address", label: "Address" },
            { key: "contactPhone", label: "Phone" },
            { key: "contactEmail", label: "Email" },
          );
        }
        const isActivityType = String(doc.content.type ?? "").toLowerCase() === "activity";
        const labelStyle = { fontSize: "11px", fontWeight: 700 as const, color: "#717171", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "5px", display: "block" };
        const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" as const };
        return createPortal(
          <div onClick={() => setEditingVaultDoc(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", padding: "24px 20px 40px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Edit Booking</p>
                <button onClick={() => setEditingVaultDoc(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>×</button>
              </div>
              {isActivityType && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Activity Name</label>
                  <input
                    type="text"
                    value={editActivityName ?? ""}
                    onChange={e => setEditActivityName(e.target.value)}
                    style={inputStyle}
                    placeholder="Activity name"
                  />
                </div>
              )}
              {fields.map(f => (
                <div key={f.key} style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type={f.type ?? "text"}
                    value={String(doc.content[f.key] ?? "")}
                    onChange={e => setEditingVaultDoc(prev => prev ? { ...prev, content: { ...prev.content, [f.key]: e.target.value } } : null)}
                    style={inputStyle}
                  />
                </div>
              ))}
              {vaultDocSaving && <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px" }}>Saving…</p>}
              <button
                disabled={vaultDocSaving}
                onClick={async () => {
                  setVaultDocSaving(true);
                  try {
                    const contentWithActivity = isActivityType && editActivityName
                      ? { ...doc.content, activityName: editActivityName }
                      : doc.content;
                    const updatedContent = JSON.stringify(contentWithActivity);
                    const patchBody: Record<string, unknown> = { content: updatedContent };
                    if (isActivityType && editActivityName) patchBody.label = editActivityName;
                    await fetch(`/api/trips/${tripId}/vault/documents/${doc.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(patchBody),
                    });
                    // Update vault documents state
                    const newLabel = (isActivityType && editActivityName) ? editActivityName : doc.label;
                    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, label: newLabel, content: updatedContent } : d));
                    // If activity type, also update the linked itinerary item title via API
                    // localItineraryItems is in ItineraryContent scope — use confirmationCode to find and PATCH
                    if (isActivityType && editActivityName && tripId) {
                      const confCode = doc.content.confirmationCode as string | null;
                      if (confCode) {
                        // Fetch itinerary items to find the linked item by confirmationCode
                        const itinRes = await fetch(`/api/trips/${tripId}/itinerary`);
                        if (itinRes.ok) {
                          const itinData = (await itinRes.json()) as { id: string; confirmationCode?: string | null }[];
                          const linkedItem = itinData.find(it => it.confirmationCode === confCode);
                          if (linkedItem) {
                            await fetch(`/api/trips/${tripId}/itinerary/${linkedItem.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: editActivityName }),
                            });
                          }
                        }
                      }
                      // Force ItineraryContent to refetch by bumping itineraryVersion
                      setItineraryVersion(v => v + 1);
                    }
                    setEditingVaultDoc(null);
                  } finally {
                    setVaultDocSaving(false);
                  }
                }}
                style={{ width: "100%", padding: "14px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Save changes
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Trip Settings Modal ── */}
      {showTripSettings && createPortal(
        <div
          onClick={() => setShowTripSettings(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", padding: "24px 20px 40px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Trip Settings</p>
              <button onClick={() => setShowTripSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#717171", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em" }}>Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid #E5E5E5", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1B3A5C", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em" }}>End Date</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid #E5E5E5", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1B3A5C", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button
                onClick={async () => {
                  if (!tripId) return;
                  setDateSaving(true);
                  try {
                    await fetch(`/api/trips/${tripId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        startDate: editStartDate ? new Date(editStartDate + 'T12:00:00').toISOString() : undefined,
                        endDate: editEndDate ? new Date(editEndDate + 'T12:00:00').toISOString() : undefined,
                      }),
                    });
                    setShowTripSettings(false);
                    window.location.reload();
                  } finally {
                    setDateSaving(false);
                  }
                }}
                disabled={dateSaving}
                style={{ width: "100%", padding: "13px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: dateSaving ? "default" : "pointer", fontFamily: "inherit", opacity: dateSaving ? 0.7 : 1 }}
              >
                {dateSaving ? "Saving…" : "Save dates"}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-[#0A1628] mb-3">Community visibility</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isAnonymous}
                  onChange={(e) => handleAnonymousToggle(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#C4664A]"
                />
                <div>
                  <p className="text-sm text-[#0A1628]">Show our family name on community trips</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When on, your trip appears with your family name on Discover. Off by default.
                  </p>
                </div>
              </label>
              {anonymousSaved && (
                <p className="text-xs text-green-600 mt-2 ml-7">Saved</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
