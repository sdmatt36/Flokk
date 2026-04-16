"use client";

import { useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import TourResults from "@/components/TourResults";

type Stop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  why: string;
  familyNote: string;
};

type TourResponse = {
  stops: Stop[];
  destinationCity: string;
  prompt: string;
  generatedAt: string;
};

export default function TourPage() {
  const [prompt, setPrompt] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TourResponse | null>(null);

  async function handleSubmit() {
    if (!prompt.trim() || !destinationCity.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tours/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), destinationCity: destinationCity.trim(), familyProfileId: undefined }),
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
    setError("");
  }

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
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A ramen tour in Tokyo near Shinjuku for a family with young kids"
              className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            />

            <input
              type="text"
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              placeholder="City (e.g. Tokyo)"
              className="w-full border border-gray-200 rounded-xl p-4 text-sm mt-3 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-4 bg-[#1B3A5C] text-white rounded-xl py-3 px-6 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Sparkles size={16} />
              {loading ? "Building your tour..." : "Build my tour"}
            </button>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
