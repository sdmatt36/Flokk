"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar, Plus, Map, Search, Plane, Globe, Pencil, Trash2, Sparkles } from "lucide-react";
import { getTripCoverImage } from "@/lib/destination-images";
import { inferCountryFromCities } from "@/lib/city-country-lookup";
import { bucketTrips } from "@/lib/trip-phase";
import { DeleteTripConfirmModal } from "./DeleteTripConfirmModal";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <>
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(true);
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
                  {(trip.savedCount + trip.manualActivityCount + trip.itineraryItemCount) === 1 ? "spot" : "spots"}
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
    <DeleteTripConfirmModal
      tripId={trip.id}
      tripTitle={trip.title}
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onDeleted={() => {
        setShowDeleteConfirm(false);
        onDelete(trip.id);
      }}
    />
    </>
  );
}

export function TripsPageClient({
  trips: initialTrips,
}: {
  trips: Trip[];
}) {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  // Discipline 4.11: bucketing via shared helper. Reads dates, not status.
  const { current, upcoming, past } = bucketTrips(trips);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [unassigned, setUnassigned] = useState<UnassignedItem[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [formCountry, setFormCountry] = useState("");
  const [formCities, setFormCities] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

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

  async function handleDeleteUnassigned(itemId: string) {
    if (!confirm("Delete this unassigned booking? This cannot be undone.")) return;
    const res = await fetch("/api/itinerary/unassigned", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) {
      alert("Failed to delete.");
      return;
    }
    setUnassigned(prev => prev.filter(i => i.id !== itemId));
  }

  async function handleCreateTripAndAssign(
    itemId: string,
    payload: { country: string; cities: string[]; startDate: string | null; endDate: string | null }
  ) {
    const createRes = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cities: payload.cities,
        country: payload.country,
        countries: payload.country ? [payload.country] : [],
        startDate: payload.startDate,
        endDate: payload.endDate,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { error?: string };
      alert(`Could not create trip: ${err.error ?? "unknown error"}`);
      return;
    }
    const { trip } = await createRes.json() as { trip: { id: string } };
    const assignRes = await fetch("/api/itinerary/unassigned", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, tripId: trip.id }),
    });
    if (!assignRes.ok) {
      alert("Trip created but item could not be attached. Open the trip and try assigning manually.");
      return;
    }
    setUnassigned(prev => prev.filter(i => i.id !== itemId));
    router.refresh();
  }

  function openCreateForm(item: UnassignedItem) {
    setExpandedItemId(item.id);
    const cityList: string[] = [];
    if (item.fromCity) cityList.push(item.fromCity);
    if (item.toCity && item.toCity !== item.fromCity) cityList.push(item.toCity);
    setFormCities(cityList.join(", "));
    // Country priority: city lookup first (covers Tokyo → Japan), then address trailing segment
    // (covers "Merzouga desert, 52202, Morocco"), then empty.
    let country = inferCountryFromCities(cityList) ?? "";
    if (!country && item.address) {
      const parts = item.address.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        const candidate = parts[parts.length - 1];
        if (!/^\d/.test(candidate) && candidate.length >= 2) {
          country = candidate;
        }
      }
    }
    setFormCountry(country);
    setFormStartDate("");
    setFormEndDate("");
  }

  function closeCreateForm() {
    setExpandedItemId(null);
    setFormCountry("");
    setFormCities("");
    setFormStartDate("");
    setFormEndDate("");
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

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#717171",
    marginBottom: "12px",
    marginTop: "0",
  };

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
                <div key={item.id} style={{ backgroundColor: "#fff", borderLeft: "3px solid #C4664A", borderRadius: "8px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                      <p style={{ fontSize: "12px", color: "#717171" }}>
                        {[item.type, item.scheduledDate, item.fromCity && item.toCity ? `${item.fromCity} → ${item.toCity}` : (item.fromCity ?? item.toCity)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
                      <select
                        disabled={assigningId === item.id}
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) handleAssign(item.id, e.target.value); }}
                        style={{ fontSize: "13px", color: "#1B3A5C", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "6px 10px", backgroundColor: "#fff", cursor: "pointer" }}
                      >
                        <option value="" disabled>Assign to trip…</option>
                        {trips.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => expandedItemId === item.id ? closeCreateForm() : openCreateForm(item)}
                        style={{ padding: "6px 10px", fontSize: "13px", fontWeight: 500, color: "#C4664A", background: "transparent", border: "1px solid #C4664A", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {expandedItemId === item.id ? "Cancel" : "Create new trip"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnassigned(item.id)}
                        title="Delete unassigned booking"
                        style={{ padding: "6px 8px", fontSize: 13, color: "#999", background: "transparent", border: "1px solid #D4C4B8", borderRadius: 6, cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {expandedItemId === item.id && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "#FFF8F3", borderRadius: "8px", border: "1px solid #E8D5C8" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                        <label style={{ fontSize: "12px", color: "#1B3A5C" }}>
                          Country
                          <input
                            type="text"
                            value={formCountry}
                            onChange={e => setFormCountry(e.target.value)}
                            placeholder="Morocco"
                            style={{ width: "100%", padding: "6px 8px", marginTop: "2px", border: "1px solid #D4C4B8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                          />
                        </label>
                        <label style={{ fontSize: "12px", color: "#1B3A5C" }}>
                          Cities (comma-separated)
                          <input
                            type="text"
                            value={formCities}
                            onChange={e => setFormCities(e.target.value)}
                            placeholder="Tangier, Marrakech"
                            style={{ width: "100%", padding: "6px 8px", marginTop: "2px", border: "1px solid #D4C4B8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                          />
                        </label>
                        <label style={{ fontSize: "12px", color: "#1B3A5C" }}>
                          Start date (optional)
                          <input
                            type="date"
                            value={formStartDate}
                            onChange={e => setFormStartDate(e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", marginTop: "2px", border: "1px solid #D4C4B8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                          />
                        </label>
                        <label style={{ fontSize: "12px", color: "#1B3A5C" }}>
                          End date (optional)
                          <input
                            type="date"
                            value={formEndDate}
                            onChange={e => setFormEndDate(e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", marginTop: "2px", border: "1px solid #D4C4B8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={closeCreateForm}
                          style={{ padding: "6px 12px", fontSize: "13px", color: "#555", background: "transparent", border: "1px solid #D4C4B8", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cityList = formCities.split(",").map(s => s.trim()).filter(Boolean);
                            if (!formCountry.trim() || cityList.length === 0) {
                              alert("Country and at least one city are required.");
                              return;
                            }
                            handleCreateTripAndAssign(item.id, {
                              country: formCountry.trim(),
                              cities: cityList,
                              startDate: formStartDate || null,
                              endDate: formEndDate || null,
                            });
                            closeCreateForm();
                          }}
                          style={{ padding: "6px 12px", fontSize: "13px", fontWeight: 500, color: "#fff", background: "#C4664A", border: "1px solid #C4664A", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Create and attach
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Happening Now section — omitted when no current trips */}
        {current.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <p style={{ ...sectionHeaderStyle, color: "#C4664A" }}>Happening Now</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {current.map((trip) => (
                <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming section */}
        {upcoming.length > 0 ? (
          <div style={{ marginBottom: "28px" }}>
            <p style={sectionHeaderStyle}>Upcoming</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((trip) => (
                <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        ) : current.length === 0 && past.length === 0 ? (
          <div style={{ backgroundColor: "#F5F5F5", borderRadius: "20px", borderLeft: "4px solid #C4664A", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "32px 24px" }}>
            <Map size={32} style={{ color: "#C4664A", marginBottom: "12px" }} />
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>No upcoming trips</p>
            <p style={{ fontSize: "14px", fontStyle: "italic", color: "#C4664A", marginBottom: "8px" }}>Save it, plan it, book it, share it.</p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, marginBottom: "16px" }}>Add a destination, dates, and your saved places.</p>
            <Link
              href="/trips/new"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "8px 20px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
            >
              <Plus size={14} />
              Plan a trip
            </Link>
          </div>
        ) : null}

        {/* Past section */}
        {past.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <p style={sectionHeaderStyle}>Past</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {past.map((trip) => (
                <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
              ))}
            </div>
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
