"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, X, Search } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { KNOWN_CITIES } from "@/lib/destination-coords";
import { getTripCoverImage } from "@/lib/destination-images";
import { TravelIntelSection } from "@/components/features/discover/TravelIntelSection";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

type Recommendation = {
  id: string;
  city: string;
  country: string;
  tag: string;
  region: string;
  why: string;
  pickReason: string;
  img: string;
  communityTripId: string | null;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r1",
    city: "Kyoto",
    country: "Japan",
    tag: "Culture",
    region: "Asia",
    why: "UNESCO temples, bamboo forests, and night food markets — ideal for curious kids.",
    pickReason: "Matches your love of history and slow travel with kids.",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-kyoto-may25",
  },
  {
    id: "r2",
    city: "Lisbon",
    country: "Portugal",
    tag: "City Break",
    region: "Europe",
    why: "Mild weather, safe neighborhoods, easy transit, and some of Europe's best pastries.",
    pickReason: "Highly rated by families who value walkability and great food.",
    img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-lisbon-jul25",
  },
  {
    id: "r3",
    city: "Amalfi Coast",
    country: "Italy",
    tag: "Beach",
    region: "Europe",
    why: "Dramatic cliffs, turquoise water, and villages your kids will remember forever.",
    pickReason: "A top pick for families who've loved coastal destinations.",
    img: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r4",
    city: "Prague",
    country: "Czech Republic",
    tag: "Culture",
    region: "Europe",
    why: "Fairy-tale architecture, walkable old town, and budget-friendly family dining.",
    pickReason: "Families who loved Vienna and Budapest consistently rate Prague next.",
    img: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r5",
    city: "Madrid",
    country: "Spain",
    tag: "Food",
    region: "Europe",
    why: "World-class museums, late-night tapas culture, and kid-friendly parks everywhere.",
    pickReason: "Perfect for food-first families who want culture on the side.",
    img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-madrid-jun25",
  },
  {
    id: "r6",
    city: "Barcelona",
    country: "Spain",
    tag: "Outdoor",
    region: "Europe",
    why: "Gaudí, beaches, and a food scene that makes everyone happy — including picky eaters.",
    pickReason: "Ranked #1 by families who want cities with beach access.",
    img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r7",
    city: "Bali",
    country: "Indonesia",
    tag: "Beach",
    region: "Asia",
    why: "Rice terraces, temple ceremonies, and warm shallow seas that kids adore.",
    pickReason: "A consistent favorite for families seeking beach + culture in Asia.",
    img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r8",
    city: "Hokkaido",
    country: "Japan",
    tag: "Adventure",
    region: "Asia",
    why: "World-class skiing, hot springs, and farm-to-table dairy that kids go wild for.",
    pickReason: "Top pick for active families after a Japan alpine experience.",
    img: "https://images.unsplash.com/photo-1542931287-023b922fa89b?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
];

function getDestinationHref(rec: Recommendation): string {
  if (rec.communityTripId) return `/trips/${rec.communityTripId}`;
  return `/trips/new?destination=${encodeURIComponent(rec.city)}&country=${encodeURIComponent(rec.country)}`;
}

const FILTERS = ["All", "Culture", "Food", "Outdoor", "Adventure", "Beach", "City Break", "Asia", "Europe"];

interface DiscoverActivity {
  id: string;
  title: string;
  type: string | null;
  city: string | null;
  rating: number | null;
  ratingNotes: string | null;
  wouldReturn: boolean | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  tripId: string;
  shareToken: string | null;
  familyName: string | null;
  isAnonymous: boolean;
  source: "manual" | "itinerary";
}

const PICKS_TYPE_MAP: Record<string, string[]> = {
  Restaurants: ["FOOD", "food", "RESTAURANT"],
  Culture: ["CULTURE", "culture", "ACTIVITY"],
  Outdoors: ["OUTDOOR", "outdoor", "NATURE"],
  "Kids & Family": ["FAMILY", "family", "KIDS"],
  Shopping: ["SHOPPING", "shopping"],
  Hotels: ["LODGING", "lodging", "HOTEL"],
};

type PublicTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  heroImageUrl: string | null;
  isAnonymous: boolean;
  shareToken: string | null;
  _count: { savedItems: number; placeRatings: number };
  familyProfile: { familyName: string | null; homeCity: string | null } | null;
};

type SearchTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  heroImageUrl: string | null;
  isAnonymous: boolean;
  shareToken: string | null;
  _count: { savedItems: number; placeRatings: number };
  familyProfile: { familyName: string | null; homeCity: string | null } | null;
};

type UserTrip = {
  id: string;
  title: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  startDate?: string | null;
};

// ── Outline button shared style ───────────────────────────────────────────────

const outlineBtn: React.CSSProperties = {
  padding: "12px 32px",
  borderRadius: "999px",
  border: "2px solid #C4664A",
  backgroundColor: "transparent",
  color: "#C4664A",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  // Global search
  const [searchQuery,    setSearchQuery]    = useState("");
  const [suggestions,    setSuggestions]    = useState<string[]>([]);
  const [showSuggestions,setShowSuggestions] = useState(false);
  const [searchResults,  setSearchResults]  = useState<SearchTrip[] | null>(null);
  const [isSearching,    setIsSearching]    = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Community trips
  const [publicTrips,  setPublicTrips]  = useState<PublicTrip[]>([]);
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Get inspired
  const [activeFilter, setActiveFilter] = useState("All");
  const [showAllDest,  setShowAllDest]  = useState(false);

  // Add yours modal
  const [showAddYours,    setShowAddYours]    = useState(false);
  const [userTrips,       setUserTrips]       = useState<UserTrip[]>([]);
  const [isLoadingTrips,  setIsLoadingTrips]  = useState(false);
  const [publishingTrip,  setPublishingTrip]  = useState<string | null>(null);

  // Community Picks
  const [activityResults, setActivityResults] = useState<DiscoverActivity[]>([]);
  const allActivitiesRef = useRef<DiscoverActivity[]>([]);
  const [savedActivities, setSavedActivities] = useState<Set<string>>(new Set());
  const [picksFilter, setPicksFilter]         = useState("All");
  const [picksSearch, setPicksSearch]         = useState("");
  const [showAllPicks, setShowAllPicks]       = useState(false);

  useEffect(() => {
    fetch("/api/discover/activities")
      .then((r) => r.json())
      .then((data) => {
        const all: DiscoverActivity[] = data.activities ?? [];
        allActivitiesRef.current = all;
        setActivityResults(all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/trips/public?limit=12")
      .then((r) => r.json())
      .then((d) => setPublicTrips(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSuggestions([]); return; }
    const q = searchQuery.toLowerCase();
    setSuggestions(KNOWN_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 6));
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    setIsSearching(true);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/trips/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.trips ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSuggestionClick(city: string) {
    setSearchQuery(city);
    setShowSuggestions(false);
    handleSearch(city);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  const handleAddYoursClick = async () => {
    setShowAddYours(true);
    setIsLoadingTrips(true);
    try {
      const res = await fetch("/api/trips");
      const data = await res.json();
      setUserTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const handlePickSave = async (act: DiscoverActivity) => {
    try {
      await fetch("/api/saves/from-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: act.title,
          city: act.city,
          placePhotoUrl: act.imageUrl ?? "",
          websiteUrl: act.websiteUrl ?? "",
          tripId: null,
        }),
      });
      setSavedActivities((prev) => new Set(prev).add(act.id));
    } catch {}
  };

  const filteredPicks = activityResults.filter((a) => {
    const matchesSearch = !picksSearch ||
      a.title.toLowerCase().includes(picksSearch.toLowerCase()) ||
      (a.city ?? "").toLowerCase().includes(picksSearch.toLowerCase());
    const matchesFilter = picksFilter === "All" ||
      (PICKS_TYPE_MAP[picksFilter] ?? []).some((t) =>
        (a.type ?? "").toLowerCase().includes(t.toLowerCase()));
    return matchesSearch && matchesFilter;
  });

  const displayedPicks = showAllPicks ? filteredPicks : filteredPicks.slice(0, 6);

  const filtered      = activeFilter === "All" ? RECOMMENDATIONS : RECOMMENDATIONS.filter((r) => r.tag === activeFilter || r.region === activeFilter);
  const displayedTrips = showAllTrips ? publicTrips : publicTrips.slice(0, 6);
  const displayedDest  = showAllDest  ? filtered    : filtered.slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Page header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "6px" }}>
            Discover
          </h1>
          <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>
            Real trips from real families, plus destinations picked for yours.
          </p>
        </div>

        {/* ── HERO SEARCH BAR ── */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={18} style={{ position: "absolute", left: "18px", color: "#AAAAAA", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search cities, countries, or destinations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSearchResults(null);
              }}
              onFocus={() => { setSearchFocused(true); setShowSuggestions(true); }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery);
                if (e.key === "Escape") clearSearch();
              }}
              style={{
                width: "100%",
                padding: "16px 52px",
                borderRadius: "999px",
                border: `2px solid ${searchFocused ? "#C4664A" : "#E5E5E5"}`,
                fontSize: "15px",
                color: "#1a1a1a",
                backgroundColor: "#FAFAFA",
                outline: "none",
                boxSizing: "border-box",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{ position: "absolute", right: "18px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px", display: "flex", alignItems: "center" }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E5E5E5", borderRadius: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" }}>
              {suggestions.map((city) => (
                <button
                  key={city}
                  onMouseDown={() => handleSuggestionClick(city)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "14px", color: "#1a1a1a", fontFamily: "inherit" }}
                >
                  <MapPin size={13} style={{ color: "#C4664A", flexShrink: 0 }} />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: "12px", color: "#AAAAAA", textAlign: "center", marginTop: "10px" }}>
          Search across trips, places, and destinations
        </p>

        {/* Search results */}
        {(searchResults !== null || isSearching) && (
          <div style={{ marginTop: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>
                {isSearching ? "Searching…" : `${searchResults?.length ?? 0} community trips found`}
              </p>
              <button onClick={clearSearch} style={{ fontSize: "12px", color: "#717171", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Clear
              </button>
            </div>
            {!isSearching && searchResults !== null && searchResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 24px", backgroundColor: "#F9F9F9", borderRadius: "16px", border: "1px solid #EEEEEE" }}>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>No trips found</p>
                <p style={{ fontSize: "13px", color: "#717171" }}>Try a different city or country name.</p>
              </div>
            )}
            {!isSearching && searchResults && searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
                {searchResults.map((trip) => {
                  const cover = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
                  const nights = trip.startDate && trip.endDate
                    ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const searchCardHref = trip.shareToken ? `/share/${trip.shareToken}` : `/trips/${trip.id}`;
                  const searchFamilyName = trip.isAnonymous || !trip.familyProfile?.familyName
                    ? "A Flokk Family"
                    : `${trip.familyProfile.familyName} Family`;
                  return (
                    <Link key={trip.id} href={searchCardHref} style={{ textDecoration: "none", display: "block" }}>
                      <div
                        className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                      >
                        <div style={{ height: "140px", backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        <div style={{ padding: "12px 14px" }}>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>{trip.title}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                            <MapPin size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
                            <span style={{ fontSize: "12px", color: "#717171" }}>
                              {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ fontSize: "11px", color: "#AAAAAA" }}>
                              {[
                                nights ? `${nights} nights` : null,
                                trip._count.savedItems > 0 ? `${trip._count.savedItems} saves` : null,
                                trip._count.placeRatings > 0 ? `${trip._count.placeRatings} ratings` : null,
                                searchFamilyName,
                              ].filter(Boolean).join(" · ")}
                            </p>
                            {trip.shareToken && (
                              <span style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, flexShrink: 0, marginLeft: "8px" }}>
                                Steal days →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2: COMMUNITY TRIPS ── */}
        <div style={{ paddingTop: "64px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", margin: "0 0 6px" }}>
                COMMUNITY TRIPS
              </p>
              <h2 className={playfair.className} style={{ fontSize: "26px", fontWeight: 900, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
                Real trips from Flokk families
              </h2>
              <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>
                Every itinerary below was planned by a family here.
              </p>
            </div>
            <button
              onClick={handleAddYoursClick}
              style={{ flexShrink: 0, marginLeft: "16px", marginTop: "4px", fontSize: "13px", color: "#C4664A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Add yours <ChevronRight size={13} />
            </button>
          </div>

          {publicTrips.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#AAAAAA", padding: "8px 0" }}>Loading trips…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
              {displayedTrips.map((trip) => {
                const coverImage = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
                const nights = trip.startDate && trip.endDate
                  ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");
                const familyName = trip.isAnonymous || !trip.familyProfile?.familyName
                  ? "A Flokk Family"
                  : `${trip.familyProfile.familyName} Family`;
                const cardHref = trip.shareToken ? `/share/${trip.shareToken}` : `/trips/${trip.id}`;
                return (
                  <Link key={trip.id} href={cardHref} style={{ textDecoration: "none", display: "block" }}>
                    <div
                      className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                    >
                      <div style={{ height: "160px", backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
                        <div style={{ position: "absolute", bottom: "10px", left: "12px", right: "12px" }}>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.title}</p>
                        </div>
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                          <MapPin size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
                          <span style={{ fontSize: "12px", color: "#2d2d2d", fontWeight: 600 }}>{destination}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={{ fontSize: "11px", color: "#717171" }}>
                            {[
                              nights ? `${nights} nights` : null,
                              trip._count.savedItems > 0 ? `${trip._count.savedItems} saves` : null,
                              trip._count.placeRatings > 0 ? `${trip._count.placeRatings} ratings` : null,
                              familyName,
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {trip.shareToken && (
                            <span style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, flexShrink: 0, marginLeft: "8px" }}>
                              Steal days →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!showAllTrips && publicTrips.length > 6 && (
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <button onClick={() => setShowAllTrips(true)} style={outlineBtn}>
                See all trips →
              </button>
            </div>
          )}
        </div>

        {/* ── SECTION 3: COMMUNITY ACTIVITY EXPLORER ── */}
        <div style={{ paddingTop: "64px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", margin: 0 }}>
              Community Activity Explorer
            </p>
            <button style={{ flexShrink: 0, marginLeft: "16px", fontSize: "13px", color: "#C4664A", fontWeight: 700, background: "none", border: "1.5px solid #C4664A", borderRadius: "999px", padding: "5px 14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Submit content →
            </button>
          </div>
          <h2 className={playfair.className} style={{ fontSize: "26px", fontWeight: 900, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
            Community Picks
          </h2>
          <p style={{ fontSize: "14px", color: "#717171", marginBottom: "24px" }}>
            Places and activities saved by families who&apos;ve been there — searchable by destination.
          </p>

          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#AAAAAA", pointerEvents: "none" }} />
            <input
              type="text"
              value={picksSearch}
              onChange={(e) => setPicksSearch(e.target.value)}
              placeholder="Search a city or activity..."
              style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: "10px", border: "1.5px solid #E0E0E0", fontSize: "14px", color: "#1B3A5C", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "28px", scrollbarWidth: "none", msOverflowStyle: "none" }} className="hide-scrollbar">
            {["All", "Restaurants", "Culture", "Outdoors", "Kids & Family", "Shopping", "Hotels"].map((f) => (
              <button
                key={f}
                onClick={() => setPicksFilter(f)}
                style={{
                  flexShrink: 0,
                  padding: "7px 16px",
                  borderRadius: "999px",
                  border: picksFilter === f ? "none" : "1.5px solid #E0E0E0",
                  backgroundColor: picksFilter === f ? "#C4664A" : "#fff",
                  color: picksFilter === f ? "#fff" : "#717171",
                  fontSize: "13px",
                  fontWeight: picksFilter === f ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {activityResults.length === 0 && picksSearch === "" && picksFilter === "All" ? (
            <p style={{ fontSize: "13px", color: "#AAAAAA", padding: "8px 0" }}>Loading picks…</p>
          ) : filteredPicks.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#AAAAAA", textAlign: "center", padding: "48px 24px" }}>
              {picksSearch ? `No activities found for "${picksSearch}"` : `No activities in this category yet.`}
            </p>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
              {displayedPicks.map((act) => (
                <div key={act.id} style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
                  <div style={{ height: "160px", backgroundColor: "#1B3A5C1A", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {act.imageUrl ? (
                      <img src={act.imageUrl} alt={act.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span style={{ fontSize: "40px", color: "rgba(27,58,92,0.15)" }}>★</span>
                    )}
                    {act.rating !== null && (
                      <span style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "rgba(255,255,255,0.92)", color: "#1B3A5C", fontSize: "11px", padding: "3px 8px", borderRadius: "999px" }}>
                        {"★".repeat(act.rating)}{"☆".repeat(5 - act.rating)}
                      </span>
                    )}
                    {act.rating !== null && act.rating >= 3 && (
                      <span className="absolute bottom-3 left-3 bg-[#C4664A] text-white text-xs px-2 py-1 rounded-full font-medium">
                        Flokk Approved
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
                    <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "3px" }}>{act.city ?? ""}</p>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", marginBottom: "4px", lineHeight: 1.3 }}>{act.title}</p>
                    {act.ratingNotes && (
                      <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{act.ratingNotes}</p>
                    )}
                    <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "10px" }}>
                      {"A Flokk Family"}
                    </p>
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {act.websiteUrl && (
                        <a href={act.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1B3A5C", textDecoration: "underline", textAlign: "center" }}>
                          View venue →
                        </a>
                      )}
                      <button
                        onClick={() => handlePickSave(act)}
                        disabled={savedActivities.has(act.id)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          border: `1.5px solid ${savedActivities.has(act.id) ? "#D0D0D0" : "#C4664A"}`,
                          color: savedActivities.has(act.id) ? "#AAAAAA" : "#C4664A",
                          backgroundColor: "transparent",
                          borderRadius: "8px",
                          padding: "8px",
                          cursor: savedActivities.has(act.id) ? "default" : "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        {savedActivities.has(act.id) ? "Saved ✓" : "+ Save"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredPicks.length > 6 && !showAllPicks && (
              <div style={{ textAlign: "center", marginTop: "32px" }}>
                <button
                  onClick={() => setShowAllPicks(true)}
                  style={{ padding: "10px 28px", borderRadius: "999px", border: "2px solid #1B3A5C", backgroundColor: "transparent", color: "#1B3A5C", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                >
                  Load more places →
                </button>
              </div>
            )}
            </>
          )}
        </div>

        {/* ── SECTION 4: TRAVEL INTEL ── */}
        <div style={{ paddingTop: "64px" }}>
          <TravelIntelSection />
        </div>

        {/* ── SECTION 4: GET INSPIRED ── */}
        <div style={{ paddingTop: "64px" }}>
          <div style={{ marginBottom: "32px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", margin: "0 0 6px" }}>
              GET INSPIRED
            </p>
            <h2 className={playfair.className} style={{ fontSize: "26px", fontWeight: 900, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
              Destinations picked for your family
            </h2>
          </div>

          {/* Filter pills */}
          <div
            style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "32px", scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="hide-scrollbar"
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setShowAllDest(false); }}
                style={{
                  flexShrink: 0,
                  padding: "7px 16px",
                  borderRadius: "999px",
                  border: activeFilter === f ? "none" : "1.5px solid #E0E0E0",
                  backgroundColor: activeFilter === f ? "#C4664A" : "#fff",
                  color: activeFilter === f ? "#fff" : "#717171",
                  fontSize: "13px",
                  fontWeight: activeFilter === f ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
              {displayedDest.map((rec) => (
                <Link key={rec.id} href={getDestinationHref(rec)} style={{ textDecoration: "none", display: "block" }}>
                  <div
                    className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                  >
                    <div style={{ height: "160px", backgroundImage: `url(${rec.img})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                      <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                          {rec.tag}
                        </span>
                      </div>
                      {rec.communityTripId && (
                        <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(27,58,92,0.85)", backdropFilter: "blur(4px)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                            Community trip
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                        <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{rec.city}, {rec.country}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>{rec.why}</p>
                      <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500 }}>{rec.pickReason}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#717171" }}>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>No destinations here yet</p>
              <p style={{ fontSize: "13px" }}>More {activeFilter} picks coming soon.</p>
            </div>
          )}

          {!showAllDest && filtered.length > 6 && (
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <button onClick={() => setShowAllDest(true)} style={outlineBtn}>
                See more destinations →
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Add yours modal ── */}
      {showAddYours && (
        <div
          onClick={() => setShowAddYours(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "520px", backgroundColor: "#fff", borderRadius: "20px 20px 0 0", padding: "24px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>Share a trip</h3>
                <p style={{ fontSize: "13px", color: "#717171" }}>Help families planning these destinations</p>
              </div>
              <button
                onClick={() => setShowAddYours(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "22px", lineHeight: 1, padding: "0 0 0 12px" }}
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {isLoadingTrips ? (
                <p style={{ fontSize: "14px", color: "#717171", padding: "16px 0", textAlign: "center" }}>Loading your trips...</p>
              ) : userTrips.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>
                    No trips yet — add one to share with the community.
                  </p>
                  <Link
                    href="/trips/new"
                    onClick={() => setShowAddYours(false)}
                    style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#1B3A5C", color: "#fff", fontWeight: 700, fontSize: "14px", borderRadius: "999px", textDecoration: "none" }}
                  >
                    Create a trip →
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {userTrips.map((trip) => (
                    <div
                      key={trip.id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#F9F9F9", borderRadius: "12px", border: "1px solid #EEEEEE" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {trip.title}
                        </p>
                        <p style={{ fontSize: "12px", color: "#717171" }}>
                          {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                          {trip.startDate ? ` · ${new Date(trip.startDate).getFullYear()}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          setPublishingTrip(trip.id);
                          try {
                            await fetch(`/api/trips/${trip.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ privacy: "PUBLIC" }),
                            });
                            setShowAddYours(false);
                            alert("Trip shared with the Flokk community! 🎉");
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setPublishingTrip(null);
                          }
                        }}
                        disabled={publishingTrip === trip.id}
                        style={{ marginLeft: "12px", padding: "8px 16px", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "12px", fontWeight: 600, borderRadius: "12px", border: "none", cursor: publishingTrip === trip.id ? "default" : "pointer", opacity: publishingTrip === trip.id ? 0.4 : 1, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", transition: "opacity 0.15s" }}
                      >
                        {publishingTrip === trip.id ? "Sharing..." : "Share trip"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "16px", lineHeight: 1.5 }}>
                Shared trips are visible to all Flokk families. You can make them private again from your trip settings.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
