"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Search, X, MapPin, Star, ExternalLink, ChevronRight } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { getTripCoverImage } from "@/lib/destination-images";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

// ── Types ────────────────────────────────────────────────────────────────────

export type PlaceItem = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  lat: number | null;
  lng: number | null;
  categoryTags: string[];
  websiteUrl: string | null;
  affiliateUrl: string | null;
  saveCount: number;
  avgRating: number | null;
  tips: Array<{ id: string; category: string; content: string }>;
  tripLinks: Array<{ id: string; title: string }>;
};

type UserTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const INTEL_CATEGORIES = ["All", "Restaurants", "Culture", "Outdoors", "Kids & Family", "Shopping", "Hotels"];

const TIP_LABELS: Record<string, string> = {
  secret:       "Best kept secret",
  mistake:      "Biggest mistake",
  kids:         "With kids",
  worth_it:     "Worth the money",
  not_worth_it: "Not worth it",
  would_return: "Would return",
  general:      "General tip",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          style={{
            color: n <= Math.round(rating) ? "#F4A024" : "#E0E0E0",
            fill:  n <= Math.round(rating) ? "#F4A024" : "#E0E0E0",
          }}
        />
      ))}
      <span style={{ fontSize: "11px", color: "#717171", marginLeft: "4px" }}>{rating.toFixed(1)}</span>
    </div>
  );
}

function CategoryPill({ tag }: { tag: string }) {
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700,
      backgroundColor: "#C4664A", color: "#fff",
      borderRadius: "20px", padding: "2px 8px",
    }}>
      {label}
    </span>
  );
}

const CATEGORY_IMAGES: Record<string, string> = {
  restaurant:    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  food:          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  dining:        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  cafe:          "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
  bar:           "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
  culture:       "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  museum:        "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  temple:        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  shrine:        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  history:       "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  outdoors:      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  nature:        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  hiking:        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  park:          "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&q=80",
  beach:         "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  kids:          "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=800&q=80",
  family:        "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=800&q=80",
  shopping:      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  market:        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
  hotel:         "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  accommodation: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  resort:        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  spa:           "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
  entertainment: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
  nightlife:     "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
};

// Pool of varied place images used when both thumbnail and category are unavailable
const PLACE_FALLBACK_POOL = [
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80", // Asia street
  "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&q=80", // city lights
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80", // market
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80", // paris street
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", // food
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", // travel
  "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80", // temple
  "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80", // outdoor
];

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h;
}

function getCategoryFallback(categoryTags: string[], title = ""): string | null {
  for (const tag of categoryTags) {
    const key = tag.toLowerCase().trim();
    if (CATEGORY_IMAGES[key]) return CATEGORY_IMAGES[key];
    const match = Object.keys(CATEGORY_IMAGES).find(k => key.includes(k) || k.includes(key));
    if (match) return CATEGORY_IMAGES[match];
  }
  // Deterministic per-title fallback so each card looks different
  if (title) return PLACE_FALLBACK_POOL[hashTitle(title) % PLACE_FALLBACK_POOL.length];
  return null;
}

function PhotoArea({
  thumbnailUrl,
  title,
  height = 160,
  destinationCity,
  destinationCountry,
  categoryTags = [],
}: {
  thumbnailUrl: string | null;
  title: string;
  height?: number;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  categoryTags?: string[];
}) {
  const validThumbnail =
    thumbnailUrl &&
    thumbnailUrl.trim() !== "" &&
    !thumbnailUrl.includes("unsplash.com/photo-undefined") &&
    !thumbnailUrl.startsWith("https://unsplash.com/") // page URL, not a CDN image
      ? thumbnailUrl
      : null;
  const imgSrc = validThumbnail ?? getCategoryFallback(categoryTags, title) ?? getTripCoverImage(destinationCity, destinationCountry, null);
  return (
    <div style={{ height, overflow: "hidden", backgroundColor: "#F0F0F0" }}>
      <img
        src={imgSrc}
        alt={title}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = "none";
          if (el.parentElement) {
            el.parentElement.style.background = "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)";
          }
        }}
      />
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function TravelIntelSection({ submitOpen, onSubmitClose }: { submitOpen?: boolean; onSubmitClose?: () => void } = {}) {
  const [city,             setCity]            = useState("");
  const [suggestions,     setSuggestions]     = useState<{cityName: string; countryName: string}[]>([]);
  const [showSuggestions, setShowSuggestions]  = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appliedCity,     setAppliedCity]     = useState("");
  const [category,        setCategory]        = useState("All");
  const [places,          setPlaces]          = useState<PlaceItem[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [displayCount,    setDisplayCount]    = useState(6);
  const [selectedPlace,   setSelectedPlace]   = useState<PlaceItem | null>(null);
  const [addToTripPlace,  setAddToTripPlace]  = useState<PlaceItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Submit modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitUrl,        setSubmitUrl]       = useState("");
  const [submitType,       setSubmitType]      = useState("Article");
  const [submitDest,       setSubmitDest]      = useState("");
  const [submitDestSuggs,  setSubmitDestSuggs] = useState<{cityName: string; countryName: string}[]>([]);
  const submitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitAgeGroups,  setSubmitAgeGroups] = useState<string[]>(["All ages"]);
  const [submitNote,       setSubmitNote]      = useState("");
  const [submitLoading,    setSubmitLoading]   = useState(false);
  const [submitDone,       setSubmitDone]      = useState(false);
  const [submitError,      setSubmitError]     = useState("");

  // City autocomplete via Places API
  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (city.length < 2) { setSuggestions([]); return; }
    cityDebounceRef.current = setTimeout(() => {
      fetch(`/api/destinations/lookup?q=${encodeURIComponent(city)}`)
        .then(r => r.json())
        .then((data: {cityName: string; countryName: string}[]) => setSuggestions(Array.isArray(data) ? data : []))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => { if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current); };
  }, [city]);

  // Sync external submit open trigger
  useEffect(() => { if (submitOpen) setShowSubmitModal(true); }, [submitOpen]);
  function closeSubmit() { closeSubmit(); onSubmitClose?.(); }

  // Submit modal destination autocomplete via Places API
  useEffect(() => {
    if (submitDebounceRef.current) clearTimeout(submitDebounceRef.current);
    if (submitDest.length < 2) { setSubmitDestSuggs([]); return; }
    submitDebounceRef.current = setTimeout(() => {
      fetch(`/api/destinations/lookup?q=${encodeURIComponent(submitDest)}`)
        .then(r => r.json())
        .then((data: {cityName: string; countryName: string}[]) => setSubmitDestSuggs(Array.isArray(data) ? data.slice(0,5) : []))
        .catch(() => setSubmitDestSuggs([]));
    }, 400);
    return () => { if (submitDebounceRef.current) clearTimeout(submitDebounceRef.current); };
  }, [submitDest]);

  // Dismiss suggestions on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch places when filters change
  const fetchPlaces = useCallback(async (cityParam: string, catParam: string) => {
    setIsLoading(true);
    setDisplayCount(6);
    const params = new URLSearchParams();
    if (cityParam) params.set("city", cityParam);
    if (catParam && catParam !== "All") params.set("category", catParam.toLowerCase());
    try {
      const res  = await fetch(`/api/travel-intel?${params.toString()}`);
      const data = await res.json() as { places: PlaceItem[]; total: number };
      setPlaces(data.places ?? []);
    } catch {
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaces(appliedCity, category);
  }, [appliedCity, category, fetchPlaces]);

  function applyCity(val: string) {
    setCity(val);
    setAppliedCity(val);
    setShowSuggestions(false);
  }

  function clearCity() {
    setCity("");
    setAppliedCity("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // Filter invalid place cards
  const filteredPlaces = places.filter((p) =>
    p.destinationCity &&
    !p.title.startsWith("Family of") &&
    !p.title.includes("· Kid")
  );

  const visiblePlaces  = filteredPlaces.slice(0, displayCount);
  const canLoadMore    = displayCount < filteredPlaces.length;

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", margin: 0 }}>
            COMMUNITY ACTIVITY EXPLORER
          </p>
          <button
            onClick={() => { setShowSubmitModal(true); setSubmitDone(false); setSubmitError(""); setSubmitUrl(""); setSubmitType("Article"); setSubmitDest(""); setSubmitAgeGroups(["All ages"]); setSubmitNote(""); }}
            style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A", backgroundColor: "transparent", border: "1.5px solid #C4664A", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}
          >
            Submit content →
          </button>
        </div>
        <h2 className={playfair.className} style={{ fontSize: "26px", fontWeight: 900, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
          Community Picks
        </h2>
        <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>
          Spots and activities saved by families who&apos;ve been there — searchable by destination.
        </p>
      </div>

      {/* City search */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: "14px" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={15} style={{ position: "absolute", left: "14px", color: "#AAAAAA", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search a city or country..."
            value={city}
            onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); if (!e.target.value) clearCity(); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCity(city);
              if (e.key === "Escape") clearCity();
            }}
            style={{ width: "100%", padding: "11px 44px", borderRadius: "999px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#F9F9F9", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {city && (
            <button onClick={clearCity} style={{ position: "absolute", right: "14px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E5E5E5", borderRadius: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" }}>
            {suggestions.map((s) => (
              <button
                key={s.cityName + s.countryName}
                onMouseDown={() => applyCity(s.cityName)}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
              >
                <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                <span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.cityName}</span>
                  {s.countryName && s.countryName !== s.cityName && (
                    <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>· {s.countryName}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category pills */}
      <div
        style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "24px", scrollbarWidth: "none", msOverflowStyle: "none" }}
        className="hide-scrollbar"
      >
        {INTEL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", border: category === cat ? "none" : "1.5px solid #E0E0E0", backgroundColor: category === cat ? "#C4664A" : "#fff", color: category === cat ? "#fff" : "#717171", fontSize: "13px", fontWeight: category === cat ? 700 : 500, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
          >
            {cat}
          </button>
        ))}
      </div>


      {/* Content submission modal */}
      {showSubmitModal && createPortal(
        <div
          onClick={() => closeSubmit()}
          style={{ position: "fixed", inset: 0, zIndex: 600, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Submit content</p>
              <button onClick={() => closeSubmit()} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>
                <X size={20} />
              </button>
            </div>

            {submitDone ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✓</div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Thanks for sharing!</p>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>We&apos;ll review and publish within 48 hours.</p>
                <button
                  onClick={() => closeSubmit()}
                  style={{ marginTop: "20px", padding: "11px 28px", borderRadius: "12px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                  {/* URL */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>URL *</label>
                    <input
                      type="url"
                      value={submitUrl}
                      onChange={e => setSubmitUrl(e.target.value)}
                      placeholder="Paste a link to an article, video or guide..."
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                    />
                  </div>

                  {/* Content type */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Content type *</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {["Article", "Video", "Guide", "Other"].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSubmitType(t)}
                          style={{ padding: "7px 16px", borderRadius: "999px", border: "1.5px solid", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: submitType === t ? "#C4664A" : "#E8E8E8", backgroundColor: submitType === t ? "#C4664A" : "#fff", color: submitType === t ? "#fff" : "#717171" }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Destination */}
                  <div style={{ position: "relative" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Destination *</label>
                    <input
                      type="text"
                      value={submitDest}
                      onChange={e => setSubmitDest(e.target.value)}
                      placeholder="e.g. Seoul, Japan, Kyoto..."
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                    />
                    {submitDestSuggs.length > 0 && submitDest && (
                      <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E8E8E8", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 10, overflow: "hidden" }}>
                        {submitDestSuggs.map(s => (
                          <button
                            key={s.cityName + s.countryName}
                            type="button"
                            onMouseDown={() => { setSubmitDest(s.cityName); setSubmitDestSuggs([]); }}
                            style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                          >
                            <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                            <span>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.cityName}</span>
                              {s.countryName && s.countryName !== s.cityName && (
                                <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>· {s.countryName}</span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Age group */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Age group relevance</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {["All ages", "Under 5", "5–8", "8–12", "Teens"].map(ag => {
                        const active = submitAgeGroups.includes(ag);
                        return (
                          <button
                            key={ag}
                            type="button"
                            onClick={() => {
                              if (ag === "All ages") {
                                setSubmitAgeGroups(["All ages"]);
                              } else {
                                setSubmitAgeGroups(prev => {
                                  const without = prev.filter(x => x !== "All ages");
                                  return active ? without.filter(x => x !== ag) || ["All ages"] : [...without, ag];
                                });
                              }
                            }}
                            style={{ padding: "6px 14px", borderRadius: "999px", border: "1.5px solid", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: active ? "#1B3A5C" : "#E8E8E8", backgroundColor: active ? "#1B3A5C" : "#fff", color: active ? "#fff" : "#717171" }}
                          >
                            {ag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Why useful */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Why is this useful? <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                    <textarea
                      value={submitNote}
                      onChange={e => setSubmitNote(e.target.value)}
                      placeholder="What makes this worth reading for families?"
                      rows={3}
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", backgroundColor: "#fff" }}
                    />
                  </div>

                  {submitError && (
                    <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{submitError}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="button"
                    disabled={!submitUrl.trim() || !submitDest.trim() || submitLoading}
                    onClick={async () => {
                      if (!submitUrl.trim() || !submitDest.trim()) {
                        setSubmitError("URL and destination are required.");
                        return;
                      }
                      setSubmitLoading(true);
                      setSubmitError("");
                      try {
                        const ageGroup = submitAgeGroups.includes("All ages") ? "all" : submitAgeGroups.join(",");
                        const res = await fetch("/api/content/submit", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            url: submitUrl.trim(),
                            contentType: submitType.toLowerCase(),
                            destination: submitDest.trim(),
                            ageGroup,
                            description: submitNote.trim() || null,
                          }),
                        });
                        if (!res.ok) {
                          const d = await res.json() as { error?: string };
                          setSubmitError(d.error ?? "Failed to submit. Please try again.");
                          return;
                        }
                        setSubmitDone(true);
                      } catch {
                        setSubmitError("Network error. Please try again.");
                      } finally {
                        setSubmitLoading(false);
                      }
                    }}
                    style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "#E0E0E0" : "#C4664A", color: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "#aaa" : "#fff", fontSize: "15px", fontWeight: 700, cursor: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "default" : "pointer", fontFamily: "inherit" }}
                  >
                    {submitLoading ? "Submitting..." : "Submit for review"}
                  </button>

                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
