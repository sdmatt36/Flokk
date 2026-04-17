"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import TourResults from "@/components/TourResults";

type DestinationSuggestion = {
  placeId: string;
  cityName: string;
  countryName: string;
};

type Stop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
};

type TourResponse = {
  stops: Stop[];
  destinationCity: string;
  prompt: string;
  durationLabel: string;
  transport: string;
  generatedAt: string;
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
  const [prompt, setPrompt] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [transport, setTransport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TourResponse | null>(null);
  const [touched, setTouched] = useState(false);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Dismiss dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
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

  function selectSuggestion(cityName: string, countryName: string) {
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setDestinationCity(value);
    setSuggestions([]);
    setShowSuggestions(false);
    setTouched(true);
  }

  function handleCityChange(value: string) {
    setDestinationCity(value);
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
        }),
      });
      const data = await res.json() as TourResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResults(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults(null);
    setPrompt("");
    setDestinationCity("");
    setDurationLabel("");
    setTransport("");
    setError("");
    setTouched(false);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  const inputClass =
    "w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]";

  if (results) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto pt-8 px-4 pb-16">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-sm text-[#1B3A5C] underline cursor-pointer mb-6"
          >
            <RotateCcw size={14} />
            Start over
          </button>
          <TourResults
            stops={results.stops}
            destinationCity={results.destinationCity}
            prompt={results.prompt}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ height: "280px" }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/tour-builder-hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <h1 className="font-serif text-4xl font-bold text-white">Build a Tour</h1>
          <p className="text-sm text-white/80 mt-2">Describe what you want. We&apos;ll map it.</p>
        </div>
      </div>

      {/* Form card — floats up over hero */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 relative z-10 -mt-10">
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
            className="w-full mt-4 bg-[#1B3A5C] text-white rounded-xl py-3 px-6 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles size={16} />
            {loading ? "Building your tour..." : "Build my tour"}
          </button>

          {touched && !allFilled && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Fill in all fields to build your tour
            </p>
          )}

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      </div>

      {/* How to Build a Flokkin' Great Tour */}
      <div className="max-w-2xl mx-auto px-4 mt-8 mb-12">
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
      </div>
    </div>
  );
}
