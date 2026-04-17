"use client";

import { useState, useEffect } from "react";
import { X, CalendarPlus, MapPin } from "lucide-react";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

type Trip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

export type AddToItinerarySpot = {
  name: string;
  city: string | null;
  address?: string | null;
  sampleNote?: string | null;
  placeType?: string | null;
};

type Props = {
  open: boolean;
  onClose: (result?: { tripName: string; day: number }) => void;
  spot: AddToItinerarySpot;
};

function computeDayCount(trip: Trip): number {
  if (!trip.startDate || !trip.endDate) return 30;
  const start = new Date(trip.startDate.split("T")[0] + "T12:00:00");
  const end = new Date(trip.endDate.split("T")[0] + "T12:00:00");
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff + 1, 1);
}

function computeDateForDay(trip: Trip, day: number): string {
  if (!trip.startDate) return new Date().toISOString().split("T")[0];
  const start = new Date(trip.startDate.split("T")[0] + "T12:00:00");
  start.setDate(start.getDate() + (day - 1));
  return start.toISOString().split("T")[0];
}

export function AddToItineraryModal({ open, onClose, spot }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityLower = (spot.city ?? "").toLowerCase().trim();
  const matchingTrips = trips.filter(t => {
    const dest = (t.destinationCity ?? "").toLowerCase().trim();
    return dest.length > 0 && cityLower.length > 0 && (dest.includes(cityLower) || cityLower.includes(dest));
  });

  const selectedTrip = matchingTrips.find(t => t.id === selectedTripId) ?? null;
  const numDays = selectedTrip ? computeDayCount(selectedTrip) : 30;

  // Fetch trips and reset state on open
  useEffect(() => {
    if (!open) return;
    setSelectedTripId("");
    setSelectedDay(1);
    setError(null);
    setLoading(true);
    fetch("/api/trips?status=ALL")
      .then(r => r.json() as Promise<{ trips: Trip[] }>)
      .then(d => setTrips(d.trips ?? []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Escape key dismiss
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleConfirm() {
    if (!selectedTrip) return;
    setSaving(true);
    setError(null);
    try {
      const date = computeDateForDay(selectedTrip, selectedDay);
      const res = await fetch(`/api/trips/${selectedTrip.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: spot.name,
          date,
          address: spot.address ?? null,
          notes: spot.sampleNote ?? "",
          status: "interested",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      onClose({ tripName: selectedTrip.title, day: selectedDay });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onMouseDown={() => onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-4 p-6"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`${playfair.className} text-xl text-[#1B3A5C] font-semibold`}>
              Add to Itinerary
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span>{spot.name}{spot.city ? `, ${spot.city}` : ""}</span>
            </p>
          </div>
          <button
            onClick={() => onClose()}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none p-0 cursor-pointer ml-4 mt-0.5 shrink-0"
            style={{ fontFamily: "inherit" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : matchingTrips.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-[#1B3A5C] font-semibold text-base mb-1">
              No trips in {spot.city ?? "this city"} yet
            </p>
            <p className="text-sm text-slate-500 mb-5">
              Start a trip to {spot.city ?? "this city"} and add {spot.name} to a day.
            </p>
            <div className="flex gap-3 justify-center">
              <a
                href={`/trips/new${spot.city ? `?destination=${encodeURIComponent(spot.city)}` : ""}`}
                className="bg-[#1B3A5C] text-white rounded-lg px-4 py-2 text-sm font-medium"
                style={{ fontFamily: "inherit" }}
              >
                Start a trip
              </a>
              <button
                onClick={() => onClose()}
                className="bg-white text-[#1B3A5C] border border-[#1B3A5C] rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
                style={{ fontFamily: "inherit" }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Which trip?</label>
              <select
                value={selectedTripId}
                onChange={e => { setSelectedTripId(e.target.value); setSelectedDay(1); setError(null); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white"
                style={{ fontFamily: "inherit" }}
              >
                <option value="">Select a trip</option>
                {matchingTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {selectedTripId && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Which day?</label>
                <select
                  value={selectedDay}
                  onChange={e => setSelectedDay(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white"
                  style={{ fontFamily: "inherit" }}
                >
                  {Array.from({ length: numDays }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Day {d}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirm}
                disabled={!selectedTripId || saving}
                className="flex-1 bg-[#1B3A5C] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#163049] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "inherit" }}
              >
                {saving ? "Adding..." : "Confirm"}
              </button>
              <button
                onClick={() => onClose()}
                className="bg-white text-[#1B3A5C] border border-[#1B3A5C] rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
                style={{ fontFamily: "inherit" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
