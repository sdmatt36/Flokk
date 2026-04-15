"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, MapPin, BookmarkCheck, Bookmark, ExternalLink, ChevronRight, Sparkles } from "lucide-react";
import { CommunityTripMap, type MarkerDef } from "@/components/features/trips/CommunityTripMap";
import Link from "next/link";
import { getDestinationCoords } from "@/lib/destination-coords";
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

function buildAllMarkers(days: DayData[]): MarkerDef[] {
  const markers: MarkerDef[] = [];
  let num = 0;
  for (const day of days) {
    for (const item of day.items) {
      if (item.lat != null && item.lng != null) {
        num++;
        markers.push({ num, label: item.title, lat: item.lat!, lng: item.lng! });
      }
    }
  }
  return markers;
}

function buildDayMarkers(day: DayData): MarkerDef[] {
  const markers: MarkerDef[] = [];
  let num = 0;
  for (const item of day.items) {
    if (item.lat != null && item.lng != null) {
      num++;
      markers.push({ num, label: item.title, lat: item.lat!, lng: item.lng! });
    }
  }
  return markers;
}

export function ShareItineraryView({
  days,
  isLoggedIn,
  isOwner = false,
  shareToken,
  heroImageUrl: _heroImageUrl,
}: {
  days: DayData[];
  isLoggedIn: boolean;
  isOwner?: boolean;
  shareToken: string;
  heroImageUrl?: string | null;
}) {
  const [tab, setTab] = useState<"itinerary" | "recommended">("itinerary");
  const [openDay, setOpenDay] = useState(-1);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet] = useState<Set<string>>(new Set());
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stealing, setStealing] = useState(false);
  const [stolen, setStolen] = useState<{ tripId: string; tripTitle: string; copied: number } | null>(null);

  useEffect(() => {
    if (!leftPanelRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setLeftHeight(entry.contentRect.height);
    });
    ro.observe(leftPanelRef.current);
    return () => ro.disconnect();
  }, []);

  const destinationCity = days[0]?.city ?? null;
  const allMarkers = buildAllMarkers(days);
  const activeMarkers = openDay >= 0 && days[openDay]
    ? buildDayMarkers(days[openDay])
    : allMarkers;

  const mapCenter = ((): [number, number] => {
    const pts = days.flatMap(d => d.items).filter(i => i.lat != null && i.lng != null);
    if (pts.length > 0) {
      const avgLat = pts.reduce((s, p) => s + p.lat!, 0) / pts.length;
      const avgLng = pts.reduce((s, p) => s + p.lng!, 0) / pts.length;
      return [avgLng, avgLat];
    }
    return getDestinationCoords(destinationCity, null);
  })();

  const relatedTrips = RELATED_TRIPS_BY_DEST[destinationCity ?? ""] ?? [];

  // Derived values for the steal modal
  const tripDestination = destinationCity ?? "this destination";
  const totalActivityCount = days.flatMap(d => d.items).filter(i => i.saveable).length;

  async function handleSteal() {
    setStealing(true);
    try {
      const res = await fetch("/api/trips/steal-to-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId: string; tripTitle: string; copied: number };
      setStolen(data);
      setConfirmOpen(false);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setStealing(false);
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

      {/* ── "Love this trip?" bar ── */}
      {!isOwner && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.4 }}>
            Love this trip? Make it yours.
          </p>
          {isLoggedIn ? (
            <button
              onClick={() => setConfirmOpen(true)}
              style={{ flexShrink: 0, backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "999px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Steal This Itinerary
            </button>
          ) : (
            <a
              href={`/sign-up?redirect_url=${encodeURIComponent(`/share/${shareToken}`)}`}
              style={{ flexShrink: 0, backgroundColor: "#1B3A5C", color: "#fff", borderRadius: "999px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Join Flokk free
            </a>
          )}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "0 20px" }}>
        {(["itinerary", "recommended"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, paddingTop: "4px", paddingBottom: "12px", fontSize: "15px", fontWeight: 600, color: active ? "#1a1a1a" : "#717171", backgroundColor: "transparent", border: "none", borderBottom: active ? "2.5px solid #C4664A" : "2.5px solid transparent", marginBottom: "-1px", cursor: "pointer" }}
            >
              {t === "itinerary" ? "Itinerary" : "Recommended"}
            </button>
          );
        })}
      </div>

      {/* ── Itinerary tab ── */}
      {tab === "itinerary" && (
        <div style={{ padding: "0 24px", overflowX: "hidden" }}>
          {/* Two-column layout: accordion left, map right */}
          <div className="flex flex-col md:flex-row" style={{ gap: "24px", alignItems: "flex-start", paddingTop: "20px" }}>

            {/* Left panel: day accordion */}
            <div ref={leftPanelRef} className="w-full md:w-[58%]" style={{ minWidth: 0 }}>
              <div style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", backgroundColor: "#fff" }}>
                {days.map((day, i) => {
                  const isOpen = openDay === i;
                  // Split "Day 1 · Mon, Jul 4" into bold day number + lighter date
                  const labelParts = day.label.split(" · ");
                  const dayNumLabel = labelParts[0] ?? day.label;
                  const datePart = labelParts[1] ?? null;
                  return (
                    <div key={day.index} style={{ borderBottom: i < days.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>

                      {/* Header row — click to expand/collapse */}
                      <div
                        onClick={() => setOpenDay(isOpen ? -1 : i)}
                        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: "10px", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>{dayNumLabel}</span>
                          {datePart && (
                            <span style={{ fontSize: "13px", color: "#717171", whiteSpace: "nowrap" }}>{datePart}</span>
                          )}
                          {!isOpen && day.items.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", overflow: "hidden", minWidth: 0 }}>
                              {day.items.slice(0, 2).map((item) => (
                                <span
                                  key={item.id}
                                  style={{ fontSize: "11px", background: "rgba(0,0,0,0.06)", color: "#666", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}
                                >
                                  {item.title.length > 18 ? item.title.slice(0, 18) + "…" : item.title}
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
                                onClick={(e) => { e.stopPropagation(); handleStealDay(day); }}
                                disabled={allSaved}
                                style={{ fontSize: "11px", fontWeight: 700, color: allSaved ? "#4a7c59" : "#fff", backgroundColor: allSaved ? "rgba(74,124,89,0.1)" : "#C4664A", border: allSaved ? "1px solid rgba(74,124,89,0.3)" : "none", borderRadius: "999px", padding: "3px 10px", cursor: allSaved ? "default" : "pointer", whiteSpace: "nowrap" }}
                              >
                                {allSaved ? "Flokked!" : "Steal this day"}
                              </button>
                            );
                          })()}
                          <ChevronDown
                            size={16}
                            style={{ color: "#717171", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
                          />
                        </div>
                      </div>

                      {/* Expandable body */}
                      <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: isOpen ? "visible" : "hidden", transition: "max-height 0.3s ease" }}>
                        <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {day.items.map((item, idx) => {
                            const saved = savedSet.has(item.id);
                            const saving = savingSet.has(item.id);
                            return (
                              <div
                                key={item.id}
                                style={{ display: "flex", gap: "10px", alignItems: "flex-start", borderRadius: "10px", padding: "8px", margin: "-8px" }}
                                className="hover:bg-black/[0.02]"
                              >
                                {/* Thumbnail or numbered placeholder */}
                                {item.imageUrl ? (
                                  <div
                                    style={{ width: "56px", height: "56px", borderRadius: "8px", flexShrink: 0, backgroundImage: `url('${item.imageUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }}
                                  />
                                ) : (
                                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, backgroundColor: "rgba(196,102,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#C4664A" }}>{idx + 1}</span>
                                  </div>
                                )}

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{item.title}</p>

                                  {item.notes && (
                                    <p style={{ fontSize: "12px", color: "#717171", marginTop: "2px", lineHeight: 1.4 }}>{item.notes}</p>
                                  )}

                                  {item.tag && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
                                      <span style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: "11px", padding: "2px 8px", borderRadius: "999px" }}>
                                        {item.tag}
                                      </span>
                                    </div>
                                  )}

                                  {item.rating && (
                                    <p style={{ fontSize: "12px", color: "#C4664A", marginTop: "4px" }}>
                                      {"★".repeat(Math.min(5, item.rating.rating))}
                                      {item.rating.notes && (
                                        <span style={{ color: "#717171", fontStyle: "italic", marginLeft: "6px" }}>{item.rating.notes}</span>
                                      )}
                                    </p>
                                  )}

                                  {/* Action row */}
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                                    {item.saveable && (
                                      <button
                                        onClick={() => handleFlokk(item)}
                                        disabled={saved || saving}
                                        style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: saved ? "rgba(74,124,89,0.1)" : "#C4664A", border: saved ? "1.5px solid rgba(74,124,89,0.3)" : "none", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: saved ? "#4a7c59" : "#fff", cursor: saved ? "default" : "pointer" }}
                                      >
                                        {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                                        {saving ? "Flokking…" : saved ? "Flokked" : "Flokk It"}
                                      </button>
                                    )}
                                    {item.lat != null && item.lng != null && (
                                      <button
                                        onClick={() => setFlyTarget({ lat: item.lat!, lng: item.lng! })}
                                        style={{ display: "flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: 600, color: "#C4664A", cursor: "pointer" }}
                                      >
                                        <MapPin size={11} />
                                        Map
                                      </button>
                                    )}
                                    {item.websiteUrl && (
                                      <a
                                        href={item.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", textDecoration: "none" }}
                                      >
                                        <ExternalLink size={11} />
                                        Visit site
                                      </a>
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
            </div>

            {/* Right panel: map — stacks below on mobile, sticky sidebar on desktop */}
            <div className="w-full md:w-[42%]" style={{ position: "sticky", top: "60px", height: leftHeight ? `${leftHeight}px` : "300px", minHeight: "260px", maxHeight: "600px" }}>
              <CommunityTripMap
                allMarkers={activeMarkers}
                center={mapCenter}
                flyTarget={flyTarget}
                onFlyTargetConsumed={() => setFlyTarget(null)}
              />
            </div>

          </div>
        </div>
      )}

      {/* ── Recommended tab ── */}
      {tab === "recommended" && (
        <div style={{ padding: "20px" }}>
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <Sparkles size={32} style={{ color: "#C4664A", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>Recommendations coming soon</p>
            <p style={{ fontSize: "13px", color: "#717171" }}>
              We&apos;re curating top picks for {destinationCity ?? "this destination"}.
            </p>
          </div>
        </div>
      )}

      {/* More trips families like yours loved */}
      {relatedTrips.length > 0 && (
        <div style={{ paddingTop: "28px", paddingBottom: "8px", borderTop: "1px solid #F0F0F0", marginTop: "32px" }}>
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
                href="/discover"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div style={{ height: "160px", borderRadius: "14px", overflow: "hidden", position: "relative", backgroundImage: `url('${trip.img}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%)" }} />
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 2, pointerEvents: "none" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.city}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>{trip.country}</p>
                  </div>
                  <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 2, display: "flex", gap: "4px", flexWrap: "wrap", pointerEvents: "none" }}>
                    {trip.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: "999px", padding: "2px 7px", backdropFilter: "blur(4px)" }}>
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

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 pb-32"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", marginBottom: "8px" }}>
              Start planning {tripDestination}?
            </h2>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "24px", lineHeight: 1.5 }}>
              We&apos;ll create a new {tripDestination} trip and copy all{" "}
              {totalActivityCount} activities into it as saved places. You can
              organise them into days from there.
            </p>
            <button
              onClick={handleSteal}
              disabled={stealing}
              style={{ width: "100%", padding: "14px", borderRadius: "999px", backgroundColor: stealing ? "#E5E5E5" : "#C4664A", color: stealing ? "#AAAAAA" : "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: stealing ? "not-allowed" : "pointer", marginBottom: "12px" }}
            >
              {stealing ? "Creating your trip..." : `Create my ${tripDestination} trip`}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#AAAAAA", padding: "4px 0", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Steal success toast ── */}
      {stolen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1B3A5C] text-white text-sm px-4 py-3 rounded-xl shadow-lg flex flex-col items-center gap-2 z-50 w-72 text-center">
          <span className="font-semibold">{stolen.tripTitle} created</span>
          <span className="text-xs" style={{ color: "#D1D5DB" }}>
            {stolen.copied} places saved. Add dates to start planning.
          </span>
          <a
            href={`/trips/${stolen.tripId}`}
            className="text-[#C4664A] font-semibold text-sm"
          >
            View trip →
          </a>
        </div>
      )}

    </div>
  );
}
