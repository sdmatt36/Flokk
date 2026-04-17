"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

type Stop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  why: string;
  familyNote: string;
};

type TripOption = {
  id: string;
  title: string;
  destinationCity: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type Props = {
  stops: Stop[];
  destinationCity: string;
  prompt: string;
};

export default function TourResults({ stops, destinationCity, prompt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [maxDays, setMaxDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<{ tripTitle: string; tripId: string; day: number } | null>(null);

  useEffect(() => {
    if (stops.length === 0 || !containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then((mb) => {
      if (destroyed || !containerRef.current) return;
      const mapboxgl = mb.default;
      mapboxgl.accessToken = token;

      const avgLat = stops.reduce((sum, s) => sum + s.lat, 0) / stops.length;
      const avgLng = stops.reduce((sum, s) => sum + s.lng, 0) / stops.length;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [avgLng, avgLat],
        zoom: 13,
      });

      mapRef.current = map;

      stops.forEach((stop, index) => {
        const el = document.createElement("div");
        el.style.cssText =
          `width:28px;height:28px;border-radius:50%;background:#C4664A;` +
          "display:flex;align-items:center;justify-content:center;" +
          "font-weight:700;font-size:12px;color:#fff;cursor:pointer;" +
          "box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
        el.textContent = String(index + 1);
        el.addEventListener("click", () => console.log(stop.name));

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
      });

      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });

      map.on("load", () => {
        map.addSource("tour-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: stops.map((s) => [s.lng, s.lat]),
            },
            properties: {},
          },
        });

        map.addLayer({
          id: "tour-route-line",
          type: "line",
          source: "tour-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1B3A5C", "line-width": 2, "line-opacity": 0.6 },
        });
      });
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stops]);

  function openModal() {
    setModalOpen(true);
    setSaveError("");
    setSaveSuccess(null);
    setSelectedTripId(null);
    setSelectedDay(1);
    if (trips.length === 0) {
      setTripsLoading(true);
      fetch("/api/trips?status=ALL")
        .then(r => r.json())
        .then((d: { trips?: TripOption[] }) => setTrips(d.trips ?? []))
        .catch(() => {})
        .finally(() => setTripsLoading(false));
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSaveError("");
    setSaveSuccess(null);
  }

  async function handleSave() {
    if (!selectedTripId) return;
    const trip = trips.find(t => t.id === selectedTripId);
    if (!trip) return;
    setSaving(true);
    setSaveError("");
    try {
      let date: string;
      if (trip.startDate) {
        const tripStart = new Date(trip.startDate + "T12:00:00");
        tripStart.setDate(tripStart.getDate() + (selectedDay - 1));
        date = tripStart.toISOString().split("T")[0];
      } else {
        date = new Date().toISOString().split("T")[0];
      }

      const results = await Promise.all(
        stops.map(stop =>
          fetch(`/api/trips/${selectedTripId}/activities`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: stop.name,
              date,
              address: stop.address,
              lat: stop.lat,
              lng: stop.lng,
              notes: stop.why,
              website: null,
              time: null,
              endTime: null,
              price: null,
              currency: null,
              status: "interested",
            }),
          })
        )
      );
      const allOk = results.every(r => r.ok);
      if (!allOk) {
        setSaveError("Some stops failed to save. Please try again.");
        return;
      }
      setSaveSuccess({ tripTitle: trip.title, tripId: trip.id, day: selectedDay });
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const upcomingTrips = trips.filter(t => t.status === "PLANNING" || t.status === "ACTIVE");
  const pastTrips = trips.filter(t => t.status === "COMPLETED");

  return (
    <div>
      <p className="font-serif text-xl font-semibold text-[#1B3A5C] mb-1">{prompt}</p>
      <p className="text-sm text-gray-400 mb-6">{destinationCity}</p>

      {stops.length > 0 && (
        <div ref={containerRef} className="h-[280px] rounded-2xl overflow-hidden mb-6" />
      )}

      {stops.map((stop, index) => (
        <div key={index} className="border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm bg-white">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-[#C4664A] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {index + 1}
            </div>
            <span className="text-sm font-semibold text-[#1B3A5C] ml-3">{stop.name}</span>
          </div>

          <div className="flex items-center mt-2">
            <Clock size={12} className="text-gray-400" />
            <span className="text-xs text-gray-400 ml-1">{stop.duration} min</span>
          </div>

          {stop.address && (
            <div className="flex items-center mt-1">
              <MapPin size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400 ml-1">{stop.address}</span>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{stop.why}</p>

          {stop.familyNote && (
            <p className="text-xs text-[#C4664A] mt-1 italic">{stop.familyNote}</p>
          )}
        </div>
      ))}

      {stops.length > 0 && (
        <button
          onClick={openModal}
          className="w-full border border-[#1B3A5C] text-[#1B3A5C] rounded-xl py-3 px-6 text-sm font-medium mt-4"
        >
          Save stops to a trip
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 mb-0 sm:mb-auto" onClick={e => e.stopPropagation()}>
            {saveSuccess ? (
              <div className="text-center">
                <p className="font-serif text-lg font-semibold text-[#1B3A5C] mb-2">Stops saved!</p>
                <p className="text-sm text-gray-600 mb-4">
                  {stops.length} stops added to <span className="font-semibold">{saveSuccess.tripTitle}</span>, Day {saveSuccess.day}.
                </p>
                <a
                  href={`/trips/${saveSuccess.tripId}`}
                  className="block w-full bg-[#1B3A5C] text-white rounded-xl py-3 text-sm font-medium text-center"
                >
                  View trip →
                </a>
                <button onClick={closeModal} className="text-sm text-gray-400 text-center mt-3 cursor-pointer block w-full" style={{ background: "none", border: "none" }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="font-serif text-lg font-semibold text-[#1B3A5C] mb-4">Save to a trip</p>

                {tripsLoading ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Loading trips...</p>
                ) : trips.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No trips found. <a href="/trips/new" className="text-[#C4664A] font-medium">Create one →</a></p>
                ) : (
                  <div className="max-h-56 overflow-y-auto mb-4">
                    {upcomingTrips.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 uppercase tracking-wide px-1 py-1 font-semibold">Upcoming</p>
                        {upcomingTrips.map(trip => (
                          <div
                            key={trip.id}
                            onClick={() => {
                              const mx = (trip.startDate && trip.endDate)
                                ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                : 30;
                              setSelectedTripId(trip.id);
                              setMaxDays(mx);
                              setSelectedDay(d => d > mx ? 1 : d);
                            }}
                            className={`py-2 px-3 rounded-lg cursor-pointer ${selectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "hover:bg-gray-50"}`}
                          >
                            <p className="text-sm text-[#1B3A5C] font-medium">{trip.title}</p>
                            {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                          </div>
                        ))}
                      </>
                    )}
                    {pastTrips.length > 0 && (
                      <>
                        <p className={`text-xs text-gray-400 uppercase tracking-wide px-1 py-1 font-semibold ${upcomingTrips.length > 0 ? "mt-2" : ""}`}>Past Trips</p>
                        {pastTrips.map(trip => (
                          <div
                            key={trip.id}
                            onClick={() => {
                              const mx = (trip.startDate && trip.endDate)
                                ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                : 30;
                              setSelectedTripId(trip.id);
                              setMaxDays(mx);
                              setSelectedDay(d => d > mx ? 1 : d);
                            }}
                            className={`py-2 px-3 rounded-lg cursor-pointer ${selectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "hover:bg-gray-50"}`}
                          >
                            <p className="text-sm text-[#1B3A5C] font-medium">{trip.title}</p>
                            {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {selectedTripId && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-2">Which day?</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedDay(d => Math.max(1, d - 1))}
                        className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center"
                        style={{ background: "none" }}
                      >−</button>
                      <span className="text-sm font-semibold text-[#1B3A5C] w-16 text-center">Day {selectedDay}</span>
                      <button
                        onClick={() => setSelectedDay(d => Math.min(maxDays, d + 1))}
                        disabled={selectedDay >= maxDays}
                        className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center disabled:opacity-40"
                        style={{ background: "none" }}
                      >+</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">This trip has {maxDays} days</p>
                  </div>
                )}

                {saveError && <p className="text-red-500 text-sm mb-2">{saveError}</p>}

                <button
                  onClick={handleSave}
                  disabled={!selectedTripId || saving}
                  className="w-full bg-[#1B3A5C] text-white rounded-xl py-3 text-sm font-medium mt-4 disabled:opacity-50"
                  style={{ border: "none", cursor: selectedTripId && !saving ? "pointer" : "default" }}
                >
                  {saving ? "Saving..." : `Add ${stops.length} stops to Day ${selectedDay}`}
                </button>
                <button onClick={closeModal} className="text-sm text-gray-400 text-center mt-3 cursor-pointer block w-full" style={{ background: "none", border: "none" }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
