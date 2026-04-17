"use client";

import { useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import TourResults from "@/components/TourResults";

const CITY_AUTOFILL = [
  "Tokyo", "Osaka", "Kyoto", "Seoul", "Bangkok", "Chiang Mai", "Singapore",
  "London", "Paris", "Barcelona", "Rome", "Lisbon", "Amsterdam",
  "New York", "Chicago", "Portland", "Seattle", "San Francisco",
  "Dublin", "Edinburgh", "Sydney", "Melbourne", "Bali", "Dubai", "Istanbul",
];

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

export default function TourPage() {
  const [prompt, setPrompt] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [transport, setTransport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TourResponse | null>(null);
  const [touched, setTouched] = useState(false);

  function handlePromptChange(value: string) {
    setPrompt(value);
    setTouched(true);
    if (!destinationCity.trim()) {
      const lower = value.toLowerCase();
      const match = CITY_AUTOFILL.find((city) => lower.includes(city.toLowerCase()));
      if (match) setDestinationCity(match);
    }
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
  }

  const inputClass =
    "w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto pt-12 px-4">
        {results ? (
          <>
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
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-bold text-[#1B3A5C] mb-2">Build a Tour</h1>
            <p className="text-sm text-gray-500 mb-8">
              Describe what you want and we&apos;ll build a family-friendly day plan with stops, timings, and a map.
            </p>

            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="A ramen tour in Tokyo near Shinjuku for a family with young kids"
              className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            />

            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <input
                type="text"
                value={destinationCity}
                onChange={(e) => { setDestinationCity(e.target.value); setTouched(true); }}
                placeholder="City (e.g. Tokyo)"
                className={inputClass}
              />

              <select
                value={durationLabel}
                onChange={(e) => { setDurationLabel(e.target.value); setTouched(true); }}
                className={inputClass}
              >
                <option value="" disabled>How long?</option>
                <option value="2 hours">2 hours</option>
                <option value="Half day (4 hrs)">Half day (4 hrs)</option>
                <option value="Full day (8 hrs)">Full day (8 hrs)</option>
              </select>

              <select
                value={transport}
                onChange={(e) => { setTransport(e.target.value); setTouched(true); }}
                className={inputClass}
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

            <div className="border-t border-gray-100 mt-8 pt-6">
              <p className="text-sm text-gray-500">Looking for trip ideas?</p>
              <a href="/discover" className="text-sm text-[#1B3A5C] font-medium">Browse community tours on Discover →</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
