"use client";

import { useState } from "react";
import { ChevronDown, MapPin, BookmarkCheck, Bookmark, ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SerializableItem } from "./ShareActivityCard";
import type { SaveableItem } from "./SaveDayButton";

export interface DayData {
  index: number;
  label: string;
  city: string | null;
  items: SerializableItem[];
  saveItems: SaveableItem[];
}

type RelatedTrip = { id: string | null; city: string; country: string; img: string; tags: string[] };

const RELATED_TRIPS_BY_DEST: Record<string, RelatedTrip[]> = {
  Kyoto: [
    { id: null, city: "Tokyo", country: "Japan", img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kids"] },
    { id: null, city: "Osaka", country: "Japan", img: "https://images.unsplash.com/photo-1589452271712-64b8a66c3570?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Kids"] },
    { id: null, city: "Madrid", country: "Spain", img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Culture"] },
    { id: null, city: "Lisbon", country: "Portugal", img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80", tags: ["Adventure", "History"] },
  ],
  Madrid: [
    { id: null, city: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kid-friendly"] },
    { id: null, city: "Lisbon", country: "Portugal", img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80", tags: ["Adventure", "History"] },
    { id: null, city: "Seville", country: "Spain", img: "https://images.unsplash.com/photo-1558642891-54be180ea339?w=400&auto=format&fit=crop&q=80", tags: ["History", "Culture"] },
    { id: null, city: "Barcelona", country: "Spain", img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&auto=format&fit=crop&q=80", tags: ["Beach", "Culture"] },
  ],
  Lisbon: [
    { id: null, city: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kid-friendly"] },
    { id: null, city: "Madrid", country: "Spain", img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Culture"] },
    { id: null, city: "Porto", country: "Portugal", img: "https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?w=400&auto=format&fit=crop&q=80", tags: ["Food", "History"] },
    { id: null, city: "Seville", country: "Spain", img: "https://images.unsplash.com/photo-1558642891-54be180ea339?w=400&auto=format&fit=crop&q=80", tags: ["History", "Culture"] },
  ],
  Seoul: [
    { id: null, city: "Tokyo", country: "Japan", img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Food"] },
    { id: null, city: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80", tags: ["Culture", "Kids"] },
    { id: null, city: "Bangkok", country: "Thailand", img: "https://images.unsplash.com/photo-1508009603885-50cf7c8dd0d5?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Culture"] },
    { id: null, city: "Taipei", country: "Taiwan", img: "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=400&auto=format&fit=crop&q=80", tags: ["Food", "Kids"] },
  ],
};

export function ShareItineraryView({
  days,
  isLoggedIn,
  isOwner,
  shareToken,
  heroImageUrl,
  tripTitle,
  destination,
  dateRange,
  durationDays,
  curatorName,
  viewCount,
  totalActivityCount,
  tripDestination,
}: {
  days: DayData[];
  isLoggedIn: boolean;
  isOwner: boolean;
  shareToken: string;
  heroImageUrl?: string | null;
  tripTitle: string;
  destination: string;
  dateRange: string | null;
  durationDays: number | null;
  curatorName: string;
  viewCount: number;
  totalActivityCount: number;
  tripDestination: string;
}) {
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set());
  const [heroConfirmOpen, setHeroConfirmOpen] = useState(false);
  const [heroStealing, setHeroStealing] = useState(false);
  const [heroStolen, setHeroStolen] = useState<{ tripId: string; tripTitle: string; copied: number } | null>(null);

  const destinationCity = days[0]?.city ?? null;
  const relatedTrips = RELATED_TRIPS_BY_DEST[destinationCity ?? ""] ?? [];

  // Top tag for stat pill
  const tagCount: Record<string, number> = {};
  for (const day of days) {
    for (const item of day.items) {
      if (item.tag) tagCount[item.tag] = (tagCount[item.tag] ?? 0) + 1;
    }
  }
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Highlight reel: up to 4 items with images across all days
  const highlightItems: SerializableItem[] = [];
  for (const day of days) {
    for (const item of day.items) {
      if (item.imageUrl && highlightItems.length < 4) highlightItems.push(item);
    }
  }

  // Avg rating for social proof
  const ratedItems = days.flatMap(d => d.items).filter(i => i.rating !== null);
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((s, i) => s + i.rating!.rating, 0) / ratedItems.length).toFixed(1)
    : null;

  async function handleHeroSteal() {
    setHeroStealing(true);
    try {
      const res = await fetch("/api/trips/steal-to-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId: string; tripTitle: string; copied: number };
      setHeroStolen(data);
      setHeroConfirmOpen(false);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setHeroStealing(false);
    }
  }

  async function handleStealDay(day: DayData) {
    if (!isLoggedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(`/share/${shareToken}`)}`;
      return;
    }
    for (const item of day.items) {
      if (savedSet.has(item.id) || savingSet.has(item.id)) continue;
      setSavingSet(prev => new Set(prev).add(item.id));
      try {
        const res = await fetch("/api/saves/from-share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            city: item.destinationCity,
            lat: item.lat,
            lng: item.lng,
            placePhotoUrl: item.imageUrl ?? null,
            websiteUrl: item.websiteUrl ?? null,
          }),
        });
        if (res.ok) setSavedSet(prev => new Set(prev).add(item.id));
      } finally {
        setSavingSet(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      }
    }
  }

  async function handleFlokk(item: SerializableItem) {
    const itemId = item.id;
    if (savedSet.has(itemId) || savingSet.has(itemId)) return;
    if (!isLoggedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(`/share/${shareToken}`)}`;
      return;
    }
    setSavingSet(prev => new Set(prev).add(itemId));
    try {
      const res = await fetch("/api/saves/from-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          city: item.destinationCity,
          lat: item.lat,
          lng: item.lng,
          placePhotoUrl: item.imageUrl ?? null,
          websiteUrl: item.websiteUrl ?? null,
        }),
      });
      if (res.ok) setSavedSet(prev => new Set(prev).add(itemId));
    } finally {
      setSavingSet(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }

  return (
    <div>

      {/* ── SECTION 1: Full-viewport hero ── */}
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          backgroundImage: heroImageUrl ? `url('${heroImageUrl}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "24px", maxWidth: "700px", width: "100%" }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, color: "#fff", lineHeight: 1.1, filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.4))" }}>
            {tripTitle}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.25rem", marginTop: "8px" }}>
            {durationDays ? `${durationDays} days in ${destinationCity ?? destination}` : (destinationCity ?? destination)}
            {curatorName ? ` · ${curatorName}` : ""}
          </p>
          {dateRange && (
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", marginTop: "4px" }}>
              {dateRange}
            </p>
          )}

          {/* Stat pills */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
            {[
              `${totalActivityCount} places`,
              `${durationDays ?? "?"} days`,
              ...(topTag ? [topTag] : []),
            ].map((pill) => (
              <span
                key={pill}
                style={{ backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: "9999px", padding: "4px 16px", fontSize: "0.875rem" }}
              >
                {pill}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: "32px" }}>
            {!isOwner && isLoggedIn && (
              <button
                onClick={() => setHeroConfirmOpen(true)}
                style={{ backgroundColor: "#C4664A", color: "#fff", padding: "12px 32px", borderRadius: "9999px", fontSize: "1.125rem", fontWeight: 600, border: "none", cursor: "pointer" }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = "#a85539")}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = "#C4664A")}
              >
                Steal This Itinerary
              </button>
            )}
            {!isLoggedIn && (
              <a
                href={`/sign-up?redirect_url=${encodeURIComponent(`/share/${shareToken}`)}`}
                style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "12px 32px", borderRadius: "9999px", fontSize: "1.125rem", fontWeight: 600, textDecoration: "none" }}
              >
                Plan your own trip free
              </a>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)" }}>
          <ChevronDown size={24} style={{ color: "rgba(255,255,255,0.6)" }} className="animate-bounce" />
        </div>
      </div>

      {/* Hero confirm modal */}
      {heroConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 pb-32"
          onClick={() => setHeroConfirmOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", marginBottom: "8px" }}>
              Start planning {tripDestination}?
            </h2>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "24px", lineHeight: 1.5 }}>
              We&apos;ll create a new {tripDestination} trip and copy all {totalActivityCount} activities into it as saved places. You can organise them into days from there.
            </p>
            <button
              onClick={handleHeroSteal}
              disabled={heroStealing}
              style={{ width: "100%", padding: "14px", borderRadius: "9999px", backgroundColor: heroStealing ? "#E5E5E5" : "#C4664A", color: heroStealing ? "#AAAAAA" : "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: heroStealing ? "not-allowed" : "pointer", marginBottom: "12px" }}
            >
              {heroStealing ? "Creating your trip..." : `Create my ${tripDestination} trip`}
            </button>
            <button
              onClick={() => setHeroConfirmOpen(false)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#AAAAAA", padding: "4px 0", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hero steal success toast */}
      {heroStolen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1B3A5C] text-white text-sm px-4 py-3 rounded-xl shadow-lg flex flex-col items-center gap-2 z-50 w-72 text-center">
          <span className="font-semibold">{heroStolen.tripTitle} created</span>
          <span className="text-xs" style={{ color: "#D1D5DB" }}>{heroStolen.copied} places saved. Add dates to start planning.</span>
          <a href={`/trips/${heroStolen.tripId}`} className="text-[#C4664A] font-semibold text-sm">View trip →</a>
        </div>
      )}

      {/* ── SECTION 2: Highlight reel ── */}
      {highlightItems.length >= 2 && (
        <div style={{ backgroundColor: "#fff", padding: "40px 24px 24px" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C", marginBottom: "16px" }}>
            Trip highlights
          </h2>
          <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar">
            {highlightItems.map((item) => {
              const saved = savedSet.has(item.id);
              const saving = savingSet.has(item.id);
              return (
                <div
                  key={item.id}
                  style={{ width: "224px", flexShrink: 0, borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", position: "relative", cursor: "pointer" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl!}
                    alt={item.title}
                    style={{ width: "224px", height: "224px", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
                  <p style={{ position: "absolute", bottom: "32px", left: "12px", right: "12px", color: "#fff", fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.3 }}>
                    {item.title}
                  </p>
                  {item.tag && (
                    <span style={{ position: "absolute", bottom: "10px", left: "12px", backgroundColor: "#C4664A", color: "#fff", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "9999px" }}>
                      {item.tag}
                    </span>
                  )}
                  <button
                    onClick={() => handleFlokk(item)}
                    disabled={saved || saving}
                    style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(255,255,255,0.9)", color: saved ? "#4a7c59" : "#C4664A", fontSize: "0.75rem", fontWeight: 600, padding: "4px 10px", borderRadius: "9999px", border: "none", cursor: saved ? "default" : "pointer" }}
                  >
                    {saving ? "…" : saved ? "Flokked" : "Flokk It"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Full itinerary ── */}
      {days.length > 0 && (
        <div style={{ backgroundColor: "#fff", padding: "32px 24px" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C", marginBottom: "24px" }}>
            The full itinerary
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {days.map((day) => {
              const allSaved = day.items.length > 0 && day.items.every(it => savedSet.has(it.id));
              return (
                <div key={day.index}>
                  {/* Day header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "9999px", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "0.875rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {day.index}
                    </div>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {day.label}
                    </span>
                  </div>

                  {/* Activity cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {day.items.map((item) => {
                      const saved = savedSet.has(item.id);
                      const saving = savingSet.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="hover:shadow-md transition-shadow"
                          style={{ display: "flex", flexDirection: "row", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #f3f4f6", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}
                        >
                          {/* Left image or placeholder */}
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              style={{ width: "80px", height: "80px", objectFit: "cover", flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: "80px", height: "80px", backgroundColor: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <MapPin size={20} style={{ color: "#d1d5db" }} />
                            </div>
                          )}

                          {/* Right content */}
                          <div style={{ padding: "12px", display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.title}
                            </p>
                            {item.tag && (
                              <span style={{ display: "inline-block", fontSize: "0.75rem", backgroundColor: "rgba(196,102,74,0.1)", color: "#C4664A", padding: "2px 8px", borderRadius: "9999px", width: "fit-content", marginTop: "2px" }}>
                                {item.tag}
                              </span>
                            )}
                            {item.notes && (
                              <p
                                style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}
                              >
                                {item.notes}
                              </p>
                            )}
                            {item.rating && (
                              <p style={{ fontSize: "0.75rem", color: "#C4664A", marginTop: "4px" }}>
                                {"★".repeat(Math.min(5, item.rating.rating))}
                              </p>
                            )}
                            <div style={{ marginTop: "8px", display: "flex", gap: "16px", alignItems: "center" }}>
                              {item.saveable && (
                                <button
                                  onClick={() => handleFlokk(item)}
                                  disabled={saved || saving}
                                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", fontWeight: 500, color: saved ? "#4a7c59" : "#C4664A", background: "none", border: "none", padding: 0, cursor: saved ? "default" : "pointer" }}
                                >
                                  {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                                  {saving ? "Flokking…" : saved ? "Flokked" : "Flokk It"}
                                </button>
                              )}
                              {item.websiteUrl && (
                                <a
                                  href={item.websiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: "0.75rem", color: "#9ca3af", textDecoration: "none", display: "flex", alignItems: "center", gap: "3px" }}
                                  onMouseOver={e => (e.currentTarget.style.color = "#6b7280")}
                                  onMouseOut={e => (e.currentTarget.style.color = "#9ca3af")}
                                >
                                  <ExternalLink size={10} />
                                  Visit site
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Steal this day */}
                  {day.items.length > 0 && (
                    <button
                      onClick={() => handleStealDay(day)}
                      disabled={allSaved}
                      style={{ marginTop: "12px", fontSize: "0.875rem", border: allSaved ? "1px solid rgba(74,124,89,0.3)" : "1px solid #C4664A", color: allSaved ? "#4a7c59" : "#C4664A", backgroundColor: allSaved ? "rgba(74,124,89,0.1)" : "transparent", padding: "6px 16px", borderRadius: "9999px", cursor: allSaved ? "default" : "pointer", transition: "background-color 0.15s, color 0.15s" }}
                      onMouseOver={e => { if (!allSaved) { e.currentTarget.style.backgroundColor = "#C4664A"; e.currentTarget.style.color = "#fff"; } }}
                      onMouseOut={e => { if (!allSaved) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#C4664A"; } }}
                    >
                      {allSaved ? "Day Flokked!" : "Steal this day"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 4: Social proof strip ── */}
      <div style={{ backgroundColor: "#f9fafb", padding: "32px 24px", marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap", textAlign: "center" }}>
          <div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C" }}>{viewCount}</p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>views</p>
          </div>
          <div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C" }}>{totalActivityCount}</p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>activities</p>
          </div>
          <div>
            {avgRating ? (
              <>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C" }}>{avgRating}★</p>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>avg rating</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1B3A5C", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <MapPin size={20} />{destinationCity ?? "—"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>destination</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: "1px", backgroundColor: "#e5e7eb" }} />

      {/* More trips families like yours loved */}
      {relatedTrips.length > 0 && (
        <div style={{ padding: "28px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#1a1a1a" }}>More trips families like yours loved</p>
            <Link href="/discover" style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#C4664A", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
              See all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "12px" }}>
            {relatedTrips.map((trip) => (
              <Link
                key={`${trip.city}-${trip.country}`}
                href="/discover"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div style={{ height: "160px", borderRadius: "14px", overflow: "hidden", position: "relative", backgroundImage: `url('${trip.img}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%)" }} />
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 2, pointerEvents: "none" }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.city}</p>
                    <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>{trip.country}</p>
                  </div>
                  <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 2, display: "flex", gap: "4px", flexWrap: "wrap", pointerEvents: "none" }}>
                    {trip.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: "0.625rem", fontWeight: 700, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: "9999px", padding: "2px 7px", backdropFilter: "blur(4px)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 5: Join CTA (non-logged-in only) ── */}
      {!isLoggedIn && (
        <div style={{ backgroundColor: "#1B3A5C", padding: "64px 24px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.5rem, 4vw, 1.875rem)", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>
            Your family&apos;s next adventure starts here
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.125rem", marginBottom: "32px" }}>
            Save places, build itineraries, and share trips with families like yours.
          </p>
          <a
            href="/sign-up"
            style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "12px 32px", borderRadius: "9999px", fontSize: "1.125rem", fontWeight: 600, textDecoration: "none" }}
          >
            Join Flokk free
          </a>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", marginTop: "16px" }}>
            Already have an account?{" "}
            <a href="/sign-in" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 600 }}>
              Sign in →
            </a>
          </p>
        </div>
      )}

    </div>
  );
}
