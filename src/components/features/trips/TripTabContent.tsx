"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  Bookmark,
  Trash2,
  Pencil,
} from "lucide-react";
import { TripMap } from "@/components/features/trips/TripMap";
import { DropLinkModal } from "@/components/features/home/DropLinkModal";
import { RecommendationDrawer, type DrawerRec } from "@/components/features/trips/RecommendationDrawer";
import { AddFlightModal } from "@/components/flights/AddFlightModal";
import { AddActivityModal, type ExistingActivity } from "@/components/activities/AddActivityModal";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { parseDateForDisplay } from "@/lib/dates";

type Tab = "saved" | "itinerary" | "recommended" | "packing" | "notes" | "vault";

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
};

type Activity = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  website?: string | null;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;
  status: string;
  confirmationCode?: string | null;
  dayIndex?: number | null;
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
        <GripVertical size={14} style={{ color: "#d0cbc2", flexShrink: 0 }} />
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
};


const TRIP_DAYS = [
  { dayIndex: 0, label: "Day 1", date: "Sun May 4" },
  { dayIndex: 1, label: "Day 2", date: "Mon May 5" },
  { dayIndex: 2, label: "Day 3", date: "Tue May 6" },
  { dayIndex: 3, label: "Day 4", date: "Wed May 7" },
  { dayIndex: 4, label: "Day 5", date: "Thu May 8" },
];

function generateTripDays(
  startDate: string | null,
  endDate: string | null
): { dayIndex: number; label: string; date: string }[] {
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
    return { dayIndex: i, label: `Day ${i + 1}`, date: dateStr };
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

function SavedDetailModal({ item, onClose }: { item: SavedDisplayItem; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Hero image */}
        <div style={{ position: "relative" }}>
          {imgFailed ? (
            <div style={{ height: "200px", backgroundColor: "#F5F0EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.icon}
            </div>
          ) : (
            <>
              <div style={{ height: "200px", backgroundImage: `url('${item.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
            </>
          )}
          <button onClick={onClose} style={{ position: "absolute", top: "12px", right: "12px", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "18px", lineHeight: 1 }}>×</button>
          {item.statusBooked && (
            <span style={{ position: "absolute", bottom: "12px", left: "12px", fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(74,124,89,0.9)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>Booked ✓</span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 20px 24px" }}>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>{item.title}</p>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "12px" }}>{item.detail}</p>

          {item.description && (
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "16px" }}>{item.description}</p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "16px" }}>
            <Users size={12} style={{ color: "#BBBBBB" }} />
            <span style={{ fontSize: "12px", color: "#BBBBBB" }}>{item.families}</span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {item.bookUrl && (
              <button
                type="button"
                onClick={() => window.open(item.bookUrl, "_blank")}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", backgroundColor: "#C4664A", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer" }}
              >
                Book now
              </button>
            )}
            {item.websiteUrl && (
              <button
                type="button"
                onClick={() => window.open(item.websiteUrl, "_blank")}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1.5px solid #EEEEEE", backgroundColor: "#fff", fontSize: "14px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
              >
                Website ↗
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SavedHorizCard({ item, isDesktop, onAddToItinerary, onBook, onLearnMore, assignedDay, onDelete }: {
  item: SavedDisplayItem;
  isDesktop: boolean;
  onAddToItinerary: () => void;
  onBook: () => void;
  onLearnMore: () => void;
  assignedDay?: number;
  onDelete?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const thumbSize = isDesktop ? 96 : 72;
  return (
    <div onClick={onLearnMore} style={{ backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)", border: "1px solid #EEEEEE", overflow: "hidden", display: "flex", flexDirection: "row", alignItems: "stretch", marginBottom: "10px", cursor: "pointer" }}>
      {imgFailed ? (
        <div style={{ width: thumbSize, minWidth: thumbSize, height: thumbSize, backgroundColor: "#F5F0EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {item.icon}
        </div>
      ) : (
        <>
          <div style={{ width: thumbSize, minWidth: thumbSize, height: thumbSize, backgroundImage: `url('${item.img}')`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
          <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
        </>
      )}
      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "3px", minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</p>
        <p style={{ fontSize: "12px", color: "#717171", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.detail}</p>
        {item.statusBooked ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, borderRadius: "20px", padding: "2px 8px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)" }}>
              {item.status}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "5px", marginTop: "4px", flexWrap: "wrap" }}>
            {assignedDay !== undefined ? (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", backgroundColor: "rgba(74,124,89,0.1)", color: "#4a7c59", border: "1px solid rgba(74,124,89,0.2)", whiteSpace: "nowrap" }}>
                ✓ Day {assignedDay + 1}
              </span>
            ) : (
              <button type="button" onClick={e => { e.stopPropagation(); onAddToItinerary(); }} style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", border: "1px solid rgba(196,102,74,0.3)", backgroundColor: "transparent", color: "#C4664A", cursor: "pointer", whiteSpace: "nowrap" }}>+ Itinerary</button>
            )}
            {item.bookUrl && (
              <button type="button" onClick={e => { e.stopPropagation(); onBook(); }} style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Book</button>
            )}
            <button type="button" onClick={e => { e.stopPropagation(); onLearnMore(); }} style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", border: "1px solid #E0E0E0", backgroundColor: "transparent", color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>Learn more</button>
            {onDelete && (
              <button type="button" onClick={e => { e.stopPropagation(); onDelete(); }} style={{ fontSize: "10px", padding: "3px 6px", borderRadius: "20px", border: "1px solid rgba(220,53,69,0.25)", backgroundColor: "transparent", color: "#dc3545", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
          <Users size={10} style={{ color: "#BBBBBB", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "#BBBBBB" }}>{item.families}</span>
        </div>
      </div>
    </div>
  );
}

// ── Real saved items helpers ──────────────────────────────────────────────────

type ApiSavedItem = {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  rawTitle: string | null;
  rawDescription: string | null;
  mediaThumbnailUrl: string | null;
  categoryTags: string[];
  extractedCheckin: string | null;
  extractedCheckout: string | null;
  isBooked: boolean;
};

function inferSavedCategory(item: ApiSavedItem): string {
  const haystack = [...item.categoryTags, item.rawTitle ?? "", item.sourceUrl ?? ""].join(" ").toLowerCase();
  if (/lodg|hotel|resort|hostel|airbnb\.com|booking\.com|vrbo|accommodation/.test(haystack)) return "LODGING";
  if (/flight|airline|airfare|transport/.test(haystack)) return "AIRFARE";
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
  return {
    id: item.id,
    title: item.rawTitle ?? urlHost,
    detail,
    status: item.isBooked ? "Booked" : "Saved",
    statusBooked: item.isBooked,
    families: "",
    img: item.mediaThumbnailUrl ?? "",
    icon,
    bookUrl: isBookable ? (item.sourceUrl ?? undefined) : undefined,
    websiteUrl: item.sourceUrl ?? undefined,
    description: item.rawDescription ?? "",
    isLodging,
    lodgingDates: { checkin: item.extractedCheckin, checkout: item.extractedCheckout },
  };
}

function SavedContent({ tripId: tripIdProp, tripStartDate, tripEndDate, tripTitle }: { tripId?: string; tripStartDate?: string | null; tripEndDate?: string | null; tripTitle?: string }) {
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

  const fetchSaves = useCallback(() => {
    if (!tripIdProp) { setLoading(false); return; }
    fetch(`/api/saves?tripId=${tripIdProp}`, { cache: "no-store" })
      .then(r => r.json())
      .then(({ saves }: { saves: ApiSavedItem[] }) => {
        if (!saves?.length) {
          setLeftSections([]);
          setRightSections([]);
          setLoading(false);
          return;
        }
        const groups: Record<string, SavedDisplayItem[]> = {};
        for (const s of saves) {
          const cat = inferSavedCategory(s);
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(apiToDisplayItem(s));
        }
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
        existing.push({ dayIndex: 0, title: item.title, location: item.detail, img: item.img, savedItemId: item.id });
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

  return (
    <div>
      {(() => {
        const all = [...leftSections, ...rightSections];
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
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1a1a1a", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap" }}>
          {inlineToast}
        </div>
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
              existing.push({ dayIndex, title: dayPickerItem.title, location: dayPickerItem.detail, img: dayPickerItem.img, savedItemId: dayPickerItem.id });
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
              existing.push({ dayIndex: 0, title: lodgingDateItem.title, location: lodgingDateItem.detail, img: lodgingDateItem.img, savedItemId: lodgingDateItem.id });
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
        <SavedDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
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

type RecAddition = { dayIndex: number; title: string; location: string; img: string; savedItemId?: string; lat?: number | null; lng?: number | null };

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

function ItineraryContent({ flyTarget, onFlyTargetConsumed, tripId, tripStartDate, tripEndDate, onSwitchToRecommended, destinationCity, destinationCountry, flights = [], activities = [] }: {
  flyTarget: { lat: number; lng: number } | null;
  onFlyTargetConsumed: () => void;
  tripId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onSwitchToRecommended?: () => void;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  flights?: Flight[];
  activities?: Activity[];
}) {
  const isDesktop = useIsDesktop();
  const [openDay, setOpenDay] = useState(0); // -1 = all collapsed
  const [notes, setNotes] = useState<string[]>([]);
  const [recAdditions, setRecAdditions] = useState<RecAddition[]>([]);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  function toggleSlot(key: string) {
    setExpandedSlotKey(prev => prev === key ? null : key);
  }
  const [suggToast, setSuggToast] = useState(false);

  // Load rec additions from DB on mount (key prop forces remount after each save)
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/itinerary`)
      .then(r => r.json())
      .then(({ items }: { items: Array<{ id: string; rawTitle: string | null; rawDescription: string | null; mediaThumbnailUrl: string | null; dayIndex: number | null; lat?: number | null; lng?: number | null }> }) => {
        if (!items?.length) return;
        setRecAdditions(items.map(item => ({
          dayIndex: item.dayIndex ?? 0,
          title: item.rawTitle ?? "",
          location: item.rawDescription ?? "",
          img: item.mediaThumbnailUrl ?? "",
          savedItemId: item.id,
          lat: item.lat ?? null,
          lng: item.lng ?? null,
        })));
      })
      .catch(e => console.error("[ItineraryRead] API fetch failed:", e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

      {/* Budget prompt or bar */}
      <BudgetPromptBanner tripId={tripId} />

      {/* Split content area */}
      <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", gap: "24px", alignItems: "flex-start" }}>

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
            return (
              <div style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", backgroundColor: "#fff" }}>
                {tripDays.map(({ dayIndex, label, date }, i) => {
                  const isOpen = openDay === i;
                  const dayItems = recAdditions.filter(a => a.dayIndex === dayIndex);
                  const dayFlights = flights.filter(f => f.dayIndex === dayIndex && f.status === "booked");
                  const dayActivities = activities.filter(a => a.dayIndex === dayIndex && (a.status === "confirmed" || a.status === "booked"));
                  return (
                    <div key={i} style={{ borderBottom: i < tripDays.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>

                      {/* Header row */}
                      <div
                        onClick={() => toggle(i)}
                        className="hover:bg-black/[0.02]"
                        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: "10px", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>{label}</span>
                          <span style={{ fontSize: "13px", color: "#717171", whiteSpace: "nowrap" }}>{date}</span>
                          {!isOpen && (dayItems.length > 0 || dayFlights.length > 0 || dayActivities.length > 0) && (
                            <div style={{ display: "flex", gap: "4px", overflow: "hidden", minWidth: 0 }}>
                              {dayFlights.slice(0, 1).map((f) => (
                                <span key={f.id} style={{ fontSize: "11px", background: "rgba(27,58,92,0.1)", color: "#1B3A5C", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "3px" }}>
                                  <Plane size={10} />{f.fromAirport}→{f.toAirport}
                                </span>
                              ))}
                              {dayActivities.slice(0, 1).map((a) => (
                                <span key={a.id} style={{ fontSize: "11px", background: "rgba(107,143,113,0.1)", color: "#4a7c59", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{a.title}</span>
                              ))}
                              {dayItems.slice(0, 2).map((a) => (
                                <span key={a.title} style={{ fontSize: "11px", background: "rgba(0,0,0,0.06)", color: "#666", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{a.title}</span>
                              ))}
                            </div>
                          )}
                          {!isOpen && dayItems.length === 0 && dayFlights.length === 0 && dayActivities.length === 0 && (
                            <span style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>No activities</span>
                          )}
                        </div>
                        <ChevronDown size={16} style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease", flexShrink: 0 }} />
                      </div>

                      {/* Expandable body */}
                      <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
                        <div style={{ padding: "4px 16px 16px" }}>

                          {/* Flights for this day */}
                          {dayFlights.map(f => (
                            <div key={f.id} style={{ backgroundColor: "#F5F8FC", border: "1.5px solid #D8E4F0", borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                              <Plane size={14} style={{ color: "#1B3A5C", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{f.fromAirport} → {f.toAirport} · {f.airline} {f.flightNumber}</p>
                                <p style={{ fontSize: "12px", color: "#717171" }}>{f.departureTime} → {f.arrivalTime}{f.duration ? ` · ${f.duration}` : ""}</p>
                              </div>
                              {f.confirmationCode && (
                                <span style={{ fontSize: "11px", color: "#1B3A5C", fontWeight: 600, backgroundColor: "rgba(27,58,92,0.08)", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{f.confirmationCode}</span>
                              )}
                            </div>
                          ))}

                          {/* Activities (confirmed/booked) for this day */}
                          {dayActivities.map(a => (
                            <div key={a.id} style={{ backgroundColor: "#F5FBF5", border: "1.5px solid #C8E0CA", borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <Compass size={14} style={{ color: "#6B8F71", flexShrink: 0, marginTop: "2px" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>{a.title}</p>
                                {(a.time || a.venueName) && (
                                  <p style={{ fontSize: "12px", color: "#717171", marginBottom: "4px" }}>
                                    {a.time ?? ""}{a.endTime ? ` – ${a.endTime}` : ""}{a.venueName ? ` · ${a.venueName}` : ""}
                                  </p>
                                )}
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "11px", color: a.status === "booked" ? "#4a7c59" : "#1B3A5C", fontWeight: 600, backgroundColor: a.status === "booked" ? "rgba(107,143,113,0.12)" : "rgba(27,58,92,0.08)", borderRadius: "999px", padding: "2px 8px" }}>
                                    {a.status === "booked" ? "Booked" : "Confirmed"}
                                  </span>
                                  {a.confirmationCode && (
                                    <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace" }}>{a.confirmationCode}</span>
                                  )}
                                  {a.website && (
                                    <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600 }}>Book tickets →</a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* User-added items for this day */}
                          {dayItems.map((a, idx) => {
                            const key = `rec-${dayIndex}-${idx}`;
                            return (
                              <FilledSlot
                                key={key}
                                title={a.title}
                                subtitle={a.location}
                                img={a.img}
                                tags={["Added"]}
                                slotKey={key}
                                isExpanded={expandedSlotKey === key}
                                onExpandToggle={() => a.savedItemId ? setDetailItemId(a.savedItemId) : toggleSlot(key)}
                                onRemove={() => {
                                  try {
                                    const stored: RecAddition[] = JSON.parse(localStorage.getItem(ITINERARY_KEY(tripId)) ?? "[]");
                                    const withIndex = stored.map((item, si) => ({ item, si }));
                                    const thisDay = withIndex.filter(({ item }) => item.dayIndex === dayIndex);
                                    const globalIdx = thisDay[idx]?.si;
                                    if (globalIdx !== undefined) {
                                      const updated = stored.filter((_, si) => si !== globalIdx);
                                      localStorage.setItem(ITINERARY_KEY(tripId), JSON.stringify(updated));
                                      setRecAdditions(updated);
                                    }
                                  } catch { /* ignore */ }
                                  setExpandedSlotKey(null);
                                }}
                              />
                            );
                          })}

                          {/* Empty slots */}
                          {dayItems.length === 0 && (
                            <>
                              <AIBanner onSuggest={() => setSuggToast(true)} />
                              <EmptySlot onClick={onSwitchToRecommended} />
                              <EmptySlot onClick={onSwitchToRecommended} />
                            </>
                          )}
                          {dayItems.length > 0 && (
                            <EmptySlot onClick={onSwitchToRecommended} />
                          )}

                          {/* Per-day notes */}
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
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
            );
          })()}
        </div>{/* end left panel */}

        {/* Right panel: map — stacks below on mobile, sticky sidebar on desktop */}
        <div style={{ width: isDesktop ? "42%" : "100%", position: isDesktop ? "sticky" : "relative", top: 0, height: isDesktop ? (leftHeight ? `${leftHeight}px` : "500px") : "300px", minHeight: "260px", maxHeight: "600px" }}>
          <TripMap activeDay={openDay >= 0 ? openDay : 0} flyTarget={flyTarget} onFlyTargetConsumed={onFlyTargetConsumed} tripId={tripId} destinationCity={destinationCity} destinationCountry={destinationCountry} savedItems={recAdditions.filter(a => a.lat != null && a.lng != null) as { title: string; lat: number; lng: number; dayIndex?: number | null }[]} />
        </div>{/* end right panel */}

      </div>

      {showTaskModal && <TaskModal onClose={() => setShowTaskModal(false)} />}
      {detailItemId && <SaveDetailModal itemId={detailItemId} onClose={() => setDetailItemId(null)} />}
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

function PackingContent({ tripId }: { tripId?: string }) {
  const storageKey = `flokk_packing_${tripId ?? "default"}`;
  const typeKey = `flokk_packing_type_${tripId ?? "default"}`;

  const [tripType, setTripType] = useState<string>(() => {
    try { return localStorage.getItem(typeKey) ?? "beach"; } catch { return "beach"; }
  });

  const packingItems = TRIP_TYPE_PACKING[tripType] ?? PACKING_ITEMS;

  const allIds = [
    ...packingItems.documents, ...packingItems.kids,
    ...packingItems.clothing, ...(packingItems.gear ?? []),
    ...TODDLER_ITEMS,
  ].map(i => i.id);

  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw)) : new Set(["passports", "travel-insurance"]);
    } catch { return new Set(["passports", "travel-insurance"]); }
  });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  function handleTripTypeChange(type: string) {
    setTripType(type);
    try { localStorage.setItem(typeKey, type); } catch {}
  }

  const allItems = [
    ...packingItems.documents, ...packingItems.kids,
    ...packingItems.clothing, ...(packingItems.gear ?? []),
    ...TODDLER_ITEMS,
  ];
  const total = allItems.length;
  const packed = allItems.filter(i => checked.has(i.id)).length;
  const progressPct = Math.round((packed / total) * 100);

  return (
    <div>
      {/* Trip type selector */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Trip type</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {TRIP_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTripTypeChange(opt.value)}
              style={{
                padding: "6px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 600,
                border: "1.5px solid",
                borderColor: tripType === opt.value ? "#C4664A" : "#E0E0E0",
                backgroundColor: tripType === opt.value ? "#C4664A" : "#fff",
                color: tripType === opt.value ? "#fff" : "#555",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
          <PackingSection Icon={FileText} photoUrl="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop" label="Documents" count={packingItems.documents.length}>
            {packingItems.documents.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          <PackingSection Icon={Baby} photoUrl="https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600&auto=format&fit=crop" label="Kids" count={packingItems.kids.length}>
            {packingItems.kids.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
        </div>

        {/* Right: Clothing + Gear + Toddler */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <PackingSection Icon={Shirt} gradient="linear-gradient(135deg, #8B6F5E 0%, #C4A882 50%, #D4956A 100%)" label="Clothing" count={packingItems.clothing.length}>
            {packingItems.clothing.map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          {(packingItems.gear ?? []).length > 0 && (
          <PackingSection Icon={Backpack} photoUrl="https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?w=600&auto=format&fit=crop" label="Gear" count={(packingItems.gear ?? []).length}>
            {(packingItems.gear ?? []).map((item) => (
              <PackingItem key={item.id} {...item} checked={checked.has(item.id)} onToggle={toggle} />
            ))}
          </PackingSection>
          )}
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
    return (
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <Compass size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
          No recommendations for {dest} yet
        </p>
        <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>
          We&apos;re constantly adding new destinations. Check back soon — or be the first to contribute a trip from {dest}.
        </p>
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
          href="/profile?tab=stats"
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

function FlightCard({ flight, onDelete, onMarkBooked }: { flight: Flight; onDelete: () => void; onMarkBooked?: () => void }) {
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
        </div>
        <button
          onClick={onDelete}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px", lineHeight: 1 }}
          title="Remove flight"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onDelete, onEdit, onMarkBooked }: { activity: Activity; onDelete: () => void; onEdit: () => void; onMarkBooked?: () => void }) {
  const isBooked = activity.status === "booked";
  const isConfirmed = activity.status === "confirmed";
  const statusColor = isBooked ? "#6B8F71" : isConfirmed ? "#1B3A5C" : "#717171";
  const statusBg = isBooked ? "rgba(107,143,113,0.1)" : isConfirmed ? "rgba(27,58,92,0.1)" : "rgba(0,0,0,0.06)";
  const statusLabel = isBooked ? "Booked" : isConfirmed ? "Confirmed" : "Interested";
  return (
    <div style={{ backgroundColor: "#fff", border: `1.5px solid ${isBooked || isConfirmed ? "#D8E4F0" : "#EEEEEE"}`, borderRadius: "14px", padding: "14px 16px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#1a1a1a" }}>{activity.title}</span>
            <span style={{ fontSize: "11px", backgroundColor: statusBg, color: statusColor, borderRadius: "999px", padding: "2px 8px", fontWeight: 600 }}>{statusLabel}</span>
          </div>
          {/* Date + time */}
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "4px" }}>
            {activity.date}{activity.time ? ` · ${activity.time}` : ""}{activity.endTime ? ` – ${activity.endTime}` : ""}
          </p>
          {/* Venue */}
          {activity.venueName && (
            <p style={{ fontSize: "12px", color: "#717171", marginBottom: "4px" }}>{activity.venueName}</p>
          )}
          {/* Meta row */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {activity.price != null && (
              <span style={{ fontSize: "12px", color: "#555" }}>{activity.currency ?? "USD"} {activity.price.toFixed(2)}</span>
            )}
            {activity.confirmationCode && (
              <span style={{ fontSize: "12px", color: "#555", fontFamily: "monospace" }}>{activity.confirmationCode}</span>
            )}
            {activity.website && (
              <a href={activity.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600 }}>Book →</a>
            )}
            {!isBooked && !isConfirmed && onMarkBooked && (
              <button onClick={onMarkBooked} style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Mark as booked →
              </button>
            )}
          </div>
          {activity.notes && (
            <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", fontStyle: "italic" }}>{activity.notes}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px", lineHeight: 1 }}
            title="Edit activity"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px", lineHeight: 1 }}
            title="Remove activity"
          >
            <Trash2 size={16} />
          </button>
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

export function TripTabContent({ initialTab = "saved", tripId, tripTitle, tripStartDate, tripEndDate, destinationCity, destinationCountry }: { initialTab?: Tab; tripId?: string; tripTitle?: string; tripStartDate?: string | null; tripEndDate?: string | null; destinationCity?: string | null; destinationCountry?: string | null }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [itineraryVersion, setItineraryVersion] = useState(0);
  const [dropLinkOpen, setDropLinkOpen] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ExistingActivity | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

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
  const [isUploading, setIsUploading] = useState(false);
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
      {/* Tab bar + Add button */}
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
        </div>
        {/* Action buttons */}
        {tripId && (
          <div style={{ display: "flex", gap: "6px", marginLeft: "12px", flexShrink: 0 }}>
            <button
              onClick={() => setShowFlightModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "6px 12px",
                backgroundColor: "transparent", color: "#1B3A5C",
                border: "1.5px solid #1B3A5C", borderRadius: "20px",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Plane size={12} /> Flight
            </button>
            <button
              onClick={() => setShowActivityModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "6px 12px",
                backgroundColor: "transparent", color: "#1B3A5C",
                border: "1.5px solid #1B3A5C", borderRadius: "20px",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Compass size={12} /> Activity
            </button>
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
              <Plus size={13} /> Add
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

      {(showActivityModal || editingActivity) && tripId && (
        <AddActivityModal
          tripId={tripId}
          existingActivity={editingActivity ?? undefined}
          onClose={() => { setShowActivityModal(false); setEditingActivity(null); }}
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

      {tab === "saved" && (
        <>
          {flights.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Flights</span>
                <span style={{ fontSize: "11px", color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{flights.length}</span>
              </div>
              {flights.map(f => (
                <FlightCard key={f.id} flight={f} onDelete={() => handleDeleteFlight(f.id)} onMarkBooked={() => handleMarkBooked(f.id)} />
              ))}
            </div>
          )}
          {tripId && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #EEEEEE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Activities {activities.length > 0 && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#bbb" }}>{activities.length}</span>}</span>
                <button
                  onClick={() => setShowActivityModal(true)}
                  style={{ fontSize: "12px", color: "#C4664A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  + Add activity
                </button>
              </div>
              {activities.map(a => (
                <ActivityCard key={a.id} activity={a} onDelete={() => handleDeleteActivity(a.id)} onEdit={() => setEditingActivity(a)} onMarkBooked={() => handleMarkActivityBooked(a.id)} />
              ))}
              {activities.length === 0 && (
                <p style={{ fontSize: "13px", color: "#bbb", fontStyle: "italic", marginBottom: "8px" }}>No activities yet. Add baseball games, tours, events…</p>
              )}
            </div>
          )}
          <SavedContent tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} tripTitle={tripTitle} />
        </>
      )}
      {tab === "itinerary" && <ItineraryContent key={itineraryVersion} flyTarget={flyTarget} onFlyTargetConsumed={() => setFlyTarget(null)} tripId={tripId} tripStartDate={tripStartDate} tripEndDate={tripEndDate} onSwitchToRecommended={() => setTab("recommended")} destinationCity={destinationCity} destinationCountry={destinationCountry} flights={flights} activities={activities} />}
      {tab === "packing" && <PackingContent tripId={tripId} />}
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
                  {(["link", "file", "note"] as const).map(t => (
                    <button key={t} onClick={() => setNewDoc(p => ({ ...p, type: t, url: t !== "link" ? p.url : p.url }))} style={{ flex: 1, padding: "8px", borderRadius: "10px", border: `1.5px solid ${newDoc.type === t ? "#1B3A5C" : "#E8E8E8"}`, backgroundColor: newDoc.type === t ? "#1B3A5C" : "#fff", color: newDoc.type === t ? "#fff" : "#717171", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {t === "link" ? "🔗 Link" : t === "file" ? "📎 File" : "📝 Note"}
                    </button>
                  ))}
                </div>
                {newDoc.type === "link" ? (
                  <input type="url" value={newDoc.url} onChange={e => setNewDoc(p => ({ ...p, url: e.target.value }))} placeholder="https://..." style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                ) : newDoc.type === "file" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="file"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file || !tripId) return;
                        setIsUploading(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch(`/api/trips/${tripId}/vault/upload`, { method: "POST", body: fd });
                          if (!res.ok) throw new Error("Upload failed");
                          const { url, fileName } = await res.json();
                          setNewDoc(p => ({ ...p, url, label: p.label || fileName }));
                        } catch (err) { console.error(err); }
                        finally { setIsUploading(false); }
                      }}
                      style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", fontFamily: "inherit", width: "100%", boxSizing: "border-box", backgroundColor: "#fff" }}
                    />
                    {isUploading && <p style={{ fontSize: "12px", color: "#717171", fontStyle: "italic" }}>Uploading…</p>}
                    {newDoc.url && !isUploading && <p style={{ fontSize: "12px", color: "#6B8F71", fontWeight: 600 }}>✓ File uploaded — add a label and save</p>}
                  </div>
                ) : (
                  <textarea value={newDoc.content} onChange={e => setNewDoc(p => ({ ...p, content: e.target.value }))} placeholder="Paste your note, confirmation number, or details here..." rows={4} style={{ border: "1.5px solid #E8E8E8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", resize: "vertical" }} />
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={!newDoc.label.trim() || isUploading}
                    onClick={async () => {
                      if (!newDoc.label.trim() || !tripId) return;
                      const res = await fetch(`/api/trips/${tripId}/vault/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newDoc) });
                      if (!res.ok) return;
                      const saved = await res.json();
                      setDocuments(p => [...p, saved]);
                      setShowAddDoc(false);
                      setNewDoc({ label: "", type: "link", url: "", content: "" });
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: newDoc.label.trim() && !isUploading ? "#1B3A5C" : "#E0E0E0", color: newDoc.label.trim() && !isUploading ? "#fff" : "#aaa", fontSize: "13px", fontWeight: 700, cursor: newDoc.label.trim() && !isUploading ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Save document
                  </button>
                  <button onClick={() => { setShowAddDoc(false); setNewDoc({ label: "", type: "link", url: "", content: "" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {documents.length === 0 && !showAddDoc ? (
              <p style={{ fontSize: "13px", color: "#bbb", fontStyle: "italic" }}>Save booking confirmations, visa copies, tickets…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {documents.map(d => (
                  <div key={d.id} style={{ backgroundColor: "#fff", border: "1px solid #EEEEEE", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px" }}>{d.type === "link" ? "🔗" : d.type === "file" ? "📎" : "📝"}</span>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{d.label}</span>
                      </div>
                      {d.type === "file" && d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" download style={{ fontSize: "12px", color: "#1B3A5C", fontWeight: 600 }}>{d.label} — Download ↓</a>
                      ) : d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1B3A5C", wordBreak: "break-all" }}>{d.url}</a>
                      ) : null}
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
    </div>
  );
}
