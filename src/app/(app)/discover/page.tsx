"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, X, Search, Plus, CalendarPlus, Pencil } from "lucide-react";
import { EditSpotModal, type EditableSpot } from "@/components/features/discover/EditSpotModal";
import { SpotImage } from "@/components/shared/SpotImage";
import { Playfair_Display } from "next/font/google";
import { getTripCoverImage } from "@/lib/destination-images";
import { CATEGORIES } from "@/lib/categories";
import { AddToItineraryModal } from "@/components/places/AddToItineraryModal";
import type { AddToItinerarySpot } from "@/components/places/AddToItineraryModal";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import type { UserSpotRating } from "@/app/api/community/user-ratings/route";

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
  "Nature & Outdoors": {
    types: ["OUTDOOR"],
    keywords: ["beach", "park", "garden", "mountain", "waterfall", "grove", "nature", "walk", "lake", "river", "forest", "canyon", "cliff", "island"],
  },
  "Shopping": {
    types: ["SHOPPING"],
    keywords: ["market", "mall", "shop", "boutique", "street", "takeshita", "boqueria", "chatuchak", "coex", "myeongdong"],
  },
  "Sports & Entertainment": {
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

// ── Places Tab ────────────────────────────────────────────────────────────────

type CommunityPlace = {
  id: string;
  name: string;
  city: string | null;
  placeType: string | null;
  category: string | null;
  description: string | null;
  image: string | null;
  photoUrl: string | null;
  address: string | null;
  website: string | null;
  websiteUrl: string | null;
  lat: number | null;
  lng: number | null;
  ratingCount: number;
  avgRating: number | null;
  sampleNote: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
};

// Spot type filter: slug is sent to the API, label is displayed in the pill button.
// "All" is a sentinel handled separately in the render.


function parseCityFromAddress(address: string): string {
  if (!address) return "";

  // Japanese address: find segment with postal code (〒 or NNN-NNNN pattern)
  // Format: "Japan, 〒150-0041 Tokyo, Shibuya, ..." → extract "Tokyo"
  const jpMatch = address.match(/〒?\d{3}-\d{4}\s+([^\s,]+)/);
  if (jpMatch) return jpMatch[1];

  // Western address: city is 3rd from end
  // "132 W 31st St, New York, NY 10001, United States" → "New York"
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length === 2) return parts[0];
  return parts[0] ?? "";
}

function PlacesTab() {
  const [placeCity, setPlaceCity] = useState("");
  const [placeType, setPlaceType] = useState("All");
  const [places, setPlaces] = useState<CommunityPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [citySuggestions, setCitySuggestions] = useState<{cityName: string; countryName: string; placeId?: string}[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  const [availablePillCities, setAvailablePillCities] = useState<{ city: string; placeCount: number }[]>([]);

  useEffect(() => {
    fetch("/api/places/cities")
      .then(r => r.json())
      .then(d => setAvailablePillCities(d.cities ?? []))
      .catch(() => setAvailablePillCities([]));
  }, []);

  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [apName, setApName] = useState("");
  const [apAddress, setApAddress] = useState("");
  const [apCity, setApCity] = useState("");
  const [apType, setApType] = useState("");
  const [apRating, setApRating] = useState(0);
  const [apNotes, setApNotes] = useState("");
  const [apLat, setApLat] = useState<number | null>(null);
  const [apLng, setApLng] = useState<number | null>(null);
  const [apSuggestions, setApSuggestions] = useState<Array<{place_id: string; name: string; formatted_address: string; photoUrl?: string; geometry?: {location: {lat: number; lng: number}}}>>([]);
  const [showApSuggestions, setShowApSuggestions] = useState(false);
  const [apWebsite, setApWebsite] = useState("");
  const [apImageUrl, setApImageUrl] = useState<string | null>(null);
  const [apCitySuggestions, setApCitySuggestions] = useState<{cityName: string; countryName: string; placeId?: string}[]>([]);
  const [apShowCitySuggestions, setApShowCitySuggestions] = useState(false);
  const apCityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apCityDebounce2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apCityRef = useRef<HTMLDivElement>(null);
  const apCityValueRef = useRef("");
  const [flokkConfirmedId, setFlokkConfirmedId] = useState<string | null>(null);
  const [clipCopiedId, setClipCopiedId] = useState<string | null>(null);
  const [itineraryModalSpot, setItineraryModalSpot] = useState<AddToItinerarySpot | null>(null);
  const [itineraryConfirmation, setItineraryConfirmation] = useState<{ placeId: string; tripName: string; day: number } | null>(null);
  const [editingSpot, setEditingSpot] = useState<EditableSpot | null>(null);
  const itineraryConfirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [apSaving, setApSaving] = useState(false);
  const [apAddToTrip, setApAddToTrip] = useState(false);
  const [apTrips, setApTrips] = useState<Array<{id: string; title: string; destinationCity: string | null; destinationCountry: string | null; startDate: string | null; endDate: string | null; status: string}>>([]);
  const [apTripsLoading, setApTripsLoading] = useState(false);
  const [apTripsLoaded, setApTripsLoaded] = useState(false);
  const [apSelectedTripId, setApSelectedTripId] = useState<string | null>(null);
  const [apDay, setApDay] = useState(1);
  const [apMaxDays, setApMaxDays] = useState(30);
  const [addPlaceToast, setAddPlaceToast] = useState<string | null>(null);
  const apDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCitySuggestions(false);
      if (apRef.current && !apRef.current.contains(e.target as Node)) setShowApSuggestions(false);
      if (apCityRef.current && !apCityRef.current.contains(e.target as Node)) setApShowCitySuggestions(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (apDebounce.current) clearTimeout(apDebounce.current);
    if (apName.length < 3) { setApSuggestions([]); return; }
    apDebounce.current = setTimeout(async () => {
      try {
        const cityParam = apCityValueRef.current.trim() ? `&city=${encodeURIComponent(apCityValueRef.current.trim())}` : "";
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(apName)}${cityParam}`);
        const data = await res.json() as { places: Array<{place_id: string; name: string; formatted_address: string; photoUrl?: string; geometry?: {location: {lat: number; lng: number}}}>};
        setApSuggestions(Array.isArray(data.places) ? data.places.slice(0, 5) : []);
        setShowApSuggestions(true);
      } catch { setApSuggestions([]); }
    }, 400);
    return () => { if (apDebounce.current) clearTimeout(apDebounce.current); };
  }, [apName]);

  useEffect(() => {
    if (apCityDebounce.current) clearTimeout(apCityDebounce.current);
    if (apCity.length < 2) { setApCitySuggestions([]); return; }
    apCityDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(apCity)}`);
        const data = await res.json();
        setApCitySuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
        setApShowCitySuggestions(true);
      } catch { setApCitySuggestions([]); }
    }, 400);
    return () => { if (apCityDebounce.current) clearTimeout(apCityDebounce.current); };
  }, [apCity]);

  useEffect(() => {
    if (apName.length < 3) return;
    if (apCityDebounce2.current) clearTimeout(apCityDebounce2.current);
    apCityDebounce2.current = setTimeout(async () => {
      try {
        const cityParam = apCityValueRef.current.trim()
          ? "&city=" + encodeURIComponent(apCityValueRef.current.trim())
          : "";
        const res = await fetch("/api/places/search?q=" + encodeURIComponent(apName) + cityParam);
        const data = await res.json() as { places: Array<{place_id: string; name: string; formatted_address: string; photoUrl?: string; geometry?: {location: {lat: number; lng: number}}}>};
        setApSuggestions(Array.isArray(data.places) ? data.places.slice(0, 5) : []);
        setShowApSuggestions(true);
      } catch { setApSuggestions([]); }
    }, 600);
    return () => { if (apCityDebounce2.current) clearTimeout(apCityDebounce2.current); };
  }, [apCity]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (placeCity.length < 2) { setCitySuggestions([]); return; }
    cityDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(placeCity)}`);
        const data = await res.json();
        setCitySuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
        setShowCitySuggestions(true);
      } catch { setCitySuggestions([]); }
    }, 400);
    return () => { if (cityDebounce.current) clearTimeout(cityDebounce.current); };
  }, [placeCity]);

  useEffect(() => {
    setPlacesLoading(true);
    const params = new URLSearchParams();
    if (selectedCity) params.set("city", selectedCity);
    if (placeType !== "All") params.set("type", placeType.toLowerCase());
    fetch(`/api/places/community?${params}`)
      .then(r => r.json())
      .then(d => setPlaces(d.places ?? []))
      .catch(() => setPlaces([]))
      .finally(() => setPlacesLoading(false));
  }, [selectedCity, placeType, refreshKey]);

  function selectCity(cityName: string, countryName: string) {
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setPlaceCity(value);
    setSelectedCity(cityName);
    setShowCitySuggestions(false);
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Rated spots from the Flokk community</p>
        <button
          className="flex items-center gap-1 border border-[#C4664A] text-[#C4664A] rounded-full px-4 py-2 text-sm font-medium bg-white"
          style={{ fontFamily: "inherit", cursor: "pointer" }}
          onClick={() => {
            setShowAddPlaceModal(true);
            const currentSearchCity = placeCity.split(",")[0].trim();
            setApCity(currentSearchCity);
            apCityValueRef.current = currentSearchCity;
          }}
        >
          <Plus size={13} />
          Add a Spot
        </button>
      </div>

      {/* City search */}
      <div ref={cityRef} className="relative mb-4">
        <input
          type="text"
          value={placeCity}
          onChange={e => { setPlaceCity(e.target.value); setShowCitySuggestions(true); setSelectedCity(null); }}
          onFocus={() => { if (placeCity.length >= 2) setShowCitySuggestions(true); }}
          placeholder="Search a city (e.g. Seoul, Kyoto)"
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
        />
        {showCitySuggestions && citySuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden" style={{ zIndex: 60 }}>
            {citySuggestions.map(s => (
              <button
                key={s.placeId ?? s.cityName}
                type="button"
                onMouseDown={() => selectCity(s.cityName, s.countryName)}
                className="w-full px-4 py-3 text-sm text-[#1B3A5C] hover:bg-gray-50 text-left flex items-center gap-2"
                style={{ background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}
              >
                <span className="font-semibold">{s.cityName}</span>
                {s.countryName && s.countryName !== s.cityName && (
                  <span className="text-gray-400 text-xs">· {s.countryName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Under-construction banner */}
      <div style={{
        padding: "12px 16px",
        marginBottom: "16px",
        backgroundColor: "#FEF3E6",
        borderLeft: "4px solid #C4664A",
        borderRadius: "6px",
        fontSize: "14px",
        color: "#334155",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <strong style={{ color: "#1B3A5C" }}>Currently being built.</strong> Please excuse our Flokkin messiness. The full Spots experience is on the way.
      </div>

      {/* City pills */}
      {availablePillCities.length > 0 && (
        <div
          style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "12px", scrollbarWidth: "none", msOverflowStyle: "none", width: "100%" }}
          className="hide-scrollbar"
        >
          <button
            onClick={() => { setPlaceCity(""); setSelectedCity(null); }}
            style={{
              flexShrink: 0,
              padding: "7px 16px",
              borderRadius: "999px",
              border: selectedCity === null ? "none" : "1.5px solid #E0E0E0",
              backgroundColor: selectedCity === null ? "#1B3A5C" : "#fff",
              color: selectedCity === null ? "#fff" : "#1B3A5C",
              fontSize: "13px",
              fontWeight: selectedCity === null ? 700 : 500,
              lineHeight: "1",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
          >
            All cities
          </button>
          {availablePillCities.map(c => {
            const isSelected = selectedCity === c.city;
            return (
              <button
                key={c.city}
                onClick={() => selectCity(c.city, "")}
                style={{
                  flexShrink: 0,
                  padding: "7px 16px",
                  borderRadius: "999px",
                  border: isSelected ? "none" : "1.5px solid #E0E0E0",
                  backgroundColor: isSelected ? "#1B3A5C" : "#fff",
                  color: isSelected ? "#fff" : "#1B3A5C",
                  fontSize: "13px",
                  fontWeight: isSelected ? 700 : 500,
                  lineHeight: "1",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {c.city}
              </button>
            );
          })}
        </div>
      )}

      {/* Type filter pills */}
      <div
        style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "20px", scrollbarWidth: "none", msOverflowStyle: "none", position: "relative", zIndex: 10, width: "100%" }}
        className="hide-scrollbar"
      >
          <button
            key="All"
            onClick={() => setPlaceType("All")}
            style={{
              flexShrink: 0,
              padding: "7px 16px",
              borderRadius: "999px",
              border: placeType === "All" ? "none" : "1.5px solid #E0E0E0",
              backgroundColor: placeType === "All" ? "#C4664A" : "#fff",
              color: placeType === "All" ? "#fff" : "#717171",
              fontSize: "13px",
              fontWeight: placeType === "All" ? 700 : 500,
              lineHeight: "1",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
          >
            All
          </button>
          {CATEGORIES.map(({ slug, label }) => (
            <button
              key={slug}
              onClick={() => setPlaceType(slug === placeType ? "All" : slug)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: "999px",
                border: placeType === slug ? "none" : "1.5px solid #E0E0E0",
                backgroundColor: placeType === slug ? "#C4664A" : "#fff",
                color: placeType === slug ? "#fff" : "#717171",
                fontSize: "13px",
                fontWeight: placeType === slug ? 700 : 500,
                lineHeight: "1",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
      </div>

      {/* Results */}
      {placesLoading ? (
        <p className="text-sm text-gray-400 text-center mt-8">Finding spots...</p>
      ) : places.length === 0 ? (
        <p className="text-sm text-gray-400 text-center mt-8">No spots match these filters yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {places.map(place => (
            <div key={place.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="bg-gray-100 overflow-hidden" style={{ height: "140px" }}>
                <SpotImage
                  spotId={place.id}
                  src={place.image}
                  category={place.category}
                  alt={place.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-[#1B3A5C] leading-snug">{place.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[place.city, place.placeType].filter(Boolean).join(" · ")}
                </p>
                {place.ratingCount > 0 ? (
                  <p className="text-xs mt-1" style={{ color: "#C4664A" }}>
                    {"★".repeat(Math.round(place.avgRating ?? 0))}
                    <span className="text-gray-500 ml-1">{place.avgRating} ({place.ratingCount} {place.ratingCount === 1 ? "family" : "families"})</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Not yet rated</p>
                )}
                {place.sampleNote && (
                  <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">{place.sampleNote}</p>
                )}
                {/* CTAs */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/saves", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sourceType: "MANUAL",
                            title: place.name,
                            city: place.city ?? null,
                            category: place.placeType ?? null,
                            notes: place.sampleNote ?? null,
                            website: place.website ?? null,
                          }),
                        });
                        await res.json();
                        setFlokkConfirmedId(place.id);
                        setTimeout(() => setFlokkConfirmedId(null), 2000);
                      } catch {
                        // silent fail
                      }
                    }}
                    className="text-xs font-medium text-[#C4664A] cursor-pointer hover:underline bg-transparent border-none p-0"
                    style={{ fontFamily: "inherit" }}
                  >
                    {flokkConfirmedId === place.id ? "Flokked!" : "Flokk It"}
                  </button>
                  <button
                    onClick={() => {
                      if (itineraryConfirmTimeout.current) clearTimeout(itineraryConfirmTimeout.current);
                      setItineraryModalSpot({ name: place.name, city: place.city, address: place.address, sampleNote: place.sampleNote, placeType: place.placeType });
                    }}
                    className="flex items-center text-xs font-medium text-[#1B3A5C] cursor-pointer hover:underline bg-transparent border-none p-0"
                    style={{ fontFamily: "inherit" }}
                  >
                    <CalendarPlus size={13} style={{ marginRight: "4px" }} />
                    + Itinerary
                  </button>
                  {place.website && (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-gray-400 cursor-pointer hover:underline"
                    >
                      Visit site
                    </a>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://flokktravel.com/places/${place.id}`);
                      setClipCopiedId(place.id);
                      setTimeout(() => setClipCopiedId(null), 2000);
                    }}
                    className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600 bg-transparent border-none p-0"
                    style={{ fontFamily: "inherit" }}
                  >
                    {clipCopiedId === place.id ? "Copied!" : "Share"}
                  </button>
                  {place.canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSpot({
                          id: place.id,
                          name: place.name,
                          city: place.city ?? "",
                          category: place.category ?? null,
                          description: place.description ?? null,
                          photoUrl: place.photoUrl ?? null,
                          websiteUrl: place.websiteUrl ?? null,
                        });
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#717171", marginLeft: "auto" }}
                      aria-label="Edit spot"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {itineraryConfirmation?.placeId === place.id && (
                  <p className="text-[#1B3A5C] text-xs font-medium mt-2">
                    Added to {itineraryConfirmation.tripName}, Day {itineraryConfirmation.day}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddToItineraryModal
        open={itineraryModalSpot !== null}
        onClose={result => {
          if (result && itineraryModalSpot) {
            // Find the place id by matching name+city so we can show confirmation on the right card
            const matched = places.find(p => p.name === itineraryModalSpot.name && p.city === itineraryModalSpot.city);
            if (matched) {
              if (itineraryConfirmTimeout.current) clearTimeout(itineraryConfirmTimeout.current);
              setItineraryConfirmation({ placeId: matched.id, tripName: result.tripName, day: result.day });
              itineraryConfirmTimeout.current = setTimeout(() => setItineraryConfirmation(null), 4000);
            }
          }
          setItineraryModalSpot(null);
        }}
        spot={itineraryModalSpot ?? { name: "", city: null }}
      />

      {editingSpot && (
        <EditSpotModal
          spot={editingSpot}
          canDelete={places.find(p => p.id === editingSpot.id)?.canDelete ?? false}
          onClose={() => setEditingSpot(null)}
          onSaved={(updated) => {
            setPlaces(prev => prev.map(p => p.id === updated.id ? {
              ...p,
              name: updated.name,
              city: updated.city,
              category: updated.category,
              placeType: updated.category ?? p.placeType,
              description: updated.description,
              photoUrl: updated.photoUrl,
              image: updated.photoUrl,
              websiteUrl: updated.websiteUrl,
              website: updated.websiteUrl,
            } : p));
            setEditingSpot(null);
          }}
          onDeleted={() => {
            setPlaces(prev => prev.filter(p => p.id !== editingSpot.id));
            setEditingSpot(null);
          }}
        />
      )}

      {/* ── Add Place Modal ── */}
      {showAddPlaceModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowAddPlaceModal(false)}
        >
          <div
            className="bg-white max-w-md w-full mx-4 rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <h2 className={`${playfair.className} text-xl text-[#1B3A5C] mb-1`}>Add a Spot</h2>
            <p className="text-sm text-gray-500 mb-5">Share a spot your family loved.</p>

            {/* City */}
            <div ref={apCityRef} className="relative mb-3">
              <input
                type="text"
                value={apCity}
                onChange={e => { setApCity(e.target.value); apCityValueRef.current = e.target.value; setApShowCitySuggestions(true); }}
                onFocus={() => { if (apCity.length >= 2) setApShowCitySuggestions(true); }}
                placeholder="City"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
              />
              {apShowCitySuggestions && apCitySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 mt-1 overflow-hidden">
                  {apCitySuggestions.map(s => (
                    <button
                      key={s.placeId ?? s.cityName}
                      type="button"
                      onMouseDown={() => { setApCity(s.cityName); apCityValueRef.current = s.cityName; setApShowCitySuggestions(false); setApCitySuggestions([]); }}
                      className="w-full px-4 py-3 text-sm text-[#1B3A5C] hover:bg-gray-50 text-left flex items-center gap-2"
                      style={{ background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}
                    >
                      <span className="font-semibold">{s.cityName}</span>
                      {s.countryName && s.countryName !== s.cityName && (
                        <span className="text-gray-400 text-xs">· {s.countryName}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name + autocomplete */}
            <div ref={apRef} className="relative mb-3">
              <input
                type="text"
                value={apName}
                onChange={e => { setApName(e.target.value); setApAddress(""); setApLat(null); setApLng(null); }}
                placeholder="e.g. Ichiran Ramen Shinjuku"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
              />
              {showApSuggestions && apSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 mt-1 overflow-hidden">
                  {apSuggestions.map(s => (
                    <button
                      key={s.place_id}
                      type="button"
                      onMouseDown={() => {
                        const city = parseCityFromAddress(s.formatted_address ?? "");
                        setApName(s.name ?? "");
                        setApAddress(s.formatted_address ?? "");
                        setApCity(city); apCityValueRef.current = city;
                        setApLat(s.geometry?.location.lat ?? null);
                        setApLng(s.geometry?.location.lng ?? null);
                        setApImageUrl(s.photoUrl ?? null);
                        setShowApSuggestions(false);
                        setApShowCitySuggestions(false);
                      }}
                      className="w-full px-4 py-3 text-sm text-[#1B3A5C] hover:bg-gray-50 text-left"
                      style={{ background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}
                    >
                      <span className="font-semibold block">{s.name}</span>
                      {s.formatted_address && <span className="text-gray-400 text-xs block truncate">{s.formatted_address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Address */}
            <input
              type="text"
              value={apAddress}
              onChange={e => setApAddress(e.target.value)}
              placeholder="Address"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-3"
            />

            {/* Website */}
            <input
              type="text"
              value={apWebsite}
              onChange={e => setApWebsite(e.target.value)}
              placeholder="Website (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-3"
            />

            {/* Type */}
            <select
              value={apType}
              onChange={e => setApType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-3 bg-white"
              style={{ fontFamily: "inherit" }}
            >
              <option value="">Type of spot</option>
              {CATEGORIES.map(({ slug, label }) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>

            {/* Rating */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Your rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setApRating(star === apRating ? 0 : star)}
                    className="text-xl cursor-pointer bg-transparent border-none p-0 leading-none"
                    style={{ color: star <= apRating ? "#C4664A" : "#D1D5DB" }}
                  >
                    {star <= apRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <textarea
              value={apNotes}
              onChange={e => setApNotes(e.target.value)}
              placeholder="What made this spot special for your family?"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-4 resize-none"
            />

            {/* Also add to trip */}
            <div className="border-t border-gray-100 mt-4 pt-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apAddToTrip}
                  onChange={async e => {
                    setApAddToTrip(e.target.checked);
                    if (e.target.checked && !apTripsLoaded) {
                      setApTripsLoading(true);
                      try {
                        const res = await fetch("/api/trips?status=ALL");
                        const data = await res.json() as { trips: Array<{id: string; title: string; destinationCity: string | null; destinationCountry: string | null; startDate: string | null; endDate: string | null; status: string}> };
                        setApTrips(data.trips ?? []);
                        setApTripsLoaded(true);
                      } catch { setApTrips([]); } finally { setApTripsLoading(false); }
                    }
                  }}
                  className="w-4 h-4 accent-[#1B3A5C]"
                />
                <span className="text-sm text-gray-600">Also add to a trip itinerary</span>
              </label>

              {apAddToTrip && (
                <div className="mt-3">
                  {apTripsLoading ? (
                    <p className="text-xs text-gray-400 py-2">Loading trips...</p>
                  ) : apTrips.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No trips found.</p>
                  ) : (
                    <>
                      {apTrips.filter(t => t.status !== "COMPLETED").length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-400 font-medium mb-1">Upcoming</p>
                          {apTrips.filter(t => t.status !== "COMPLETED").map(trip => (
                            <div
                              key={trip.id}
                              onClick={() => {
                                setApSelectedTripId(trip.id);
                                setApDay(1);
                                const mx = (trip.startDate && trip.endDate)
                                  ? Math.round((new Date(trip.endDate.split("T")[0]).getTime() - new Date(trip.startDate.split("T")[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                  : 30;
                                setApMaxDays(Math.max(1, mx));
                              }}
                              className={`py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 mb-1 ${apSelectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "border border-transparent"}`}
                            >
                              <p className="text-sm font-medium text-[#1B3A5C]">{trip.title}</p>
                              {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {apTrips.filter(t => t.status === "COMPLETED").length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-400 font-medium mb-1">Past Trips</p>
                          {apTrips.filter(t => t.status === "COMPLETED").map(trip => (
                            <div
                              key={trip.id}
                              onClick={() => {
                                setApSelectedTripId(trip.id);
                                setApDay(1);
                                const mx = (trip.startDate && trip.endDate)
                                  ? Math.round((new Date(trip.endDate.split("T")[0]).getTime() - new Date(trip.startDate.split("T")[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                  : 30;
                                setApMaxDays(Math.max(1, mx));
                              }}
                              className={`py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 mb-1 ${apSelectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "border border-transparent"}`}
                            >
                              <p className="text-sm font-medium text-[#1B3A5C]">{trip.title}</p>
                              {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {apSelectedTripId && (
                        <div className="flex items-center gap-3 mt-3">
                          <p className="text-xs text-gray-500 font-medium">Which day?</p>
                          <button
                            type="button"
                            onClick={() => setApDay(d => Math.max(1, d - 1))}
                            disabled={apDay <= 1}
                            className="w-7 h-7 rounded-full border border-gray-200 text-sm font-medium text-gray-500 flex items-center justify-center"
                            style={{ opacity: apDay <= 1 ? 0.4 : 1 }}
                          >−</button>
                          <span className="text-sm font-semibold text-[#1B3A5C]">Day {apDay}</span>
                          <button
                            type="button"
                            onClick={() => setApDay(d => Math.min(apMaxDays, d + 1))}
                            disabled={apDay >= apMaxDays}
                            className="w-7 h-7 rounded-full border border-gray-200 text-sm font-medium text-gray-500 flex items-center justify-center"
                            style={{ opacity: apDay >= apMaxDays ? 0.4 : 1 }}
                          >+</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Save */}
            <button
              disabled={apSaving || !apName.trim() || !apCity.trim() || !apType}
              onClick={async () => {
                if (!apName.trim() || !apCity.trim() || !apType) return;
                setApSaving(true);
                try {
                  const res = await fetch("/api/places/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: apName.trim(),
                      address: apAddress.trim() || null,
                      city: apCity.trim(),
                      type: apType.toLowerCase(),
                      lat: apLat,
                      lng: apLng,
                      website: apWebsite.trim() || null,
                      notes: apNotes.trim() || null,
                      imageUrl: apImageUrl,
                      rating: apRating || null,
                      ratingNote: apNotes.trim() || null,
                      alsoAddToTripId: apAddToTrip && apSelectedTripId ? apSelectedTripId : null,
                      alsoAddToDayIndex: apAddToTrip && apSelectedTripId ? apDay - 1 : null,
                    }),
                  });
                  if (res.ok) {
                    const savedCity = apCity.trim();
                    setShowAddPlaceModal(false);
                    setApName(""); setApAddress(""); setApCity(""); apCityValueRef.current = ""; setApWebsite(""); setApType(""); setApRating(0); setApNotes(""); setApLat(null); setApLng(null); setApImageUrl(null); setApShowCitySuggestions(false);
                    setApAddToTrip(false); setApSelectedTripId(null); setApDay(1);
                    setAddPlaceToast(`Place added to ${savedCity}`);
                    setTimeout(() => setAddPlaceToast(null), 3000);
                    if (selectedCity && savedCity.toLowerCase().includes(selectedCity.toLowerCase())) {
                      setRefreshKey(k => k + 1);
                    }
                  }
                } finally {
                  setApSaving(false);
                }
              }}
              className="w-full bg-[#1B3A5C] text-white rounded-xl py-3 text-sm font-semibold"
              style={{ fontFamily: "inherit", cursor: apSaving || !apName.trim() || !apCity.trim() || !apType ? "default" : "pointer", opacity: apSaving || !apName.trim() || !apCity.trim() || !apType ? 0.5 : 1 }}
            >
              {apSaving ? "Saving..." : "Add Place"}
            </button>

            <p
              className="text-sm text-gray-400 text-center mt-3 cursor-pointer"
              onClick={() => setShowAddPlaceModal(false)}
            >
              Cancel
            </p>
          </div>
        </div>
      )}

      {/* ── Add Place Toast ── */}
      {addPlaceToast && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", padding: "10px 20px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, zIndex: 200, pointerEvents: "none" }}>
          {addPlaceToast}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const SPOTS_TAB_ENABLED = true;

  // Tab
  const [activeTab, setActiveTab] = useState<"trips" | "places">("trips");

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
  const [userSavedKeys, setUserSavedKeys] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<DiscoverActivity | null>(null);
  const [userSpotRatings, setUserSpotRatings] = useState<Map<string, number>>(new Map());
  const [shareToast, setShareToast] = useState<string | null>(null);

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
    fetch("/api/community/user-ratings")
      .then(r => r.json())
      .then(d => {
        const map = new Map<string, number>();
        (d.ratings ?? []).forEach((r: UserSpotRating) => {
          if (r.rating != null) {
            map.set(`${r.spotName.toLowerCase().trim()}|${(r.spotCity ?? "").toLowerCase().trim()}`, r.rating);
          }
        });
        setUserSpotRatings(map);
      })
      .catch(() => {});
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
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "6px" }}>
            Discover
          </h1>
          <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>
            Real trips from real families, plus destinations picked for yours.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("trips")}
            className="rounded-full px-5 py-2 text-sm font-medium"
            style={{ fontFamily: "inherit", cursor: "pointer", backgroundColor: activeTab === "trips" ? "#1B3A5C" : "transparent", color: activeTab === "trips" ? "#fff" : "#555", border: activeTab === "trips" ? "1.5px solid #1B3A5C" : "1.5px solid #E0E0E0" }}
          >
            Community Trips
          </button>
          {SPOTS_TAB_ENABLED && (
            <button
              onClick={() => setActiveTab("places")}
              className="rounded-full px-5 py-2 text-sm font-medium"
              style={{ fontFamily: "inherit", cursor: "pointer", backgroundColor: activeTab === "places" ? "#1B3A5C" : "transparent", color: activeTab === "places" ? "#fff" : "#555", border: activeTab === "places" ? "1.5px solid #1B3A5C" : "1.5px solid #E0E0E0" }}
            >
              Spots
            </button>
          )}
        </div>

        {SPOTS_TAB_ENABLED && activeTab === "places" ? (
          <PlacesTab />
        ) : (<>

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
                      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: "120px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                          <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{trip.title}</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>
                          {[familyName, nights ? `${nights} nights` : null].filter(Boolean).join(" · ")}
                        </p>
                        <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500, marginTop: "auto" }}>
                          {trip.shareToken ? "Steal days →" : "View trip →"}
                        </p>
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
            Spots and activities saved by families who&apos;ve been there — searchable by destination.
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

          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "28px", scrollbarWidth: "none", msOverflowStyle: "none", width: "100%" }} className="hide-scrollbar">
            {(["All", ...CATEGORIES.map(c => c.label)] as string[]).map((f) => (
              <button
                key={f}
                onClick={() => { setPicksFilter(f); setShowAllPicks(false); }}
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  borderRadius: "999px",
                  border: picksFilter === f ? "none" : "1.5px solid #E0E0E0",
                  backgroundColor: picksFilter === f ? "#C4664A" : "#fff",
                  color: picksFilter === f ? "#fff" : "#717171",
                  fontSize: "12px",
                  fontWeight: picksFilter === f ? 700 : 500,
                  lineHeight: "1",
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
                    <SpotImage
                      src={act.imageUrl}
                      category={act.type}
                      alt={act.title}
                      allowResolve={false}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
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
                    <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "10px" }}>
                      {act.source === "placeholder"
                        ? "Flokk Pick"
                        : act.isAnonymous || !act.familyName
                          ? "A Real Flokker"
                          : `${act.familyName} Family`}
                    </p>
                    <div style={{ marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <PlaceActionRow
                        place={{
                          name: act.title,
                          city: act.city,
                          websiteUrl: act.websiteUrl,
                          photoUrl: act.imageUrl,
                          category: act.type,
                          sourceTripId: act.tripId,
                          sourceShareToken: act.shareToken,
                        }}
                        isSaved={isSaved || savedActivities.has(act.id)}
                        userRating={userSpotRatings.get(`${act.title.toLowerCase().trim()}|${(act.city ?? "").toLowerCase().trim()}`) ?? null}
                        onFlokkIt={() => handlePickSave(act)}
                        onShareToast={(msg) => { setShareToast(msg); setTimeout(() => setShareToast(null), 3000); }}
                        variant="card-compact"
                      />
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
            style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "32px", scrollbarWidth: "none", msOverflowStyle: "none", width: "100%" }}
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
                  lineHeight: "1",
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
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: "120px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                        <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{rec.city}, {rec.country}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>{rec.why}</p>
                      <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500, marginTop: "auto" }}>{rec.pickReason}</p>
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
        </>)}

      </div>

      {/* ── Add yours modal ── */}
      {activeTab === "trips" && showAddYours && (
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

      {/* ── Activity detail modal ── */}
      {activeTab === "trips" && selectedActivity && (
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
                <SpotImage
                  src={selectedActivity.imageUrl}
                  category={selectedActivity.type}
                  alt={selectedActivity.title}
                  allowResolve={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
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
              <PlaceActionRow
                place={{
                  name: selectedActivity.title,
                  city: selectedActivity.city,
                  websiteUrl: selectedActivity.websiteUrl,
                  photoUrl: selectedActivity.imageUrl,
                  category: selectedActivity.type,
                  sourceTripId: selectedActivity.tripId,
                  sourceShareToken: selectedActivity.shareToken,
                }}
                isSaved={
                  userSavedKeys.has(`${selectedActivity.title.toLowerCase().trim()}|${(selectedActivity.city ?? "").toLowerCase().trim()}`) ||
                  savedActivities.has(selectedActivity.id)
                }
                userRating={userSpotRatings.get(`${selectedActivity.title.toLowerCase().trim()}|${(selectedActivity.city ?? "").toLowerCase().trim()}`) ?? null}
                onFlokkIt={() => { handlePickSave(selectedActivity); setSelectedActivity(null); }}
                onShareToast={(msg) => { setShareToast(msg); setTimeout(() => setShareToast(null), 3000); }}
                variant="card-expanded"
              />
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div style={{
          position: "fixed", bottom: 88, left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#1B3A5C", color: "#fff",
          padding: "10px 20px", borderRadius: 999,
          fontSize: 13, fontWeight: 600, zIndex: 1300,
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          {shareToast}
        </div>
      )}

    </div>
  );
}
