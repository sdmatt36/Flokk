"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MapPin, Calendar, Plus, Map, Search, Plane, Globe, Pencil, Trash2, Sparkles } from "lucide-react";
import { getTripCoverImage } from "@/lib/destination-images";

type Trip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
  heroImageUrl: string | null;
  savedCount: number;
  manualActivityCount: number;
  itineraryItemCount: number;
  dayItemCounts: Record<number, number>;
  wellPlannedDays: number;
  startedDays: number;
  hasFlights: boolean;
  hasLodging: boolean;
  itineraryActivityCount: number;
  packingCount: number;
  shareToken: string | null;
  isAnonymous: boolean;
  familyName: string | null;
};

type UnassignedItem = {
  id: string;
  type: string;
  title: string;
  scheduledDate: string | null;
  address: string | null;
  confirmationCode: string | null;
  totalCost: number | null;
  currency: string | null;
  fromCity: string | null;
  toCity: string | null;
};


const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active now",
  COMPLETED: "Completed",
};
const STATUS_COLOR: Record<string, string> = {
  PLANNING: "#6B8F71",
  ACTIVE: "#C4664A",
  COMPLETED: "#717171",
};

const PLACEHOLDERS = [
  "Where to next?",
  "Plan 5 days in Tokyo with kids...",
  "Beach trip in May under $3k...",
  "Weekend getaway from home...",
  "Best cities for kids who love history...",
];

function diffCalendarDays(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / ms);
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = new Date(start).toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const endStr = new Date(end).toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function calculateReadiness(trip: Trip): { score: number; firstMissing: string | null } {
  let score = 0;
  const missing: string[] = [];

  if (trip.hasFlights) score += 25; else missing.push("flights");
  if (trip.hasLodging) score += 25; else missing.push("accommodation");

  const activityCount = trip.itineraryActivityCount + trip.savedCount;
  if (activityCount >= 3) score += 20; else missing.push("activities");

  if (trip.packingCount > 0) score += 15; else missing.push("packing list");

  missing.push("travel insurance"); // Always nudge — InsureMyTrip affiliate

  return { score, firstMissing: missing[0] ?? null };
}

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: (id: string) => void }) {
  const hero = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const statusColor = STATUS_COLOR[trip.status] ?? "#717171";
  const [displayTitle, setDisplayTitle] = useState(trip.title);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(trip.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const [shareStep, setShareStep] = useState<"idle" | "choose" | "copied">("idle");

  function handleShareClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShareStep("choose");
  }

  async function handleShareChoice(anonymous: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAnonymous: anonymous, isPublic: true }),
    });
    await navigator.clipboard.writeText(`${window.location.origin}/share/${trip.shareToken}`);
    setShareStep("copied");
    setTimeout(() => setShareStep("idle"), 2000);
  }

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  async function commitRename() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === displayTitle) { setIsRenaming(false); setDraftTitle(displayTitle); return; }
    setDisplayTitle(trimmed);
    setIsRenaming(false);
    await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
  }

  // Countdown
  const daysUntil = trip.startDate
    ? diffCalendarDays(new Date(), new Date(trip.startDate))
    : null;
  const showCountdown =
    daysUntil !== null &&
    daysUntil > 0 &&
    daysUntil <= 365 &&
    trip.status !== "COMPLETED";

  const countdownLabel =
    daysUntil === 1
      ? "Tomorrow"
      : daysUntil! <= 30
      ? `${daysUntil} days away`
      : `${Math.round(daysUntil! / 7)} weeks away`;

  // Completion bar — real per-day segments from server
  const totalDays =
    trip.startDate && trip.endDate
      ? diffCalendarDays(new Date(trip.startDate), new Date(trip.endDate)) + 1
      : null;
  const { wellPlannedDays, startedDays, dayItemCounts } = trip;
  const segmentCount = totalDays ? Math.min(totalDays, 20) : 0;

  return (
    <Link href={`/trips/${trip.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className="group hover:shadow-lg transition-shadow" style={{ backgroundColor: "#fff", borderRadius: "20px", overflow: "hidden", border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
        {/* Hero image */}
        <div
          id={`trip-hero-${trip.id}`}
          style={{ height: "140px", position: "relative", overflow: "hidden", backgroundImage: `url('${hero}')`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          {/* Invisible img used only for onError fallback */}
          <img
            src={hero}
            alt=""
            aria-hidden
            style={{ display: "none" }}
            onError={() => {
              const el = document.getElementById(`trip-hero-${trip.id}`);
              if (el) {
                el.style.backgroundImage = "none";
                el.style.background = "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)";
              }
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />

          {/* Countdown chip */}
          {showCountdown && (
            <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 2, backgroundColor: "rgba(27,58,92,0.85)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "5px 12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>{countdownLabel}</span>
            </div>
          )}

          {/* Trip title */}
          <div style={{ position: "absolute", bottom: "12px", left: "16px", right: "60px", zIndex: 2, display: "flex", alignItems: "center", gap: "6px" }}>
            {isRenaming ? (
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setIsRenaming(false); setDraftTitle(displayTitle); } }}
                onClick={e => e.preventDefault()}
                style={{ fontSize: "18px", fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.35)", border: "1.5px solid rgba(255,255,255,0.6)", borderRadius: "8px", padding: "3px 8px", outline: "none", width: "100%", fontFamily: "inherit" }}
              />
            ) : (
              <>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2, textShadow: "0 1px 6px rgba(0,0,0,0.5)", margin: 0 }}>
                  {displayTitle}
                </p>
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setDraftTitle(displayTitle); setIsRenaming(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: "2px", lineHeight: 1, flexShrink: 0 }}
                  title="Rename trip"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>

          {/* Status pill */}
          <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: "20px", padding: "3px 10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: statusColor }}>
              {STATUS_LABEL[trip.status]}
            </span>
          </div>

          {/* Delete button — visible on hover */}
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!confirm("Delete this trip? This cannot be undone.")) return;
              const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
              if (res.ok) onDelete(trip.id);
            }}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-10"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#fff", border: "none", cursor: "pointer" }}
            title="Delete trip"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Details */}
        <div style={{ padding: "12px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {(trip.destinationCity || trip.destinationCountry) && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#2d2d2d", fontWeight: 600 }}>
                    {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {dateRange && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <Calendar size={12} style={{ color: "#717171", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#717171" }}>{dateRange}</span>
                </div>
              )}
            </div>
            {trip.status !== "COMPLETED" ? (() => {
              const { score, firstMissing } = calculateReadiness(trip);
              const radius = 20;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (score / 100) * circumference;
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, minWidth: "60px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>Ready</p>
                  <div style={{ position: "relative", width: "56px", height: "56px" }}>
                    <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
                      <circle cx="28" cy="28" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="4" />
                      <circle
                        cx="28" cy="28" r={radius} fill="none"
                        stroke="#C4664A" strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 0.6s ease" }}
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C" }}>{score}%</span>
                    </div>
                  </div>
                  {firstMissing && (
                    <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "3px", textAlign: "center", maxWidth: "64px", lineHeight: 1.3 }}>Add {firstMissing}</p>
                  )}
                </div>
              );
            })() : (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "#C4664A", lineHeight: 1 }}>
                  {trip.savedCount + trip.manualActivityCount + trip.itineraryItemCount}
                </p>
                <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>
                  {(trip.savedCount + trip.manualActivityCount + trip.itineraryItemCount) === 1 ? "place" : "places"}
                </p>
              </div>
            )}
          </div>

          {/* Completion bar — segmented per day */}
          {totalDays !== null && totalDays > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                {Array.from({ length: segmentCount }).map((_, i) => {
                  const count = dayItemCounts?.[i + 1] ?? 0;
                  const color =
                    count >= 2
                      ? "#C4664A"
                      : count === 1
                      ? "rgba(196,102,74,0.35)"
                      : "#E8E8E8";
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: "6px",
                        borderRadius: "999px",
                        backgroundColor: color,
                        transition: "background-color 0.3s ease",
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: "11px", color: "#717171", marginTop: "5px", display: "block" }}>
                {wellPlannedDays > 0
                  ? `${wellPlannedDays} of ${totalDays} days planned`
                  : startedDays > 0
                  ? `${startedDays} day${startedDays > 1 ? "s" : ""} started`
                  : `${totalDays} days to plan`}
              </span>
            </div>
          )}
        {trip.status === "COMPLETED" && trip.shareToken && (
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end", position: "relative" }}>
            {shareStep === "choose" && (
              <div style={{ position: "absolute", bottom: "28px", right: 0, backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "12px", zIndex: 10, width: "180px" }}>
                <p style={{ fontSize: "11px", color: "#717171", marginBottom: "8px" }}>Share as:</p>
                {trip.familyName && (
                  <button
                    onClick={(e) => handleShareChoice(false, e)}
                    style={{ display: "block", width: "100%", textAlign: "left", fontSize: "13px", color: "#1B3A5C", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}
                  >
                    {trip.familyName} Family
                  </button>
                )}
                <button
                  onClick={(e) => handleShareChoice(true, e)}
                  style={{ display: "block", width: "100%", textAlign: "left", fontSize: "13px", color: "#1B3A5C", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}
                >
                  Stay anonymous
                </button>
              </div>
            )}
            <button
              onClick={handleShareClick}
              style={{ fontSize: "12px", color: shareStep === "copied" ? "#6B8F71" : "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}
            >
              {shareStep === "copied" ? "Link copied" : "Share trip"}
            </button>
          </div>
        )}
      </div>
    </div>
    </Link>
  );
}

export function TripsPageClient({
  trips: initialTrips,
  defaultTab = "upcoming",
}: {
  trips: Trip[];
  defaultTab?: "upcoming" | "past";
}) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const upcoming = trips.filter((t) => t.status !== "COMPLETED");
  const past = trips.filter((t) => t.status === "COMPLETED").sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());

  const [tab, setTab] = useState<"upcoming" | "past">(defaultTab);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const displayed = tab === "upcoming" ? upcoming : past;

  const [unassigned, setUnassigned] = useState<UnassignedItem[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/itinerary/unassigned")
      .then(r => r.json())
      .then((items: UnassignedItem[]) => { if (Array.isArray(items)) setUnassigned(items); })
      .catch(() => {});
  }, []);

  async function handleAssign(itemId: string, tripId: string) {
    if (!tripId) return;
    setAssigningId(itemId);
    try {
      await fetch("/api/itinerary/unassigned", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, tripId }),
      });
      setUnassigned(prev => prev.filter(i => i.id !== itemId));
    } catch { /* ignore */ } finally {
      setAssigningId(null);
    }
  }

  const handleDelete = (id: string) => setTrips((prev) => prev.filter((t) => t.id !== id));

  // TODO: wire to Trip Wizard when built
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalDaysAbroad = trips.reduce((sum, t) => {
    if (!t.startDate || !t.endDate) return sum;
    return sum + diffCalendarDays(new Date(t.startDate), new Date(t.endDate)) + 1;
  }, 0);

  const countriesCount = new Set(
    trips.map((t) => t.destinationCountry).filter(Boolean)
  ).size;

  const tabStyle = (active: boolean) => ({
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
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 800, color: "#1B3A5C", marginBottom: "4px" }}>
              Your trips
            </h1>
            <p style={{ fontSize: "14px", color: "#717171" }}>
              {trips.length > 0
                ? `${trips.length} ${trips.length === 1 ? "trip" : "trips"} total`
                : "Plan your next adventure."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "4px" }}>
            <Link
              href="/tour"
              style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #1B3A5C", color: "#1B3A5C", borderRadius: "12px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, textDecoration: "none", backgroundColor: "transparent" }}
            >
              <Sparkles size={14} />
              Build a Tour
            </Link>
            <Link
              href="/trips/past/new"
              style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#F0F0F0", color: "#1B3A5C", borderRadius: "20px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
            >
              + Add a past trip
            </Link>
            <Link
              href="/trips/new"
              style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "8px 16px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
            >
              <Plus size={15} />
              New trip
            </Link>
          </div>
        </div>

        {/* Search bar — TODO: wire to Trip Wizard when built */}
        <div style={{ position: "relative", marginBottom: "24px" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "16px", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <Search size={16} style={{ color: "#717171" }} />
          </div>
          <input
            type="text"
            placeholder={PLACEHOLDERS[placeholderIndex]}
            style={{
              width: "100%",
              paddingLeft: "44px",
              paddingRight: "16px",
              paddingTop: "14px",
              paddingBottom: "14px",
              borderRadius: "16px",
              border: "1.5px solid #EEEEEE",
              backgroundColor: "#fff",
              fontSize: "14px",
              color: "#1B3A5C",
              outline: "none",
              boxSizing: "border-box" as const,
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
          />
        </div>

        {/* Unassigned bookings */}
        {unassigned.length > 0 && (
          <div style={{ marginBottom: "24px", backgroundColor: "#FFFBEB", border: "1px solid #D97706", borderLeft: "3px solid #C4664A", borderRadius: "12px", padding: "16px 20px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#D97706", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Unassigned bookings ({unassigned.length})
            </p>
            <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px", lineHeight: 1.5 }}>
              These bookings could not be matched to a trip automatically. Assign each one to the correct trip.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {unassigned.map(item => (
                <div key={item.id} style={{ backgroundColor: "#fff", borderLeft: "3px solid #C4664A", borderRadius: "8px", padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                    <p style={{ fontSize: "12px", color: "#717171" }}>
                      {[item.type, item.scheduledDate, item.fromCity && item.toCity ? `${item.fromCity} → ${item.toCity}` : (item.fromCity ?? item.toCity)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <select
                    disabled={assigningId === item.id}
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) handleAssign(item.id, e.target.value); }}
                    style={{ fontSize: "13px", color: "#1B3A5C", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "6px 10px", backgroundColor: "#fff", cursor: "pointer", flexShrink: 0 }}
                  >
                    <option value="" disabled>Assign to trip</option>
                    {trips.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: "20px" }}>
          <button onClick={() => setTab("upcoming")} style={tabStyle(tab === "upcoming")}>
            Upcoming {upcoming.length > 0 && <span style={{ marginLeft: "4px", fontSize: "12px", color: tab === "upcoming" ? "#C4664A" : "#aaa" }}>({upcoming.length})</span>}
          </button>
          <button onClick={() => setTab("past")} style={tabStyle(tab === "past")}>
            Past {past.length > 0 && <span style={{ marginLeft: "4px", fontSize: "12px", color: tab === "past" ? "#C4664A" : "#aaa" }}>({past.length})</span>}
          </button>
        </div>

        {/* Trip cards */}
        {displayed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((trip) => (
              <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div style={{ backgroundColor: "#F5F5F5", borderRadius: "20px", borderLeft: "4px solid #C4664A", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "32px 24px" }}>
            <Map size={32} style={{ color: "#C4664A", marginBottom: "12px" }} />
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
              {tab === "upcoming" ? "No upcoming trips" : "No past trips yet"}
            </p>
            <p style={{ fontSize: "14px", fontStyle: "italic", color: "#C4664A", marginBottom: "8px" }}>
              Save it, plan it, book it, share it.
            </p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, marginBottom: "16px" }}>
              {tab === "upcoming"
                ? "Add a destination, dates, and your saved places."
                : "Your completed trips will appear here."}
            </p>
            {tab === "upcoming" && (
              <Link
                href="/trips/new"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "8px 20px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
              >
                <Plus size={14} />
                Plan a trip
              </Link>
            )}
          </div>
        )}

        {/* Travel stats strip */}
        {trips.length > 0 && (
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #F0F0F0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <div style={{ textAlign: "center", padding: "16px 8px", borderRadius: "16px", backgroundColor: "rgba(27,58,92,0.04)" }}>
                <Plane size={16} style={{ color: "#C4664A", display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#1B3A5C" }}>
                  {trips.length}
                </div>
                <div style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>trips taken</div>
              </div>
              <div style={{ textAlign: "center", padding: "16px 8px", borderRadius: "16px", backgroundColor: "rgba(27,58,92,0.04)" }}>
                <Globe size={16} style={{ color: "#C4664A", display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#1B3A5C" }}>
                  {countriesCount}
                </div>
                <div style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>countries</div>
              </div>
              <div style={{ textAlign: "center", padding: "16px 8px", borderRadius: "16px", backgroundColor: "rgba(27,58,92,0.04)" }}>
                <Calendar size={16} style={{ color: "#C4664A", display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#1B3A5C" }}>
                  {totalDaysAbroad}
                </div>
                <div style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>days abroad</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
