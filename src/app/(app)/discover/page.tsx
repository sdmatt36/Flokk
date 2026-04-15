"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, X, Search } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { getTripCoverImage } from "@/lib/destination-images";

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
  visitorCount: number;
  source: "manual" | "itinerary" | "placeholder";
}

const PICKS_CATEGORY_MAP: Record<string, { types: string[]; keywords: string[] }> = {
  "Food & Drink": {
    types: ["FOOD"],
    keywords: ["restaurant", "cafe", "coffee", "food", "eat", "lunch", "dinner", "breakfast", "bbq", "burger", "taco", "bakery", "bar", "chicken", "korean bbq", "ramen", "sushi", "pizza", "bistro", "brasserie"],
  },
  "Culture": {
    types: ["CULTURE"],
    keywords: ["temple", "shrine", "palace", "museum", "gallery", "village", "historic", "cathedral", "monument", "tower", "hanok", "dmz", "heritage"],
  },
  "Experiences": {
    types: ["ACTIVITY", "FAMILY"],
    keywords: ["teamlab", "experience", "tour", "workshop", "class", "show", "performance", "kids", "children", "family", "zoo", "aquarium", "amusement", "borderless"],
  },
  "Lodging": {
    types: ["LODGING"],
    keywords: ["hotel", "hostel", "inn", "resort", "accommodation", "stay", "moxy", "check-in"],
  },
  "Adventure": {
    types: [],
    keywords: ["hike", "trail", "climb", "surf", "ski", "kayak", "bike", "cycle", "trek", "dive", "bungee", "rafting", "adventure"],
  },
  "Nature": {
    types: ["OUTDOOR"],
    keywords: ["beach", "park", "garden", "mountain", "waterfall", "grove", "nature", "walk", "lake", "river", "forest", "canyon", "cliff", "island"],
  },
  "Shopping": {
    types: ["SHOPPING"],
    keywords: ["market", "mall", "shop", "boutique", "street", "takeshita", "boqueria", "chatuchak", "coex", "myeongdong"],
  },
  "Entertainment": {
    types: ["SPORT"],
    keywords: ["game", "stadium", "arena", "match", "baseball", "football", "soccer", "basketball", "cricket", "rugby", "tennis", "golf", "cable car", "sky cab", "observation", "crossing"],
  },
  "Wellness": {
    types: [],
    keywords: ["spa", "wellness", "yoga", "massage", "onsen", "hot spring", "bath", "sauna", "retreat"],
  },
  "Nightlife": {
    types: [],
    keywords: ["nightlife", "club", "cocktail", "lounge", "pub", "disco"],
  },
  "Other": {
    types: [],
    keywords: [],
  },
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
  const [suggestions,    setSuggestions]    = useState<{cityName: string; countryName: string; placeId?: string}[]>([]);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [communityRatingModal, setCommunityRatingModal] = useState<{ id: string; title: string; city: string | null } | null>(null);
  const [communityRatingValue, setCommunityRatingValue] = useState(0);
  const [communityRatingNotes, setCommunityRatingNotes] = useState("");
  const [communityRatingSubmitting, setCommunityRatingSubmitting] = useState(false);
  const [communityRatedItems, setCommunityRatedItems] = useState<Map<string, number>>(new Map());
  const [communityRatingToast, setCommunityRatingToast] = useState<string | null>(null);
  const [userSavedKeys, setUserSavedKeys] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<DiscoverActivity | null>(null);

  useEffect(() => {
    fetch("/api/saves")
      .then(r => r.json())
      .then(d => {
        const keys = new Set<string>(
          (d.saves ?? []).map((s: { rawTitle: string | null; destinationCity: string | null }) =>
            `${(s.rawTitle ?? "").toLowerCase().trim()}|${(s.destinationCity ?? "").toLowerCase().trim()}`
          )
        );
        setUserSavedKeys(keys);
      })
      .catch((err) => { console.error('[discover] Failed to fetch user saves for isSaved check:', err); });
  }, []);

  useEffect(() => {
    fetch("/api/community/rate")
      .then(r => r.json())
      .then(d => {
        const map = new Map<string, number>();
        for (const item of (d.ratings ?? [])) {
          if (item.placeName && item.rating) {
            map.set((item.placeName as string).toLowerCase().trim(), item.rating as number);
          }
        }
        setCommunityRatedItems(map);
      })
      .catch((err) => { console.error('[discover] Failed to fetch community ratings:', err); });
  }, []);

  useEffect(() => {
    const realFetch = fetch("/api/discover/activities")
      .then(r => r.json())
      .then(d => (d.activities ?? []) as DiscoverActivity[])
      .catch(() => [] as DiscoverActivity[]);

    const placeholderFetch = fetch("/api/discover/placeholder-activities")
      .then(r => r.json())
      .then(d => (d.activities ?? []) as DiscoverActivity[])
      .catch(() => [] as DiscoverActivity[]);

    Promise.all([realFetch, placeholderFetch]).then(([real, placeholders]) => {
      const normalize = (s: string) => s.toLowerCase().trim();
      const GENERIC_WORDS = new Set(["park", "lake", "city", "town", "old", "new", "market", "street", "road", "hill", "bay", "port", "bridge", "walk", "tour", "food", "museum", "temple", "shrine", "garden", "beach", "island"]);
      const REGIONS: string[][] = [
        ["kyoto", "nara", "osaka", "kobe"],
        ["seoul", "busan"],
      ];
      const sameRegion = (cityA: string, cityB: string): boolean => {
        const a = normalize(cityA);
        const b = normalize(cityB);
        if (a === b) return true;
        return REGIONS.some(r => r.some(c => a.includes(c)) && r.some(c => b.includes(c)));
      };
      // Build a map of placeholder imageUrls keyed by normalized title; also store city for city-scoped matching
      const placeholderImageMap = new Map<string, string | null>(
        placeholders.map((p: DiscoverActivity) => [normalize(p.title), p.imageUrl])
      );
      const placeholderEntries = (placeholders as DiscoverActivity[]).map(p => ({
        title: normalize(p.title),
        city: normalize(p.city ?? ""),
        img: p.imageUrl,
      }));
      // For real activities missing an imageUrl: exact title match first, then city-scoped partial word match
      const enrichedReal: DiscoverActivity[] = real.map((a: DiscoverActivity) => {
        if (a.imageUrl) return a;
        const exactMatch = placeholderImageMap.get(normalize(a.title));
        if (exactMatch) return { ...a, imageUrl: exactMatch };
        // Partial word match — city must match, and generic words are excluded
        const actNorm = normalize(a.title);
        const actCity = normalize(a.city ?? "");
        let partialImage: string | null = null;
        for (const pe of placeholderEntries) {
          if (!sameRegion(actCity, pe.city)) continue;
          const words = pe.title.split(/\s+/).filter(w => w.length > 3 && !GENERIC_WORDS.has(w));
          if (words.length > 0 && words.some(w => actNorm.includes(w))) {
            partialImage = pe.img ?? null;
            break;
          }
        }
        return { ...a, imageUrl: partialImage };
      });
      const realKeys = new Set(enrichedReal.map((a: DiscoverActivity) => `${normalize(a.title)}|${normalize(a.city ?? "")}`));
      const dedupedPlaceholders = placeholders.filter(
        (p: DiscoverActivity) => !realKeys.has(`${normalize(p.title)}|${normalize(p.city ?? "")}`)
      );
      // Shuffle for random city mix on default view
      const combined: DiscoverActivity[] = [...enrichedReal, ...dedupedPlaceholders];
      const all: DiscoverActivity[] = combined.sort(() => Math.random() - 0.5);
      allActivitiesRef.current = all;
      setActivityResults(all);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/trips/public?limit=12")
      .then((r) => r.json())
      .then((d) => setPublicTrips(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (searchQuery.length < 2) { setSuggestions([]); return; }
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => { if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current); };
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

  function handleSuggestionClick(cityName: string, countryName: string) {
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setSearchQuery(value);
    setShowSuggestions(false);
    handleSearch(value);
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

  const filteredPicks = (() => {
    const cityCount = new Map<string, number>();
    return activityResults.filter(a => {
      const matchesSearch =
        !picksSearch ||
        a.title.toLowerCase().includes(picksSearch.toLowerCase()) ||
        (a.city ?? "").toLowerCase().includes(picksSearch.toLowerCase());

      const matchesFilter = (() => {
        if (picksFilter === "All" || picksFilter === "Other") return true;
        const rule = PICKS_CATEGORY_MAP[picksFilter];
        if (!rule) return true;
        const titleLower = a.title.toLowerCase();
        const matchesType = rule.types.length > 0 && rule.types.includes(a.type ?? "");
        const matchesKeyword = rule.keywords.length > 0 && rule.keywords.some(k => titleLower.includes(k));
        return matchesType || matchesKeyword;
      })();

      if (!matchesSearch || !matchesFilter) return false;

      // When no search active, cap at 3 per city for a mixed default view
      if (!picksSearch) {
        const key = (a.city ?? "").toLowerCase();
        const count = cityCount.get(key) ?? 0;
        if (count >= 3) return false;
        cityCount.set(key, count + 1);
      }

      return true;
    });
  })();

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
              {suggestions.map((s) => (
                <button
                  key={s.placeId ?? `${s.cityName}-${s.countryName}`}
                  onMouseDown={() => handleSuggestionClick(s.cityName, s.countryName)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                >
                  <MapPin size={13} style={{ color: "#C4664A", flexShrink: 0 }} />
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
                        <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                            {trip.destinationCity ?? destination}
                          </span>
                        </div>
                        {trip.shareToken && (
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
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{trip.title}</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>
                          {[familyName, nights ? `${nights} nights` : null].filter(Boolean).join(" · ")}
                        </p>
                        {trip.shareToken && (
                          <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500 }}>Steal days →</p>
                        )}
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
              onChange={(e) => { setPicksSearch(e.target.value); setShowAllPicks(false); }}
              placeholder="Search a city or activity..."
              style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: "10px", border: "1.5px solid #E0E0E0", fontSize: "14px", color: "#1B3A5C", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "28px", scrollbarWidth: "none", msOverflowStyle: "none" }} className="hide-scrollbar">
            {["All", "Food & Drink", "Culture", "Experiences", "Lodging", "Adventure", "Nature", "Shopping", "Entertainment", "Wellness", "Nightlife", "Other"].map((f) => (
              <button
                key={f}
                onClick={() => { setPicksFilter(f); setShowAllPicks(false); }}
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
              {displayedPicks.map((act) => {
                const isSaved = userSavedKeys.has(
                  `${act.title.toLowerCase().trim()}|${(act.city ?? "").toLowerCase().trim()}`
                );
                return (
                <div key={act.id} onClick={() => setSelectedActivity(act)} style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", cursor: "pointer" }}>
                  <div style={{ height: "160px", backgroundColor: "#1B3A5C1A", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {act.imageUrl ? (
                      <img src={act.imageUrl} alt={act.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", backgroundColor: "#F5F5F4" }} />
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
                    {/* Community rating */}
                    {act.rating !== null && (act.visitorCount ?? 0) >= 2 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span style={{ color: "#f59e0b", fontSize: "13px", letterSpacing: "1px" }}>
                          {"★".repeat(act.rating)}{"☆".repeat(5 - act.rating)}
                        </span>
                        <span style={{ fontSize: "11px", color: "#AAAAAA" }}>
                          {act.visitorCount} families rated this
                        </span>
                      </div>
                    ) : (act.visitorCount ?? 0) === 1 ? (
                      <p style={{ fontSize: "11px", color: "#CCCCCC", marginBottom: "4px" }}>1 family rated this</p>
                    ) : null}
                    {/* Personal rating */}
                    {communityRatedItems.has(act.title.toLowerCase().trim()) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", color: "#AAAAAA" }}>You rated:</span>
                        <div style={{ display: "flex", gap: "1px" }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} style={{ color: i <= (communityRatedItems.get(act.title.toLowerCase().trim()) ?? 0) ? "#f59e0b" : "#d1d5db", fontSize: "13px" }}>★</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "10px" }}>
                      {act.source === "placeholder"
                        ? "Flokk Pick"
                        : act.isAnonymous || !act.familyName
                          ? "A Real Flokker"
                          : `${act.familyName} Family`}
                    </p>
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {act.websiteUrl && (
                        <a href={act.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: "12px", color: "#1B3A5C", textDecoration: "underline", textAlign: "center" }}>
                          Visit site →
                        </a>
                      )}
                      {/* Rate it — only for users who have this place saved */}
                      {isSaved && !communityRatedItems.has(act.title.toLowerCase().trim()) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCommunityRatingModal({ id: act.id, title: act.title, city: act.city }); setCommunityRatingValue(0); setCommunityRatingNotes(""); }}
                          style={{ background: "none", border: "none", padding: "0 0 2px", fontSize: "11px", color: "#AAAAAA", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                        >
                          ★ Rate it
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePickSave(act); }}
                        disabled={savedActivities.has(act.id)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          border: "none",
                          color: "#fff",
                          backgroundColor: savedActivities.has(act.id) ? "#AAAAAA" : "#C4664A",
                          borderRadius: "8px",
                          padding: "8px",
                          cursor: savedActivities.has(act.id) ? "default" : "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                          width: "100%",
                        }}
                      >
                        {savedActivities.has(act.id) ? "Saved ✓" : "Flokk It"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
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

      {/* ── Community rating modal ── */}
      {communityRatingModal && (
        <div
          onClick={() => setCommunityRatingModal(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
              {communityRatingModal.title.length > 40 ? communityRatingModal.title.slice(0, 40) + "…" : communityRatingModal.title}
            </h2>

            {/* Star selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCommunityRatingValue(star)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "28px", color: star <= communityRatingValue ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Notes */}
            <textarea
              placeholder="What did you think?"
              value={communityRatingNotes}
              onChange={(e) => setCommunityRatingNotes(e.target.value)}
              rows={3}
              style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical" }}
            />

            {/* Save button */}
            <button
              disabled={communityRatingValue === 0 || communityRatingSubmitting}
              onClick={async () => {
                if (communityRatingValue === 0) return;
                setCommunityRatingSubmitting(true);
                try {
                  const res = await fetch("/api/community/rate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      placeName: communityRatingModal.title,
                      destinationCity: communityRatingModal.city ?? undefined,
                      rating: communityRatingValue,
                      notes: communityRatingNotes.trim() || undefined,
                    }),
                  });
                  if (res.ok) {
                    setCommunityRatedItems((prev) => new Map(prev).set(communityRatingModal.title.toLowerCase().trim(), communityRatingValue));
                    setCommunityRatingModal(null);
                    setCommunityRatingToast("Rating saved!");
                    setTimeout(() => setCommunityRatingToast(null), 3000);
                  }
                } finally {
                  setCommunityRatingSubmitting(false);
                }
              }}
              style={{ padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: communityRatingValue > 0 ? "#C4664A" : "#E8E8E8", color: communityRatingValue > 0 ? "#fff" : "#aaa", fontSize: 14, fontWeight: 600, cursor: communityRatingValue > 0 ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
            >
              {communityRatingSubmitting ? "Saving…" : "Save rating"}
            </button>

            <button
              type="button"
              onClick={() => setCommunityRatingModal(null)}
              style={{ background: "none", border: "none", padding: 0, fontSize: "13px", color: "#717171", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Activity detail modal ── */}
      {selectedActivity && (
        <div
          onClick={() => setSelectedActivity(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "440px", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
          >
            {/* Image */}
            {selectedActivity.imageUrl && (
              <div style={{ height: "220px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
                <img src={selectedActivity.imageUrl} alt={selectedActivity.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {selectedActivity.rating !== null && selectedActivity.rating >= 3 && (
                  <span style={{ position: "absolute", bottom: "12px", left: "12px", backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px" }}>
                    Flokk Approved
                  </span>
                )}
              </div>
            )}
            {/* Body */}
            <div style={{ padding: "20px 20px 24px", overflowY: "auto", flex: 1, position: "relative" }}>
              {/* Close button */}
              <button
                onClick={() => setSelectedActivity(null)}
                style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "22px", lineHeight: 1, padding: "0 0 0 12px" }}
              >
                <X size={20} />
              </button>
              <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "4px" }}>{selectedActivity.city ?? ""}</p>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "#1B3A5C", marginBottom: "10px", lineHeight: 1.3, paddingRight: "32px" }}>{selectedActivity.title}</p>
              {selectedActivity.ratingNotes && (
                <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.6, marginBottom: "12px" }}>{selectedActivity.ratingNotes}</p>
              )}
              {selectedActivity.rating !== null && (selectedActivity.visitorCount ?? 0) >= 2 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ color: "#f59e0b", fontSize: "16px", letterSpacing: "1px" }}>
                    {"★".repeat(selectedActivity.rating)}{"☆".repeat(5 - selectedActivity.rating)}
                  </span>
                  <span style={{ fontSize: "12px", color: "#AAAAAA" }}>{selectedActivity.visitorCount} families rated this</span>
                </div>
              )}
              <p style={{ fontSize: "12px", color: "#AAAAAA", marginBottom: "20px" }}>
                {selectedActivity.source === "placeholder"
                  ? "Flokk Pick"
                  : selectedActivity.isAnonymous || !selectedActivity.familyName
                    ? "A Real Flokker"
                    : `${selectedActivity.familyName} Family`}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {selectedActivity.websiteUrl && (
                  <a
                    href={selectedActivity.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block", padding: "11px", borderRadius: "10px", border: "2px solid #1B3A5C", backgroundColor: "transparent", color: "#1B3A5C", fontSize: "13px", fontWeight: 700, textAlign: "center", textDecoration: "none", fontFamily: "inherit" }}
                  >
                    Visit site →
                  </a>
                )}
                <button
                  onClick={() => { handlePickSave(selectedActivity); setSelectedActivity(null); }}
                  disabled={savedActivities.has(selectedActivity.id)}
                  style={{ padding: "11px", borderRadius: "10px", border: "none", backgroundColor: savedActivities.has(selectedActivity.id) ? "#AAAAAA" : "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: savedActivities.has(selectedActivity.id) ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                >
                  {savedActivities.has(selectedActivity.id) ? "Saved ✓" : "Flokk It"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rating toast ── */}
      {communityRatingToast && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", padding: "10px 20px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, zIndex: 200, pointerEvents: "none" }}>
          {communityRatingToast}
        </div>
      )}

    </div>
  );
}
