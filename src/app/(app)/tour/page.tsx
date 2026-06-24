"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import TourResults from "@/components/TourResults";
import { ShareButton } from "@/components/shared/ShareButton";
import BuildATourHero from "@/components/features/build-a-tour/BuildATourHero";
import YourToursSection from "@/components/features/build-a-tour/YourToursSection";
import FlokkLearnsYouPanel from "@/components/features/build-a-tour/FlokkLearnsYouPanel";
import FlokkerExamplesSection from "@/components/features/build-a-tour/FlokkerExamplesSection";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";

type DestinationSuggestion = {
  placeId: string;
  cityName: string;
  countryName: string;
  region: string;
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
  title?: string | null;
  subtitle?: string | null;
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
  inputGroup?: string | null;
  inputVibe?: string[];
  inputDurationHr?: number | null;
  isPublic?: boolean;
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

type PublishResult = {
  tourId: string;
  isPublic: boolean;
  publicTitle: string | null;
  publicSubtitle: string | null;
  stops: Array<{
    id: string;
    publicWhy: string | null;
    publicFamilyNote: string | null;
  }>;
};

type PublishStatus =
  | "idle"
  | "confirming"
  | "publishing"
  | "published"
  | "unpublishing"
  | "unpublished"
  | "error";

const WHOS_COMING_OPTIONS = [
  "With the whole family",
  "Just adults",
  "Solo",
  "Multi-family",
  "Grandparents",
  "Teens lead",
];

const WHOS_COMING_TO_GROUP: Record<string, string> = {
  "With the whole family": "family_kids",
  "Just adults": "adults_only",
  "Solo": "solo",
  "Multi-family": "friends",
  "Grandparents": "adults_only",
  "Teens lead": "family_kids",
};

const VIBE_OPTIONS = [
  "Food & markets",
  "Culture",
  "Nature",
  "Adventure",
  "Beach",
  "Off-path",
  "Family-paced",
  "Parks & play",
  "Sweets",
  "Animals",
  "Blend",
  "✨ Surprise me",
];

const VIBE_TO_SLUG: Record<string, string> = {
  "Food & markets": "food_markets",
  "Culture": "culture",
  "Nature": "nature",
  "Adventure": "adventure",
  "Beach": "beach",
  "Off-path": "off_path",
  "Family-paced": "family_paced",
  "Parks & play": "parks_play",
  "Sweets": "sweets",
  "Animals": "animals",
  "Blend": "blend",
  "✨ Surprise me": "surprise",
};

const DURATION_TO_HOURS: Record<string, number> = {
  "1 hour": 1,
  "2 hours": 2,
  "3 hours": 3,
  "Half day (4 hrs)": 4,
  "Full day (8 hrs)": 8,
};

export default function TourPage() {
  const [tripId, setTripId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [startingPoint, setStartingPoint] = useState("");
  const [destinationCountry, setDestinationCountry] = useState<string | null>(null);
  const [durationLabel, setDurationLabel] = useState("");
  const [transport, setTransport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<TourResponse | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [removedStops, setRemovedStops] = useState<Stop[]>([]);
  const [touched, setTouched] = useState(false);
  const [whosComing, setWhosComing] = useState("With the whole family");
  const [vibes, setVibes] = useState<string[]>(["Food & markets"]);

  // Library state
  const [savedTours, setSavedTours] = useState<Record<string, SavedTourEntry[]>>({});
  const [loadingTours, setLoadingTours] = useState(true);

  // Publish state machine
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isCurrentlyPublic, setIsCurrentlyPublic] = useState(false);

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

  // Browser back/forward: sync UI to URL
  useEffect(() => {
    function handlePopState() {
      const idParam = new URLSearchParams(window.location.search).get("id");
      if (!idParam) {
        setResults(null);
        setStops([]);
        setRemovedStops([]);
      } else {
        loadSavedTour(idParam);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSavedTours() {
    setLoadingTours(true);
    try {
      const res = await fetch("/api/tours/my-tours");
      if (res.ok) {
        const data = await res.json() as Record<string, SavedTourEntry[]>;
        setSavedTours(data);
      }
    } catch { /* non-fatal */ } finally {
      setLoadingTours(false);
    }
  }

  async function loadSavedTour(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tours/${id}`);
      if (!res.ok) { setError("Could not load tour."); return; }
      const data = await res.json() as TourResponse;
      setResults(data);
      // Hydrate publish state from the loaded tour so an already-public tour shows the
      // "Live on Discover" pill + an Unpublish control (was only ever set by in-session publish).
      setIsCurrentlyPublic(!!data.isPublic);
      // Push state so the back button returns to /tour (form) not home.
      // Skip push if the URL already matches (e.g. initial page load with ?id=).
      const currentId = new URLSearchParams(window.location.search).get("id");
      if (currentId !== id) {
        window.history.pushState({}, "", `/tour?id=${id}`);
      }
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
          inputStartPoint: startingPoint.trim() || undefined,
          inputGroup: WHOS_COMING_TO_GROUP[whosComing] ?? "family_kids",
          inputVibe: vibes.map(v => VIBE_TO_SLUG[v]).filter(Boolean),
          inputDurationHr: DURATION_TO_HOURS[durationLabel] ?? null,
        }),
      });
      const data = await res.json() as TourResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResults({ ...data, destinationCountry });
        if (data.tourId) {
          window.history.pushState({}, "", `/tour?id=${data.tourId}`);
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
    setStartingPoint("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleRemoveStop(stopId: string) {
    setStops(prev => prev.filter(s => s.id !== stopId));
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
  }

  const handlePublishClick = () => {
    setPublishStatus("confirming");
    setPublishError(null);
  };

  const handleConfirmPublish = async () => {
    if (!results?.tourId) return;
    setPublishStatus("publishing");
    try {
      const res = await fetch(`/api/tours/${results.tourId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || `Publish failed with status ${res.status}`);
      }
      const data: PublishResult = await res.json();
      setPublishResult(data);
      setPublishStatus("published");
      setIsCurrentlyPublic(true);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Couldn't publish right now. Try again.");
      setPublishStatus("error");
    }
  };

  const handleUnpublish = async () => {
    if (!results?.tourId) return;
    setPublishStatus("unpublishing");
    try {
      const res = await fetch(`/api/tours/${results.tourId}/publish`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Unpublish failed with status ${res.status}`);
      }
      setPublishStatus("unpublished");
      setIsCurrentlyPublic(false);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Couldn't unpublish right now. Try again.");
      setPublishStatus("error");
    }
  };

  const handleClosePublishModal = () => {
    setPublishStatus("idle");
    setPublishResult(null);
    setPublishError(null);
  };

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
              Create a new tour
            </button>
            {results.tourId && (
              <ShareButton
                entityType="generated_tour"
                entityId={results.tourId}
                title={results.title ?? "Tour on Flokk"}
                label="Share tour"
              />
            )}
            {results.tourId && (
              isCurrentlyPublic ? (
                <button
                  onClick={handleUnpublish}
                  className="text-sm text-[#C4664A] font-semibold cursor-pointer"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  Unpublish
                </button>
              ) : (
                <button
                  onClick={handlePublishClick}
                  className="text-sm text-[#C4664A] font-semibold cursor-pointer"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  Publish to Discover
                </button>
              )
            )}
            {isCurrentlyPublic && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#1B3A5C", fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                Live on Discover
              </span>
            )}
          </div>
          <TourResults
            stops={stops}
            removedStops={removedStops}
            destinationCity={results.destinationCity}
            destinationCountry={results.destinationCountry ?? null}
            prompt={results.prompt}
            title={results.title ?? null}
            subtitle={results.subtitle ?? null}
            inputGroup={results.inputGroup ?? null}
            inputVibe={results.inputVibe ?? []}
            inputDurationHr={results.inputDurationHr ?? null}
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

        {publishStatus !== "idle" && (
          <div
            className={MODAL_OVERLAY_CLASSES}
            onClick={publishStatus === "publishing" || publishStatus === "unpublishing" ? undefined : handleClosePublishModal}
          >
            <div
              className={MODAL_PANEL_CLASSES}
              style={{ maxWidth: "440px", padding: "32px 28px" }}
              onClick={(e) => e.stopPropagation()}
            >
              {publishStatus === "confirming" && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Publish to Discover?
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 24px" }}>
                    Your tour will be visible to anyone browsing Flokk. We&apos;ll automatically rewrite the copy
                    to remove your children&apos;s names and replace them with age ranges.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button
                      onClick={handleClosePublishModal}
                      style={{ padding: "10px 16px", background: "none", border: "none", color: "#555", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPublish}
                      style={{ padding: "10px 24px", background: "#C4664A", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Publish
                    </button>
                  </div>
                </>
              )}

              {publishStatus === "publishing" && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Publishing your tour
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 16px" }}>
                    We&apos;re carefully editing your tour for public viewing. This takes about 20 seconds.
                  </p>
                  <div style={{ fontSize: 14, color: "#C4664A", fontStyle: "italic" }}>
                    Flokking.
                  </div>
                </>
              )}

              {publishStatus === "published" && publishResult && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Your tour is live on Discover
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Here&apos;s how it reads to the public. Names removed, age ranges added.
                  </p>
                  <div style={{ background: "#F9F7F4", padding: 16, borderRadius: 8, marginBottom: 20 }}>
                    {publishResult.publicTitle && (
                      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1B3A5C", marginBottom: 6 }}>
                        {publishResult.publicTitle}
                      </div>
                    )}
                    {publishResult.publicSubtitle && (
                      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, fontStyle: "italic" }}>
                        {publishResult.publicSubtitle}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
                    <button
                      onClick={handleUnpublish}
                      style={{ padding: "10px 16px", background: "none", border: "none", color: "#555", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Unpublish
                    </button>
                    <button
                      onClick={handleClosePublishModal}
                      style={{ padding: "10px 24px", background: "#C4664A", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {publishStatus === "unpublishing" && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Unpublishing
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>
                    Removing your tour from Discover.
                  </p>
                </>
              )}

              {publishStatus === "unpublished" && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Tour unpublished
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 24px" }}>
                    Your tour is no longer visible on Discover. The share link still works for anyone you&apos;ve sent it to.
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={handleClosePublishModal}
                      style={{ padding: "10px 24px", background: "#1B3A5C", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {publishStatus === "error" && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px", lineHeight: 1.2 }}>
                    Something went wrong
                  </h2>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: "0 0 24px" }}>
                    {publishError ?? "Couldn't complete that action. Try again."}
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={handleClosePublishModal}
                      style={{ padding: "10px 24px", background: "#C4664A", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "linear-gradient(180deg, #FAEAD0 0%, #FAEAD0 200px, #FFFFFF 600px)" }}>
      <BuildATourHero />

      {/* Two-column row: form card + Flokk Learns You panel */}
      <div className="flex flex-col md:flex-row" style={{ maxWidth: 1200, margin: "0 auto", marginTop: -120, position: "relative", zIndex: 5, padding: "0 32px", gap: 24, alignItems: "stretch" }}>
        {/* Form card */}
        <div className="bg-white rounded-2xl tour-form-card" style={{ flex: "1 1 720px", border: "1px solid rgba(0,0,0,0.04)", padding: "40px 60px", boxShadow: "0 8px 32px rgba(27,58,92,0.08), 0 2px 8px rgba(27,58,92,0.04)" }}>
        <div>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setTouched(true); }}
            placeholder="A ramen tour in Tokyo near Shinjuku for a family with young kids"
            className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
            style={{ minHeight: 140 }}
          />

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
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
                      {(() => {
                        const needsRegion = suggestions.filter(
                          other => other.cityName === s.cityName && other.countryName === s.countryName
                        ).length > 1;
                        if (needsRegion && s.region && s.region !== s.cityName && s.region !== s.countryName) {
                          return <span className="text-gray-400 text-xs whitespace-nowrap">· {s.region}, {s.countryName}</span>;
                        }
                        if (s.countryName && s.countryName !== s.cityName) {
                          return <span className="text-gray-400 text-xs whitespace-nowrap">· {s.countryName}</span>;
                        }
                        return null;
                      })()}
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
              <option value="1 hour">1 hour</option>
              <option value="2 hours">2 hours</option>
              <option value="3 hours">3 hours</option>
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

          <input
            type="text"
            value={startingPoint}
            onChange={(e) => setStartingPoint(e.target.value)}
            placeholder="Starting point (optional: hotel name, landmark, address)"
            className={`${inputClass} mt-3`}
          />

          {/* Who's Coming + Vibe chips */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #F0F0F0" }}>
            <div style={{ fontSize: 11, color: "#717171", letterSpacing: "0.5px", fontWeight: 500, marginBottom: 8 }}>
              WHO&apos;S COMING
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {WHOS_COMING_OPTIONS.map((opt) => {
                const selected = whosComing === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setWhosComing(opt)}
                    style={{
                      padding: "6px 12px",
                      background: selected ? "#1B3A5C" : "white",
                      color: selected ? "white" : "#1B3A5C",
                      border: selected ? "none" : "1px solid #E0E0E0",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: selected ? 500 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {opt}{selected ? " ✓" : ""}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 11, color: "#717171", letterSpacing: "0.5px", fontWeight: 500, marginBottom: 8 }}>
              VIBE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {VIBE_OPTIONS.map((opt) => {
                const selected = vibes.includes(opt);
                const isSurprise = opt === "✨ Surprise me";
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVibes((prev) => prev.includes(opt) ? prev.filter(v => v !== opt) : [...prev, opt])}
                    style={{
                      padding: "6px 12px",
                      background: selected ? "rgba(196,102,74,0.12)" : (isSurprise ? "linear-gradient(90deg, rgba(196,102,74,0.12), rgba(27,58,92,0.12))" : "white"),
                      color: (selected || isSurprise) ? "#C4664A" : "#1B3A5C",
                      border: selected ? "1px solid rgba(196,102,74,0.4)" : (isSurprise ? "1px solid rgba(196,102,74,0.3)" : "1px solid #E0E0E0"),
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: (selected || isSurprise) ? 500 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {opt}{selected ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !allFilled}
            className="w-full mt-7 bg-[#1B3A5C] text-white rounded-xl py-3 px-6 text-sm font-medium flex items-center justify-center disabled:opacity-60"
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
        </div>
        <FlokkLearnsYouPanel />
      </div>

      {/* Tour Library */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <YourToursSection
          savedTours={savedTours}
          loadingTours={loadingTours}
          onLoadTour={loadSavedTour}
          onDelete={handleTourDelete}
        />

        <div className="mb-12" />
      </div>

      <FlokkerExamplesSection
        userTourCount={Object.keys(savedTours).length}
        onSelectExample={(p) => setPrompt(p)}
      />
    </div>
  );
}
