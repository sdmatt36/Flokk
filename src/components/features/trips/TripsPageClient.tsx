"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Calendar, Plus, Map, Search, Plane, Globe } from "lucide-react";

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
};

const DEFAULT_HERO = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80";

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

function TripCard({ trip }: { trip: Trip }) {
  const hero = trip.heroImageUrl ?? DEFAULT_HERO;
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const statusColor = STATUS_COLOR[trip.status] ?? "#717171";

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

  // Completion bar
  const totalDays =
    trip.startDate && trip.endDate
      ? diffCalendarDays(new Date(trip.startDate), new Date(trip.endDate)) + 1
      : null;
  const plannedDays =
    totalDays && trip.savedCount > 0
      ? Math.min(trip.savedCount, totalDays)
      : 0;
  const completionPercent =
    totalDays && totalDays > 0
      ? Math.min(100, Math.round((plannedDays / totalDays) * 100))
      : 0;

  return (
    <Link href={`/trips/${trip.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className="hover:shadow-lg transition-shadow" style={{ backgroundColor: "#fff", borderRadius: "20px", overflow: "hidden", border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
        {/* Hero image */}
        <div style={{ height: "140px", position: "relative", overflow: "hidden", backgroundImage: `url('${hero}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />

          {/* Countdown chip */}
          {showCountdown && (
            <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 2, backgroundColor: "rgba(27,58,92,0.85)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "5px 12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>{countdownLabel}</span>
            </div>
          )}

          {/* Trip title */}
          <div style={{ position: "absolute", bottom: "12px", left: "16px", right: "60px", zIndex: 2 }}>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
              {trip.title}
            </p>
          </div>

          {/* Status pill */}
          <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: "20px", padding: "3px 10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: statusColor }}>
              {STATUS_LABEL[trip.status]}
            </span>
          </div>
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
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "#C4664A", lineHeight: 1 }}>
                {trip.savedCount}
              </p>
              <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>
                {trip.savedCount === 1 ? "place" : "places"}
              </p>
            </div>
          </div>

          {/* Completion bar */}
          {totalDays !== null && totalDays > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
              <div style={{ flex: 1, height: "6px", backgroundColor: "#F0F0F0", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#C4664A",
                    borderRadius: "999px",
                    width: `${completionPercent}%`,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "11px", color: "#717171", whiteSpace: "nowrap", flexShrink: 0 }}>
                {plannedDays}/{totalDays} days planned
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function TripsPageClient({ trips }: { trips: Trip[] }) {
  const upcoming = trips.filter((t) => t.status !== "COMPLETED");
  const past = trips.filter((t) => t.status === "COMPLETED");

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const displayed = tab === "upcoming" ? upcoming : past;

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
          <Link
            href="/trips/new"
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "8px 16px", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0, marginTop: "4px" }}
          >
            <Plus size={15} />
            New trip
          </Link>
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
              <TripCard key={trip.id} trip={trip} />
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
