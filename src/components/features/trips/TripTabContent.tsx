"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { mergeDuplicateLodging } from "@/lib/itinerary/merge-duplicate-lodging";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";
import TourMapBlock from "@/components/tours/TourMapBlock";
import { CATEGORIES, categoryLabel as getCategoryLabel, normalizeCategorySlug as normalizeCategorySlugTC } from "@/lib/categories";
import { matchesCategory } from "@/lib/categoryFilter";

function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

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
  Star,
  Bookmark,
  Trash2,
  Pencil,
  X,
  ExternalLink,
  Clock,
  Footprints,
  Loader2,
  Calendar,
} from "lucide-react";
import { TripMap } from "@/components/features/trips/TripMap";
import { LODGING_TYPE_LABELS, LODGING_TYPE_OPTIONS } from "@/lib/infer-lodging-type";
import { DropLinkModal } from "@/components/features/home/DropLinkModal";
import { RecommendationDrawer, type DrawerRec } from "@/components/features/trips/RecommendationDrawer";
import { AddFlightModal } from "@/components/flights/AddFlightModal";
import { EditFlightModal } from "@/components/flights/EditFlightModal";
import { AddActivityModal, type ExistingActivity } from "@/components/activities/AddActivityModal";
import { AddToTripModal } from "@/components/trips/AddToTripModal";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";
import { parseDateForDisplay } from "@/lib/dates";
import { toTitleCase } from "@/lib/utils";
import { getTripCoverImage, getItemImage, CATEGORY_IMAGES } from "@/lib/destination-images";
import { ItemImageTile } from "@/components/shared/ItemImageTile";
import { BookingIntelCard } from "@/components/features/trips/BookingIntelCard";
import { BudgetPanel } from "@/components/features/trips/BudgetPanel";
import { ShareTripButton } from "@/components/features/trips/ShareTripButton";
import { getEntityStatus, type EntityStatusResult } from "@/lib/entity-status";
import { EntityStatusPill } from "@/components/ui/EntityStatusPill";
import { buildSaveStatusMap } from "@/lib/save-status-map";
import { shareEntity } from "@/lib/share";
import { ShareButton } from "@/components/shared/ShareButton";
import { ShareEntityType } from "@/lib/share-token";
import { NoteEditor, type TiptapDoc, emptyDoc } from "@/components/features/notes/NoteEditor";

type Tab = "saved" | "itinerary" | "tours" | "recommended" | "events" | "packing" | "notes" | "vault" | "howwasit";

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
  type?: string | null;
  savedItemId?: string | null;
  categoryTags?: string[];
};

// Disabled until Phase B web-search-Haiku adapter ships. TheSportsDB free tier
// searchteams.php?t={city} searches by team name not city — returns 0 results for
// every major US market (Chicago, NYC, LA, San Diego all empty against live API).
// eventsnext.php also only returns ~1 near-term game, insufficient for trips >1 week out.
// Re-enable when Phase B is verified against live data. See Chat 40 handoff.
const SHOW_EVENTS_TAB = false;

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
  sourceMethod: string | null;
  sourcePlatform: string | null;
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
  source?: string;
  destinationCity?: string | null;
  hasBooking: boolean;
  hasItineraryLink: boolean;
  dayIndex: number | null;
  userRating: number | null;
  tripStatus: string | null;
  tripEndDate: string | null;
  eventDateTime?: string | null;
  eventVenue?: string | null;
  eventCategory?: string | null;
  eventTicketUrl?: string | null;
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
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={MODAL_PANEL_CLASSES}
        style={{ padding: "24px 20px 32px" }}
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
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={MODAL_PANEL_CLASSES}
        style={{ padding: "24px 20px 32px" }}
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


function SavedDetailModal({ item, onClose, onAddToItinerary, onMarkBooked, onDelete, assignedDay, onTagsUpdated }: {
  item: SavedDisplayItem;
  onClose: () => void;
  onAddToItinerary?: () => void;
  onMarkBooked?: () => void;
  onDelete?: () => void;
  assignedDay?: number;
  onTagsUpdated?: (itemId: string, tags: string[]) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const normalizeTags = (raw: string[]) =>
    [...new Set(raw.map(t => normalizeCategorySlugTC(t) ?? t.toLowerCase().trim()).filter(Boolean))];
  const [localTags, setLocalTags] = useState<string[]>(() => normalizeTags(item.categoryTags ?? []));
  const [editingTags, setEditingTags] = useState(false);
  const [tagsSaved, setTagsSaved] = useState(false);
  const [localWebsiteUrl, setLocalWebsiteUrl] = useState<string | null>(item.websiteUrl ?? null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [justShared, setJustShared] = useState(false);
  const initialTags = useRef(normalizeTags(item.categoryTags ?? []));
  const localTagsRef = useRef<string[]>(normalizeTags(item.categoryTags ?? []));
  const tagSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initial = item.title.replace(/^www\./, "").charAt(0).toUpperCase();
  const categoryLabel = localTags.filter(t => !["VG", "VGN"].includes(t)).slice(0, 2).map(t => getCategoryLabel(t) || t).join(" · ");

  function toggleTag(tag: string) {
    const current = localTagsRef.current;
    const newTags = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    localTagsRef.current = newTags;
    setLocalTags(newTags);
    if (tagSaveTimer.current) clearTimeout(tagSaveTimer.current);
    tagSaveTimer.current = setTimeout(() => {
      const toSave = localTagsRef.current;
      fetch(`/api/saves/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryTags: toSave }),
      }).then(() => {
        initialTags.current = toSave;
        onTagsUpdated?.(item.id, toSave);
        setTagsSaved(true);
        setTimeout(() => setTagsSaved(false), 2000);
      }).catch(() => {});
    }, 600);
  }

  function handleClose() {
    onClose();
  }
  return createPortal(
    <div
      onClick={handleClose}
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`}
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
          <button onClick={handleClose} style={{ position: "absolute", top: "12px", right: "12px", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", lineHeight: 1 }}>×</button>
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

          {/* Tag editing */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
              {localTags.filter(t => !["VG", "VGN"].includes(t)).map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  style={{ fontSize: "11px", fontWeight: 600, background: "#C4664A", color: "#fff", borderRadius: "999px", padding: "3px 10px", border: "none", cursor: "pointer" }}>
                  {getCategoryLabel(tag) || tag}
                </button>
              ))}
              {localTags.length === 0 && !editingTags && (
                <span style={{ fontSize: "12px", color: "#aaa" }}>No tags yet</span>
              )}
              <button onClick={() => setEditingTags(e => !e)}
                style={{ fontSize: "11px", fontWeight: 600, color: tagsSaved ? "#4a7c59" : "#C4664A", border: `1.5px solid ${tagsSaved ? "#4a7c59" : "#C4664A"}`, borderRadius: "999px", padding: "3px 10px", background: "none", cursor: "pointer" }}>
                {tagsSaved ? "Saved ✓" : editingTags ? "Done" : "Edit tags"}
              </button>
            </div>
            {editingTags && (
              <div style={{ marginTop: "8px", padding: "12px", backgroundColor: "#FAFAFA", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.08)" }}>
                <p style={{ fontSize: "11px", color: "#999", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Tap to toggle</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {CATEGORIES.map(({ slug, label }) => {
                    const active = localTags.includes(slug);
                    return (
                      <button key={slug} onClick={() => toggleTag(slug)}
                        style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "999px", border: "1.5px solid", borderColor: active ? "#C4664A" : "#D0D0D0", backgroundColor: active ? "#C4664A" : "#fff", color: active ? "#fff" : "#666", cursor: "pointer" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {item.detail && <p style={{ fontSize: "13px", color: "#717171", marginBottom: "12px" }}>{item.detail}</p>}
          {item.description && (
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "16px" }}>{item.description}</p>
          )}

          {/* Visit site + URL edit */}
          <div style={{ marginBottom: "16px" }}>
            {localWebsiteUrl && !editingUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <a href={localWebsiteUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}>
                  Link →
                </a>
                <button type="button"
                  onClick={() => { setUrlInput(localWebsiteUrl); setEditingUrl(true); setUrlError(null); }}
                  style={{ fontSize: "12px", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                  Edit URL
                </button>
              </div>
            ) : !localWebsiteUrl && !editingUrl ? (
              <button type="button"
                onClick={() => { setUrlInput(""); setEditingUrl(true); setUrlError(null); }}
                style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                + Add URL
              </button>
            ) : null}
            {editingUrl && (
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <input type="url" value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setUrlError(null); }}
                  placeholder="https://..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${urlError ? "#e53e3e" : "rgba(0,0,0,0.12)"}`, fontSize: "13px", color: "#333", outline: "none", fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", boxSizing: "border-box" as const }} />
                {urlError && <p style={{ fontSize: "12px", color: "#e53e3e", margin: 0 }}>{urlError}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button"
                    onClick={async () => {
                      const val = urlInput.trim();
                      if (!val.startsWith("http://") && !val.startsWith("https://")) {
                        setUrlError("Please enter a valid URL");
                        return;
                      }
                      try {
                        await fetch(`/api/saves/${item.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ websiteUrl: val }),
                        });
                        setLocalWebsiteUrl(val);
                        setEditingUrl(false);
                        setUrlError(null);
                      } catch { setUrlError("Failed to save. Try again."); }
                    }}
                    style={{ fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    Save
                  </button>
                  <button type="button"
                    onClick={() => { setEditingUrl(false); setUrlError(null); }}
                    style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "999px", backgroundColor: "transparent", color: "#aaa", border: "1px solid #ddd", cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

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
                Link →
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
            {item.id && (
              <button type="button"
                onClick={async () => {
                  const result = await shareEntity({ entityType: "saved_item", entityId: item.id! });
                  if (result.ok) { setJustShared(true); setTimeout(() => setJustShared(false), 2000); }
                }}
                style={{ padding: "10px", borderRadius: "999px", backgroundColor: "transparent", border: "1.5px solid rgba(196,102,74,0.4)", fontSize: "13px", fontWeight: 700, color: justShared ? "#4a7c59" : "#C4664A", cursor: "pointer", fontFamily: "inherit" }}>
                {justShared ? "Link copied" : "Share"}
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
function SavedHorizCard({ item, isDesktop: _isDesktop, onAddToItinerary, onBook, onLearnMore, assignedDay, onDelete, onShare }: {
  item: SavedDisplayItem;
  isDesktop: boolean;
  onAddToItinerary: () => void;
  onBook: () => void;
  onLearnMore: () => void;
  assignedDay?: number;
  onDelete?: () => void;
  onShare?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImg = !!item.img && !imgFailed;
  const initial = item.title.replace(/^www\./, "").charAt(0).toUpperCase();
  const subtitleParts = [
    item.categoryTags?.slice(0, 1)[0],
    item.detail,
  ].filter(Boolean);
  const subtitle = subtitleParts.length > 1 ? subtitleParts.join(" · ") : subtitleParts[0] ?? "";
  const statusResult = getEntityStatus({
    dayIndex: item.dayIndex,
    hasItineraryLink: item.hasItineraryLink,
    hasBooking: item.hasBooking,
    userRating: item.userRating,
    tripStatus: item.tripStatus,
    tripEndDate: item.tripEndDate,
  });
  const pillLabel = statusResult.status === "on_itinerary" && item.dayIndex != null
    ? `Day ${item.dayIndex + 1}`
    : statusResult.label;
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
        {/* Title */}
        <div style={{ marginBottom: "2px" }}>
          <p style={{ fontSize: "14px", fontWeight: 800, color: "#1B3A5C", lineHeight: 1.3 }}>{item.title}</p>
        </div>
        {/* Subtitle: category + detail */}
        {subtitle && (
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "10px", lineHeight: 1.4 }}>{subtitle}</p>
        )}
        {/* Action row */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
          {statusResult.status !== "saved" ? (
            <EntityStatusPill status={statusResult.status} label={pillLabel} color={statusResult.color} />
          ) : null}
          {statusResult.showAffordance && (
            <button type="button" onClick={e => { e.stopPropagation(); onAddToItinerary(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add to itinerary
            </button>
          )}
          {item.bookUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); onBook(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Book</button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onLearnMore(); }} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Learn more</button>
          {onShare && (
            <button type="button" onClick={e => { e.stopPropagation(); onShare(); }} style={{ fontSize: "12px", fontWeight: 600, color: "#C4664A", background: "white", border: "1px solid rgba(196,102,74,0.3)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>
              Share
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={e => { e.stopPropagation(); onDelete(); }} style={{ fontSize: "10px", padding: "4px 7px", borderRadius: "999px", border: "1px solid rgba(220,53,69,0.25)", backgroundColor: "transparent", color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center", marginLeft: onShare ? "4px" : "auto" }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventSavedCard({ item }: { item: SavedDisplayItem }) {
  return (
    <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "10px" }}>
      <div
        style={{
          position: "relative",
          aspectRatio: "16/9",
          backgroundColor: "#1B3A5C",
          backgroundImage: item.img ? `url(${item.img})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {item.eventDateTime && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              backgroundColor: "rgba(27,58,92,0.9)",
              color: "white",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {formatEventDateTime(item.eventDateTime)}
          </div>
        )}
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>
          {item.title}
        </h4>
        {item.eventVenue && (
          <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
            {item.eventVenue}
          </p>
        )}
        {item.eventCategory && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "999px",
              backgroundColor: "rgba(196,102,74,0.15)",
              color: "#C4664A",
              fontSize: "11px",
              fontWeight: 500,
              alignSelf: "flex-start",
            }}
          >
            {formatCategoryLabel(item.eventCategory)}
          </span>
        )}
        {item.eventTicketUrl && (
          <a
            href={item.eventTicketUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: "4px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              color: "white",
              backgroundColor: "#C4664A",
              border: "none",
              borderRadius: "6px",
              textDecoration: "none",
              alignSelf: "flex-start",
            }}
          >
            View tickets →
          </a>
        )}
      </div>
    </div>
  );
}

const SAVED_FILTER_PILLS: Array<{ slug: string; label: string }> = [
  { slug: "All", label: "All" },
  ...CATEGORIES.map(c => ({ slug: c.slug, label: c.label })),
  { slug: "Unorganized", label: "Unorganized" },
];

function cardActionRow({
  shareEntityType,
  shareEntityId,
  shareTitle,
  customOnShare,
  onEdit,
  onRemove,
  removeLabel = "Remove",
}: {
  shareEntityType?: ShareEntityType | null;
  shareEntityId?: string | null;
  shareTitle?: string | null;
  customOnShare?: (() => void) | null;
  onEdit?: (() => void) | null;
  onRemove?: (() => void) | null;
  removeLabel?: string;
}) {
  const hasShare = (shareEntityType && shareEntityId) || customOnShare;
  if (!hasShare && !onEdit && !onRemove) return null;
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(0,0,0,0.06)" }}
    >
      {shareEntityType && shareEntityId && (
        <ShareButton entityType={shareEntityType} entityId={shareEntityId} title={shareTitle ?? undefined} />
      )}
      {(!shareEntityType || !shareEntityId) && customOnShare && (
        <button onClick={e => { e.stopPropagation(); customOnShare(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#C4664A", padding: 0, fontSize: "12px", fontWeight: 600, fontFamily: "inherit" }}>Share</button>
      )}
      {onEdit && (
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: 0, fontSize: "12px", fontWeight: 500, fontFamily: "inherit" }}>Edit</button>
      )}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", padding: 0, fontSize: "12px", fontFamily: "inherit" }}>{removeLabel}</button>
      )}
    </div>
  );
}

function SavedGridCard({ item, onAddToItinerary, onLearnMore, assignedDay, onDelete, shareEntityId }: {
  item: SavedDisplayItem;
  onAddToItinerary: () => void;
  onLearnMore: () => void;
  assignedDay?: number;
  onDelete?: () => void;
  shareEntityId?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImg = !!item.img && !imgFailed;
  const categoryTag = item.categoryTags?.[0] ?? null;
  const statusResult = getEntityStatus({
    dayIndex: item.dayIndex,
    hasItineraryLink: item.hasItineraryLink,
    hasBooking: item.hasBooking,
    userRating: item.userRating,
    tripStatus: item.tripStatus,
    tripEndDate: item.tripEndDate,
  });
  const pillLabel = statusResult.status === "on_itinerary" && item.dayIndex != null
    ? `Day ${item.dayIndex + 1}`
    : statusResult.label;

  return (
    <div
      onClick={onLearnMore}
      style={{ cursor: "pointer", position: "relative", backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}
    >
      {/* Image */}
      {hasImg ? (
        <div style={{ height: "160px", backgroundImage: `url(${item.img})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
          <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
          {item.source && (
            <div style={{ position: "absolute", bottom: "6px", left: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", padding: "2px 8px", borderRadius: "20px" }}>
              {item.source}
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: "160px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>{categoryTag ?? "Saved place"}</span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: "12px" }}>
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "4px" }}>{item.title}</p>
        {categoryTag && (
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "8px" }}>{categoryTag}</p>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          {statusResult.status !== "saved" ? (
            <EntityStatusPill status={statusResult.status} label={pillLabel} color={statusResult.color} />
          ) : null}
          {statusResult.showAffordance && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddToItinerary(); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "#C4664A", fontWeight: 600, fontFamily: "inherit" }}
            >
              + Add to itinerary
            </button>
          )}
          {item.websiteUrl && (
            <a
              href={item.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ display: "block", fontSize: "12px", color: "#C4664A", marginTop: "4px" }}
            >
              Link →
            </a>
          )}
        </div>
        {(shareEntityId || onDelete) && (
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: "8px", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {shareEntityId && (
              <ShareButton entityType="saved_item" entityId={shareEntityId} title={item.title} />
            )}
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, fontSize: "12px", fontFamily: "inherit" }}>Delete</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Real saved items helpers ──────────────────────────────────────────────────

type ApiSavedItem = {
  id: string;
  sourceMethod: string | null;
  sourcePlatform: string | null;
  sourceUrl: string | null;
  websiteUrl: string | null;
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
  hasBooking?: boolean;
  hasItineraryLink?: boolean;
  userRating?: number | null;
  tripStatus?: string | null;
  tripEndDate?: string | null;
  eventDateTime?: string | null;
  eventVenue?: string | null;
  eventCategory?: string | null;
  eventTicketUrl?: string | null;
};

const SAVED_SOURCE_LABEL: Record<string, string> = {
  URL_PASTE: "URL save", EMAIL_FORWARD: "Email", IN_APP_SAVE: "Saved in app", SHARED_TRIP_IMPORT: "Flokk share",
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", google_maps: "Google Maps",
  airbnb: "Airbnb", getyourguide: "GetYourGuide", viator: "Viator", klook: "Klook",
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
  MANUAL: "URL save", IN_APP: "Saved in app", EMAIL_IMPORT: "Email",
  PHOTO_IMPORT: "URL save", FROM_SHARE: "Flokk share",
};

function inferSavedCategory(item: ApiSavedItem): string {
  if (item.categoryTags.includes("event")) return "EVENTS";
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
    websiteUrl: item.websiteUrl ?? item.sourceUrl ?? undefined,
    description: item.rawDescription ?? "",
    isLodging,
    lodgingDates: { checkin: item.extractedCheckin, checkout: item.extractedCheckout },
    categoryTags: item.categoryTags,
    source: SAVED_SOURCE_LABEL[item.sourcePlatform ?? ""] || SAVED_SOURCE_LABEL[item.sourceMethod ?? ""] || undefined,
    destinationCity: item.destinationCity,
    hasBooking: item.hasBooking ?? false,
    hasItineraryLink: item.hasItineraryLink ?? (item.dayIndex != null),
    dayIndex: item.dayIndex ?? null,
    userRating: item.userRating ?? null,
    tripStatus: item.tripStatus ?? null,
    tripEndDate: item.tripEndDate ?? null,
    eventDateTime: item.eventDateTime ?? null,
    eventVenue: item.eventVenue ?? null,
    eventCategory: item.eventCategory ?? null,
    eventTicketUrl: item.eventTicketUrl ?? null,
  };
}

function SavedContent({ tripId: tripIdProp, tripStartDate, tripEndDate, tripTitle, onSwitchToItinerary, shareToken }: { tripId?: string; tripStartDate?: string | null; tripEndDate?: string | null; tripTitle?: string; onSwitchToItinerary?: () => void; shareToken?: string }) {
  const isDesktop = useIsDesktop();
  const [shareToast, setShareToast] = useState(false);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  async function handleShare(item: SavedDisplayItem) {
    const result = await shareEntity({ entityType: "saved_item", entityId: item.id });
    if (result.ok) { if (shareToastTimer.current) clearTimeout(shareToastTimer.current); setShareToast(true); shareToastTimer.current = setTimeout(() => setShareToast(false), 2000); }
  }

  function renderSection(section: { category: string; items: SavedDisplayItem[] }) {
    return (
      <div key={section.category} style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{section.category}</span>
          <span style={{ fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{section.items.length}</span>
        </div>
        {section.items.map(item => (
          item.eventDateTime ? (
            <EventSavedCard key={item.id} item={item} />
          ) : (
            <SavedHorizCard
              key={item.title + item.detail}
              item={item}
              isDesktop={isDesktop}
              onAddToItinerary={() => handleAddToItinerary(item)}
              onBook={() => handleBook(item)}
              onLearnMore={() => handleLearnMore(item)}
              assignedDay={assignedDays[item.title]}
              onDelete={() => handleDeleteSave(item)}
              onShare={() => handleShare(item)}
            />
          )
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
    return matchesCategory(itm.categoryTags ?? [], activeFilter);
  };
  const displayedLeft = leftSections.map(s => ({ ...s, items: s.items.filter(filterSaveItem) })).filter(s => s.items.length > 0);
  const displayedRight = rightSections.map(s => ({ ...s, items: s.items.filter(filterSaveItem) })).filter(s => s.items.length > 0);

  return (
    <div>
      {/* FILTER STRIP */}
      <div style={{ display: "flex", overflowX: "auto", overscrollBehaviorX: "contain", gap: "8px", marginBottom: "16px", paddingBottom: "4px", scrollbarWidth: "none", width: "100%" }}>
        {SAVED_FILTER_PILLS.map((pill) => {
          const isActive = activeFilter === pill.slug;
          return (
            <button
              key={pill.slug}
              onClick={() => setActiveFilter(pill.slug)}
              style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "#717171", backgroundColor: isActive ? "#C4664A" : "#fff", border: isActive ? "none" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap" }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* SAVES GRID — filtered */}
      {displayedLeft.length === 0 && displayedRight.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 24px", color: "#717171", fontSize: "14px" }}>
          No saves match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...displayedLeft, ...displayedRight].flatMap(s => s.items).map(item => (
            <SavedGridCard
              key={item.title + item.detail}
              item={item}
              onAddToItinerary={() => handleAddToItinerary(item)}
              onLearnMore={() => handleLearnMore(item)}
              assignedDay={assignedDays[item.title]}
              onDelete={() => handleDeleteSave(item)}
              shareEntityId={item.id}
            />
          ))}
        </div>
      )}

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
          onTagsUpdated={(itemId, tags) => {
            setLeftSections(prev => prev.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, categoryTags: tags } : i) })));
            setRightSections(prev => prev.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, categoryTags: tags } : i) })));
          }}
        />
      )}
      {shareToast && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none" }}>
          Link copied
        </div>
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
    <div onClick={onClose} className={MODAL_OVERLAY_CLASSES}>
      <div onClick={e => e.stopPropagation()} className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`} style={{ padding: "24px 20px 32px" }}>
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

const AIRPORT_COUNTRY: Record<string, string> = {
  NRT: "JP", HND: "JP", KIX: "JP", OKA: "JP",
  ICN: "KR", GMP: "KR", PUS: "KR", CJU: "KR",
  CDG: "FR", LHR: "GB", LGW: "GB",
  BCN: "ES", MAD: "ES", LIS: "PT", FCO: "IT",
  AMS: "NL", FRA: "DE", ZRH: "CH", PRG: "CZ",
  VIE: "AT", DUB: "IE", CPH: "DK",
  BKK: "TH", DMK: "TH", SIN: "SG", HKG: "HK",
  TPE: "TW", MNL: "PH", KUL: "MY",
  CGK: "ID", DPS: "ID", CMB: "LK",
  DEL: "IN", BOM: "IN", DXB: "AE", AUH: "AE",
  LAX: "US", JFK: "US", EWR: "US", ORD: "US", SFO: "US", MIA: "US",
  YUL: "CA", YYZ: "CA",
  SYD: "AU", MEL: "AU",
  GRU: "BR", EZE: "AR",
  CPT: "ZA", JNB: "ZA", CAI: "EG", RAK: "MA",
};

type RecAddition = { dayIndex: number; title: string; location: string; img?: string; savedItemId?: string; lat?: number | null; lng?: number | null; isBooked?: boolean; sortOrder: number; startTime?: string | null; categoryTags?: string[]; tourId?: string | null };

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
  bookingSource?: string | null;
  managementUrl?: string | null;
  imageUrl?: string | null;
  additionalConfirmations?: string[];
  status?: string | null;
  lodgingType?: string | null;
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

// Budget UI consolidated into BudgetPanel (src/components/features/trips/BudgetPanel.tsx)

// ── Activity detail modal ─────────────────────────────────────────────────────
function ActivityDetailModal({ activity, onClose, onEdit, onDelete, onMarkBooked, onAddToItinerary }: {
  activity: Activity;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onMarkBooked?: () => void;
  onAddToItinerary?: () => void;
}) {
  const a = activity;
  return createPortal(
    <div
      onClick={onClose}
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:w-[480px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
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
              Link →
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
            {onDelete && (
              <button
                onClick={onDelete}
                style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: "#e53e3e", border: "none", borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Delete activity
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ItineraryContent({ flyTarget, onFlyTargetConsumed, tripId, tripStartDate, tripEndDate, onSwitchToRecommended, onEditActivity, onEditSavedActivity, onActivityAdded, destinationCity, destinationCountry, flights = [], activities = [], onRemoveActivityFromDay, onDeleteActivity, onMarkActivityBooked, onRemoveFlightFromDay, onAddFlight, budgetTotal, trackedTotal, budgetCurrency, budgetLoaded, onBudgetChange, shareToken, onManageTours }: {
  flyTarget: { lat: number; lng: number } | null;
  onFlyTargetConsumed: () => void;
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onSwitchToRecommended?: () => void;
  onActivityAdded?: () => void;
  onEditActivity?: (a: Activity) => void;
  onEditSavedActivity?: (a: Activity) => void;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  flights?: Flight[];
  activities?: Activity[];
  onRemoveActivityFromDay?: (id: string) => void;
  onDeleteActivity?: (id: string) => void;
  onMarkActivityBooked?: (id: string) => void;
  onRemoveFlightFromDay?: (id: string) => void;
  onAddFlight?: () => void;
  budgetTotal: number | null;
  trackedTotal: number;
  budgetCurrency: string;
  budgetLoaded: boolean;
  onBudgetChange: (total: number | null, currency: string) => void;
  shareToken?: string;
  onManageTours?: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [openDay, setOpenDay] = useState(0); // -1 = all collapsed
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [addActivityDefaultDate, setAddActivityDefaultDate] = useState<string | undefined>();
  const [showAddToTripModal, setShowAddToTripModal] = useState(false);
  const [addToTripDefaultDate, setAddToTripDefaultDate] = useState<string | undefined>();
  const [recAdditions, setRecAdditions] = useState<RecAddition[]>([]);
  // Local copies of activities/flights so drag-reorder can update them independently of parent prop
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);
  const [localFlights, setLocalFlights] = useState<Flight[]>([]);
  const [localItineraryItems, setLocalItineraryItems] = useState<ItineraryItemLocal[]>([]);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationIndex, setVerificationIndex] = useState(0);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergedItineraryItems = useMemo(
    () => mergeDuplicateLodging(localItineraryItems),
    [localItineraryItems]
  );
  const [selectedItineraryItem, setSelectedItineraryItem] = useState<ItineraryItemLocal | null>(null);
  const [editActivityTitle, setEditActivityTitle] = useState("");
  const [editingItinFields, setEditingItinFields] = useState(false);
  const [editItTime, setEditItTime] = useState("");
  const [editItDate, setEditItDate] = useState("");
  const [editItNotes, setEditItNotes] = useState("");
  const [editItSaving, setEditItSaving] = useState(false);
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
  // Geocoded coordinate overrides for activities with null lat/lng (populated by fallback geocoding)
  const [geocodedOverrides, setGeocodedOverrides] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [noLocationIds, setNoLocationIds] = useState<Set<string>>(new Set());
  const geocodingInProgressRef = useRef<Set<string>>(new Set());
  const [tourCancelTarget, setTourCancelTarget] = useState<{ tourId: string; title: string; stopCount: number; days: number[] } | null>(null);
  const [tourCancelling, setTourCancelling] = useState(false);
  const [bookingCancelTarget, setBookingCancelTarget] = useState<ItineraryItemLocal | null>(null);
  const [bookingCancelling, setBookingCancelling] = useState(false);

  // ── Per-day notes state ──────────────────────────────────────────────────
  type DayNote = { id: string; content: TiptapDoc; checked: boolean; dayIndex: number | null; createdAt: string };
  const [dayNotesList, setDayNotesList] = useState<DayNote[]>([]);
  const [addingNoteForDay, setAddingNoteForDay] = useState<number | null>(null);
  const [newlyCreatedDayNoteId, setNewlyCreatedDayNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/notes`)
      .then(r => r.json())
      .then((d: DayNote[]) => setDayNotesList(Array.isArray(d) ? d.filter(n => n.dayIndex !== null) : []))
      .catch(console.error);
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddDayNote(dayIndex: number) {
    if (addingNoteForDay !== null || !tripId) return;
    setAddingNoteForDay(dayIndex);
    try {
      const res = await fetch(`/api/trips/${tripId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: emptyDoc(), dayIndex }),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: DayNote = await res.json();
      setDayNotesList(prev => [...prev, saved]);
      setNewlyCreatedDayNoteId(saved.id);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingNoteForDay(null);
    }
  }

  async function handleSaveDayNote(noteId: string, content: TiptapDoc): Promise<boolean> {
    try {
      const res = await fetch(`/api/trips/${tripId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) setDayNotesList(prev => prev.map(n => n.id === noteId ? { ...n, content } : n));
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleDeleteDayNote(noteId: string) {
    await fetch(`/api/trips/${tripId}/notes/${noteId}`, { method: "DELETE" });
    setDayNotesList(prev => prev.filter(n => n.id !== noteId));
    if (newlyCreatedDayNoteId === noteId) setNewlyCreatedDayNoteId(null);
  }

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

  // Fallback geocoding: fire-and-forget for activities with null lat/lng
  useEffect(() => {
    const nullCoord = localActivities.filter(
      a => a.lat == null && a.lng == null && !geocodingInProgressRef.current.has(a.id)
    );
    if (!tripId || nullCoord.length === 0) return;
    for (const a of nullCoord) {
      geocodingInProgressRef.current.add(a.id);
      fetch(`/api/trips/${tripId}/activities/${a.id}/geocode`, { method: "POST" })
        .then(r => r.json())
        .then((data: { lat?: number | null; lng?: number | null }) => {
          if (data.lat && data.lng) {
            setGeocodedOverrides(prev => { const m = new Map(prev); m.set(a.id, { lat: data.lat!, lng: data.lng! }); return m; });
          } else {
            setNoLocationIds(prev => new Set(prev).add(a.id));
          }
        })
        .catch(() => setNoLocationIds(prev => new Set(prev).add(a.id)));
    }
  }, [localActivities, tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Time-aware sort key ───────────────────────────────────────────────────
  // Returns minutes-since-midnight for the item's effective time.
  // Structural anchors (arrival flights, check-in, check-out, departure flights)
  // use fixed virtual times so they remain stable at the boundaries of each day.
  // Activities and saves with an actual startTime sort by clock time.
  // Untimed activities default to 720 (noon) as a stable midday position.
  //
  //  FLIGHT arrival  →  arrivalTime or 0  (always first)
  //  LODGING check-out → departureTime (if set) or 50 (default anchor)
  //  timed activity   →  actual HH:MM in minutes
  //  untimed activity → 720  (noon)
  //  TRAIN            →  departureTime or 660  (11:00 default)
  //  LODGING check-in → 900  (15:00 default)
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
        // Check-out is a day-anchor event: user departs previous lodging first thing in the
        // morning before any activities. Fixed weight 50 keeps it at top-of-day regardless of
        // the actual departureTime clock value. Previously read departureTime ("11:00" -> 660),
        // which sorted between early-morning tour stops (e.g. 540) and midday ones (720),
        // fragmenting tour clusters. Applies to EMAIL_IMPORT and MANUAL rows equally.
        if (it.title.toLowerCase().includes("check-out")) return timeToMin(it.departureTime) ?? 50;
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
    // ManualActivity: use actual time if present, else semantic default based on title/type
    if (item.itemType === "activity" && item.activity) {
      const a = item.activity;
      if (a.time) return timeToMin(a.time) ?? 720;
      if (/hotel|hostel|resort|airbnb|inn|hyatt|hilton|marriott|sheraton|westin|check.?in/i.test(a.title)) return 900;
      return 720;
    }
    // Null-startTime items sort last (matches share view convergence per Disc 4.27).
    return timeToMin(item.startTime) ?? 9999;
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

    const sortedItems = [
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
    ...mergedItineraryItems.filter(it => it.dayIndex === targetDayIndex).map(it => ({
        sortId: `itinerary_${it.id}`,
        itemType: "itinerary" as const,
        sortOrder: it.sortOrder ?? 0,
        rawId: it.id,
        startTime: it.departureTime ?? null,
        lat: it.latitude ?? null,
        lng: it.longitude ?? null,
        itineraryItem: it,
      })),
    // Pre-sort: same-day LODGING check-in anchors to end of day; check-out anchors to start.
    // Only applies when sortOrder===0 (user hasn't manually reordered the item).
    // Primary sort: sortOrder (preserves manual drag-and-drop order).
    // Secondary: semantic time key so untimed items appear in correct clock position.
    // Tertiary: lodging semantic weight so CHECK_IN (20) always precedes CHECK_OUT (80)
    // when both items have the same explicit time.
    ].sort((a, b) => {
      const anchorWeight = (item: UnifiedDayItem): number => {
        if (item.itemType !== "itinerary") return 50;
        if (item.itineraryItem?.type !== "LODGING") return 50;
        if (item.itineraryItem.dayIndex !== targetDayIndex) return 50;
        if ((item.itineraryItem.sortOrder ?? 0) !== 0) return 50; // user reordered — let it ride
        const title = item.itineraryItem.title.toLowerCase();
        if (title.startsWith("check-in:")) return 1000; // force to end
        if (title.startsWith("check-out:")) {
          return item.itineraryItem?.departureTime ? 50 : -1000; // timed: sort by clock; untimed: anchor to top
        }
        return 50;
      };
      const aw = anchorWeight(a) - anchorWeight(b);
      if (aw !== 0) return aw;
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      const sk = toSortKey(a) - toSortKey(b);
      if (sk !== 0) return sk;
      const lodgingW = (item: UnifiedDayItem) =>
        item.itemType === "itinerary" && item.itineraryItem?.type === "LODGING"
          ? (item.itineraryItem.title.toLowerCase().includes("check-out") ? 80 : 20)
          : 50;
      return lodgingW(a) - lodgingW(b);
    });

    // Defense-in-depth tour cluster compaction (Discipline 4.10):
    // If a non-tour item's sortOrder lands between two same-tourId items after the
    // three-level sort (anchorWeight → sortOrder → toSortKey), the render loop's
    // isFirstInTourGroup check re-fires the cluster header, fragmenting the visual
    // group into two. This pass keeps every tourId cluster contiguous by emitting
    // all cluster members at the position of the FIRST cluster item encountered in
    // the sorted array. Preserves internal cluster order and non-tour item positions
    // at the cluster's outer boundary. Multiple tours on the same day are handled
    // independently via the emittedTourIds Set.
    const compactedItems: UnifiedDayItem[] = [];
    const emittedTourIds = new Set<string>();
    for (const item of sortedItems) {
      const tourId = item.itemType === "saved" ? (item.recAddition?.tourId ?? null) : null;
      if (tourId) {
        if (emittedTourIds.has(tourId)) continue; // already emitted in earlier cluster pass
        emittedTourIds.add(tourId);
        compactedItems.push(
          ...sortedItems.filter(x => x.itemType === "saved" && x.recAddition?.tourId === tourId)
        );
      } else {
        compactedItems.push(item);
      }
    }
    return compactedItems;
  }

  /** Build ordered map pins for a specific day, matching visual list order exactly. */
  function buildMapPinsForDay(dayIndex: number): { title: string; lat: number; lng: number; dayIndex: number }[] {
    function validCoord(lat: unknown, lng: unknown): boolean {
      return lat != null && lng != null &&
        typeof lat === "number" && typeof lng === "number" &&
        (lat as number) !== 0 && (lng as number) !== 0 &&
        (lat as number) >= -90 && (lat as number) <= 90 &&
        (lng as number) >= -180 && (lng as number) <= 180;
    }
    return buildDayItems(dayIndex).flatMap(item => {
      let title = "";
      let lat: number | null = null;
      let lng: number | null = null;
      if (item.itemType === "itinerary" && item.itineraryItem) {
        const it = item.itineraryItem;
        title = it.title;
        if (it.type === "FLIGHT") { lat = it.arrivalLat ?? null; lng = it.arrivalLng ?? null; }
        else { lat = it.latitude ?? null; lng = it.longitude ?? null; }
      } else if (item.itemType === "activity" && item.activity) {
        const a = item.activity;
        title = a.title;
        const override = geocodedOverrides.get(a.id);
        lat = override?.lat ?? a.lat ?? null;
        lng = override?.lng ?? a.lng ?? null;
      } else if (item.itemType === "flight" && item.flight) {
        const f = item.flight;
        title = f.toAirport ? `Flight to ${f.toAirport}` : "Flight";
        const coords = AIRPORT_COORDS[(f.toAirport ?? "").toUpperCase().trim()];
        lat = coords?.lat ?? null; lng = coords?.lng ?? null;
      } else if (item.itemType === "saved" && item.recAddition) {
        title = item.recAddition.title;
        lat = item.recAddition.lat ?? null;
        lng = item.recAddition.lng ?? null;
      }
      if (!validCoord(lat, lng)) return [];
      return [{ title, lat: lat!, lng: lng!, dayIndex }];
    });
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

    // Rule 4: airport departure buffer (3h international, 2h domestic)
    const depFlightsWithTime = itItems.filter(({ it, unified }) =>
      it.type === "FLIGHT" && (unified.sortOrder ?? 0) >= 85 && !!it.departureTime
    );
    for (const { it: depFlight } of depFlightsWithTime) {
      const depMin = timeToMinutes(depFlight.departureTime!);
      const fromCountry = depFlight.fromAirport ? AIRPORT_COUNTRY[depFlight.fromAirport.toUpperCase()] : undefined;
      const toCountry = depFlight.toAirport ? AIRPORT_COUNTRY[depFlight.toAirport.toUpperCase()] : undefined;
      const isDomestic = !!fromCountry && !!toCountry && fromCountry === toCountry;
      const requiredBuffer = isDomestic ? 120 : 180;
      const requiredHours = isDomestic ? 2 : 3;

      // Latest timed item on this day that comes before the flight and isn't itself a departure flight
      const priorTimes = items
        .filter(i => {
          if (!i.startTime) return false;
          if (timeToMinutes(i.startTime) >= depMin) return false;
          if (i.itemType === "itinerary" && i.itineraryItem?.type === "FLIGHT" && (i.sortOrder ?? 0) >= 85) return false;
          if (i.itemType === "flight") return false;
          return true;
        })
        .map(i => timeToMinutes(i.startTime!));

      if (priorTimes.length === 0) continue;
      const latestActivityMin = Math.max(...priorTimes);
      const gap = depMin - latestActivityMin;

      if (gap < requiredBuffer) {
        const route = depFlight.fromAirport && depFlight.toAirport
          ? `${depFlight.fromAirport}–${depFlight.toAirport}`
          : depFlight.fromAirport ?? depFlight.toAirport ?? "flight";
        warnings.push(
          `Allow at least ${requiredHours} hours to reach the airport for your ${route} flight at ${depFlight.departureTime}.`
        );
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
      .then(({ items }: { items: Array<{ id: string; rawTitle: string | null; rawDescription: string | null; placePhotoUrl?: string | null; mediaThumbnailUrl: string | null; destinationCity?: string | null; destinationCountry?: string | null; dayIndex: number | null; sortOrder?: number; lat?: number | null; lng?: number | null; isBooked?: boolean; startTime?: string | null; categoryTags?: string[]; tourId?: string | null }> }) => {
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
          tourId: item.tourId ?? null,
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

  function refreshItineraryItems() {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/itinerary-items`)
      .then(r => r.json())
      .then(({ items }: { items: ItineraryItemLocal[] }) => {
        if (Array.isArray(items)) setLocalItineraryItems(items);
      })
      .catch(() => {});
  }

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
        // LODGING render position is anchored semantically (check-out -1000 = day-start,
        // check-in +1000 = day-end). Auto-sort must not persist a sortOrder that overrides
        // the anchor invariant. User drag-reorders that deliberately set a non-zero sortOrder
        // on a LODGING item are still respected — only the automation path is blocked here.
        if (item.itineraryItem?.type === "LODGING") return;
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
    let rawMins: number;
    if (km < 1) {
      mode = "Walk";
      rawMins = km / 0.08;
    } else if (km <= 20) {
      mode = "Drive or transit";
      rawMins = km / 0.6;
    } else {
      mode = "Drive";
      rawMins = km / 0.6;
    }
    const mins = Math.round(rawMins / 5) * 5;
    let duration: string;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      duration = m === 0 ? `~${h} hr` : `~${h} hr ${m} min`;
    } else {
      duration = `~${mins} min`;
    }
    return {
      mode,
      duration,
      directionsUrl: getDirectionsUrl(lat1, lng1, lat2, lng2),
    };
  }

  /**
   * Computes layover/connection duration between two adjacent flight legs.
   * Returns formatted string like "3h 30m" or null if data is missing/invalid/> 24h.
   */
  function computeLayoverDuration(
    prevDate: string | null,
    prevArrivalTime: string | null,
    nextDate: string | null,
    nextDepartureTime: string | null,
  ): string | null {
    if (!prevArrivalTime || !nextDepartureTime || !prevDate || !nextDate) return null;
    const [prevH, prevM] = prevArrivalTime.split(":").map(Number);
    const [nextH, nextM] = nextDepartureTime.split(":").map(Number);
    if ([prevH, prevM, nextH, nextM].some(isNaN)) return null;
    const prevTotalMin = prevH * 60 + prevM;
    const nextTotalMin = nextH * 60 + nextM;
    const dayDiff = Math.round((new Date(nextDate).getTime() - new Date(prevDate).getTime()) / (1000 * 60 * 60 * 24));
    const diffMin = nextTotalMin + dayDiff * 1440 - prevTotalMin;
    if (diffMin < 0 || diffMin > 24 * 60) return null;
    const hours = Math.floor(diffMin / 60);
    const mins = Math.round(diffMin % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
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

      {/* Booking intelligence card — shown when trip is within 90 days and missing flights/hotel */}
      {tripId && (
        <BookingIntelCard
          tripId={tripId}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          startDate={tripStartDate}
          endDate={tripEndDate}
          onAddFlight={onAddFlight}
          onManageTours={onManageTours}
        />
      )}

      {/* Unified budget panel */}
      <BudgetPanel
        tripId={tripId}
        destinationCity={destinationCity}
        destinationCountry={destinationCountry}
        budgetTotal={budgetTotal}
        budgetCurrency={budgetCurrency}
        trackedTotal={trackedTotal}
        loaded={budgetLoaded}
        onBudgetChange={onBudgetChange}
      />

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
                savedItems={openDay >= 0 ? [] : recAdditions.filter(a => a.lat != null && a.lng != null) as { title: string; lat: number; lng: number; dayIndex?: number | null }[]}
                activities={openDay >= 0 ? buildMapPinsForDay(openDay) : localActivities.filter(a => a.lat != null && a.lng != null).map(a => ({ title: a.title, lat: a.lat!, lng: a.lng!, dayIndex: a.dayIndex }))}
                importedBookingPins={openDay >= 0 ? [] : [...localItineraryItems]
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
                              {(() => {
                                // "From [hotel] · Directions →" above the first item with coords
                                const isVTCq = (lat: number | null | undefined, lng: number | null | undefined) =>
                                  lat != null && lng != null && lat !== 0 && lng !== 0 &&
                                  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
                                const activeLodging = localItineraryItems
                                  .filter(it => it.type === "LODGING" && /^check-in:/i.test(it.title) &&
                                    it.dayIndex != null && it.dayIndex < dayIndex &&
                                    isVTCq(it.latitude, it.longitude))
                                  .sort((a, b) => (b.dayIndex ?? 0) - (a.dayIndex ?? 0))[0] ?? null;
                                if (!activeLodging) return null;
                                const firstWithCoords = allDayItems.find(it =>
                                  isVTCq(it.lat, it.lng) &&
                                  !(it.itemType === "itinerary" && it.itineraryItem?.type === "LODGING" && /^check-out:/i.test(it.itineraryItem?.title ?? ""))
                                );
                                if (!firstWithCoords?.lat || !firstWithCoords?.lng) return null;

                                // Suppress "From [hotel] · Directions →" when the first item of the day is a FLIGHT
                                // departing from a different city than the trip's destination. Prevents nonsensical
                                // directions like "From London hotel → HND→SIN" when the user is in Tokyo, or
                                // "From London hotel → CMB→LHR" when the user is in Colombo. Only show when the
                                // flight departs from the same city (local airport transfer, e.g. hotel → KIX).
                                const firstDayItItem = firstWithCoords.itineraryItem;
                                if (firstDayItItem?.type === "FLIGHT") {
                                  const flightFromCity = (firstDayItItem.fromCity ?? "").trim().toLowerCase();
                                  const tripDestCity = (destinationCity ?? "").trim().toLowerCase();
                                  if (!flightFromCity || !tripDestCity || flightFromCity !== tripDestCity) {
                                    return null;
                                  }
                                }

                                const hotelName = activeLodging.title.replace(/^check-in:\s*/i, "");
                                const directionsUrl = getDirectionsUrl(activeLodging.latitude!, activeLodging.longitude!, firstWithCoords.lat, firstWithCoords.lng);
                                return (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 28px 8px", marginBottom: "2px" }}>
                                    <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                    <span style={{ fontSize: "11px", color: "#888", whiteSpace: "nowrap" }}>From {hotelName}</span>
                                    <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                                      Directions →
                                    </a>
                                    <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                  </div>
                                );
                              })()}
                              {allDayItems.flatMap((item, idx) => {
                                const next = allDayItems[idx + 1];

                                // Transit: use arrival coords for TRAIN/FLIGHT preceding items.
                                // No startTime requirement — any two consecutive items with valid coords within 50km show transit.
                                const isVTC = (lat: number | null | undefined, lng: number | null | undefined) =>
                                  lat != null && lng != null && typeof lat === "number" && typeof lng === "number" &&
                                  lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
                                // Extract coords from any UnifiedDayItem regardless of item type
                                const getCoords = (i: UnifiedDayItem): { lat: number; lng: number } | null => {
                                  if (isVTC(i.lat, i.lng)) return { lat: i.lat!, lng: i.lng! };
                                  return null;
                                };
                                const prevIt = item.itineraryItem;
                                // For TRAIN/FLIGHT preceding items, use arrival coords as the starting point.
                                // For FLIGHT with null arrivalLat/Lng (e.g. repair-inserted items), fall back to AIRPORT_COORDS[toAirport].
                                const flightArrivalFallback = (prevIt?.type === "FLIGHT" && prevIt.toAirport)
                                  ? AIRPORT_COORDS[prevIt.toAirport.toUpperCase().trim()] ?? null
                                  : null;
                                const fromCoords = (prevIt && (prevIt.type === "TRAIN" || prevIt.type === "FLIGHT") && isVTC(prevIt.arrivalLat, prevIt.arrivalLng))
                                  ? { lat: prevIt.arrivalLat!, lng: prevIt.arrivalLng! }
                                  : (flightArrivalFallback ?? getCoords(item));
                                // For FLIGHT next items, use departure airport coords
                                const nextItItem = next?.itineraryItem;
                                const nextFlightItem = next?.flight;
                                const nextFromAirport = (nextItItem?.type === "FLIGHT" ? nextItItem.fromAirport : nextFlightItem?.fromAirport)?.toUpperCase().trim() ?? "";
                                const depCoords = nextFromAirport ? AIRPORT_COORDS[nextFromAirport] : null;
                                const toCoords = depCoords ? { lat: depCoords.lat, lng: depCoords.lng } : (next ? getCoords(next) : null);

                                const prevHasCoords = fromCoords != null;
                                const nextHasCoords = toCoords != null;

                                const prevItem = idx > 0 ? allDayItems[idx - 1] : null;
                                const isFirstInTourGroup =
                                  item.itemType === "saved" &&
                                  item.recAddition?.tourId != null &&
                                  item.recAddition.tourId !== (prevItem?.recAddition?.tourId ?? null);

                                return [
                                ...(isFirstInTourGroup ? [(() => {
                                  const tId = item.recAddition!.tourId!;
                                  const tourStopCount = allDayItems.filter(
                                    di => di.itemType === "saved" && di.recAddition?.tourId === tId
                                  ).length;
                                  return (
                                    <div key={`tour-header-${tId}`} style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "8px 0 4px",
                                      borderTop: "1px solid rgba(196,102,74,0.2)",
                                      marginTop: "4px",
                                    }}>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        Tour · {tourStopCount} {tourStopCount === 1 ? "stop" : "stops"}
                                      </span>
                                      <button
                                        onClick={async () => {
                                          const res = await fetch(`/api/trips/${tripId}/tours`);
                                          const d = await res.json() as { tours?: Array<{ id: string; title: string; stopCount: number; days: number[] }> };
                                          const found = (d.tours ?? []).find(t => t.id === tId);
                                          if (found) {
                                            setTourCancelTarget({ tourId: found.id, title: found.title, stopCount: found.stopCount, days: found.days });
                                          }
                                        }}
                                        style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                                      >
                                        Cancel tour
                                      </button>
                                    </div>
                                  );
                                })()]: []),
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
                                              <span style={{ fontSize: "12px", fontWeight: 800, color: "#C4664A" }}>{(() => {
                                                const tId = item.recAddition?.tourId;
                                                if (!tId) return idx + 1;
                                                return allDayItems
                                                  .filter(x => x.itemType === "saved" && x.recAddition?.tourId === tId)
                                                  .indexOf(item) + 1;
                                              })()}</span>
                                            </div>
                                            {a.img && (
                                              <div style={{ width: "52px", height: "52px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${a.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{a.title}</p>
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
                                              {a.savedItemId && cardActionRow({
                                                shareEntityType: "saved_item",
                                                shareEntityId: a.savedItemId,
                                                shareTitle: a.title,
                                                onEdit: async () => {
                                                  const isLodging = /lodging|accommodation|hotel|airbnb|hostel/i.test((a.categoryTags ?? []).join(" "));
                                                  try {
                                                    const res = await fetch(`/api/saves/${a.savedItemId}`);
                                                    const data = await res.json() as { item: { rawTitle: string | null; extractedCheckin: string | null; extractedCheckout: string | null; websiteUrl: string | null; notes: string | null } };
                                                    const it = data.item;
                                                    if (isLodging) {
                                                      setEditingLodging({ id: a.savedItemId!, rawTitle: it.rawTitle ?? a.title, extractedCheckin: it.extractedCheckin ?? "", extractedCheckout: it.extractedCheckout ?? "", websiteUrl: it.websiteUrl ?? "", notes: it.notes ?? "" });
                                                    } else {
                                                      let actDate = "";
                                                      if (tripStartDate && a.dayIndex != null) {
                                                        try {
                                                          const s = new Date(tripStartDate + "T12:00:00");
                                                          s.setDate(s.getDate() + a.dayIndex);
                                                          actDate = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
                                                        } catch { /* ignore */ }
                                                      }
                                                      onEditSavedActivity?.({ id: a.savedItemId!, title: it.rawTitle ?? a.title, date: actDate, time: null, endTime: null, venueName: null, address: null, website: it.websiteUrl ?? null, price: null, currency: null, notes: it.notes ?? null, status: "interested", confirmationCode: null, lat: a.lat ?? null, lng: a.lng ?? null });
                                                    }
                                                  } catch { /* ignore */ }
                                                },
                                                onRemove: async () => {
                                                  if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
                                                  await fetch(`/api/saves/${a.savedItemId}`, { method: "DELETE" });
                                                  setRecAdditions(prev => prev.filter(r => r.savedItemId !== a.savedItemId));
                                                },
                                                removeLabel: "Delete",
                                              })}
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
                                        const handleActivityClick = () => {
                                          if (a.savedItemId) {
                                            setDetailItemId(a.savedItemId);
                                          } else {
                                            setDetailActivity(a);
                                          }
                                        };
                                        return (
                                          <div onClick={handleActivityClick} style={{ flex: 1, display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "rgba(107,143,113,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <Compass size={12} style={{ color: "#6B8F71" }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{a.title}</p>
                                              {(a.time || a.venueName) && (
                                                <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4 }}>{a.time ?? ""}{a.endTime ? ` – ${a.endTime}` : ""}{a.venueName ? ` · ${a.venueName}` : ""}</p>
                                              )}
                                              {a.website && (
                                                <a href={a.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#C4664A", fontWeight: 600, textDecoration: "none", marginTop: "3px" }}>
                                                  {/ticket|concert|game|sport|baseball|soccer|football|theater|theatre|show|stadium|arena/i.test(a.title) ? "Book tickets →" : "Link →"}
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
                                              {noLocationIds.has(a.id) && (
                                                <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "4px" }}>No location — add an address to show on map</p>
                                              )}
                                              {cardActionRow({
                                                shareEntityType: "manual_activity",
                                                shareEntityId: a.id,
                                                shareTitle: a.title,
                                                onRemove: onDeleteActivity ? () => { if (window.confirm("Delete this activity permanently?")) onDeleteActivity(a.id); } : null,
                                                removeLabel: "Delete",
                                              })}
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
                                          const depTime = formatTime(it.departureTime) ?? it.departureTime;
                                          const arrTime = it.arrivalTime ? (formatTime(it.arrivalTime) ?? it.arrivalTime) : null;
                                          const paxLabel = it.passengers.length > 0
                                            ? it.passengers.length <= 2
                                              ? it.passengers.join(", ")
                                              : `${it.passengers.length} passengers`
                                            : null;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
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
                                                  </div>
                                                </div>
                                              </div>
                                              {cardActionRow({
                                                shareEntityType: "itinerary_item",
                                                shareEntityId: it.id,
                                                shareTitle: route,
                                                onEdit: matchFlight ? () => setEditingFlight(matchFlight) : null,
                                                onRemove: () => { if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); },
                                              })}
                                            </div>
                                          );
                                        }

                                        // ── LODGING ──────────────────────────────────────────────────────
                                        if (it.type === "LODGING") {
                                          const isCheckOut = /^check-out:/i.test(it.title);
                                          const hotelName = it.title.replace(/^check-in:\s*/i, "").replace(/^check-out:\s*/i, "");
                                          const dateLabel = isCheckOut ? "Check-out" : "Check-in";
                                          const dateFormatted = formatDateShort(it.scheduledDate);
                                          const lodgingTime = formatTime(isCheckOut ? it.departureTime : it.arrivalTime);
                                          const costLabel = it.totalCost != null ? `${it.currency ?? ""} ${it.totalCost.toLocaleString()}`.trim() : null;
                                          const lodgStatus = (it.status ?? "BOOKED").toUpperCase();
                                          const lodgStatusColor = lodgStatus === "INTERESTED" ? "#1B3A5C" : lodgStatus === "CONFIRMED" ? "#C4664A" : "#4a7c59";
                                          const lodgStatusBg = lodgStatus === "INTERESTED" ? "rgba(27,58,92,0.08)" : lodgStatus === "CONFIRMED" ? "rgba(196,102,74,0.1)" : "rgba(74,124,89,0.1)";
                                          const lodgStatusLabel = lodgStatus === "INTERESTED" ? "Interested" : lodgStatus === "CONFIRMED" ? "Confirmed" : "Booked";
                                          const lodgingStatusBadge = <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: lodgStatusBg, color: lodgStatusColor, borderRadius: "999px", padding: "2px 8px" }}>{lodgStatusLabel}</span>;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                                <ItemImageTile src={it.imageUrl} title={it.title} variant="card" />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{hotelName}</p>
                                                  {dateFormatted && (
                                                    <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>
                                                      {dateLabel} · {dateFormatted}{lodgingTime ? ` · ${lodgingTime}` : ""}
                                                    </p>
                                                  )}
                                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                    {lodgingStatusBadge}
                                                    {(it.confirmationCode || it.additionalConfirmations?.length) && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {[it.confirmationCode, ...(it.additionalConfirmations ?? [])].filter(Boolean).join(" · ")}</span>}
                                                    {costLabel && <span style={{ fontSize: "11px", color: "#999" }}>{costLabel}</span>}
                                                  </div>
                                                </div>
                                              </div>
                                              {cardActionRow({
                                                shareEntityType: "itinerary_item",
                                                shareEntityId: it.id,
                                                shareTitle: hotelName,
                                                onEdit: () => setSelectedItineraryItem(it),
                                                onRemove: () => { if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); },
                                              })}
                                            </div>
                                          );
                                        }

                                        // ── TRAIN ────────────────────────────────────────────────────────
                                        if (it.type === "TRAIN") {
                                          const trainRoute = it.fromCity && it.toCity ? `${it.fromCity} → ${it.toCity}` : it.title;
                                          const operator = it.fromCity && it.toCity && it.title !== trainRoute ? it.title : null;
                                          const depTime = formatTime(it.departureTime) ?? it.departureTime;
                                          const arrTime = it.arrivalTime ? (formatTime(it.arrivalTime) ?? it.arrivalTime) : null;
                                          return (
                                            <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedItineraryItem(it)}>
                                              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
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
                                                  </div>
                                                </div>
                                              </div>
                                              {cardActionRow({
                                                shareEntityType: "itinerary_item",
                                                shareEntityId: it.id,
                                                shareTitle: trainRoute,
                                                onEdit: () => setSelectedItineraryItem(it),
                                                onRemove: () => { if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); },
                                              })}
                                            </div>
                                          );
                                        }

                                        // ── OTHER (ACTIVITY, RESTAURANT, CAR_RENTAL, etc.) ───────────────
                                        const typeLabel = it.type.charAt(0) + it.type.slice(1).toLowerCase().replace(/_/g, " ");
                                        const isActivity = it.type === "ACTIVITY";
                                        return (
                                          <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => { if (it.type === "ACTIVITY") setEditActivityTitle(it.title ?? ""); setSelectedItineraryItem(it); }}>
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                              <ItemImageTile src={it.imageUrl} title={it.title} variant="card" />
                                              <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: "2px" }}>{it.title}</p>
                                                {it.notes && <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.4, marginBottom: "6px" }}>{it.notes}</p>}
                                                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                  {bookedBadge}
                                                  {!isActivity && <span style={{ fontSize: "11px", color: "#999" }}>{typeLabel}</span>}
                                                  {it.confirmationCode && <span style={{ fontSize: "11px", color: "#999" }}>Conf: {it.confirmationCode}</span>}
                                                  {it.totalCost != null && <span style={{ fontSize: "11px", color: "#999" }}>{it.currency ?? ""} {it.totalCost.toLocaleString()}</span>}
                                                </div>
                                              </div>
                                            </div>
                                            {cardActionRow({
                                              shareEntityType: "itinerary_item",
                                              shareEntityId: it.id,
                                              shareTitle: it.title,
                                              onEdit: () => { if (it.type === "ACTIVITY") setEditActivityTitle(it.title ?? ""); setSelectedItineraryItem(it); },
                                              onRemove: () => { if (window.confirm("Remove this booking from your itinerary?")) handleDeleteBookingItem(it.id); },
                                            })}
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
                                prevHasCoords && nextHasCoords ? (
                                  (() => {
                                    const prevIsFlightType = prevIt?.type === "FLIGHT";
                                    const nextIsFlightType = nextItItem?.type === "FLIGHT";

                                    // Between two adjacent flight legs: show layover/connection instead of drive/walk
                                    if (prevIsFlightType && nextIsFlightType) {
                                      const sameBooking = !!prevIt?.confirmationCode && prevIt.confirmationCode === nextItItem?.confirmationCode;
                                      const layoverLabel = sameBooking ? "Layover" : "Connection";
                                      const layoverDuration = computeLayoverDuration(
                                        prevIt?.scheduledDate ?? null,
                                        prevIt?.arrivalTime ?? null,
                                        nextItItem?.scheduledDate ?? null,
                                        nextItItem?.departureTime ?? null,
                                      );
                                      if (!layoverDuration) return null;
                                      return (
                                        <div key={`transit_${idx}`} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 28px 6px", marginBottom: "2px" }}>
                                          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                          <span style={{ fontSize: "11px", color: "#888", whiteSpace: "nowrap" }}>
                                            {layoverLabel} · {layoverDuration}
                                          </span>
                                          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(0,0,0,0.06)" }} />
                                        </div>
                                      );
                                    }

                                    const transit = computeTransit(fromCoords!.lat, fromCoords!.lng, toCoords!.lat, toCoords!.lng);
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
                              setAddToTripDefaultDate(defaultDate);
                              setShowAddToTripModal(true);
                            }}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px", marginTop: "4px", border: "1.5px dashed rgba(196,102,74,0.35)", borderRadius: "10px", background: "none", cursor: "pointer", color: "#C4664A", fontSize: "13px", fontWeight: 600 }}
                          >
                            <Plus size={14} />
                            Add to day
                          </button>

                          {/* Per-day notes */}
                          <div style={{ marginTop: "10px" }}>
                            {dayNotesList
                              .filter(n => n.dayIndex === i)
                              .map(note => (
                                <div key={note.id} style={{ marginBottom: "8px", position: "relative" }}>
                                  <NoteEditor
                                    key={note.id}
                                    initialContent={note.content}
                                    onSave={(content) => handleSaveDayNote(note.id, content)}
                                    placeholder="Notes for this day..."
                                    autoFocus={note.id === newlyCreatedDayNoteId}
                                  />
                                  <button
                                    onClick={() => handleDeleteDayNote(note.id)}
                                    title="Delete note"
                                    style={{
                                      position: "absolute",
                                      top: "6px",
                                      right: "6px",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#D0D0D0",
                                      padding: "2px",
                                      lineHeight: 1,
                                      zIndex: 1,
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            <button
                              onClick={() => handleAddDayNote(i)}
                              disabled={addingNoteForDay === i}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                padding: "8px",
                                marginTop: dayNotesList.filter(n => n.dayIndex === i).length > 0 ? "4px" : "0",
                                border: "1px dashed rgba(196,102,74,0.35)",
                                borderRadius: "8px",
                                background: "none",
                                cursor: addingNoteForDay === i ? "default" : "pointer",
                                color: "#C4664A",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              <Plus size={12} />
                              Add note for Day {i + 1}
                            </button>
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
            savedItems={openDay >= 0 ? [] : recAdditions.filter(a => a.lat != null && a.lng != null) as { title: string; lat: number; lng: number; dayIndex?: number | null }[]}
            activities={openDay >= 0 ? buildMapPinsForDay(openDay) : localActivities.filter(a => a.lat != null && a.lng != null).map(a => ({ title: a.title, lat: a.lat!, lng: a.lng!, dayIndex: a.dayIndex }))}
            importedBookingPins={openDay >= 0 ? [] : [...localItineraryItems]
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
          onDelete={onDeleteActivity ? () => { setDetailActivity(null); onDeleteActivity(detailActivity.id); } : undefined}
          onMarkBooked={onMarkActivityBooked ? () => { setDetailActivity(null); onMarkActivityBooked(detailActivity.id); } : undefined}
        />
      )}
      {showAddToTripModal && tripId && (
        <AddToTripModal
          tripId={tripId}
          defaultDate={addToTripDefaultDate}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          onClose={() => { setShowAddToTripModal(false); setAddToTripDefaultDate(undefined); }}
          onSaved={(saved) => {
            setShowAddToTripModal(false);
            setAddToTripDefaultDate(undefined);
            const result = saved as { checkIn?: { id: string; dayIndex: number | null } } | { time?: string | null; dayIndex?: number | null };
            if ("checkIn" in result && result.checkIn) {
              // LODGING created — refresh ItineraryItems
              refreshItineraryItems();
            } else {
              // Activity created — queue auto-sort if timed
              const act = result as { time?: string | null; dayIndex?: number | null };
              if (act?.time && act?.dayIndex != null) {
                pendingAutoSortDayRef.current = act.dayIndex;
              }
              onActivityAdded?.();
            }
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
          className={MODAL_OVERLAY_CLASSES}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`}
            style={{ padding: "24px 20px 40px" }}
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
            className={MODAL_OVERLAY_CLASSES}
            onClick={() => { setSelectedItineraryItem(null); setEditingItinFields(false); }}
          >
            <div
              className="w-full sm:w-[440px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto pb-safe sm:pb-0"
              style={{ padding: "24px" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>{typeLabel}</span>
                <button onClick={() => { setSelectedItineraryItem(null); setEditingItinFields(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#AAAAAA" }}>
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
                      {sit.departureTime && <><span style={lblStyle}>Departs</span><span style={rowStyle}>{formatTime(sit.departureTime) || sit.departureTime}</span></>}
                      {sit.arrivalTime && <><span style={lblStyle}>Arrives</span><span style={rowStyle}>{formatTime(sit.arrivalTime) || sit.arrivalTime}</span></>}
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
                const itEditInputStyle: React.CSSProperties = { width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
                if (editingItinFields) return (
                  <div>
                    <p style={{ ...titleStyle, marginBottom: "20px" }}>{hotelName}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>{isCheckOut ? "Check-out time" : "Check-in time"}</label>
                        <input type="time" value={editItTime} onChange={e => setEditItTime(e.target.value)} style={itEditInputStyle} />
                      </div>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>Date</label>
                        <input type="date" value={editItDate} onChange={e => setEditItDate(e.target.value)} style={itEditInputStyle} />
                      </div>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>Notes</label>
                        <textarea value={editItNotes} onChange={e => setEditItNotes(e.target.value)} rows={3} placeholder="Any notes..." style={{ ...itEditInputStyle, resize: "none" }} />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setEditItSaving(true);
                        try {
                          const res = await fetch(`/api/trips/${tripId}/itinerary/${sit.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ [isCheckOut ? "departureTime" : "arrivalTime"]: editItTime || null, scheduledDate: editItDate || null, notes: editItNotes || null }),
                          });
                          const d = await res.json();
                          if (res.ok && d.item) {
                            setLocalItineraryItems(prev => prev.map(i => i.id === sit.id ? { ...i, ...d.item } : i));
                          }
                          setSelectedItineraryItem(null);
                          setEditingItinFields(false);
                        } catch { /* ignore */ } finally { setEditItSaving(false); }
                      }}
                      style={{ display: "block", width: "100%", marginTop: "16px", padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: editItSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editItSaving ? 0.7 : 1 }}
                    >
                      {editItSaving ? "Saving..." : "Save changes"}
                    </button>
                    <button onClick={() => setEditingItinFields(false)} style={{ display: "block", width: "100%", marginTop: "10px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", textAlign: "center", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                  </div>
                );
                return (
                  <div>
                    <div style={{ marginBottom: "16px" }}><ItemImageTile src={sit.imageUrl} title={sit.title} variant="modal" /></div>
                    <p style={titleStyle}>{hotelName}</p>
                    <div style={gridStyle}>
                      <span style={lblStyle}>{isCheckOut ? "Check-out" : "Check-in"}</span>
                      <span style={rowStyle}>{fmtDateModal(sit.scheduledDate) ?? "—"}</span>
                      {!isCheckOut && sit.arrivalTime && <><span style={lblStyle}>Check-in time</span><span style={rowStyle}>{formatTime(sit.arrivalTime) || sit.arrivalTime}</span></>}
                      {isCheckOut && sit.departureTime && <><span style={lblStyle}>Check-out time</span><span style={rowStyle}>{formatTime(sit.departureTime) || sit.departureTime}</span></>}
                      {sit.address && <><span style={lblStyle}>Address</span><span style={rowStyle}>{sit.address}</span></>}
                      {(sit.confirmationCode || sit.additionalConfirmations?.length) && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{[sit.confirmationCode, ...(sit.additionalConfirmations ?? [])].filter(Boolean).join(" · ")}</span></>}
                      {costLabel && <><span style={lblStyle}>Total</span><span style={rowStyle}>{costLabel}</span></>}
                      {guestsLabel && <><span style={lblStyle}>Guests</span><span style={rowStyle}>{guestsLabel}</span></>}
                      {sit.bookingSource && sit.bookingSource !== "unknown" && (() => {
                        const SRC_LABEL: Record<string, string> = { "booking.com": "Booking.com", airbnb: "Airbnb", "hotels.com": "Hotels.com", expedia: "Expedia", marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", vrbo: "VRBO", direct: "Direct" };
                        return <><span style={lblStyle}>Booked via</span><span style={rowStyle}>{SRC_LABEL[sit.bookingSource] ?? sit.bookingSource}</span></>;
                      })()}
                      <span style={lblStyle}>Type</span>
                      <span style={rowStyle}>
                        <select
                          value={sit.lodgingType ?? ""}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            setSelectedItineraryItem(prev => prev ? { ...prev, lodgingType: val } : null);
                            setLocalItineraryItems(prev => prev.map(it => it.id === sit.id ? { ...it, lodgingType: val } : it));
                            await fetch(`/api/trips/${tripId}/itinerary/${sit.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ lodgingType: val }),
                            });
                          }}
                          style={{ fontSize: "13px", color: sit.lodgingType ? "#1B3A5C" : "#888", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", outline: "none" }}
                        >
                          <option value="">Select type…</option>
                          {LODGING_TYPE_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </span>
                      {sit.status && sit.status.toUpperCase() !== "BOOKED" && (() => {
                        const s = sit.status.toUpperCase();
                        const c = s === "INTERESTED" ? "#1B3A5C" : "#C4664A";
                        const label = s === "INTERESTED" ? "Interested" : "Confirmed";
                        return <><span style={lblStyle}>Status</span><span style={{ ...rowStyle, fontWeight: 700, color: c }}>{label}</span></>;
                      })()}
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
                    {sit.managementUrl && (
                      <a
                        href={sit.managementUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textAlign: "center", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid #C4664A", fontWeight: 600, padding: "12px", borderRadius: "10px", fontSize: "14px", textDecoration: "none", marginTop: "8px" }}
                      >
                        Manage booking
                      </a>
                    )}
                    <button
                      onClick={() => { setEditItTime(isCheckOut ? (sit.departureTime ?? "") : (sit.arrivalTime ?? "")); setEditItDate(sit.scheduledDate ?? ""); setEditItNotes(sit.notes ?? ""); setEditingItinFields(true); }}
                      style={{ display: "block", width: "100%", marginTop: "8px", padding: "12px", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid #C4664A", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        const result = await shareEntity({ entityType: "itinerary_item", entityId: sit.id });
                        if (result.ok) { if (shareToastTimer.current) clearTimeout(shareToastTimer.current); setShareToast(true); shareToastTimer.current = setTimeout(() => setShareToast(false), 2000); setSelectedItineraryItem(null); }
                      }}
                      style={{ display: "block", width: "100%", marginTop: "8px", padding: "12px", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid rgba(196,102,74,0.4)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Share
                    </button>
                    <button
                      onClick={() => setBookingCancelTarget(sit)}
                      style={{ display: "block", width: "100%", marginTop: "8px", padding: "12px", backgroundColor: "transparent", color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: "10px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel Booking
                    </button>
                  </div>
                );
              })()}

              {sit.type === "TRAIN" && (() => {
                const trainRoute = sit.fromCity && sit.toCity ? `${sit.fromCity} → ${sit.toCity}` : sit.title;
                const operator = sit.fromCity && sit.toCity && sit.title !== trainRoute ? sit.title : null;
                const itEditInputStyle: React.CSSProperties = { width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
                if (editingItinFields) return (
                  <div>
                    <p style={{ ...titleStyle, marginBottom: "20px" }}>{trainRoute}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>Departure time</label>
                        <input type="time" value={editItTime} onChange={e => setEditItTime(e.target.value)} style={itEditInputStyle} />
                      </div>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>Date</label>
                        <input type="date" value={editItDate} onChange={e => setEditItDate(e.target.value)} style={itEditInputStyle} />
                      </div>
                      <div>
                        <label style={{ ...lblStyle, display: "block", marginBottom: "6px" }}>Notes</label>
                        <textarea value={editItNotes} onChange={e => setEditItNotes(e.target.value)} rows={3} placeholder="Any notes..." style={{ ...itEditInputStyle, resize: "none" }} />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setEditItSaving(true);
                        try {
                          const res = await fetch(`/api/trips/${tripId}/itinerary/${sit.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ departureTime: editItTime || null, scheduledDate: editItDate || null, notes: editItNotes || null }),
                          });
                          const d = await res.json();
                          if (res.ok && d.item) {
                            setLocalItineraryItems(prev => prev.map(i => i.id === sit.id ? { ...i, ...d.item } : i));
                          }
                          setSelectedItineraryItem(null);
                          setEditingItinFields(false);
                        } catch { /* ignore */ } finally { setEditItSaving(false); }
                      }}
                      style={{ display: "block", width: "100%", marginTop: "16px", padding: "12px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: editItSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editItSaving ? 0.7 : 1 }}
                    >
                      {editItSaving ? "Saving..." : "Save changes"}
                    </button>
                    <button onClick={() => setEditingItinFields(false)} style={{ display: "block", width: "100%", marginTop: "10px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", textAlign: "center", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                  </div>
                );
                return (
                  <div>
                    <p style={titleStyle}>{trainRoute}</p>
                    <div style={gridStyle}>
                      {operator && <><span style={lblStyle}>Operator</span><span style={rowStyle}>{operator}</span></>}
                      {sit.scheduledDate && <><span style={lblStyle}>Date</span><span style={rowStyle}>{fmtDateModal(sit.scheduledDate)}</span></>}
                      {sit.departureTime && <><span style={lblStyle}>Departs</span><span style={rowStyle}>{formatTime(sit.departureTime) || sit.departureTime}</span></>}
                      {sit.arrivalTime && <><span style={lblStyle}>Arrives</span><span style={rowStyle}>{formatTime(sit.arrivalTime) || sit.arrivalTime}</span></>}
                      {sit.confirmationCode && <><span style={lblStyle}>Confirmation</span><span style={{ ...rowStyle, fontWeight: 700 }}>{sit.confirmationCode}</span></>}
                    </div>
                    <button
                      onClick={() => { setEditItTime(sit.departureTime ?? ""); setEditItDate(sit.scheduledDate ?? ""); setEditItNotes(sit.notes ?? ""); setEditingItinFields(true); }}
                      style={{ display: "block", width: "100%", marginTop: "8px", padding: "12px", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid #C4664A", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Edit
                    </button>
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
                    <div style={{ marginBottom: "16px" }}><ItemImageTile src={sit.imageUrl} title={sit.title} variant="modal" /></div>
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
                      {sit.departureTime && <><span style={lblStyle}>Time</span><span style={rowStyle}>{formatTime(sit.departureTime) || sit.departureTime}</span></>}
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
                    <button
                      onClick={async () => {
                        const result = await shareEntity({ entityType: "itinerary_item", entityId: sit.id });
                        if (result.ok) { if (shareToastTimer.current) clearTimeout(shareToastTimer.current); setShareToast(true); shareToastTimer.current = setTimeout(() => setShareToast(false), 2000); setSelectedItineraryItem(null); }
                      }}
                      style={{ display: "block", width: "100%", marginTop: "8px", padding: "12px", backgroundColor: "transparent", color: "#C4664A", border: "1.5px solid rgba(196,102,74,0.4)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Share
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
      {shareToast && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none" }}>
          Link copied
        </div>
      )}

      {tourCancelTarget && (
        <div className={MODAL_OVERLAY_CLASSES} onClick={() => !tourCancelling && setTourCancelTarget(null)}>
          <div className={MODAL_PANEL_CLASSES} style={{ padding: "28px 24px 40px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", fontFamily: "var(--font-playfair, serif)", margin: "0 0 12px" }}>
              Are you Flokkin&apos; sure?
            </p>
            <p style={{ fontSize: "14px", color: "#4B5563", lineHeight: 1.6, margin: "0 0 24px" }}>
              This will remove all {tourCancelTarget.stopCount} {tourCancelTarget.stopCount === 1 ? "stop" : "stops"} of the{" "}
              <strong>{tourCancelTarget.title}</strong>
              {tourCancelTarget.days.length > 0 && ` from Day${tourCancelTarget.days.length > 1 ? "s" : ""} ${tourCancelTarget.days.map(d => d + 1).join(", ")}`}.
              The tour stays in your library — you can save it to your trip again later.
            </p>
            <button
              onClick={async () => {
                setTourCancelling(true);
                try {
                  await fetch(`/api/tours/${tourCancelTarget.tourId}/unlink-from-trip`, { method: "DELETE" });
                  setRecAdditions(prev => prev.filter(r => r.tourId !== tourCancelTarget.tourId));
                  setTourCancelTarget(null);
                } catch { /* non-fatal */ } finally {
                  setTourCancelling(false);
                }
              }}
              disabled={tourCancelling}
              style={{ width: "100%", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px", opacity: tourCancelling ? 0.6 : 1 }}
            >
              {tourCancelling ? "Removing..." : "Yes, cancel tour"}
            </button>
            <button
              onClick={() => setTourCancelTarget(null)}
              disabled={tourCancelling}
              style={{ width: "100%", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {bookingCancelTarget && (() => {
        const bc = bookingCancelTarget;
        const hotelName = bc.title.replace(/^check-(?:in|out):\s*/i, "").trim();
        const SRC_LABEL: Record<string, string> = {
          "booking.com": "Booking.com", airbnb: "Airbnb", hilton: "Hilton", hyatt: "Hyatt",
          marriott: "Marriott", "hotels.com": "Hotels.com", expedia: "Expedia", vrbo: "VRBO",
        };
        const platformName = bc.bookingSource ? (SRC_LABEL[bc.bookingSource] ?? null) : null;
        const hasMgmtUrl = !!bc.managementUrl;
        const mailtoSubject = encodeURIComponent(
          `Cancellation Request — ${hotelName}${bc.confirmationCode ? ` (${bc.confirmationCode})` : ""}`
        );
        const mailtoBody = encodeURIComponent(
          `Dear ${hotelName} team,\n\nI would like to cancel my reservation` +
          (bc.confirmationCode ? ` (Confirmation: ${bc.confirmationCode})` : "") + ".\n\n" +
          (bc.scheduledDate ? `Date: ${bc.scheduledDate}\n` : "") +
          (bc.passengers?.length ? `Guests: ${bc.passengers.join(", ")}\n` : "") +
          "\nPlease confirm the cancellation at your earliest convenience.\n\nThank you"
        );
        return (
          <div className={MODAL_OVERLAY_CLASSES} onClick={() => !bookingCancelling && setBookingCancelTarget(null)}>
            <div className={MODAL_PANEL_CLASSES} style={{ padding: "28px 24px 40px" }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", fontFamily: "var(--font-playfair, serif)", margin: "0 0 6px" }}>
                Cancel Booking
              </p>
              <p style={{ fontSize: "14px", color: "#4B5563", margin: "0 0 20px" }}>
                {hotelName}{bc.confirmationCode ? ` · ${bc.confirmationCode}` : ""}
              </p>
              {hasMgmtUrl ? (
                <>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 1 — cancel on {platformName ?? "the booking platform"}:
                  </p>
                  <a
                    href={bc.managementUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block", textAlign: "center", padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none", marginBottom: "20px" }}
                  >
                    Open {platformName ?? "Booking Platform"}
                  </a>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 2 — once cancelled, remove from your trip:
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 1 — email the property to cancel:
                  </p>
                  <a
                    href={`mailto:?subject=${mailtoSubject}&body=${mailtoBody}`}
                    style={{ display: "block", textAlign: "center", padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none", marginBottom: "20px" }}
                  >
                    Compose cancellation email
                  </a>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 2 — once sent, remove from your trip:
                  </p>
                </>
              )}
              <button
                onClick={async () => {
                  setBookingCancelling(true);
                  try {
                    await fetch(`/api/trips/${tripId}/lodging/${bc.id}`, { method: "DELETE" });
                    const propName = bc.title.replace(/^check-(?:in|out):\s*/i, "").trim().toLowerCase();
                    setLocalItineraryItems(prev => prev.filter(it =>
                      it.id !== bc.id &&
                      !(it.type === "LODGING" && it.title.replace(/^check-(?:in|out):\s*/i, "").trim().toLowerCase() === propName)
                    ));
                    setBookingCancelTarget(null);
                    setSelectedItineraryItem(null);
                  } catch { /* non-fatal */ } finally {
                    setBookingCancelling(false);
                  }
                }}
                disabled={bookingCancelling}
                style={{ width: "100%", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: bookingCancelling ? "not-allowed" : "pointer", marginBottom: "10px", opacity: bookingCancelling ? 0.6 : 1, fontFamily: "inherit" }}
              >
                {bookingCancelling ? "Removing..." : "Remove from trip"}
              </button>
              <button
                onClick={() => setBookingCancelTarget(null)}
                disabled={bookingCancelling}
                style={{ width: "100%", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Keep booking
              </button>
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

type FetchedRec = {
  source: "event" | "flokker" | "ai";
  name: string;
  category: string;
  whyThisFamily: string;
  ageAppropriate: boolean;
  budgetTier: string;
  tip: string;
  tags: string[];
  websiteUrl: string | null;
  imageUrl: string | null;
  placeId: string | null;
  photoUrl: string | null;
  lat: number | null;
  lng: number | null;
  segmentCity: string | null;
  proximityLabel: string | null;
  avgRating?: number;
};

type EventCard = {
  id: string;
  tripId: string;
  segmentCity: string;
  category: string;
  title: string;
  venue: string | null;
  venueLat: number | null;
  venueLng: number | null;
  startDateTime: string;
  endDateTime: string | null;
  description: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  sourceProvider: string;
  whyThisFamily: string | null;
  relevanceScore: number;
};

function calcAgeFromIso(birthDateIso: string): number {
  const today = new Date();
  const birth = new Date(birthDateIso);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function buildFamilyContextString(members: { role: "ADULT" | "CHILD"; birthDate: string | null }[]): string {
  const adults = members.filter(m => m.role === "ADULT").length;
  const children = members.filter(m => m.role === "CHILD");
  const kidAges = children
    .map(m => (m.birthDate ? calcAgeFromIso(m.birthDate) : null))
    .filter((a): a is number => a !== null)
    .sort((a, b) => b - a);

  const adultStr = adults > 0 ? `${adults} adult${adults > 1 ? "s" : ""}` : "";
  const kidCount = children.length;
  let kidStr = "";
  if (kidCount > 0) {
    kidStr = `${kidCount} kid${kidCount > 1 ? "s" : ""}`;
    if (kidAges.length > 0) {
      const ageList = kidAges.length === 1
        ? `age ${kidAges[0]}`
        : `ages ${kidAges.slice(0, -1).join(", ")} & ${kidAges[kidAges.length - 1]}`;
      kidStr += ` (${ageList})`;
    }
  }

  return [adultStr, kidStr].filter(Boolean).join(" + ");
}

function RecommendedContent({
  tripId,
  tripStartDate,
  tripEndDate,
  destinationCity,
  destinationCountry,
  members,
  onViewOnMap,
  onSaved,
  onRefreshItinerary,
}: {
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  members?: { role: "ADULT" | "CHILD"; birthDate: string | null }[];
  onViewOnMap: (lat: number, lng: number) => void;
  onSaved: (rec: SavedRec) => void;
  onRefreshItinerary?: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [drawerRec, setDrawerRec] = useState<DrawerRec | null>(null);
  const [aiRecs, setAiRecs] = useState<FetchedRec[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  // fallback items kept for potential future re-use
  const [fallbackItems, setFallbackItems] = useState<FallbackItem[]>([]);
  const [fallbackLoaded, setFallbackLoaded] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [itinStates, setItinStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [recStatusMap, setRecStatusMap] = useState<Map<string, EntityStatusResult>>(new Map());
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "venues" | "almost">("initial");
  const [aiLimitedResults, setAiLimitedResults] = useState(false);

  useEffect(() => {
    if (!aiLoading) return;
    setLoadingPhase("initial");
    const t1 = setTimeout(() => setLoadingPhase("venues"), 5000);
    const t2 = setTimeout(() => setLoadingPhase("almost"), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [aiLoading]);

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

  // Static list filtering commented out — replaced by AI endpoint
  // const hasDestination = !!(destinationCity || destinationCountry);
  // const cityLower = (destinationCity ?? "").toLowerCase().trim();
  // const filteredRecs = !hasDestination ? [] : RECOMMENDATIONS.filter(rec =>
  //   rec.city.toLowerCase() === cityLower
  // );
  // const matchesDestination = filteredRecs.length > 0;

  const hasDestination = !!(destinationCity || destinationCountry);

  // Fetch AI recommendations
  useEffect(() => {
    if (!tripId || aiLoaded) return;
    setAiLoaded(true);
    setAiLoading(true);
    fetch(`/api/recommendations/ai?tripId=${encodeURIComponent(tripId)}`)
      .then(r => r.json())
      .then((data: { recommendations: FetchedRec[]; limitedResults?: boolean }) => {
        setAiRecs(Array.isArray(data.recommendations) ? data.recommendations : []);
        setAiLimitedResults(data.limitedResults ?? false);
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [tripId, aiLoaded]);

  // Fallback community saves kept but no longer primary path
  useEffect(() => {
    if (!hasDestination || !destinationCity || fallbackLoaded) return;
    setFallbackLoaded(true);
    fetch(`/api/recommendations/fallback?city=${encodeURIComponent(destinationCity)}`)
      .then(r => r.json())
      .then((items: FallbackItem[]) => setFallbackItems(Array.isArray(items) ? items : []))
      .catch(() => {});
  }, [hasDestination, destinationCity, fallbackLoaded]);

  // Build status map from user's global saves for recommendation pill rendering
  useEffect(() => {
    fetch("/api/saves")
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: { saves?: any[] }) => {
        if (!Array.isArray(data.saves)) return;
        setRecStatusMap(buildSaveStatusMap(data.saves));
      })
      .catch(() => {});
  }, []);

  // Loading state
  if (aiLoading) {
    const loadingMessage = {
      initial: "Generating personalized recommendations for your trip...",
      venues: "Finding venue photos and details...",
      almost: "Almost there — putting it all together...",
    }[loadingPhase];
    return (
      <div style={{ padding: "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>Building recommendations for your family</p>
        <p style={{ fontSize: "13px", color: "#717171" }}>{loadingMessage}</p>
      </div>
    );
  }

  // No destination
  if (!hasDestination) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <Compass size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>No destination set</p>
        <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>Add a destination to your trip to get personalised recommendations.</p>
      </div>
    );
  }

  // No AI recs returned (no destination on trip, or parse failed)
  if (aiLoaded && aiRecs.length === 0) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <Compass size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
          No recommendations yet
        </p>
        <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>
          Check back soon — or complete your family profile to get personalised suggestions.
        </p>
      </div>
    );
  }

  const BUDGET_COLORS: Record<string, string> = {
    Free:    "#4a7c59",
    Budget:  "#1B3A5C",
    Mid:     "#6b5b95",
    Premium: "#C4664A",
    Luxury:  "#8B6914",
  };

  return (
    <div>
      {/* Family context bar */}
      <div style={{ background: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A", padding: "12px 16px", marginBottom: "24px", borderRadius: "0 8px 8px 0" }}>
        <span style={{ fontSize: "12px", color: "#717171" }}>
          {members && members.length > 0
            ? `Personalised for ${buildFamilyContextString(members)}`
            : "Personalised for your family"}
        </span>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Recommended for your trip</div>
        <div style={{ fontSize: "13px", color: "#717171" }}>Based on your family&apos;s interests, travel style, and past saves</div>
      </div>

      {aiLimitedResults && (
        <div style={{ fontSize: "13px", color: "#717171", padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: "8px", marginBottom: "20px" }}>
          Limited recommendations available for this destination. More may appear as your trip details are added.
        </div>
      )}

      {/* AI rec cards */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : "1fr", gap: "16px" }}>
        {aiRecs.map((rec, i) => {
          const budgetColor = BUDGET_COLORS[rec.budgetTier] ?? "#717171";
          const recKey = `${rec.name.toLowerCase().trim()}|${(destinationCity ?? "").toLowerCase().trim()}`;
          const recStatus = recStatusMap.get(recKey) ?? null;
          const showRecAffordances = !recStatus || recStatus.showAffordance;
          const cardImageUrl = rec.photoUrl ?? rec.imageUrl
            ?? CATEGORY_IMAGES[rec.category]
            ?? getTripCoverImage(rec.segmentCity, destinationCountry);
          return (
            <div
              key={`${rec.name}-${i}`}
              style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0", overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              {/* Image header */}
              <div
                style={{
                  height: "160px",
                  backgroundImage: cardImageUrl ? `url(${cardImageUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: cardImageUrl ? undefined : "#1B3A5C",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                {rec.source === "flokker" && rec.avgRating !== undefined && (
                  <span style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "rgba(27,58,92,0.85)", color: "#fff", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "3px 10px" }}>
                    {rec.avgRating.toFixed(1)} ★ Flokker pick
                  </span>
                )}
              </div>

              {/* Header row */}
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F5F5F5" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, flex: 1 }}>{rec.name}</p>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: budgetColor, backgroundColor: `${budgetColor}18`, borderRadius: "999px", padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap" }}>{rec.budgetTier}</span>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "999px", padding: "3px 10px" }}>{rec.category}</span>
              </div>

              {/* Why this family */}
              <div style={{ padding: "10px 16px", background: "rgba(196,102,74,0.05)", borderBottom: "1px solid #F5F5F5" }}>
                <p style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, fontStyle: "italic", lineHeight: 1.5 }}>{rec.whyThisFamily}</p>
              </div>

              {/* Tip + actions + tags */}
              <div style={{ padding: "10px 16px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                {recStatus && recStatus.status !== "saved" && (
                  <div>
                    <EntityStatusPill status={recStatus.status} label={recStatus.label} color={recStatus.color} />
                  </div>
                )}
                {rec.proximityLabel && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(27,58,92,0.08)", borderRadius: "999px", padding: "3px 10px", alignSelf: "flex-start" }}>
                    <MapPin size={11} style={{ color: "#1B3A5C", flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#1B3A5C" }}>{rec.proximityLabel}</span>
                  </div>
                )}
                <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5 }}>{rec.tip}</p>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {showRecAffordances && (
                    <button
                      type="button"
                      disabled={saveStates[rec.name] === "loading" || saveStates[rec.name] === "done"}
                      onClick={async () => {
                        setSaveStates(prev => ({ ...prev, [rec.name]: "loading" }));
                        try {
                          const res = await fetch("/api/saves", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ sourceMethod: "URL_PASTE", title: rec.name, category: rec.category, city: rec.segmentCity ?? destinationCity ?? undefined, tripId, placePhotoUrl: rec.photoUrl ?? rec.imageUrl ?? undefined }),
                          });
                          if (!res.ok) throw new Error();
                          setSaveStates(prev => ({ ...prev, [rec.name]: "done" }));
                        } catch {
                          setSaveStates(prev => ({ ...prev, [rec.name]: "error" }));
                          setTimeout(() => setSaveStates(prev => ({ ...prev, [rec.name]: "idle" })), 2000);
                        }
                      }}
                      style={{ fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px", backgroundColor: saveStates[rec.name] === "done" ? "rgba(74,124,89,0.1)" : "transparent", color: saveStates[rec.name] === "done" ? "#4a7c59" : saveStates[rec.name] === "error" ? "#C44A4A" : "#C4664A", border: `1.5px solid ${saveStates[rec.name] === "done" ? "#4a7c59" : saveStates[rec.name] === "error" ? "#C44A4A" : "#C4664A"}`, cursor: saveStates[rec.name] === "loading" || saveStates[rec.name] === "done" ? "default" : "pointer", fontFamily: "inherit" }}
                    >
                      {saveStates[rec.name] === "done" ? "Saved" : saveStates[rec.name] === "error" ? "Failed" : saveStates[rec.name] === "loading" ? "Saving..." : "+ Save"}
                    </button>
                  )}
                  {showRecAffordances && (
                    <button
                      type="button"
                      disabled={!tripStartDate || itinStates[rec.name] === "loading" || itinStates[rec.name] === "done"}
                      onClick={async () => {
                        if (!tripId || !tripStartDate) return;
                        setItinStates(prev => ({ ...prev, [rec.name]: "loading" }));
                        try {
                          const res = await fetch(`/api/trips/${tripId}/activities`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: rec.name, notes: rec.whyThisFamily, date: tripStartDate.slice(0, 10), imageUrl: rec.photoUrl ?? rec.imageUrl ?? undefined, lat: rec.lat ?? undefined, lng: rec.lng ?? undefined, website: rec.websiteUrl ?? undefined, type: rec.category }),
                          });
                          if (!res.ok) throw new Error();
                          setItinStates(prev => ({ ...prev, [rec.name]: "done" }));
                          onRefreshItinerary?.();
                        } catch {
                          setItinStates(prev => ({ ...prev, [rec.name]: "error" }));
                          setTimeout(() => setItinStates(prev => ({ ...prev, [rec.name]: "idle" })), 2000);
                        }
                      }}
                      style={{ fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px", backgroundColor: itinStates[rec.name] === "done" ? "rgba(74,124,89,0.1)" : "transparent", color: itinStates[rec.name] === "done" ? "#4a7c59" : itinStates[rec.name] === "error" ? "#C44A4A" : "#C4664A", border: `1.5px solid ${itinStates[rec.name] === "done" ? "#4a7c59" : itinStates[rec.name] === "error" ? "#C44A4A" : "#C4664A"}`, cursor: (!tripStartDate || itinStates[rec.name] === "loading" || itinStates[rec.name] === "done") ? "default" : "pointer", fontFamily: "inherit" }}
                    >
                      {itinStates[rec.name] === "done" ? "Added" : itinStates[rec.name] === "error" ? "Failed" : itinStates[rec.name] === "loading" ? "Adding..." : "+ Itinerary"}
                    </button>
                  )}
                  {rec.websiteUrl && (
                    <a href={rec.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", fontWeight: 700, padding: "5px 12px", borderRadius: "999px", color: "#C4664A", border: "1.5px solid #C4664A", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      Link →
                    </a>
                  )}
                </div>
                {rec.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {rec.tags.map(tag => (
                      <span key={tag} style={{ fontSize: "11px", color: "#888", backgroundColor: "#F5F5F5", borderRadius: "999px", padding: "2px 8px" }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
    </div>
  );
}

function formatEventDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${month} ${day} · ${time}`;
  } catch {
    return isoString.split("T")[0];
  }
}

function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    sports_events: "Sports",
    live_music: "Live Music",
    comedy_shows: "Comedy",
    seasonal_events: "Seasonal",
    family_kids: "Family & Kids",
  };
  return labels[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function EventsContent({
  tripId,
  destinationCity,
  destinationCountry,
}: {
  tripId?: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
}) {
  const [events, setEvents] = useState<EventCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "checking" | "almost">("initial");

  useEffect(() => {
    if (!loading) return;
    setLoadingPhase("initial");
    const t1 = setTimeout(() => setLoadingPhase("checking"), 4000);
    const t2 = setTimeout(() => setLoadingPhase("almost"), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  useEffect(() => {
    if (!tripId) { setEvents([]); setLoading(false); return; }
    fetch(`/api/events?tripId=${encodeURIComponent(tripId)}`)
      .then((r) => r.json())
      .then((data: { events?: EventCard[]; enrichmentFailed?: boolean }) => {
        setEvents(data.events ?? []);
        setEnrichmentFailed(!!data.enrichmentFailed);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[events] fetch failed", err);
        setEvents([]);
        setLoading(false);
      });
  }, [tripId]);

  const header = (
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", color: "#1B3A5C", margin: 0, lineHeight: 1.2 }}>
        See what&apos;s happening around town while you&apos;re there.
      </h2>
      <p style={{ fontSize: "14px", color: "#717171", margin: "6px 0 0 0" }}>
        Events matching your family&apos;s interests, during your trip dates.
      </p>
    </div>
  );

  if (loading) {
    const loadingMessage = {
      initial: "Checking what's happening during your trip...",
      checking: "Searching for events that match your family...",
      almost: "Almost there — putting it together...",
    }[loadingPhase];
    return (
      <div>
        {header}
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "#717171" }}>{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div>
        {header}
        <div style={{ padding: "60px 24px", textAlign: "center", maxWidth: "480px", margin: "0 auto" }}>
          <Calendar size={32} style={{ color: "#C4664A", marginBottom: "16px" }} />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", marginBottom: "8px" }}>
            No events found yet
          </p>
          <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5 }}>
            We&apos;re still expanding event coverage for {destinationCity ?? "this destination"}. Check back soon — or update your family&apos;s entertainment interests in your profile to see different categories.
          </p>
        </div>
      </div>
    );
  }

  // Group events by segmentCity
  const groupedBySegment: Record<string, EventCard[]> = {};
  for (const event of events) {
    const city = event.segmentCity || "Other";
    if (!groupedBySegment[city]) groupedBySegment[city] = [];
    groupedBySegment[city].push(event);
  }
  const segmentCities = Object.keys(groupedBySegment);
  const showSegmentHeaders = segmentCities.length > 1;

  return (
    <div>
      {header}
      {enrichmentFailed && (
        <div style={{ padding: "12px 16px", backgroundColor: "rgba(196,102,74,0.1)", borderRadius: "8px", marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#1B3A5C", margin: 0 }}>
            Some event details may be incomplete.
          </p>
        </div>
      )}
      {segmentCities.map((city) => (
        <section key={city} style={{ marginBottom: "32px" }}>
          {showSegmentHeaders && (
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", color: "#1B3A5C", marginBottom: "12px", marginTop: 0 }}>
              {city}
            </h3>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {groupedBySegment[city].map((event) => (
              <EventCardItem
                key={event.id}
                event={event}
                tripId={tripId}
                destinationCity={destinationCity}
                destinationCountry={destinationCountry}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventCardItem({
  event,
  tripId,
  destinationCity,
  destinationCountry,
}: {
  event: EventCard;
  tripId?: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const coverImage = event.imageUrl ?? getTripCoverImage(destinationCity, destinationCountry);

  const handleSaveEvent = async () => {
    if (saving || saved || !tripId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/events/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, eventId: event.id }),
      });
      if (res.ok) {
        setSaved(true);
        window.dispatchEvent(new Event("flokk:refresh"));
      }
    } catch (err) {
      console.error("[event save] failed", err);
    } finally {
      setSaving(false);
    }
  };

  const saveButtonStyle: React.CSSProperties = {
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: saved ? "white" : "#717171",
    backgroundColor: saved ? "#C4664A" : "white",
    border: saved ? "none" : "1.5px solid #E0E0E0",
    borderRadius: "6px",
    cursor: saving || saved ? "default" : "pointer",
    whiteSpace: "nowrap",
    opacity: saving ? 0.6 : 1,
  };
  const ticketsButtonStyle: React.CSSProperties = {
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: "white",
    backgroundColor: "#C4664A",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div
        style={{
          position: "relative",
          aspectRatio: "16/9",
          backgroundColor: "#1B3A5C",
          backgroundImage: `url(${coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            backgroundColor: "rgba(27,58,92,0.9)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {formatEventDateTime(event.startDateTime)}
        </div>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>
          {event.title}
        </h4>
        {event.venue && (
          <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
            {event.venue}
          </p>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "999px",
            backgroundColor: "rgba(196,102,74,0.15)",
            color: "#C4664A",
            fontSize: "11px",
            fontWeight: 500,
            alignSelf: "flex-start",
          }}
        >
          {formatCategoryLabel(event.category)}
        </span>
        {event.whyThisFamily && (
          <p style={{ fontSize: "12px", color: "#C4664A", fontStyle: "italic", lineHeight: 1.5, margin: "4px 0 0 0" }}>
            {event.whyThisFamily}
          </p>
        )}
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          <button
            onClick={handleSaveEvent}
            disabled={saving || saved}
            style={saveButtonStyle}
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "+ Save"}
          </button>
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={ticketsButtonStyle}
            >
              View tickets →
            </a>
          )}
        </div>
      </div>
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
            {/ticket|concert|game|sport|baseball|soccer|football|theater|theatre|show|stadium|arena/i.test(activity.title) ? "Book tickets →" : "Link →"}
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
          onDelete={() => { onDelete(); setShowDetail(false); }}
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
  itemKind: "itinerary" | "save" | "manual";
  rating: number;
  notes: string;
  wouldReturn: boolean | null;
  alreadySaved: boolean;
  ratingId?: string;
  savedItemId?: string;
};

const STAR_LABELS: Record<number, string> = {
  1: "1 — Poor",
  2: "2 — Below average",
  3: "3 — Good",
  4: "4 — Very good",
  5: "5 — Excellent",
};

const EXCLUDE_SAVE_TAGS = /flight|airfare|airline|lodging|accommodation|hotel|transportation/i;

function HowWasItContent({ tripId, tripTitle, destinationCity, postTripCaptureComplete, shareToken, onComplete, onNavigateToItinerary, onDoneCapturing, onShowSharePrompt }: {
  tripId: string;
  tripTitle?: string | null;
  destinationCity?: string | null;
  postTripCaptureComplete: boolean;
  shareToken?: string;
  onComplete: () => void;
  onNavigateToItinerary: () => void;
  onDoneCapturing: () => void;
  onShowSharePrompt?: () => void;
}) {
  const [items, setItems] = useState<HowWasItItem[]>([]);
  const [done, setDone] = useState(postTripCaptureComplete);
  const [submitting, setSubmitting] = useState(false);
  const [existingRatingsCount, setExistingRatingsCount] = useState(0);
  const [capturedToast, setCapturedToast] = useState<string | null>(null);
  const [spurName, setSpurName] = useState("");
  const [spurType, setSpurType] = useState("Activity");
  const [spurTip, setSpurTip] = useState("");
  const [spurSaving, setSpurSaving] = useState(false);
  const [spurSaved, setSpurSaved] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  async function handleShareTrip() {
    if (!shareToken) return;
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    if (isTouchDevice && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: tripTitle ?? "Trip on Flokk", url: shareUrl });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, shareUrl.length);
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setHasShared(true);
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/itinerary-items`).then(r => r.ok ? r.json() : {}),
      fetch(`/api/saves?tripId=${tripId}`).then(r => r.ok ? r.json() : { saves: [] }),
      fetch(`/api/trips/${tripId}/ratings`).then(r => r.ok ? r.json() : { ratings: [] }),
      fetch(`/api/trips/${tripId}/activities`).then(r => r.ok ? r.json() : []),
    ]).then(([itinData, savesData, ratingData, manualData]) => {
      const itinItems: { id: string; title?: string | null; type?: string }[] = Array.isArray(itinData) ? itinData : ((itinData as { items?: unknown[] }).items ?? []);
      type ExistingRating = { id: string; rating: number; notes: string | null; wouldReturn: boolean | null; itineraryItemId?: string | null; manualActivityId?: string | null; savedItemId?: string | null };
      const existingRatings: ExistingRating[] = ratingData.ratings ?? [];
      setExistingRatingsCount(existingRatings.length);
      const ratingByItinId = new Map<string, ExistingRating>(existingRatings.filter(r => r.itineraryItemId).map(r => [r.itineraryItemId!, r]));
      const ratingByManualId = new Map<string, ExistingRating>(existingRatings.filter(r => r.manualActivityId).map(r => [r.manualActivityId!, r]));

      // LODGING: exclude check-out items; strip "Check-in: " prefix from title
      // ACTIVITY: include all
      const itinRated: HowWasItItem[] = itinItems
        .filter(it =>
          (it.type === "ACTIVITY") ||
          (it.type === "LODGING" && !it.title?.toLowerCase().startsWith("check-out"))
        )
        .map(it => {
          const existing = ratingByItinId.get(it.id);
          return {
            id: it.id,
            title: (it.title?.replace(/^check-in:\s*/i, "") ?? it.title ?? "Untitled").trim(),
            type: it.type ?? "",
            itemKind: "itinerary" as const,
            rating: existing?.rating ?? 0,
            notes: existing?.notes ?? "",
            wouldReturn: existing?.wouldReturn ?? null,
            alreadySaved: !!existing,
            ratingId: existing?.id,
          };
        });

      // SavedItems assigned to trip — exclude flight/lodging/transportation tags
      // Save-kind ratings live exclusively in SavedItem.userRating (Option B architecture)
      const saveItems: HowWasItItem[] = ((savesData.saves ?? []) as { id: string; rawTitle?: string | null; categoryTags?: string[]; userRating?: number | null; notes?: string | null }[])
        .filter(s => !s.categoryTags?.some(t => EXCLUDE_SAVE_TAGS.test(t)))
        .map(s => ({
          id: s.id,
          title: s.rawTitle ?? "Untitled",
          type: "save",
          itemKind: "save" as const,
          rating: s.userRating ?? 0,
          notes: s.notes ?? "",
          wouldReturn: null,
          alreadySaved: s.userRating != null,
          savedItemId: s.id,
        }));

      // ManualActivity records — deduplicate against itinerary and save titles
      const existingTitles = new Set<string>([
        ...itinRated.map(i => i.title.toLowerCase()),
        ...saveItems.map(i => i.title.toLowerCase()),
      ]);
      // Keyed by SavedItem.id — includes items the saveItems filter excluded (e.g. lodging).
      // Used so ManualActivities with a paired savedItemId can read the canonical userRating.
      const allSavesById = new Map<string, { userRating?: number | null; notes?: string | null }>(
        ((savesData.saves ?? []) as { id: string; userRating?: number | null; notes?: string | null }[]).map(s => [s.id, s])
      );
      const manualItems: HowWasItItem[] = ((manualData as { id: string; title: string; savedItemId?: string | null }[]) ?? [])
        .filter(m => !existingTitles.has(m.title.toLowerCase()))
        .map(m => {
          // If this ManualActivity has a paired SavedItem, always use the save-kind path.
          // This ensures How Was It and SaveDetailModal share the same userRating field.
          if (m.savedItemId) {
            const matched = allSavesById.get(m.savedItemId);
            return {
              id: m.id,
              title: m.title,
              type: "ACTIVITY",
              itemKind: "save" as const,
              rating: matched?.userRating ?? 0,
              notes: matched?.notes ?? "",
              wouldReturn: null,
              alreadySaved: matched?.userRating != null,
              savedItemId: m.savedItemId,
            };
          }
          const existing = ratingByManualId.get(m.id);
          return {
            id: m.id,
            title: m.title,
            type: "ACTIVITY",
            itemKind: "manual" as const,
            rating: existing?.rating ?? 0,
            notes: existing?.notes ?? "",
            wouldReturn: existing?.wouldReturn ?? null,
            alreadySaved: !!existing,
            ratingId: existing?.id,
          };
        });

      setItems([...itinRated, ...saveItems, ...manualItems]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleDoneCapturing() {
    setSubmitting(true);

    // Save any pending ratings first
    const toSubmit = items.filter(it => it.rating > 0 && !it.alreadySaved);
    if (toSubmit.length > 0) {
      try {
        await Promise.all(toSubmit.map(it => {
          if (it.itemKind === "save") {
            // Option B: save-kind ratings write only to SavedItem.userRating — no PlaceRating created
            return fetch(`/api/saves/${it.savedItemId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userRating: it.rating, notes: it.notes || undefined }),
            });
          }
          return fetch(`/api/trips/${tripId}/ratings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(it.itemKind === "itinerary" ? { itineraryItemId: it.id } : {}),
              ...(it.itemKind === "manual" ? { manualActivityId: it.id } : {}),
              placeName: it.title,
              placeType: it.type.toLowerCase(),
              rating: it.rating,
              notes: it.notes || undefined,
              wouldReturn: it.wouldReturn ?? undefined,
            }),
          });
        }));
      } catch (err) {
        console.error("[handleDoneCapturing] rating submit failed:", err);
        setSubmitting(false);
        alert("Some ratings failed to save. Please try again.");
        return;
      }
    }

    // Mark trip capture complete and started
    try {
      await fetch(`/api/trips/${tripId}/post-trip-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postTripCaptureStarted: true, postTripCaptureComplete: true }),
      });
    } catch (err) {
      console.error("[handleDoneCapturing] status update failed:", err);
    }

    setSubmitting(false);
    setCapturedToast(
      toSubmit.length > 0
        ? `Saved ${toSubmit.length} rating${toSubmit.length === 1 ? "" : "s"}.`
        : (done ? "No changes to save." : "Trip captured. Thanks for contributing to Flokk.")
    );
    setTimeout(() => setCapturedToast(null), 4000);
    onDoneCapturing();
  }

  async function handleSaveEdit(item: HowWasItItem) {
    setEditSaving(true);
    if (item.itemKind === "save") {
      // Option B: save-kind edits write only to SavedItem.userRating
      await fetch(`/api/saves/${item.savedItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRating: item.rating, notes: item.notes || undefined }),
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, rating: item.rating, notes: item.notes, alreadySaved: true } : i));
      setEditingItemId(null);
      setEditSaving(false);
      return;
    }
    if (!item.ratingId) { setEditSaving(false); return; }
    await fetch(`/api/trips/${tripId}/ratings/${item.ratingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: item.rating,
        notes: item.notes || undefined,
        wouldReturn: item.wouldReturn ?? undefined,
      }),
    });
    setEditingItemId(null);
    setEditSaving(false);
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

  return (
    <div style={{ maxWidth: "560px" }}>

      {done && (
        <div style={{ textAlign: "center", padding: "16px 0 24px", borderBottom: "1px solid #eee", marginBottom: "24px" }}>
          <p style={{ fontWeight: 700, fontSize: "18px", color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "4px" }}>Your ratings are in.</p>
          <p style={{ color: "#717171", fontSize: "14px", marginTop: "4px" }}>Other Flokkers planning {destinationCity ? `${destinationCity} ` : ""}will thank you.</p>
        </div>
      )}

      {/* Share nudge — only before ratings are submitted */}
      {shareToken && !hasShared && (
        <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#FFF8F6", border: "1px solid #C4664A", borderRadius: "12px" }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", marginBottom: "4px" }}>
            Want to share your {destinationCity ?? "trip"} itinerary with other Flokkers?
          </p>
          <p style={{ fontSize: "12px", color: "#717171", marginBottom: "14px" }}>
            Other families planning {destinationCity ?? "this destination"} would love to see what you did.
          </p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleShareTrip}
              style={{ padding: "8px 18px", backgroundColor: "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 700, border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Copy share link
            </button>
            <button
              onClick={() => setHasShared(true)}
              style={{ padding: "8px 12px", color: "#AAAAAA", fontSize: "13px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
      {shareToken && hasShared && (
        <div style={{ marginBottom: "24px", padding: "12px 16px", backgroundColor: "#F0F7F0", border: "1px solid #6B8F71", borderRadius: "12px" }}>
          <p style={{ fontSize: "13px", color: "#6B8F71", fontWeight: 600 }}>
            Share link copied — paste it anywhere to share your trip.
          </p>
        </div>
      )}

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
            {item.alreadySaved && editingItemId !== item.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <p style={{ fontSize: "12px", color: "#6B8F71", fontWeight: 600, margin: 0 }}>Rated</p>
                <button
                  onClick={() => setEditingItemId(item.id)}
                  style={{ fontSize: "12px", color: "#717171", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}
                >
                  Edit
                </button>
              </div>
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
                {item.alreadySaved && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleSaveEdit(item)}
                      disabled={editSaving}
                      style={{ padding: "8px 16px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {editSaving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      onClick={() => setEditingItemId(null)}
                      style={{ padding: "8px 16px", backgroundColor: "#fff", color: "#717171", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
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

      {/* Section 3 — Finish capture */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        marginTop: "32px",
        paddingTop: "24px",
        borderTop: "1px solid #E5E7EB",
        textAlign: "center",
      }}>
        <p style={{
          fontSize: "14px",
          color: "#64748B",
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: "12px",
        }}>
          {done ? "Making updates?" : "Finished capturing your memories from this trip?"}
        </p>
        <button
          onClick={handleDoneCapturing}
          disabled={submitting}
          style={{
            padding: "12px 28px",
            borderRadius: "9999px",
            border: "none",
            background: submitting ? "#94A3B8" : "#C4664A",
            color: "#FFFFFF",
            fontSize: "15px",
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            cursor: submitting ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "background 150ms ease-out",
          }}
        >
          {submitting ? (
            <>
              <span style={{
                display: "inline-block",
                width: "14px",
                height: "14px",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#FFFFFF",
                borderRadius: "50%",
                animation: "spin 600ms linear infinite",
              }} />
              Saving your ratings...
            </>
          ) : (
            done ? "Save my updates" : "Save my ratings and finish"
          )}
        </button>
      </div>

      {capturedToast && (
        <div style={{ position: "fixed", bottom: "96px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, zIndex: 9999, maxWidth: "320px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {capturedToast}
        </div>
      )}

    </div>
  );
}

// ── Tours tab ─────────────────────────────────────────────────────────────────

function ToursContent({ tripId, tripTitle }: { tripId?: string; tripTitle?: string }) {
  type TourMeta = {
    id: string;
    title: string;
    prompt: string;
    stopCount: number;
    coverImage: string | null;
    days: number[];
    transport: string;
    durationLabel: string;
    destinationCity: string;
    destinationCountry: string | null;
  };
  type StopPreview = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    duration: number;
    travelTime: number;
    imageUrl: string | null;
    why: string | null;
    familyNote: string | null;
    websiteUrl: string | null;
    ticketRequired: string | null;
  };
  const [tours, setTours] = useState<TourMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<TourMeta | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [expandedStops, setExpandedStops] = useState<Record<string, StopPreview[] | "loading">>({});
  const [selectedStop, setSelectedStop] = useState<{ stop: StopPreview; tourTitle: string; stopIndex: number; totalStops: number } | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<Record<string, { stop: StopPreview; tourId: string; timer: ReturnType<typeof setTimeout>; startedAt: number }>>({});
  const [originalTargetStops, setOriginalTargetStops] = useState<Record<string, number>>({});
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush all pending DELETEs on unmount (best-effort, keepalive)
  useEffect(() => {
    return () => {
      Object.values(pendingRemovals).forEach(p => {
        clearTimeout(p.timer);
        fetch(`/api/tours/${p.tourId}/stops/${p.stop.id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTours = () => {
    if (!tripId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/trips/${tripId}/tours`)
      .then(r => r.json())
      .then((d: { tours?: TourMeta[] }) => setTours(d.tours ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTours(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel(tour: TourMeta) {
    // Flush pending removals for this tour synchronously before unlinking
    Object.values(pendingRemovals).forEach(p => {
      if (p.tourId === tour.id) {
        clearTimeout(p.timer);
        fetch(`/api/tours/${tour.id}/stops/${p.stop.id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      }
    });
    setPendingRemovals(prev => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([id, p]) => { if (p.tourId !== tour.id) next[id] = p; });
      return next;
    });
    setCancelling(true);
    try {
      await fetch(`/api/tours/${tour.id}/unlink-from-trip`, { method: "DELETE" });
      setTours(prev => prev.filter(t => t.id !== tour.id));
      setCancelTarget(null);
    } catch { /* non-fatal */ } finally {
      setCancelling(false);
    }
  }

  async function toggleExpand(tourId: string) {
    if (expandedStops[tourId]) {
      // Block collapse while any pending removal for this tour is in flight
      const hasPending = Object.values(pendingRemovals).some(p => p.tourId === tourId);
      if (hasPending) return;
      setExpandedStops(prev => { const next = { ...prev }; delete next[tourId]; return next; });
      return;
    }
    setExpandedStops(prev => ({ ...prev, [tourId]: "loading" }));
    try {
      const res = await fetch(`/api/tours/${tourId}`);
      if (!res.ok) { setExpandedStops(prev => { const next = { ...prev }; delete next[tourId]; return next; }); return; }
      const data = await res.json() as { stops: StopPreview[] };
      setExpandedStops(prev => ({ ...prev, [tourId]: data.stops ?? [] }));
      // Capture original target on first expand only
      setOriginalTargetStops(prev => prev[tourId] != null ? prev : { ...prev, [tourId]: (data.stops ?? []).length });
    } catch {
      setExpandedStops(prev => { const next = { ...prev }; delete next[tourId]; return next; });
    }
  }

  function dayLabel(days: number[]): string {
    if (days.length === 0) return "";
    if (days.length === 1) return `Day ${days[0] + 1}`;
    return `Days ${days.map(d => d + 1).join(", ")}`;
  }

  function handleLocalRemove(tId: string, stop: StopPreview) {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tours/${tId}/stops/${stop.id}`, { method: "DELETE", keepalive: true });
        if (res.ok) {
          setExpandedStops(prev => {
            const current = prev[tId];
            if (current === "loading" || !current) return prev;
            return { ...prev, [tId]: (current as StopPreview[]).filter(s => s.id !== stop.id) };
          });
          setTours(prev => prev.map(t => t.id === tId ? { ...t, stopCount: t.stopCount - 1 } : t));
        }
      } catch (err) { console.error("[ToursContent] stop delete failed:", err); }
      setPendingRemovals(prev => { const next = { ...prev }; delete next[stop.id]; return next; });
    }, 8000);
    setPendingRemovals(prev => ({ ...prev, [stop.id]: { stop, tourId: tId, timer, startedAt: Date.now() } }));
  }

  function handleUndoRemoval(stopId: string) {
    setPendingRemovals(prev => {
      const target = prev[stopId];
      if (target) clearTimeout(target.timer);
      const next = { ...prev };
      delete next[stopId];
      return next;
    });
  }

  async function handleAddReplacement(tId: string, count: number) {
    setIsRegenerating(tId);
    try {
      const res = await fetch(`/api/tours/${tId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      if (!res.ok) throw new Error("Regenerate failed");
      const data = await res.json() as { allActive: StopPreview[] };
      setExpandedStops(prev => ({ ...prev, [tId]: data.allActive }));
      setTours(prev => prev.map(t => t.id === tId ? { ...t, stopCount: data.allActive.length } : t));
    } catch (err) { console.error("[ToursContent] regenerate failed:", err); }
    finally { setIsRegenerating(null); }
  }

  if (loading) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>
        Loading tours...
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center" }}>
        <p style={{ fontSize: "15px", color: "#6B7280", lineHeight: 1.5 }}>
          Tours you save to this trip will appear here.
        </p>
        <a
          href={tripId ? `/tour?tripId=${tripId}` : "/tour"}
          style={{ display: "inline-block", marginTop: "16px", fontSize: "13px", color: "#C4664A", fontWeight: 600 }}
        >
          Build a tour →
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {tours.map(tour => {
          const stopsState = expandedStops[tour.id];
          const isExpanded = !!stopsState;
          const stopsLoading = stopsState === "loading";
          const stopsList = Array.isArray(stopsState) ? stopsState : [];
          const hasPendingForTour = Object.values(pendingRemovals).some(p => p.tourId === tour.id);
          const activeStopCount = stopsList.filter(s => !pendingRemovals[s.id]).length;
          const origTarget = originalTargetStops[tour.id];
          const gap = origTarget != null ? origTarget - activeStopCount : 0;
          const location = [tour.destinationCity, tour.destinationCountry].filter(Boolean).join(", ");
          return (
            <div key={tour.id} style={{
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}>
              {/* Full-width hero image */}
              <div
                onClick={() => toggleExpand(tour.id)}
                style={{ cursor: "pointer" }}
              >
                {tour.coverImage ? (
                  <div style={{ height: "180px", overflow: "hidden" }}>
                    <img src={tour.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ height: "180px", background: "linear-gradient(135deg,#1B3A5C,#C4664A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MapPin size={32} style={{ color: "rgba(255,255,255,0.5)" }} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: "14px 16px 0" }}>
                <p
                  onClick={() => toggleExpand(tour.id)}
                  style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "var(--font-playfair, serif)", lineHeight: 1.3, cursor: "pointer" }}
                >
                  {decodeHtmlEntities(tour.title)}
                </p>

                {location && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                    <MapPin size={11} style={{ color: "#717171", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#717171" }}>{location}</span>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#C4664A", backgroundColor: "#FAE5DD", borderRadius: "999px", padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {tour.stopCount} {tour.stopCount === 1 ? "Stop" : "Stops"} · {tour.transport}
                  </span>
                  {tour.days.length > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: "999px", padding: "3px 10px" }}>
                      {dayLabel(tour.days)}
                    </span>
                  )}
                </div>

                {/* Expanded stops */}
                {isExpanded && (
                  <div style={{ marginTop: "14px", borderTop: "1px solid #F3F4F6", paddingTop: "12px" }}>
                    {stopsLoading ? (
                      <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>Loading stops...</p>
                    ) : stopsList.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>No stops found.</p>
                    ) : (
                      <>
                        <TourMapBlock stops={stopsList} />
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {stopsList.map((stop) => {
                            const isPending = !!pendingRemovals[stop.id];
                            const activeStops = stopsList.filter(s => !pendingRemovals[s.id]);
                            const activeIdx = activeStops.indexOf(stop);
                            if (isPending) {
                              return (
                                <div key={stop.id} className="relative overflow-hidden rounded-xl" style={{ border: "1px solid rgba(27,58,92,0.2)", backgroundColor: "rgba(27,58,92,0.05)", padding: "12px 16px" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                    <span style={{ fontSize: "14px", color: "#1B3A5C" }}>
                                      Removed <strong>{decodeHtmlEntities(stop.name)}</strong>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUndoRemoval(stop.id)}
                                      style={{ flexShrink: 0, border: "1px solid #C4664A", backgroundColor: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "12px", fontWeight: 700, color: "#C4664A", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                                    >
                                      Undo
                                    </button>
                                  </div>
                                  <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#C4664A] origin-left animate-[shrink_8s_linear_forwards]" />
                                </div>
                              );
                            }
                            return (
                              <div key={stop.id} style={{ position: "relative" }}>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleLocalRemove(tour.id, stop); }}
                                  style={{ position: "absolute", top: "8px", right: "8px", zIndex: 10, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
                                  aria-label={`Remove ${stop.name}`}
                                >
                                  <X size={14} style={{ color: "#6B7280" }} />
                                </button>
                                <div
                                  onClick={() => setSelectedStop({ stop, tourTitle: decodeHtmlEntities(tour.title), stopIndex: activeIdx + 1, totalStops: activeStops.length })}
                                  style={{ display: "flex", alignItems: "flex-start", cursor: "pointer", border: "1px solid #F3F4F6", borderRadius: "16px", overflow: "hidden", backgroundColor: "#fff" }}
                                >
                                  {/* 96×96 image */}
                                  <div style={{
                                    width: "96px", height: "96px", flexShrink: 0,
                                    backgroundColor: "#F3F4F6", overflow: "hidden",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}>
                                    {stop.imageUrl ? (
                                      <img src={stop.imageUrl} alt={stop.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      <MapPin size={20} style={{ color: "#D1D5DB" }} />
                                    )}
                                  </div>
                                  {/* Content */}
                                  <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 10px" }}>
                                    {/* Badge + title */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#C4664A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>
                                        {activeIdx + 1}
                                      </div>
                                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
                                        {decodeHtmlEntities(stop.name)}
                                      </p>
                                    </div>
                                    {/* Link button */}
                                    {stop.websiteUrl && (
                                      <a
                                        href={stop.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#C4664A", textDecoration: "none", marginTop: "4px" }}
                                      >
                                        <ExternalLink size={12} />
                                        Link
                                      </a>
                                    )}
                                    {/* Duration + walk + ticket pills */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#F3F4F6", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", color: "#6B7280" }}>
                                        <Clock size={10} />
                                        {stop.duration} min
                                      </span>
                                      {tour.transport === "Walking" && activeIdx > 0 && stop.travelTime > 0 && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#F3F4F6", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", color: "#6B7280" }}>
                                          <Footprints size={10} />
                                          {stop.travelTime} min walk
                                        </span>
                                      )}
                                      {stop.ticketRequired === "ticket-required" && (
                                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7", borderRadius: "999px", padding: "2px 8px" }}>Ticket required</span>
                                      )}
                                      {stop.ticketRequired === "advance-booking-recommended" && (
                                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7", borderRadius: "999px", padding: "2px 8px" }}>Book ahead</span>
                                      )}
                                      {stop.ticketRequired === "free" && (
                                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#065F46", backgroundColor: "#D1FAE5", borderRadius: "999px", padding: "2px 8px" }}>Free</span>
                                      )}
                                    </div>
                                    {/* Why */}
                                    {stop.why && (
                                      <p style={{ fontSize: "12px", color: "#6B7280", margin: "4px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                        {stop.why}
                                      </p>
                                    )}
                                    {/* familyNote */}
                                    {stop.familyNote && (
                                      <p style={{ fontSize: "12px", color: "#C4664A", fontStyle: "italic", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                        {stop.familyNote}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {gap > 0 && (
                            <button
                              type="button"
                              onClick={() => handleAddReplacement(tour.id, gap)}
                              disabled={hasPendingForTour || isRegenerating === tour.id}
                              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "12px", border: "2px dashed rgba(27,58,92,0.3)", backgroundColor: "#fff", padding: "20px 16px", fontSize: "14px", fontWeight: 600, color: "#1B3A5C", cursor: (hasPendingForTour || isRegenerating === tour.id) ? "not-allowed" : "pointer", opacity: (hasPendingForTour || isRegenerating === tour.id) ? 0.5 : 1 }}
                            >
                              {isRegenerating === tour.id ? (
                                <>
                                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Plus size={16} />
                                  {gap === 1 ? "Add a replacement stop" : `Generate ${gap} more stops`}
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpand(tour.id)}
                            style={{ fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textAlign: "left", fontFamily: "inherit" }}
                          >
                            ↑ Hide stops
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action row */}
              <div style={{ padding: "12px 16px 14px", display: "flex", gap: "10px", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={async e => { e.stopPropagation(); const result = await shareEntity({ entityType: "generated_tour", entityId: tour.id }); if (result.ok) { if (shareToastTimer.current) clearTimeout(shareToastTimer.current); setShareToast(true); shareToastTimer.current = setTimeout(() => setShareToast(false), 2000); } }}
                  style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  Share
                </button>
                <a
                  href={tripId ? `/tour?tripId=${tripId}` : "/tour"}
                  style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                >
                  Start over
                </a>
                <button
                  onClick={() => setCancelTarget(tour)}
                  style={{ fontSize: "13px", color: "#9CA3AF", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Cancel tour
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedStop && (
        <div
          className={MODAL_OVERLAY_CLASSES}
          onClick={() => setSelectedStop(null)}
        >
          <div
            className="w-full sm:w-[480px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Hero image — fixed height, flex-shrink-0, close button positioned absolute */}
            <div style={{ position: "relative", flexShrink: 0, height: selectedStop.stop.imageUrl ? "200px" : "80px", borderRadius: "20px 20px 0 0", overflow: "hidden" }}>
              {selectedStop.stop.imageUrl ? (
                <img src={selectedStop.stop.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1B3A5C,#C4664A)" }} />
              )}
              <button
                onClick={() => setSelectedStop(null)}
                style={{ position: "absolute", top: "12px", right: "12px", width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "16px", lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 8px" }}>
              <p style={{ fontSize: "11px", color: "#9CA3AF", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Stop {selectedStop.stopIndex} of {selectedStop.totalStops}
              </p>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", fontFamily: "var(--font-playfair, serif)", lineHeight: 1.3 }}>
                {decodeHtmlEntities(selectedStop.stop.name)}
              </p>

              {selectedStop.stop.ticketRequired === "ticket-required" && (
                <div style={{ backgroundColor: "#FEF3C7", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#92400E", margin: 0 }}>Ticket required — book in advance if possible.</p>
                </div>
              )}
              {selectedStop.stop.ticketRequired === "advance-booking-recommended" && (
                <div style={{ backgroundColor: "#FEF3C7", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#92400E", margin: 0 }}>Advance booking recommended — popular attraction.</p>
                </div>
              )}
              {selectedStop.stop.ticketRequired === "free" && (
                <div style={{ backgroundColor: "#D1FAE5", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#065F46", margin: 0 }}>Free admission.</p>
                </div>
              )}

              {selectedStop.stop.why && (
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, margin: "0 0 12px" }}>
                  {selectedStop.stop.why}
                </p>
              )}

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{selectedStop.stop.duration} min</span>
                {selectedStop.stop.travelTime > 0 && (
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>· {selectedStop.stop.travelTime} min walk from previous stop</span>
                )}
              </div>
            </div>

            {/* Sticky footer — always visible */}
            <div style={{ flexShrink: 0, borderTop: "1px solid #F3F4F6", padding: "14px 24px 32px", backgroundColor: "#fff", display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {selectedStop.stop.lat !== 0 && selectedStop.stop.lng !== 0 ? (
                <a
                  href={`https://www.google.com/maps/?q=${selectedStop.stop.lat},${selectedStop.stop.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "14px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                >
                  View on Maps →
                </a>
              ) : null}
              {selectedStop.stop.websiteUrl ? (
                <a
                  href={selectedStop.stop.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "14px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                >
                  Visit website →
                </a>
              ) : null}
              {selectedStop.stop.lat === 0 && selectedStop.stop.lng === 0 && !selectedStop.stop.websiteUrl ? (
                <span style={{ fontSize: "14px", color: "#9CA3AF" }}>No links available</span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className={MODAL_OVERLAY_CLASSES} onClick={() => !cancelling && setCancelTarget(null)}>
          <div className={MODAL_PANEL_CLASSES} style={{ padding: "28px 24px 40px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", fontFamily: "var(--font-playfair, serif)", margin: "0 0 12px" }}>
              Are you Flokkin&apos; sure?
            </p>
            <p style={{ fontSize: "14px", color: "#4B5563", lineHeight: 1.6, margin: "0 0 24px" }}>
              This will remove all {cancelTarget.stopCount} {cancelTarget.stopCount === 1 ? "stop" : "stops"} of the{" "}
              <strong>{cancelTarget.title}</strong>
              {cancelTarget.days.length > 0 && ` from ${dayLabel(cancelTarget.days)} of ${tripTitle ?? "your trip"}`}.
              The tour stays in your library — you can save it to your trip again later.
            </p>
            <button
              onClick={() => handleCancel(cancelTarget)}
              disabled={cancelling}
              style={{ width: "100%", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px", opacity: cancelling ? 0.6 : 1 }}
            >
              {cancelling ? "Removing..." : "Yes, cancel tour"}
            </button>
            <button
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
              style={{ width: "100%", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {shareToast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1B3A5C", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: "13px", fontWeight: 600, zIndex: 9999, pointerEvents: "none" }}>
          Link copied to clipboard
        </div>
      )}
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

export function TripTabContent({ initialTab = "saved", tripId, tripTitle, tripStartDate, tripEndDate, destinationCity, destinationCountry, initialIsAnonymous = true, initialIsPublic = false, shareToken, tripStatus, initialPostTripCaptureStarted = false, initialPostTripCaptureComplete = false, initialPostTripModalVisitCount = 0, viewerMembers }: { initialTab?: Tab; tripId?: string; tripTitle?: string; tripStartDate?: string | null; tripEndDate?: string | null; destinationCity?: string | null; destinationCountry?: string | null; initialIsAnonymous?: boolean; initialIsPublic?: boolean; shareToken?: string; tripStatus?: string; initialPostTripCaptureStarted?: boolean; initialPostTripCaptureComplete?: boolean; initialPostTripModalVisitCount?: number; viewerMembers?: { role: "ADULT" | "CHILD"; name: string; birthDate: string | null }[] }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [postTripCaptureStarted, setPostTripCaptureStarted] = useState(initialPostTripCaptureStarted);
  const [postTripCaptureComplete, setPostTripCaptureComplete] = useState(initialPostTripCaptureComplete);
  const [showPostTripModal, setShowPostTripModal] = useState(false);
  const [showPostTripBanner, setShowPostTripBanner] = useState(false);
  useEffect(() => {
    if (tripStatus === "COMPLETED" && !initialPostTripCaptureStarted) {
      const newCount = initialPostTripModalVisitCount + 1;
      if (tripId) {
        fetch(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postTripModalVisitCount: newCount }),
        });
      }
      if (initialPostTripModalVisitCount === 0) {
        const t = setTimeout(() => setShowPostTripModal(true), 1000);
        return () => clearTimeout(t);
      } else {
        if (!initialPostTripCaptureComplete) setShowPostTripBanner(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [itineraryVersion, setItineraryVersion] = useState(0);
  const [dropLinkOpen, setDropLinkOpen] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ExistingActivity | null>(null);
  const [editingActivityIsSavedItem, setEditingActivityIsSavedItem] = useState(false);
  const [activityDayPickerItem, setActivityDayPickerItem] = useState<Activity | null>(null);
  const [activityToast, setActivityToast] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityDefaultDate, setActivityDefaultDate] = useState<string | undefined>(undefined);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [editingFlightVaultDocId, setEditingFlightVaultDocId] = useState<string | null>(null);
  const [editingFlightBookingId, setEditingFlightBookingId] = useState<string | null>(null);
  const [editingVaultDoc, setEditingVaultDoc] = useState<{ id: string; label: string; content: Record<string, unknown> } | null>(null);
  const [vaultDocSaving, setVaultDocSaving] = useState(false);
  const [editActivityName, setEditActivityName] = useState<string | null>(null);
  const [vaultActivityItem, setVaultActivityItem] = useState<ItineraryItemLocal | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(initialIsAnonymous);
  const [anonymousSaved, setAnonymousSaved] = useState(false);
  const [showTripSettings, setShowTripSettings] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [editTripTitle, setEditTripTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [dateSaving, setDateSaving] = useState(false);

  // Budget state — lives at top level so it survives tab switches
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [trackedTotal, setTrackedTotal] = useState<number>(0);
  const [budgetCurrency, setBudgetCurrency] = useState<string>("USD");
  const [budgetLoaded, setBudgetLoaded] = useState(false);

  useEffect(() => {
    if (!tripId || budgetLoaded) return;
    fetch(`/api/trips/${tripId}/budget`)
      .then(r => r.json())
      .then(data => {
        if (data.budgetTotal !== null && data.budgetTotal !== undefined) setBudgetTotal(data.budgetTotal);
        if (data.budgetCurrency) setBudgetCurrency(data.budgetCurrency);
        setTrackedTotal(data.trackedTotal ?? 0);
        setBudgetLoaded(true);
      })
      .catch(err => { console.error('Budget fetch failed:', err); setBudgetLoaded(true); });
  }, [tripId, budgetLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBudgetChange(total: number | null, currency: string) {
    setBudgetTotal(total);
    setBudgetCurrency(currency);
  }

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
  type TripNote = { id: string; content: TiptapDoc; checked: boolean; dayIndex: number | null; createdAt: string };
  const [tripNotes, setTripNotes] = useState<TripNote[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newlyCreatedNoteId, setNewlyCreatedNoteId] = useState<string | null>(null);
  const [notesFilter, setNotesFilter] = useState<"all" | "trip" | number>("all");

  useEffect(() => {
    if (tab !== "notes" || !tripId) return;
    fetch(`/api/trips/${tripId}/notes`)
      .then(r => r.json())
      .then(d => setTripNotes(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [tripId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddNote() {
    if (isAddingNote || !tripId) return;
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: emptyDoc() }),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: TripNote = await res.json();
      setTripNotes(prev => [...prev, saved]);
      setNewlyCreatedNoteId(saved.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleSaveNote(noteId: string, content: TiptapDoc): Promise<boolean> {
    try {
      const res = await fetch(`/api/trips/${tripId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setTripNotes(prev => prev.map(n => n.id === noteId ? { ...n, content } : n));
      }
      return res.ok;
    } catch {
      return false;
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
    if (newlyCreatedNoteId === id) setNewlyCreatedNoteId(null);
  }

  // ── Vault state ──────────────────────────────────────────────────────────
  type VaultContact = { id: string; name: string; role?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; notes?: string | null };
  type VaultDocument = { id: string; label: string; type: string; url?: string | null; content?: string | null };
  type VaultKeyInfo = { id: string; label: string; value: string };
  type VaultCancelTarget = {
    docId: string; label: string; bookingType: string;
    confirmationCode: string | null; managementUrl: string | null;
    platformName: string | null; checkIn: string | null; checkOut: string | null;
    guests: string[];
  };

  const [contacts, setContacts] = useState<VaultContact[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [keyInfo, setKeyInfo] = useState<VaultKeyInfo[]>([]);
  const [vaultCancelTarget, setVaultCancelTarget] = useState<VaultCancelTarget | null>(null);
  const [vaultCancelling, setVaultCancelling] = useState(false);
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

      {/* Post-trip banner — shown on repeat visits until capture started */}
      {tripStatus === "COMPLETED" && !postTripCaptureStarted && !postTripCaptureComplete && showPostTripBanner && (
        <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#92400E", marginBottom: "2px" }}>
              You have unrated activities from {destinationCity ?? "your trip"}
            </p>
            <p style={{ fontSize: "11px", color: "#B45309" }}>
              Your ratings help families planning this destination.
            </p>
          </div>
          <button
            onClick={() => { setShowPostTripBanner(false); setTab("howwasit"); }}
            style={{ fontSize: "12px", backgroundColor: "#C4664A", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Rate now
          </button>
        </div>
      )}

      {/* Action buttons row — above tab bar so tabs get full width */}
      {tripId && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", marginBottom: "8px" }}>
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
              setEditTripTitle(tripTitle ?? '');
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

      {/* Tab bar — full width, horizontally scrollable on mobile */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch" as const,
          scrollbarWidth: "none" as const,
          msOverflowStyle: "none" as const,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          marginBottom: "20px",
        }}
      >
        {(["Saved", "Itinerary", "Tours", "Recommended", ...(SHOW_EVENTS_TAB ? ["Events"] : []), "Packing", "Notes", "Vault"] as const).map((label) => {
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
        {tripStatus === "COMPLETED" && (
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

      {editingFlightBookingId && tripId && (
        <EditFlightModal
          flightBookingId={editingFlightBookingId}
          tripId={tripId}
          onClose={() => { setEditingFlightBookingId(null); setEditingFlightVaultDocId(null); }}
          onBookingSaved={() => {
            // Re-fetch vault documents so the card reflects updated leg data
            fetch(`/api/trips/${tripId}/vault/documents`)
              .then(r => r.json())
              .then((docs: VaultDocument[]) => setDocuments(docs))
              .catch(() => {});
            setEditingFlightBookingId(null);
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
          isSavedItem={editingActivityIsSavedItem}
          onClose={() => { setShowActivityModal(false); setEditingActivity(null); setEditingActivityIsSavedItem(false); setActivityDefaultDate(undefined); }}
          onSaved={(updated) => {
            setShowActivityModal(false);
            setEditingActivity(null);
            setEditingActivityIsSavedItem(false);
            if (updated?.id) {
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
        <SavedContent tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} tripTitle={tripTitle} onSwitchToItinerary={() => setTab("itinerary")} shareToken={shareToken} />
      )}
      {tab === "itinerary" && <ItineraryContent key={itineraryVersion} flyTarget={flyTarget} onFlyTargetConsumed={() => setFlyTarget(null)} tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} onSwitchToRecommended={() => setTab("recommended")} onActivityAdded={fetchActivities} onEditActivity={(a) => setEditingActivity(a)} onEditSavedActivity={(a) => { setEditingActivity(a); setEditingActivityIsSavedItem(true); }} destinationCity={destinationCity} destinationCountry={destinationCountry} flights={flights} activities={activities} onRemoveActivityFromDay={handleRemoveActivityFromDay} onDeleteActivity={handleDeleteActivity} onMarkActivityBooked={handleMarkActivityBooked} onRemoveFlightFromDay={handleRemoveFlightFromDay} onAddFlight={() => setShowFlightModal(true)} budgetTotal={budgetTotal} trackedTotal={trackedTotal} budgetCurrency={budgetCurrency} budgetLoaded={budgetLoaded} onBudgetChange={handleBudgetChange} shareToken={shareToken} onManageTours={() => setTab("tours")} />}
      {tab === "tours" && <ToursContent tripId={tripId} tripTitle={tripTitle} />}
      {tab === "packing" && <PackingContent tripId={tripId} destinationCity={destinationCity} destinationCountry={destinationCountry} tripStartDate={tripStartDate} tripEndDate={tripEndDate} />}
      {tab === "notes" && (
        <div style={{ maxWidth: "600px" }}>
          {/* Header + Add button */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>Trip notes</p>
              <p style={{ fontSize: "13px", color: "#717171", marginBottom: "4px" }}>Reminders, things to check, ideas — everything in one place.</p>
              <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.5 }}>
                Trip notes save here. Day-specific notes go in Itinerary — they show up here too with a Day badge.
              </p>
            </div>
            <button
              onClick={handleAddNote}
              disabled={isAddingNote}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                backgroundColor: isAddingNote ? "#E0E0E0" : "#1B3A5C",
                color: isAddingNote ? "#aaa" : "#fff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isAddingNote ? "default" : "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginLeft: "12px",
              }}
            >
              + Add note
            </button>
          </div>

          {/* Day filter chips — shown whenever any notes exist */}
          {(() => {
            const dayIndexValues = [...new Set(tripNotes.map(n => n.dayIndex).filter((d): d is number => d !== null))].sort((a, b) => a - b);
            if (dayIndexValues.length === 0) return null;
            const chipStyle = (active: boolean): React.CSSProperties => ({
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              backgroundColor: active ? "#1B3A5C" : "transparent",
              color: active ? "#fff" : "#717171",
              borderColor: active ? "#1B3A5C" : "#E0E0E0",
              whiteSpace: "nowrap" as const,
            });
            return (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
                <button onClick={() => setNotesFilter("all")} style={chipStyle(notesFilter === "all")}>All</button>
                {tripNotes.some(n => n.dayIndex === null) && (
                  <button onClick={() => setNotesFilter("trip")} style={chipStyle(notesFilter === "trip")}>Trip notes</button>
                )}
                {dayIndexValues.map(d => (
                  <button key={d} onClick={() => setNotesFilter(d)} style={chipStyle(notesFilter === d)}>Day {d + 1}</button>
                ))}
              </div>
            );
          })()}

          {/* Notes list */}
          {(() => {
            const filtered = tripNotes.filter(n => {
              if (notesFilter === "all") return true;
              if (notesFilter === "trip") return n.dayIndex === null;
              return n.dayIndex === notesFilter;
            });
            if (filtered.length === 0) return (
              <div style={{ padding: "40px 24px", textAlign: "center", border: "1.5px dashed #E0E0E0", borderRadius: "16px" }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>No notes yet.</p>
                <p style={{ fontSize: "13px", color: "#717171" }}>Add reminders, things to check, or anything related to this trip.</p>
              </div>
            );
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...filtered]
                .sort((a, b) => {
                  if (a.checked !== b.checked) return Number(a.checked) - Number(b.checked);
                  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                })
                .map(note => (
                  <div
                    key={note.id}
                    style={{
                      borderRadius: "12px",
                      backgroundColor: note.checked ? "#FAFAFA" : "#fff",
                      border: "1px solid",
                      borderColor: note.checked ? "#F0F0F0" : "#EEEEEE",
                      opacity: note.checked ? 0.6 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {/* Note header: day badge + actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 0 12px" }}>
                      {note.dayIndex !== null && note.dayIndex !== undefined && (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#C4664A",
                          backgroundColor: "rgba(196,102,74,0.1)",
                          padding: "2px 8px",
                          borderRadius: "10px",
                        }}>
                          Day {note.dayIndex + 1}
                        </span>
                      )}
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                        {/* Checked toggle */}
                        <button
                          onClick={() => handleToggleNote(note.id, note.checked)}
                          title={note.checked ? "Mark incomplete" : "Mark done"}
                          style={{
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
                            flexShrink: 0,
                          }}
                        >
                          {note.checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", lineHeight: 1 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Editor */}
                    <div style={{ padding: "4px 0 0 0" }}>
                      <NoteEditor
                        key={note.id}
                        initialContent={note.content}
                        onSave={(content) => handleSaveNote(note.id, content)}
                        placeholder="Write a note..."
                        autoFocus={note.id === newlyCreatedNoteId}
                      />
                    </div>
                  </div>
                ))}
            </div>
          );
          })()}

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
                  const isFlightType = (booking.type as string) === "flight";
                  const flightLegs = isFlightType && Array.isArray(booking.legs) ? (booking.legs as Array<Record<string, unknown>>) : [];
                  const isFlightWithLegs = flightLegs.length > 0;
                  const rows: { label: string; value: string }[] = [];
                  function fmtVaultDate(d: unknown): string {
                    if (!d) return "";
                    try {
                      const dt = new Date(String(d) + "T12:00:00");
                      return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    } catch { return String(d); }
                  }
                  if (!isFlightWithLegs) {
                    if (booking.fromCity && booking.toCity) {
                      rows.push({ label: "Route", value: `${booking.fromCity} → ${booking.toCity}` });
                    } else if (booking.fromAirport && booking.toAirport) {
                      rows.push({ label: "Route", value: `${booking.fromAirport} → ${booking.toAirport}` });
                    }
                  }
                  if (booking.activityName) rows.push({ label: "Activity", value: String(booking.activityName) });
                  if (!isFlightWithLegs && booking.departureDate) rows.push({ label: "Departure", value: `${fmtVaultDate(booking.departureDate)}${booking.departureTime ? ` at ${booking.departureTime}` : ""}` });
                  if (!isFlightWithLegs && booking.arrivalDate) rows.push({ label: "Arrival", value: `${fmtVaultDate(booking.arrivalDate)}${booking.arrivalTime ? ` at ${booking.arrivalTime}` : ""}` });
                  if (booking.checkIn) rows.push({ label: "Check-in", value: fmtVaultDate(booking.checkIn) });
                  if (booking.checkOut) rows.push({ label: "Check-out", value: fmtVaultDate(booking.checkOut) });
                  if (booking.address) rows.push({ label: "Address", value: String(booking.address) });
                  if (isFlightWithLegs && booking.airline) rows.push({ label: "Airline", value: String(booking.airline) });
                  if (isFlightWithLegs && booking.cabinClass) rows.push({ label: "Cabin", value: String(booking.cabinClass) });
                  if (booking.confirmationCode) rows.push({ label: "Confirmation", value: String(booking.confirmationCode) });
                  if (booking.totalCost) rows.push({ label: "Total", value: `${booking.totalCost}${booking.currency ? ` ${booking.currency}` : ""}` });
                  if (booking.contactPhone) rows.push({ label: "Phone", value: String(booking.contactPhone) });
                  if (Array.isArray(booking.guestNames) && booking.guestNames.length > 0) rows.push({ label: "Guests", value: (booking.guestNames as string[]).join(", ") });
                  // For flight-type docs, find matching Flight record (legacy path)
                  const HOTEL_SOURCE_LABEL: Record<string, string> = { "booking.com": "Booking.com", airbnb: "Airbnb", "hotels.com": "Hotels.com", expedia: "Expedia", marriott: "Marriott", hilton: "Hilton", hyatt: "Hyatt", vrbo: "VRBO", direct: "Direct" };
                  const hotelBookingSource = (booking.type as string) === "hotel" ? (booking.bookingSource as string | null | undefined) ?? null : null;
                  const hotelManagementUrl = (booking.type as string) === "hotel" ? (booking.managementUrl as string | null | undefined) ?? null : null;
                  const hotelSourceLabel = hotelBookingSource && hotelBookingSource !== "unknown" ? (HOTEL_SOURCE_LABEL[hotelBookingSource] ?? hotelBookingSource) : null;
                  if (hotelSourceLabel) rows.push({ label: "Booked via", value: hotelSourceLabel });
                  const matchedFlight = isFlightType && !isFlightWithLegs
                    ? flights.find(f => f.flightNumber === (booking.flightNumber as string))
                    : null;

                  function handleVaultEdit() {
                    const fbId = booking._flightBookingId as string | null | undefined;
                    if (isFlightType && fbId) {
                      setEditingFlightBookingId(fbId);
                      setEditingFlightVaultDocId(d.id);
                    } else if (matchedFlight) {
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
                          {isFlightType
                            ? isFlightWithLegs
                              ? [...flightLegs.map(l => String(l.from ?? "")), String(flightLegs[flightLegs.length - 1].to ?? "")].filter(Boolean).join(" → ") || "Flight details"
                              : (booking.fromAirport && booking.toAirport)
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
                      {isFlightWithLegs && (
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {flightLegs.map((leg, legIdx) => (
                            <div key={legIdx} style={{ borderLeft: "2px solid rgba(196,102,74,0.35)", paddingLeft: "10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C" }}>{String(leg.from ?? "")} → {String(leg.to ?? "")}</span>
                                <span style={{ fontSize: "11px", color: "#aaa" }}>{String(leg.flightNumber ?? "")}</span>
                              </div>
                              <span style={{ fontSize: "12px", color: "#717171" }}>
                                {fmtVaultDate(leg.departureDate)}{leg.departureTime ? ` · ${leg.departureTime}` : ""}{leg.arrivalTime ? ` → ${leg.arrivalTime}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isFlightType && !isFlightWithLegs && (
                        <p style={{ fontSize: "11px", color: "#BBBBBB", marginTop: "10px" }}>Re-forward confirmation to update times</p>
                      )}
                      {(booking.type as string) === "hotel" && typeof booking.address === "string" && booking.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(booking.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: "10px", fontSize: "12px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                        >
                          Open in Maps →
                        </a>
                      )}
                      {hotelManagementUrl && (
                        <a
                          href={hotelManagementUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: "8px", fontSize: "12px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                        >
                          Manage booking →
                        </a>
                      )}
                      {!!(booking.url || booking.bookingUrl) && (
                        <a
                          href={String(booking.url ?? booking.bookingUrl ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 13, fontWeight: 500, color: "#C4664A", textDecoration: "none" }}
                        >
                          View booking →
                        </a>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleVaultEdit(); }} style={{ position: "absolute", top: "12px", right: "36px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px" }} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const anyMgmtUrl = (booking.managementUrl as string | null | undefined) ?? hotelManagementUrl ?? null;
                          setVaultCancelTarget({
                            docId: d.id,
                            label: d.label,
                            bookingType: (booking.type as string) ?? "booking",
                            confirmationCode: (booking.confirmationCode as string | null) ?? null,
                            managementUrl: anyMgmtUrl,
                            platformName: hotelSourceLabel ?? null,
                            checkIn: (booking.checkIn as string | null) ?? (booking.departureDate as string | null) ?? null,
                            checkOut: (booking.checkOut as string | null) ?? (booking.arrivalDate as string | null) ?? null,
                            guests: Array.isArray(booking.guestNames) ? (booking.guestNames as string[]) : [],
                          });
                        }}
                        style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px" }}
                        title="Cancel booking"
                      >
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
                {documents.filter(d => d.type !== "booking").map(d => {
                  // Parse content for operator_plan type; fall back to raw string for all others
                  let planContent: Record<string, unknown> | null = null;
                  if (d.type === "operator_plan" && d.content) {
                    try { planContent = JSON.parse(d.content) as Record<string, unknown>; } catch { /* fall through to raw */ }
                  }
                  return (
                    <div key={d.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px" }}>{d.type === "operator_plan" ? "🗺️" : d.type === "link" ? "🔗" : "📝"}</span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{d.label}</span>
                        </div>
                        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1B3A5C", wordBreak: "break-all" }}>{d.url}</a>}
                        {planContent ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", marginTop: "8px" }}>
                            {!!planContent.operatorName && (
                              <div><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Operator</span><br />{String(planContent.operatorName)}</div>
                            )}
                            {!!planContent.operatorWebsite && (
                              <div><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Website</span><br /><a href={String(planContent.operatorWebsite).startsWith("http") ? String(planContent.operatorWebsite) : `https://${planContent.operatorWebsite}`} target="_blank" rel="noopener noreferrer" style={{ color: "#C4664A" }}>{String(planContent.operatorWebsite)}</a></div>
                            )}
                            {!!planContent.operatorEmail && (
                              <div><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</span><br /><a href={`mailto:${planContent.operatorEmail}`} style={{ color: "#C4664A" }}>{String(planContent.operatorEmail)}</a></div>
                            )}
                            {!!planContent.operatorPhone && (
                              <div><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone</span><br />{String(planContent.operatorPhone)}</div>
                            )}
                            {planContent.totalCost != null && !!planContent.currency && (
                              <div><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quote</span><br />{Number(planContent.totalCost).toLocaleString()} {String(planContent.currency)}</div>
                            )}
                            {Array.isArray(planContent.cities) && (planContent.cities as string[]).length > 0 && (
                              <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cities</span><br />{(planContent.cities as string[]).join(" · ")}</div>
                            )}
                            {Array.isArray(planContent.bundledActivities) && (planContent.bundledActivities as Array<{ name: string }>).length > 0 && (
                              <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#999", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Included</span><br />{(planContent.bundledActivities as Array<{ name: string }>).map(a => a.name).join(" · ")}</div>
                            )}
                          </div>
                        ) : (
                          d.content && <p style={{ fontSize: "12px", color: "#555", marginTop: "4px", whiteSpace: "pre-wrap" }}>{d.content}</p>
                        )}
                      </div>
                      <button onClick={async () => { await fetch(`/api/trips/${tripId}/vault/documents/${d.id}`, { method: "DELETE" }); setDocuments(p => p.filter(x => x.id !== d.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#D0D0D0", padding: "2px", flexShrink: 0 }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
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
          tripTitle={tripTitle}
          destinationCity={destinationCity}
          postTripCaptureComplete={postTripCaptureComplete}
          shareToken={shareToken}
          onComplete={() => setPostTripCaptureComplete(true)}
          onNavigateToItinerary={() => setTab("itinerary")}
          onDoneCapturing={() => setPostTripCaptureStarted(true)}
          onShowSharePrompt={() => setShowSharePrompt(true)}
        />
      )}

      {tab === "recommended" && (
        <RecommendedContent
          tripId={tripId}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
          members={viewerMembers}
          onViewOnMap={(lat, lng) => { setTab("itinerary"); setFlyTarget({ lat, lng }); }}
          onSaved={() => {}}
          onRefreshItinerary={() => setItineraryVersion(v => v + 1)}
        />
      )}

      {tab === "events" && SHOW_EVENTS_TAB && (
        <EventsContent
          tripId={tripId}
          destinationCity={destinationCity}
          destinationCountry={destinationCountry}
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
        return (
          <div
            className={MODAL_OVERLAY_CLASSES}
            onClick={() => setVaultActivityItem(null)}
          >
            <div
              className="w-full sm:w-[440px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto pb-safe sm:pb-0"
              style={{ padding: "24px" }}
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
              You&apos;re back{destinationCity ? ` from ${destinationCity}` : ""}!
            </p>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "28px", lineHeight: 1.6 }}>
              How was it? Your ratings help other families find the best spots.
            </p>
            <button
              onClick={async () => {
                if (!tripId) return;
                await fetch(`/api/trips/${tripId}/post-trip-status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postTripCaptureStarted: true }) });
                setPostTripCaptureStarted(true);
                setShowPostTripModal(false);
                setTab("howwasit");
              }}
              style={{ width: "100%", padding: "14px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: "12px" }}
            >
              Share how it went
            </button>
            <button
              onClick={() => setShowPostTripModal(false)}
              style={{ display: "block", width: "100%", padding: "8px", backgroundColor: "transparent", color: "#AAAAAA", border: "none", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}
            >
              Maybe later
            </button>
            <p style={{ fontSize: "11px", color: "#BBBBBB", textAlign: "center", marginTop: "12px", lineHeight: 1.5 }}>
              Your ratings earn you Pioneer status and help build the Flokk community library.
            </p>
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
            { key: "websiteUrl", label: "Website URL", type: "url" },
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
          <div onClick={() => setEditingVaultDoc(null)} className={MODAL_OVERLAY_CLASSES}>
            <div onClick={e => e.stopPropagation()} className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`} style={{ padding: "24px 20px 40px" }}>
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
                    const isHotelType = ["lodging", "hotel"].includes(String(doc.content.type ?? "").toLowerCase());
                    const normalizedVendor = isHotelType
                      ? (toTitleCase(doc.content.vendorName as string | null) || (doc.content.vendorName as string | null) || "")
                      : null;
                    const contentWithActivity = isActivityType && editActivityName
                      ? { ...doc.content, activityName: editActivityName }
                      : isHotelType && normalizedVendor
                        ? { ...doc.content, vendorName: normalizedVendor }
                        : doc.content;
                    const updatedContent = JSON.stringify(contentWithActivity);
                    const patchBody: Record<string, unknown> = { content: updatedContent };
                    if (isActivityType && editActivityName) patchBody.label = editActivityName;
                    if (isHotelType && normalizedVendor) patchBody.label = normalizedVendor;
                    await fetch(`/api/trips/${tripId}/vault/documents/${doc.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(patchBody),
                    });
                    // Update vault documents state
                    const newLabel = (isActivityType && editActivityName) ? editActivityName : (isHotelType && normalizedVendor) ? normalizedVendor : doc.label;
                    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, label: newLabel, content: updatedContent } : d));
                    // Activity: update linked itinerary item title
                    if (isActivityType && editActivityName && tripId) {
                      const confCode = doc.content.confirmationCode as string | null;
                      if (confCode) {
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
                      setItineraryVersion(v => v + 1);
                    }
                    // Hotel: update both check-in and check-out itinerary item titles
                    if (isHotelType && normalizedVendor && tripId) {
                      const confCode = doc.content.confirmationCode as string | null;
                      if (confCode) {
                        const itinRes = await fetch(`/api/trips/${tripId}/itinerary-items`);
                        if (itinRes.ok) {
                          const itinData = (await itinRes.json()) as { items: { id: string; title?: string | null; confirmationCode?: string | null; type?: string | null }[] };
                          const linkedItems = itinData.items.filter(it => it.confirmationCode === confCode && it.type === "LODGING");
                          for (const item of linkedItems) {
                            const prefix = (item.title ?? "").startsWith("Check-out:") ? "Check-out:" : "Check-in:";
                            await fetch(`/api/trips/${tripId}/itinerary/${item.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: `${prefix} ${normalizedVendor}` }),
                            });
                          }
                        }
                      }
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
          className={MODAL_OVERLAY_CLASSES}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`}
            style={{ padding: "24px 20px 40px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Trip Settings</p>
              <button onClick={() => setShowTripSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#717171", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em" }}>Trip Name</label>
                <input
                  type="text"
                  value={editTripTitle}
                  onChange={e => setEditTripTitle(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid #E5E5E5", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1B3A5C", outline: "none", boxSizing: "border-box" }}
                />
              </div>
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
                  if (!tripId || !editTripTitle.trim()) return;
                  setDateSaving(true);
                  try {
                    await fetch(`/api/trips/${tripId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: editTripTitle.trim(),
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
                disabled={dateSaving || !editTripTitle.trim()}
                style={{ width: "100%", padding: "13px", backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: dateSaving ? "default" : "pointer", fontFamily: "inherit", opacity: dateSaving ? 0.7 : 1 }}
              >
                {dateSaving ? "Saving…" : "Save dates"}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-[#0A1628] mb-3">Community visibility</p>
              <label className="flex items-start gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setIsPublic(next);
                    if (tripId) await fetch(`/api/trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: next }) });
                  }}
                  className="mt-0.5 w-4 h-4 accent-[#C4664A]"
                />
                <div>
                  <p className="text-sm text-[#0A1628]">Share on Discover</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When on, your completed trip appears in the Real Trips section on the Discover page.
                  </p>
                </div>
              </label>
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

      {/* ── Share with community prompt ── */}
      {showSharePrompt && createPortal(
        <div
          onClick={() => { setShowSharePrompt(false); setTab("itinerary"); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "420px", padding: "32px 24px 28px" }}
          >
            <p style={{ fontSize: "22px", fontWeight: 900, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "12px" }}>Share this trip?</p>
            <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.6, marginBottom: "24px" }}>
              Your {tripTitle ?? "trip"} itinerary will appear on the Discover page so other families can steal it. Your ratings already power Community Picks.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={async () => {
                  if (tripId) await fetch(`/api/trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: true }) });
                  setIsPublic(true);
                  setShowSharePrompt(false);
                  setTab("itinerary");
                }}
                style={{ width: "100%", padding: "14px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Share it
              </button>
              <button
                onClick={() => { setShowSharePrompt(false); setTab("itinerary"); }}
                style={{ width: "100%", padding: "14px", backgroundColor: "transparent", color: "#1B3A5C", border: "2px solid #1B3A5C", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Keep it private
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {vaultCancelTarget && (() => {
        const vc = vaultCancelTarget;
        const bt = vc.bookingType.toLowerCase();
        const typeDisplay = bt === "hotel" ? "Hotel" : bt === "flight" ? "Flight" : bt === "activity" ? "Activity" : bt === "train" ? "Train" : bt === "car_rental" ? "Car Rental" : "Booking";
        const hasMgmtUrl = !!vc.managementUrl;
        const mailtoSubject = encodeURIComponent(`Cancellation Request — ${vc.label}${vc.confirmationCode ? ` (${vc.confirmationCode})` : ""}`);
        const mailtoBody = encodeURIComponent(
          `Dear ${vc.label} team,\n\nI would like to cancel my reservation` +
          (vc.confirmationCode ? ` (Confirmation: ${vc.confirmationCode})` : "") + ".\n\n" +
          (vc.checkIn ? `Date: ${vc.checkIn}\n` : "") +
          (vc.checkOut ? `Check-out: ${vc.checkOut}\n` : "") +
          (vc.guests.length ? `Guests: ${vc.guests.join(", ")}\n` : "") +
          "\nPlease confirm the cancellation at your earliest convenience.\n\nThank you"
        );
        return (
          <div className={MODAL_OVERLAY_CLASSES} onClick={() => !vaultCancelling && setVaultCancelTarget(null)}>
            <div className={MODAL_PANEL_CLASSES} style={{ padding: "28px 24px 40px" }} onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", fontFamily: "var(--font-playfair, serif)", margin: "0 0 6px" }}>
                Cancel {typeDisplay}
              </p>
              <p style={{ fontSize: "14px", color: "#4B5563", margin: "0 0 20px" }}>
                {vc.label}{vc.confirmationCode ? ` · ${vc.confirmationCode}` : ""}
              </p>
              {hasMgmtUrl ? (
                <>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 1 — cancel on {vc.platformName ?? "the booking platform"}:
                  </p>
                  <a
                    href={vc.managementUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block", textAlign: "center", padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none", marginBottom: "20px" }}
                  >
                    Open {vc.platformName ?? "Booking Platform"}
                  </a>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>Step 2 — once cancelled, remove from vault:</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>
                    Step 1 — contact the provider to cancel:
                  </p>
                  <a
                    href={`mailto:?subject=${mailtoSubject}&body=${mailtoBody}`}
                    style={{ display: "block", textAlign: "center", padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none", marginBottom: "20px" }}
                  >
                    Compose cancellation email
                  </a>
                  <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 8px" }}>Step 2 — once sent, remove from vault:</p>
                </>
              )}
              <button
                onClick={async () => {
                  setVaultCancelling(true);
                  try {
                    const res = await fetch(`/api/trips/${tripId}/vault/documents/${vc.docId}`, { method: "DELETE" });
                    if (res.ok) {
                      setDocuments(p => p.filter(x => x.id !== vc.docId));
                      setItineraryVersion(v => v + 1);
                    }
                    setVaultCancelTarget(null);
                  } catch { /* non-fatal */ } finally {
                    setVaultCancelling(false);
                  }
                }}
                disabled={vaultCancelling}
                style={{ width: "100%", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: vaultCancelling ? "not-allowed" : "pointer", marginBottom: "10px", opacity: vaultCancelling ? 0.6 : 1, fontFamily: "inherit" }}
              >
                {vaultCancelling ? "Removing..." : "Remove from vault"}
              </button>
              <button
                onClick={() => setVaultCancelTarget(null)}
                disabled={vaultCancelling}
                style={{ width: "100%", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Keep booking
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
