"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ExternalLink, Footprints, GripVertical, Loader2, MapPin, Plus, X } from "lucide-react";
import { bucketTrips } from "@/lib/trip-phase";
import TourMapBlock from "@/components/tours/TourMapBlock";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const GROUP_CHIP_LABELS: Record<string, string> = {
  adults_only: "Adults only",
  family_kids: "Family",
  solo: "Solo",
  couple: "Couple",
  friends: "Friends",
};

type Props = {
  stops: Stop[];
  removedStops: Stop[];
  destinationCity: string;
  destinationCountry?: string | null;
  prompt: string;
  title?: string | null;
  subtitle?: string | null;
  inputGroup?: string | null;
  inputVibe?: string[];
  inputDurationHr?: number | null;
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
  readOnly?: boolean;
};

// ── Sortable stop wrapper ──────────────────────────────────────────────────────
function SortableStopShell({ id, children }: { id: string; children: (dragHandleProps: React.HTMLAttributes<HTMLSpanElement>, isDragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners } as React.HTMLAttributes<HTMLSpanElement>, isDragging)}
    </div>
  );
}

function RemovalPlaceholder({ stop, onUndo }: { stop: Stop; onUndo: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1B3A5C]/20 bg-[#1B3A5C]/5 px-4 py-3 mb-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#1B3A5C]">
          Removed <span className="font-semibold">{decodeHtmlEntities(stop.name)}</span>
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

export default function TourResults({ stops, removedStops, destinationCity, destinationCountry, prompt, title, subtitle, inputGroup, inputVibe, inputDurationHr, durationLabel, transport, tourId, walkViolations, originalTargetStops, onRemoveStop, onQuickUndo, onDeleteCommit, onPermanentRestore, onReplaceStops, readOnly = false }: Props) {
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
  const [showPastTrips, setShowPastTrips] = useState(false);
  const [pendingRemovals, setPendingRemovals] = useState<{
    stop: Stop;
    timer: ReturnType<typeof setTimeout>;
    startedAt: number;
  }[]>([]);

  // Add-stop form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addDuration, setAddDuration] = useState("30");
  const [addNotes, setAddNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addNameRef = useRef<HTMLInputElement>(null);

  // Reorder debounce ref — persist after drag settles
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // dnd-kit sensors: pointer (mouse/trackpad) + touch (mobile) + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stops.findIndex(s => s.id === active.id);
    const newIndex = stops.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(stops, oldIndex, newIndex).map((s, i) => ({ ...s, orderIndex: i }));
    onReplaceStops(reordered);
    persistReorder(reordered);
  }

  function moveStop(stopId: string, direction: "up" | "down") {
    const idx = stops.findIndex(s => s.id === stopId);
    if (idx === -1) return;
    const newIndex = direction === "up" ? idx - 1 : idx + 1;
    if (newIndex < 0 || newIndex >= stops.length) return;
    const reordered = arrayMove(stops, idx, newIndex).map((s, i) => ({ ...s, orderIndex: i }));
    onReplaceStops(reordered);
    persistReorder(reordered);
  }

  function persistReorder(reordered: Stop[]) {
    if (!tourId) return;
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(() => {
      fetch(`/api/tours/${tourId}/stops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((s, i) => ({ id: s.id, orderIndex: i })) }),
      });
    }, 600);
  }

  async function handleAddStop() {
    if (!addName.trim() || !tourId || isAdding) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/tours/${tourId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          address: addAddress.trim() || undefined,
          durationMin: parseInt(addDuration) || 30,
          notes: addNotes.trim() || undefined,
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as Stop & { prevStopId?: string | null; prevStopTravelTime?: number | null };
      // Sync travelTime on the previous stop so the walk-time chip updates
      const updated = stops.map(s =>
        s.id === data.prevStopId && data.prevStopTravelTime != null
          ? { ...s, travelTime: data.prevStopTravelTime }
          : s
      );
      const { prevStopId: _a, prevStopTravelTime: _b, ...newStop } = data;
      onReplaceStops([...updated, newStop]);
      setAddName("");
      setAddAddress("");
      setAddDuration("30");
      setAddNotes("");
      setShowAddForm(false);
    } catch { /* non-fatal */ } finally {
      setIsAdding(false);
    }
  }

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

  // Discipline 4.11: bucketing via shared helper. Past trips collapsed (not excluded) — the Spots/Discover content flywheel depends on retroactive tour generation from completed trips.
  const { current: currentTrips, upcoming: upcomingTrips, past: pastTrips } = bucketTrips(trips);
  const activePicks = [...currentTrips, ...upcomingTrips, ...pastTrips];

  return (
    <div>
      <p className="font-serif text-xl font-semibold text-[#1B3A5C] mb-1">{title ?? destinationCity}</p>
      {subtitle && <p className="text-sm text-gray-500 mb-2">{subtitle}</p>}
      {(inputGroup || (inputVibe && inputVibe.length > 0) || inputDurationHr) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {inputGroup && (
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#F0F4F8", color: "#1B3A5C", borderRadius: 20, fontWeight: 500 }}>
              {GROUP_CHIP_LABELS[inputGroup] ?? inputGroup}
            </span>
          )}
          {inputDurationHr && (
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#F0F4F8", color: "#1B3A5C", borderRadius: 20, fontWeight: 500 }}>
              {inputDurationHr} hr{inputDurationHr !== 1 ? "s" : ""}
            </span>
          )}
          {inputVibe?.map(v => (
            <span key={v} style={{ fontSize: 11, padding: "3px 10px", background: "rgba(196,102,74,0.1)", color: "#C4664A", borderRadius: 20, fontWeight: 500 }}>
              {v.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm text-gray-400 mb-6">{destinationCity}</p>

      {walkViolations != null && walkViolations > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Heads up: {walkViolations} {walkViolations === 1 ? "leg" : "legs"} on this route exceed the suggested walking distance. Remove a stop and regenerate for a tighter route.
          </p>
        </div>
      )}

      <TourMapBlock stops={stops} transport={transport} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {stops.map((stop, index) => (
            pendingRemovals.some(p => p.stop.id === stop.id) ? (
              <RemovalPlaceholder
                key={stop.id}
                stop={stop}
                onUndo={() => handleUndo(stop.id)}
              />
            ) : (
              <SortableStopShell key={stop.id} id={stop.id}>
                {(dragHandleProps, isDragging) => (
                  <div className={`relative border rounded-2xl mb-3 shadow-sm bg-white overflow-hidden ${isDragging ? "border-[#1B3A5C]/40 shadow-md" : "border-gray-100"}`}>
                    {!readOnly && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {/* Up/Down arrows for reliable mobile reorder */}
                        <button
                          type="button"
                          onClick={() => moveStop(stop.id, "up")}
                          disabled={index === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp size={12} className="text-[#1B3A5C]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStop(stop.id, "down")}
                          disabled={index === stops.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown size={12} className="text-[#1B3A5C]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLocalRemove(stop);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white"
                          aria-label={`Remove ${stop.name}`}
                        >
                          <X size={14} className="text-[#1B3A5C]" />
                        </button>
                      </div>
                    )}

                    <div className="flex">
                      {/* Drag handle */}
                      {!readOnly && (
                        <span
                          {...dragHandleProps}
                          className="flex items-center justify-center w-6 shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none"
                          style={{ paddingLeft: 4 }}
                          aria-label="Drag to reorder"
                        >
                          <GripVertical size={14} />
                        </span>
                      )}

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
                      <div className="flex flex-col p-3 flex-1 min-w-0 gap-1.5" style={{ paddingRight: readOnly ? undefined : "72px" }}>
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#C4664A] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <span className="text-sm font-semibold text-[#1B3A5C] leading-snug">{decodeHtmlEntities(stop.name)}</span>
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
                            Link
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

                        {stop.why && stop.why !== "Added manually" && (
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{decodeHtmlEntities(stop.why)}</p>
                        )}

                        {stop.familyNote && (
                          <p className="text-xs text-[#C4664A] italic line-clamp-2">{stop.familyNote}</p>
                        )}

                        {/* Directions to next stop */}
                        {(() => {
                          const next = stops[index + 1];
                          if (!next || !stop.lat || !stop.lng || !next.lat || !next.lng) return null;
                          const travelMode = transport === "Walking" ? "walking" : transport === "Metro / Transit" ? "transit" : "driving";
                          const url = `https://www.google.com/maps/dir/?api=1&origin=${stop.lat},${stop.lng}&destination=${next.lat},${next.lng}&travelmode=${travelMode}`;
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-[#1B3A5C]/60 hover:text-[#1B3A5C] transition-colors mt-0.5"
                            >
                              <MapPin size={10} />
                              Directions to {decodeHtmlEntities(next.name)}
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </SortableStopShell>
            )
          ))}
        </SortableContext>
      </DndContext>

      {/* Add a stop */}
      {!readOnly && tourId && (
        showAddForm ? (
          <div className="border border-[#1B3A5C]/20 rounded-2xl bg-[#F8FAFF] p-4 mb-3">
            <p className="text-sm font-semibold text-[#1B3A5C] mb-3">Add a stop</p>
            <input
              ref={addNameRef}
              type="text"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAddStop(); if (e.key === "Escape") setShowAddForm(false); }}
              placeholder="Place name (required)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-2 bg-white"
              autoFocus
            />
            <input
              type="text"
              value={addAddress}
              onChange={e => setAddAddress(e.target.value)}
              placeholder="Address (optional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-2 bg-white"
            />
            <div className="flex gap-2 mb-2">
              <select
                value={addDuration}
                onChange={e => setAddDuration(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] bg-white"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">90 min</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            <input
              type="text"
              value={addNotes}
              onChange={e => setAddNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] mb-3 bg-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddStop}
                disabled={!addName.trim() || isAdding}
                className="flex-1 bg-[#1B3A5C] text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
                style={{ border: "none", cursor: addName.trim() && !isAdding ? "pointer" : "default" }}
              >
                {isAdding ? "Adding..." : "Add stop"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddName(""); setAddAddress(""); setAddDuration("30"); setAddNotes(""); }}
                className="px-4 rounded-xl border border-gray-200 text-sm text-gray-500"
                style={{ background: "white", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setTimeout(() => addNameRef.current?.focus(), 50); }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#1B3A5C]/30 bg-white px-4 py-3 text-sm text-[#1B3A5C] hover:border-[#1B3A5C] hover:bg-[#1B3A5C]/5 transition-colors"
          >
            <Plus size={14} />
            Add your own stop
          </button>
        )
      )}

      {gap > 0 && !readOnly && (
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
                  <span className="text-sm text-gray-700">{decodeHtmlEntities(stop.name)}</span>
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

      {stops.length > 0 && !readOnly && (
        <button
          onClick={openModal}
          className="w-full border border-[#1B3A5C] text-[#1B3A5C] rounded-xl py-3 px-6 text-sm font-medium mt-4"
        >
          Save stops to a trip
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={closeModal}>
          <div className="w-full sm:w-[480px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
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
                    {currentTrips.length > 0 && (
                      <>
                        <p className="text-xs uppercase tracking-wide px-1 py-1 font-semibold" style={{ color: "#C4664A" }}>Happening Now</p>
                        {currentTrips.map(trip => {
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
                    {upcomingTrips.length > 0 && (
                      <>
                        <p className={`text-xs text-gray-400 uppercase tracking-wide px-1 py-1 font-semibold ${currentTrips.length > 0 ? "mt-2" : ""}`}>Upcoming</p>
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
                        <button
                          type="button"
                          onClick={() => setShowPastTrips(v => !v)}
                          className={`text-xs text-gray-400 uppercase tracking-wide px-1 py-1 font-semibold w-full text-left ${(currentTrips.length > 0 || upcomingTrips.length > 0) ? "mt-2" : ""}`}
                          style={{ background: "none", border: "none", cursor: "pointer", letterSpacing: "0.05em" }}
                        >
                          Past Trips {showPastTrips ? "▲" : "▼"}
                        </button>
                        {showPastTrips && pastTrips.map(trip => {
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
                    {activePicks.length === 0 && (
                      <p className="text-sm text-gray-400 py-2 px-1">No trips found. <a href="/trips/new" className="text-[#C4664A] font-medium">Create one →</a></p>
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
