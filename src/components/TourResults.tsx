"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Clock, ExternalLink, Footprints, Loader2, MapPin, Plus, X } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

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
  removedStops: Stop[];
  destinationCity: string;
  destinationCountry?: string | null;
  prompt: string;
  durationLabel: string;
  transport: string;
  tourId?: string | null;
  walkViolations?: number;
  originalTargetStops: number;
  onRemoveStop: (stopId: string) => void;
  onQuickUndo: (stop: Stop) => void;
  onDeleteCommit: (stop: Stop) => void;
  onPermanentRestore: (stop: Stop) => void;
  onReplaceStops: (stops: Stop[]) => void;
};

function RemovalPlaceholder({ stop, onUndo }: { stop: Stop; onUndo: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1B3A5C]/20 bg-[#1B3A5C]/5 px-4 py-3 mb-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#1B3A5C]">
          Removed <span className="font-semibold">{stop.name}</span>
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-md border border-[#C4664A] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#C4664A] hover:bg-[#C4664A] hover:text-white transition-colors"
        >
          Undo
        </button>
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#C4664A] origin-left animate-[shrink_8s_linear_forwards]" />
    </div>
  );
}

export default function TourResults({ stops, removedStops, destinationCity, destinationCountry, prompt, durationLabel, transport, tourId, walkViolations, originalTargetStops, onRemoveStop, onQuickUndo, onDeleteCommit, onPermanentRestore, onReplaceStops }: Props) {
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
  const [saveSuccess, setSaveSuccess] = useState<{ tripTitle: string; tripId: string; day: number; tourId: string } | null>(null);
  const [imgLoaded, setImgLoaded] = useState<Record<string, boolean>>({});

  const [showRemoved, setShowRemoved] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pendingRemovals, setPendingRemovals] = useState<{
    stop: Stop;
    timer: ReturnType<typeof setTimeout>;
    startedAt: number;
  }[]>([]);

  // Flush pending DELETEs on unmount
  useEffect(() => {
    return () => {
      pendingRemovals.forEach(p => {
        clearTimeout(p.timer);
        fetch(`/api/tours/${tourId}/stops/${p.stop.id}`, {
          method: "DELETE",
          keepalive: true,
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function normalizeCity(s: string | null | undefined): string {
    return (s ?? "").toLowerCase().split(",")[0].trim();
  }

  function autoSelectTrip(loadedTrips: TripOption[]) {
    const tourCityNorm = normalizeCity(destinationCity);
    if (!tourCityNorm) return;
    const matches = loadedTrips.filter(t => {
      const tripCityNorm = normalizeCity(t.destinationCity);
      if (!tripCityNorm) return false;
      return tripCityNorm === tourCityNorm || tripCityNorm.includes(tourCityNorm) || tourCityNorm.includes(tripCityNorm);
    });
    if (matches.length === 0) return;
    const upcoming = matches.filter(t => t.status === "PLANNING" || t.status === "ACTIVE");
    const match = upcoming[0] ?? matches[0];
    if (match) {
      const mx = (match.startDate && match.endDate)
        ? Math.round((new Date(match.endDate.split("T")[0]).getTime() - new Date(match.startDate.split("T")[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 30;
      setSelectedTripId(match.id);
      setMaxDays(mx);
    }
  }

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
        .then((d: { trips?: TripOption[] }) => {
          const loaded = d.trips ?? [];
          const tourCityNorm = normalizeCity(destinationCity);
          const sorted = [...loaded].sort((a, b) => {
            const aMatch = normalizeCity(a.destinationCity) === tourCityNorm;
            const bMatch = normalizeCity(b.destinationCity) === tourCityNorm;
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0;
          });
          setTrips(sorted);
          autoSelectTrip(sorted);
        })
        .catch(() => {})
        .finally(() => setTripsLoading(false));
    } else {
      autoSelectTrip(trips);
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
      const res = await fetch("/api/tours/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourMeta: {
            prompt,
            destinationCity,
            destinationCountry: destinationCountry ?? null,
            durationLabel,
            transport,
          },
          ...(tourId ? { tourId } : { stops }),
          tripId: selectedTripId,
          dayIndex: selectedDay - 1,
        }),
      });
      const data = await res.json() as { tourId?: string; error?: string };
      if (!res.ok || data.error) {
        setSaveError(data.error ?? "Some stops failed to save. Please try again.");
        return;
      }
      setSaveSuccess({ tripTitle: trip.title, tripId: trip.id, day: selectedDay, tourId: data.tourId ?? "" });
      window.dispatchEvent(new Event("flokk:refresh"));
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLocalRemove(stop: Stop) {
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/tours/${tourId}/stops/${stop.id}`, {
        method: "DELETE",
        keepalive: true,
      });
      if (res.ok) {
        onRemoveStop(stop.id);
        onDeleteCommit(stop);
      }
      setPendingRemovals(prev => prev.filter(p => p.stop.id !== stop.id));
    }, 8000);

    setPendingRemovals(prev => [
      ...prev.filter(p => p.stop.id !== stop.id),
      { stop, timer, startedAt: Date.now() },
    ]);
  }

  function handleUndo(stopId: string) {
    setPendingRemovals(prev => {
      const target = prev.find(p => p.stop.id === stopId);
      if (target) clearTimeout(target.timer);
      return prev.filter(p => p.stop.id !== stopId);
    });
  }

  const activeCount = stops.filter(s => !pendingRemovals.some(p => p.stop.id === s.id)).length;
  const gap = originalTargetStops - activeCount;

  async function handleRegenerate() {
    if (!tourId || gap <= 0) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/tours/${tourId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: gap }),
      });
      if (!res.ok) {
        console.error("[regenerate]", await res.text());
        return;
      }
      const data = await res.json() as { newStops: Stop[]; allActive: Stop[] };
      onReplaceStops(data.allActive);
    } catch (e) {
      console.error("[regenerate] network error", e);
    } finally {
      setIsRegenerating(false);
    }
  }

  const upcomingTrips = trips.filter(t => t.status === "PLANNING" || t.status === "ACTIVE");
  const pastTrips = trips.filter(t => t.status === "COMPLETED");

  return (
    <div>
      <p className="font-serif text-xl font-semibold text-[#1B3A5C] mb-1">{prompt}</p>
      <p className="text-sm text-gray-400 mb-6">{destinationCity}</p>

      {walkViolations != null && walkViolations > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Heads up: this tour has {walkViolations} {walkViolations === 1 ? "walk" : "walks"} that exceed the suggested walking distance for your family. You can remove any stop and regenerate for a tighter route.
          </p>
        </div>
      )}

      {stops.length > 0 && (
        <div ref={containerRef} className="h-[280px] rounded-2xl overflow-hidden mb-6" />
      )}

      {stops.map((stop, index) => (
        pendingRemovals.some(p => p.stop.id === stop.id) ? (
          <RemovalPlaceholder
            key={stop.id}
            stop={stop}
            onUndo={() => handleUndo(stop.id)}
          />
        ) : (
          <div key={stop.id} className="relative border border-gray-100 rounded-2xl mb-3 shadow-sm bg-white overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLocalRemove(stop);
              }}
              className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white z-10"
              aria-label={`Remove ${stop.name}`}
            >
              <X size={14} className="text-[#1B3A5C]" />
            </button>

            <div className="flex">
              {/* Image */}
              <div className="w-24 h-24 shrink-0 bg-stone-100 flex items-center justify-center overflow-hidden">
                {stop.imageUrl ? (
                  <img
                    src={stop.imageUrl}
                    alt={stop.name}
                    className="w-full h-full object-cover transition-opacity duration-500"
                    style={{ opacity: imgLoaded[stop.id] ? 1 : 0 }}
                    onLoad={() => setImgLoaded(prev => ({ ...prev, [stop.id]: true }))}
                  />
                ) : (
                  <MapPin size={20} className="text-stone-300" />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col p-3 flex-1 min-w-0 gap-1.5">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#C4664A] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-sm font-semibold text-[#1B3A5C] leading-snug">{stop.name}</span>
                </div>

                {stop.websiteUrl && (
                  <a
                    href={stop.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-[#1B3A5C] hover:text-[#C4664A] transition-colors"
                  >
                    <ExternalLink size={12} />
                    Visit website
                  </a>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-500">
                    <Clock size={10} />
                    {stop.duration} min
                  </span>
                  {transport === "Walking" && index > 0 && (stops[index - 1].travelTime ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-500">
                      <Footprints size={10} />
                      {stops[index - 1].travelTime} min walk
                    </span>
                  )}
                </div>

                {stop.why && (
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{stop.why}</p>
                )}

                {stop.familyNote && (
                  <p className="text-xs text-[#C4664A] italic line-clamp-2">{stop.familyNote}</p>
                )}
              </div>
            </div>
          </div>
        )
      ))}

      {gap > 0 && (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1B3A5C]/30 bg-white px-4 py-6 text-sm font-medium text-[#1B3A5C] hover:border-[#1B3A5C] hover:bg-[#1B3A5C]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRegenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating {gap === 1 ? "a replacement stop" : `${gap} replacement stops`}...
            </>
          ) : (
            <>
              <Plus size={16} />
              {gap === 1 ? "Add a replacement stop" : `Generate ${gap} more stops`}
            </>
          )}
        </button>
      )}

      {removedStops.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRemoved(s => !s)}
            className="flex items-center gap-2 text-sm text-[#1B3A5C] hover:underline"
          >
            <ChevronDown size={14} className={showRemoved ? "rotate-180 transition-transform" : "transition-transform"} />
            {showRemoved ? "Hide" : "Show"} removed stops ({removedStops.length})
          </button>
          {showRemoved && (
            <div className="mt-3 space-y-2">
              {removedStops.map(stop => (
                <div key={stop.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-700">{stop.name}</span>
                  <button
                    type="button"
                    onClick={() => onPermanentRestore(stop)}
                    className="rounded-md border border-[#1B3A5C] bg-white px-2 py-1 text-xs font-semibold text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white transition-colors"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                <button onClick={closeModal} className="text-sm text-gray-400 text-center mt-2 cursor-pointer block w-full" style={{ background: "none", border: "none" }}>
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
                        {upcomingTrips.map(trip => {
                          const isMatch = normalizeCity(trip.destinationCity) === normalizeCity(destinationCity);
                          return (
                            <div
                              key={trip.id}
                              onClick={() => {
                                const mx = (trip.startDate && trip.endDate)
                                  ? Math.round((new Date(trip.endDate.split("T")[0]).getTime() - new Date(trip.startDate.split("T")[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                  : 30;
                                setSelectedTripId(trip.id);
                                setMaxDays(mx);
                                setSelectedDay(d => d > mx ? 1 : d);
                              }}
                              className={`py-2 px-3 rounded-lg cursor-pointer ${selectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "hover:bg-gray-50"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-[#1B3A5C] font-medium">{trip.title}</p>
                                {isMatch && <span className="text-xs text-[#C4664A] font-medium shrink-0">Suggested</span>}
                              </div>
                              {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                            </div>
                          );
                        })}
                      </>
                    )}
                    {pastTrips.length > 0 && (
                      <>
                        <p className={`text-xs text-gray-400 uppercase tracking-wide px-1 py-1 font-semibold ${upcomingTrips.length > 0 ? "mt-2" : ""}`}>Past Trips</p>
                        {pastTrips.map(trip => {
                          const isMatch = normalizeCity(trip.destinationCity) === normalizeCity(destinationCity);
                          return (
                            <div
                              key={trip.id}
                              onClick={() => {
                                const mx = (trip.startDate && trip.endDate)
                                  ? Math.round((new Date(trip.endDate.split("T")[0]).getTime() - new Date(trip.startDate.split("T")[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                  : 30;
                                setSelectedTripId(trip.id);
                                setMaxDays(mx);
                                setSelectedDay(d => d > mx ? 1 : d);
                              }}
                              className={`py-2 px-3 rounded-lg cursor-pointer ${selectedTripId === trip.id ? "bg-[#1B3A5C]/5 border border-[#1B3A5C]" : "hover:bg-gray-50"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-[#1B3A5C] font-medium">{trip.title}</p>
                                {isMatch && <span className="text-xs text-[#C4664A] font-medium shrink-0">Suggested</span>}
                              </div>
                              {trip.destinationCity && <p className="text-xs text-gray-400">{trip.destinationCity}</p>}
                            </div>
                          );
                        })}
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
