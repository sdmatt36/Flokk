"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import TourResults from "@/components/TourResults";
import { TourActionMenu } from "@/components/tours/TourActionMenu";
import { shareEntity } from "@/lib/share";
import BuildATourHero from "@/components/features/build-a-tour/BuildATourHero";

type DestinationSuggestion = {
  placeId: string;
  cityName: string;
  countryName: string;
};

type Stop = {
  id: string;
  orderIndex: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
  imageUrl?: string | null;
  websiteUrl?: string | null;
};

type TourResponse = {
  tourId?: string | null;
  originalTargetStops?: number;
  stops: Stop[];
  removedStops?: Stop[];
  destinationCity: string;
  destinationCountry?: string | null;
  prompt: string;
  durationLabel: string;
  transport: string;
  generatedAt: string;
  walkViolations?: number;
};

type SavedTourEntry = {
  id: string;
  title: string;
  createdAt: string;
  stopCount: number;
  transport: string;
  destinationCountry: string | null;
  destinationDisplayName: string;
  coverImage: string | null;
};

const VIBE_CHIPS = [
  "Just the two of us",
  "With the whole family",
  "Multi-family adventure",
  "Grandparents in tow",
  "Teens take the lead",
  "Off the beaten path",
];

export default function TourPage() {
  const [tripId, setTripId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationCountry, setDestinationCountry] = useState<string | null>(null);
  const [durationLabel, setDurationLabel] = useState("");
  const [transport, setTransport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TourResponse | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [removedStops, setRemovedStops] = useState<Stop[]>([]);
  const [touched, setTouched] = useState(false);

  // Library state
  const [savedTours, setSavedTours] = useState<Record<string, SavedTourEntry[]>>({});
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const tourLibraryRef = useRef<HTMLDivElement>(null);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Dismiss city suggestions dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Sync lifted stops state when results first arrive
  useEffect(() => {
    if (results?.stops) setStops(results.stops);
    if (results?.removedStops) setRemovedStops(results.removedStops);
    else setRemovedStops([]);
  }, [results?.tourId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for stop photos after generation (up to 30s, every 3s)
  useEffect(() => {
    if (!results?.tourId) return;
    if (results.stops.every((s) => s.imageUrl)) return;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > 30_000) { clearInterval(interval); return; }
      try {
        const res = await fetch(`/api/tours/${results.tourId}`);
        if (!res.ok) return;
        const fresh = await res.json() as { stops: Stop[] };
        setResults((prev) => prev ? { ...prev, stops: fresh.stops } : prev);
        setStops(fresh.stops);
        if (fresh.stops.every((s) => s.imageUrl)) clearInterval(interval);
      } catch { /* non-fatal */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [results?.tourId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss tour library pill popover on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (tourLibraryRef.current && !tourLibraryRef.current.contains(e.target as Node)) {
        setExpandedCity(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch city suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (destinationCity.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(destinationCity)}`);
        const data: DestinationSuggestion[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destinationCity]);

  // Load tour library on mount; load specific tour if ?id= is present; read tripId context
  useEffect(() => {
    fetchSavedTours();
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const tripIdParam = params.get("tripId");
    if (idParam) loadSavedTour(idParam);
    if (tripIdParam) setTripId(tripIdParam);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSavedTours() {
    try {
      const res = await fetch("/api/tours/my-tours");
      if (res.ok) {
        const data = await res.json() as Record<string, SavedTourEntry[]>;
        setSavedTours(data);
      }
    } catch { /* non-fatal */ }
  }

  async function loadSavedTour(id: string) {
    setExpandedCity(null);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tours/${id}`);
      if (!res.ok) { setError("Could not load tour."); return; }
      const data = await res.json() as TourResponse;
      setResults(data);
    } catch {
      setError("Could not load tour.");
    } finally {
      setLoading(false);
    }
  }

  function handleTourDelete(id: string) {
    setSavedTours(prev => {
      const updated = { ...prev };
      for (const city of Object.keys(updated)) {
        updated[city] = updated[city].filter(t => t.id !== id);
        if (updated[city].length === 0) {
          delete updated[city];
          if (expandedCity === city) setExpandedCity(null);
        }
      }
      return updated;
    });
  }

  function selectSuggestion(cityName: string, countryName: string) {
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setDestinationCity(value);
    setDestinationCountry(countryName || null);
    setSuggestions([]);
    setShowSuggestions(false);
    setTouched(true);
  }

  function handleCityChange(value: string) {
    setDestinationCity(value);
    setDestinationCountry(null);
    setShowSuggestions(true);
    setTouched(true);
  }

  function appendVibe(vibe: string) {
    setPrompt(prev => prev ? `${prev} ${vibe}` : vibe);
    setTouched(true);
  }

  const allFilled =
    prompt.trim() !== "" &&
    destinationCity.trim() !== "" &&
    durationLabel !== "" &&
    transport !== "";

  async function handleSubmit() {
    if (!allFilled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tours/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          destinationCity: destinationCity.trim(),
          durationLabel,
          transport,
          familyProfileId: undefined,
          tripId: tripId ?? undefined,
        }),
      });
      const data = await res.json() as TourResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResults({ ...data, destinationCountry });
        if (data.tourId) {
          window.history.replaceState({}, '', `/tour?id=${data.tourId}`);
        }
        // Refresh library in background so the new tour appears next time
        fetchSavedTours();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults(null);
    setStops([]);
    setRemovedStops([]);
    setPrompt("");
    setDestinationCity("");
    setDestinationCountry(null);
    setDurationLabel("");
    setTransport("");
    setError("");
    setTouched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setExpandedCity(null);
  }

  function handleRemoveStop(stopId: string) {
    setStops(prev => prev.filter(s => s.id !== stopId));
    setResults(prev => prev ? { ...prev, walkViolations: undefined } : prev);
    // Do NOT move to removedStops here — that happens when the server-side DELETE fires (handleDeleteCommit)
  }

  const handleRestore = async (stop: Stop, shouldFireAPI: boolean) => {
    setRemovedStops(prev => prev.filter(s => s.id !== stop.id));
    setStops(prev => {
      const next = [...prev];
      const insertIdx = next.findIndex(s => s.orderIndex > stop.orderIndex);
      if (insertIdx === -1) {
        next.push(stop);
      } else {
        next.splice(insertIdx, 0, stop);
      }
      return next;
    });
    if (shouldFireAPI) {
      const res = await fetch(`/api/tours/${results?.tourId}/stops/${stop.id}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        setStops(prev => prev.filter(s => s.id !== stop.id));
        setRemovedStops(prev => [stop, ...prev]);
      }
    }
  };

  function handleDeleteCommit(stop: Stop) {
    setRemovedStops(prev => [stop, ...prev]);
  }

  function handleReplaceStops(newActiveStops: Stop[]) {
    setStops(newActiveStops);
    setResults(prev => prev ? { ...prev, walkViolations: undefined } : prev);
  }

  const inputClass =
    "w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]";

  const hasSavedTours = Object.keys(savedTours).length > 0;

  if (results) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto pt-8 px-4 pb-16">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-sm text-[#1B3A5C] underline cursor-pointer"
            >
              <RotateCcw size={14} />
              Start over
            </button>
            {results.tourId && (
              <button
                onClick={async () => {
                  const r = await shareEntity({ entityType: "generated_tour", entityId: results.tourId! });
                  if (r.ok) alert("Link copied to clipboard");
                }}
                className="text-sm text-[#C4664A] font-semibold cursor-pointer bg-none border-none p-0"
                style={{ background: "none", border: "none" }}
              >
                Share tour
              </button>
            )}
          </div>
          <TourResults
            stops={stops}
            removedStops={removedStops}
            destinationCity={results.destinationCity}
            destinationCountry={results.destinationCountry ?? null}
            prompt={results.prompt}
            durationLabel={results.durationLabel}
            transport={results.transport}
            tourId={results.tourId ?? null}
            walkViolations={results.walkViolations}
            originalTargetStops={results.originalTargetStops ?? 5}
            onRemoveStop={handleRemoveStop}
            onQuickUndo={(stop) => handleRestore(stop, false)}
            onDeleteCommit={handleDeleteCommit}
            onPermanentRestore={(stop) => handleRestore(stop, true)}
            onReplaceStops={handleReplaceStops}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <BuildATourHero />

      {/* Content — centered */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", width: "100%" }}>
        {/* Form card — floats up over hero */}
        <div className="bg-white rounded-2xl shadow-lg p-6 relative" style={{ zIndex: 10, marginTop: -50, border: "1px solid rgba(0,0,0,0.04)" }}>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setTouched(true); }}
            placeholder="A ramen tour in Tokyo near Shinjuku for a family with young kids"
            className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
          />

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            {/* City input with autocomplete */}
            <div ref={suggestionsRef} className="relative flex-1">
              <input
                type="text"
                value={destinationCity}
                onChange={(e) => handleCityChange(e.target.value)}
                onFocus={() => { if (destinationCity.length >= 2) setShowSuggestions(true); }}
                placeholder="City (e.g. Tokyo)"
                autoComplete="off"
                className={inputClass}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 mt-1 overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onMouseDown={() => selectSuggestion(s.cityName, s.countryName)}
                      className="w-full px-4 py-3 text-sm text-[#1B3A5C] cursor-pointer hover:bg-gray-50 text-left flex items-center gap-2"
                      style={{ background: "none", border: "none", fontFamily: "inherit" }}
                    >
                      <span className="font-semibold">{s.cityName}</span>
                      {s.countryName && s.countryName !== s.cityName && (
                        <span className="text-gray-400 text-xs">· {s.countryName}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {suggestionsLoading && destinationCity.length >= 2 && (
                <p className="text-xs text-gray-400 mt-1">Searching...</p>
              )}
            </div>

            <select
              value={durationLabel}
              onChange={(e) => { setDurationLabel(e.target.value); setTouched(true); }}
              className={`flex-1 ${inputClass}`}
            >
              <option value="" disabled>How long?</option>
              <option value="2 hours">2 hours</option>
              <option value="Half day (4 hrs)">Half day (4 hrs)</option>
              <option value="Full day (8 hrs)">Full day (8 hrs)</option>
            </select>

            <select
              value={transport}
              onChange={(e) => { setTransport(e.target.value); setTouched(true); }}
              className={`flex-1 ${inputClass}`}
            >
              <option value="" disabled>Getting around?</option>
              <option value="Walking">Walking</option>
              <option value="Metro / Transit">Metro / Transit</option>
              <option value="Car or Taxi">Car or Taxi</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !allFilled}
            className="w-full mt-4 bg-[#1B3A5C] text-white rounded-xl py-3 px-6 text-sm font-medium flex items-center justify-center disabled:opacity-60"
          >
            {loading ? "Building your tour..." : "Build my tour"}
          </button>

          {loading && (
            <p className="text-center mt-3" style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600, fontStyle: "italic" }}>
              Flokking... Patience is a Virtue.
            </p>
          )}

          {touched && !allFilled && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Fill in all fields to build your tour
            </p>
          )}

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>

        {/* Tour Library */}
        {hasSavedTours && (
          <div className="mt-6" ref={tourLibraryRef}>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Your tours</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(savedTours).map(([groupKey, tours]) => (
                <div key={groupKey} className="relative">
                  <button
                    onClick={() => setExpandedCity(expandedCity === groupKey ? null : groupKey)}
                    className="border border-gray-200 rounded-full px-3 py-1.5 text-sm text-[#1B3A5C] bg-white hover:border-[#1B3A5C] transition-colors"
                    style={{ fontFamily: "inherit" }}
                  >
                    {tours[0]?.destinationDisplayName ?? groupKey} ({tours.length})
                  </button>
                  {expandedCity === groupKey && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[260px]">
                      {tours.map(tour => (
                        <div key={tour.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded-lg">
                          {tour.coverImage ? (
                            <img src={tour.coverImage} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: "40px", height: "40px", borderRadius: "6px", backgroundColor: "#F3F4F6", flexShrink: 0 }} />
                          )}
                          <button
                            onClick={() => loadSavedTour(tour.id)}
                            className="text-left flex-1 min-w-0"
                            style={{ background: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}
                          >
                            <span className="block text-sm text-[#1B3A5C] font-semibold truncate">{tour.title}</span>
                            <span className="block text-xs text-gray-400 mt-0.5">{tour.stopCount} stops · {tour.transport}</span>
                          </button>
                          <TourActionMenu tourId={tour.id} onDelete={handleTourDelete} anchorPosition="pill" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How to Build a Flokkin' Great Tour */}
        <div className="mt-8 mb-12">
          <h2 className="font-serif text-xl font-semibold text-[#1B3A5C] mb-2">How to Build a Flokkin&apos; Great Tour</h2>
          <p className="text-sm text-gray-500 mb-5">Who&apos;s coming along?</p>

          <div className="flex flex-wrap gap-2">
            {VIBE_CHIPS.map((vibe) => (
              <button
                key={vibe}
                onClick={() => appendVibe(vibe)}
                className="border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 cursor-pointer hover:border-[#1B3A5C] hover:text-[#1B3A5C] transition-colors bg-white"
                style={{ fontFamily: "inherit" }}
              >
                {vibe}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 italic mt-4">Try: &apos;Best sushi near Tsukiji&apos; · &apos;Street art walk in Shoreditch&apos; · &apos;Castle hopping in Edinburgh&apos;</p>
        </div>
      </div>
    </div>
  );
}
