"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, X, MapPin, Utensils,
  Coffee, Camera, Toilet, Armchair, Loader2,
} from "lucide-react";
import type { PrefetchedCandidate } from "@/lib/tour-stop-insertion";

type StopUpdate = {
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

type AddStopSheetProps = {
  tourId: string;
  isOpen: boolean;
  onClose: () => void;
  onPickPlaceIKnow: () => void;
  onStopsUpdated: (stops: StopUpdate[]) => void;
};

type View = "categories" | "food" | "bathroom" | "snack" | "photo_spot";
type MealType = "auto" | "breakfast" | "lunch" | "dinner";
type BathroomState = "idle" | "loading" | "preview" | "error";
type BathroomError = "no_candidates" | "places_resolution_failed" | "out_of_area" | "auth" | "unknown";

const CATEGORIES = [
  { key: "place_i_know", icon: MapPin,    label: "A place I know", implemented: true,  action: "manual"          },
  { key: "food",         icon: Utensils,  label: "Food",           implemented: true,  action: "food_subscreen"  },
  { key: "snack",        icon: Coffee,    label: "Snack",          implemented: true,  action: "snack_flow"      },
  { key: "bathroom",     icon: Toilet,    label: "Bathroom",       implemented: true,  action: "bathroom_flow"   },
  { key: "photo_spot",   icon: Camera,    label: "Photo spot",     implemented: true,  action: "photo_spot_flow" },
  { key: "rest",         icon: Armchair,  label: "Rest",           implemented: false, action: null              },
] as const;

export default function AddStopSheet({ tourId, isOpen, onClose, onPickPlaceIKnow, onStopsUpdated }: AddStopSheetProps) {
  const [view, setView] = useState<View>("categories");
  const [foodMealType, setFoodMealType] = useState<MealType>("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bathroomState, setBathroomState] = useState<BathroomState>("idle");
  const [bathroomCandidate, setBathroomCandidate] = useState<PrefetchedCandidate | null>(null);
  const [bathroomInsertAfterStopId, setBathroomInsertAfterStopId] = useState<string | null>(null);
  const [bathroomError, setBathroomError] = useState<BathroomError | null>(null);

  const [snackState, setSnackState] = useState<BathroomState>("idle");
  const [snackCandidate, setSnackCandidate] = useState<PrefetchedCandidate | null>(null);
  const [snackInsertAfterStopId, setSnackInsertAfterStopId] = useState<string | null>(null);
  const [snackError, setSnackError] = useState<BathroomError | null>(null);

  const [photoSpotState, setPhotoSpotState] = useState<BathroomState>("idle");
  const [photoSpotCandidate, setPhotoSpotCandidate] = useState<PrefetchedCandidate | null>(null);
  const [photoSpotInsertAfterStopId, setPhotoSpotInsertAfterStopId] = useState<string | null>(null);
  const [photoSpotError, setPhotoSpotError] = useState<BathroomError | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setView("categories");
      setFoodMealType("auto");
      setError(null);
      setIsSubmitting(false);
      setBathroomState("idle");
      setBathroomCandidate(null);
      setBathroomInsertAfterStopId(null);
      setBathroomError(null);
      setSnackState("idle");
      setSnackCandidate(null);
      setSnackInsertAfterStopId(null);
      setSnackError(null);
      setPhotoSpotState("idle");
      setPhotoSpotCandidate(null);
      setPhotoSpotInsertAfterStopId(null);
      setPhotoSpotError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleCategoryClick(cat: typeof CATEGORIES[number]) {
    if (cat.action === "manual") {
      onPickPlaceIKnow();
      onClose();
      return;
    }
    if (cat.action === "food_subscreen") {
      setView("food");
      return;
    }
    if (cat.action === "bathroom_flow") {
      setView("bathroom");
      fireBathroomSuggest();
      return;
    }
    if (cat.action === "snack_flow") {
      setView("snack");
      fireSnackSuggest();
      return;
    }
    if (cat.action === "photo_spot_flow") {
      setView("photo_spot");
      firePhotoSpotSuggest();
      return;
    }
  }

  async function fireBathroomSuggest() {
    setBathroomState("loading");
    setBathroomCandidate(null);
    setBathroomInsertAfterStopId(null);
    setBathroomError(null);
    try {
      const res = await fetch(`/api/tours/${tourId}/suggest-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "bathroom" }),
      });
      if (res.status === 200) {
        const json = await res.json() as { candidate: PrefetchedCandidate; insertAfterStopId: string };
        setBathroomCandidate(json.candidate);
        setBathroomInsertAfterStopId(json.insertAfterStopId);
        setBathroomState("preview");
        return;
      }
      if (res.status === 404) {
        setBathroomError("auth");
        setBathroomState("error");
        return;
      }
      if (res.status === 422) {
        const json = await res.json() as { error?: string };
        setBathroomError((json.error as BathroomError) ?? "unknown");
        setBathroomState("error");
        return;
      }
      setBathroomError("unknown");
      setBathroomState("error");
    } catch {
      setBathroomError("unknown");
      setBathroomState("error");
    }
  }

  async function fireBathroomAccept() {
    if (!bathroomCandidate) return;
    setBathroomState("loading");
    try {
      const res = await fetch(`/api/tours/${tourId}/add-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "bathroom", prefetchedCandidate: bathroomCandidate, insertAfterStopId: bathroomInsertAfterStopId }),
      });
      if (res.status === 200) {
        const json = await res.json() as { allStops: StopUpdate[] };
        onStopsUpdated(json.allStops);
        onClose();
        return;
      }
      setBathroomError("unknown");
      setBathroomState("error");
    } catch {
      setBathroomError("unknown");
      setBathroomState("error");
    }
  }

  function fireBathroomDecline() {
    setView("categories");
    setBathroomState("idle");
    setBathroomCandidate(null);
    setBathroomInsertAfterStopId(null);
    setBathroomError(null);
  }

  async function handleSubmitFood() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tours/${tourId}/add-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "food", mealType: foodMealType }),
      });
      if (res.ok) {
        const data = (await res.json()) as { tourStop: unknown; pickedPlace: unknown; allStops: StopUpdate[] };
        if (Array.isArray(data.allStops)) {
          onStopsUpdated(data.allStops);
        }
        onClose();
        return;
      }
      let msg = "Couldn't add a stop. Try again.";
      try {
        const data = (await res.json()) as { reason?: string; message?: string };
        if (data.reason === "no_meal_gap")               msg = "This tour doesn't span lunch or dinner hours.";
        else if (data.reason === "no_candidates")        msg = "No restaurants found near the tour route.";
        else if (data.reason === "all_filtered_out")     msg = "No suitable restaurants found nearby.";
        else if (data.reason === "already_has_this_category") msg = "This tour already has a meal stop.";
        else if (data.reason === "too_few_stops")        msg = "This tour needs at least 2 stops.";
        else if (data.reason === "wrong_owner")          msg = "You don't have permission to modify this tour.";
        else if (data.reason === "tour_not_found")       msg = "Tour not found.";
        else if (data.reason === "not_implemented")      msg = "This stop type isn't available yet.";
        else if (data.message)                           msg = data.message;
      } catch { /* fall through to default */ }
      setError(msg);
      setIsSubmitting(false);
    } catch {
      setError("Couldn't add a stop. Try again.");
      setIsSubmitting(false);
    }
  }

  function bathroomHeaderTitle() {
    if (bathroomState === "error") return "No match";
    return "Bathroom break";
  }

  function bathroomErrorCopy() {
    if (!bathroomError || bathroomError === "no_candidates" || bathroomError === "places_resolution_failed" || bathroomError === "out_of_area") {
      return "We couldn't find a clean restroom on this route right now.";
    }
    if (bathroomError === "auth") {
      return "Your session expired. Please sign in again.";
    }
    return "Something went wrong. Try again or pick a place manually.";
  }

  async function fireSnackSuggest() {
    setSnackState("loading");
    setSnackCandidate(null);
    setSnackInsertAfterStopId(null);
    setSnackError(null);
    try {
      const res = await fetch(`/api/tours/${tourId}/suggest-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "snack" }),
      });
      if (res.status === 200) {
        const json = await res.json() as { candidate: PrefetchedCandidate; insertAfterStopId: string };
        setSnackCandidate(json.candidate);
        setSnackInsertAfterStopId(json.insertAfterStopId);
        setSnackState("preview");
        return;
      }
      if (res.status === 404) {
        setSnackError("auth");
        setSnackState("error");
        return;
      }
      if (res.status === 422) {
        const json = await res.json() as { error?: string };
        setSnackError((json.error as BathroomError) ?? "unknown");
        setSnackState("error");
        return;
      }
      setSnackError("unknown");
      setSnackState("error");
    } catch {
      setSnackError("unknown");
      setSnackState("error");
    }
  }

  async function fireSnackAccept() {
    if (!snackCandidate) return;
    setSnackState("loading");
    try {
      const res = await fetch(`/api/tours/${tourId}/add-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "snack", prefetchedCandidate: snackCandidate, insertAfterStopId: snackInsertAfterStopId }),
      });
      if (res.status === 200) {
        const json = await res.json() as { allStops: StopUpdate[] };
        onStopsUpdated(json.allStops);
        onClose();
        return;
      }
      setSnackError("unknown");
      setSnackState("error");
    } catch {
      setSnackError("unknown");
      setSnackState("error");
    }
  }

  function fireSnackDecline() {
    setView("categories");
    setSnackState("idle");
    setSnackCandidate(null);
    setSnackInsertAfterStopId(null);
    setSnackError(null);
  }

  function snackHeaderTitle() {
    if (snackState === "error") return "No match";
    return "Snack stop";
  }

  function snackErrorCopy() {
    if (!snackError || snackError === "no_candidates" || snackError === "places_resolution_failed" || snackError === "out_of_area") {
      return "We couldn't find a snack spot on this route right now.";
    }
    if (snackError === "auth") {
      return "Your session expired. Please sign in again.";
    }
    return "Something went wrong. Try again or pick a place manually.";
  }

  async function firePhotoSpotSuggest() {
    setPhotoSpotState("loading");
    setPhotoSpotCandidate(null);
    setPhotoSpotInsertAfterStopId(null);
    setPhotoSpotError(null);
    try {
      const res = await fetch(`/api/tours/${tourId}/suggest-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "photo_spot" }),
      });
      if (res.status === 200) {
        const json = await res.json() as { candidate: PrefetchedCandidate; insertAfterStopId: string };
        setPhotoSpotCandidate(json.candidate);
        setPhotoSpotInsertAfterStopId(json.insertAfterStopId);
        setPhotoSpotState("preview");
        return;
      }
      if (res.status === 404) {
        setPhotoSpotError("auth");
        setPhotoSpotState("error");
        return;
      }
      if (res.status === 422) {
        const json = await res.json() as { error?: string };
        setPhotoSpotError((json.error as BathroomError) ?? "unknown");
        setPhotoSpotState("error");
        return;
      }
      setPhotoSpotError("unknown");
      setPhotoSpotState("error");
    } catch {
      setPhotoSpotError("unknown");
      setPhotoSpotState("error");
    }
  }

  async function firePhotoSpotAccept() {
    if (!photoSpotCandidate) return;
    setPhotoSpotState("loading");
    try {
      const res = await fetch(`/api/tours/${tourId}/add-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "photo_spot", prefetchedCandidate: photoSpotCandidate, insertAfterStopId: photoSpotInsertAfterStopId }),
      });
      if (res.status === 200) {
        const json = await res.json() as { allStops: StopUpdate[] };
        onStopsUpdated(json.allStops);
        onClose();
        return;
      }
      setPhotoSpotError("unknown");
      setPhotoSpotState("error");
    } catch {
      setPhotoSpotError("unknown");
      setPhotoSpotState("error");
    }
  }

  function firePhotoSpotDecline() {
    setView("categories");
    setPhotoSpotState("idle");
    setPhotoSpotCandidate(null);
    setPhotoSpotInsertAfterStopId(null);
    setPhotoSpotError(null);
  }

  function photoSpotHeaderTitle() {
    if (photoSpotState === "error") return "No match";
    return "Photo spot";
  }

  function photoSpotErrorCopy() {
    if (!photoSpotError || photoSpotError === "no_candidates" || photoSpotError === "places_resolution_failed" || photoSpotError === "out_of_area") {
      return "We couldn't find a photo spot on this route right now.";
    }
    if (photoSpotError === "auth") {
      return "Your session expired. Please sign in again.";
    }
    return "Something went wrong. Try again or pick a place manually.";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] sm:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3A5C]/10">
          {view === "categories" ? (
            <h2 className="font-serif text-lg text-[#1B3A5C]">Add to your tour</h2>
          ) : view === "bathroom" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fireBathroomDecline}
                className="p-1 rounded-md hover:bg-[#1B3A5C]/5 text-[#1B3A5C]"
                aria-label="Back to categories"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-serif text-lg text-[#1B3A5C]">{bathroomHeaderTitle()}</h2>
            </div>
          ) : view === "snack" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fireSnackDecline}
                className="p-1 rounded-md hover:bg-[#1B3A5C]/5 text-[#1B3A5C]"
                aria-label="Back to categories"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-serif text-lg text-[#1B3A5C]">{snackHeaderTitle()}</h2>
            </div>
          ) : view === "photo_spot" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={firePhotoSpotDecline}
                className="p-1 rounded-md hover:bg-[#1B3A5C]/5 text-[#1B3A5C]"
                aria-label="Back to categories"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-serif text-lg text-[#1B3A5C]">{photoSpotHeaderTitle()}</h2>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView("categories")}
                className="p-1 rounded-md hover:bg-[#1B3A5C]/5 text-[#1B3A5C]"
                aria-label="Back to categories"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-serif text-lg text-[#1B3A5C]">Food</h2>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#1B3A5C]/5 text-[#1B3A5C]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === "categories" ? (
            <div className="flex flex-col">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  disabled={!cat.implemented}
                  className={`flex items-center w-full px-3 py-3 rounded-lg text-left ${
                    cat.implemented
                      ? "text-[#1B3A5C] hover:bg-[#1B3A5C]/5"
                      : "text-[#1B3A5C]/60 cursor-not-allowed"
                  }`}
                >
                  <cat.icon size={20} className="shrink-0" />
                  <span className="ml-3 flex-1 text-sm font-medium">{cat.label}</span>
                  {cat.implemented ? (
                    <ChevronRight size={16} className="opacity-50" />
                  ) : (
                    <span className="text-xs border border-[#C4664A] text-[#C4664A] rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : view === "bathroom" ? (
            <div className="flex flex-col gap-4">
              {bathroomState === "loading" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin text-[#1B3A5C]" />
                  <p className="text-sm text-[#4A5568]">Finding a clean restroom on your route…</p>
                </div>
              )}

              {bathroomState === "preview" && bathroomCandidate && (
                <>
                  {/* Candidate card */}
                  <div className="flex gap-3">
                    {bathroomCandidate.imageUrl && (
                      <img
                        src={bathroomCandidate.imageUrl}
                        alt={bathroomCandidate.name}
                        className="w-24 h-24 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <h3 className="font-serif font-bold text-lg text-[#1B3A5C] leading-tight">
                        {bathroomCandidate.name}
                      </h3>
                      <span className="inline-flex self-start text-xs border border-[#1B3A5C]/30 text-[#1B3A5C] rounded-full px-2 py-0.5">
                        {bathroomCandidate.durationMin} min stop
                      </span>
                      {bathroomCandidate.why && (
                        <p className="text-sm text-[#4A5568] leading-snug">{bathroomCandidate.why}</p>
                      )}
                      {bathroomCandidate.familyNote && (
                        <p className="text-sm italic text-[#C4664A] leading-snug">{bathroomCandidate.familyNote}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-3 mt-2">
                    <button
                      type="button"
                      onClick={fireBathroomAccept}
                      className="w-full rounded-xl bg-[#C4664A] text-white px-4 py-3 text-sm font-medium hover:bg-[#B85D42] transition-colors"
                    >
                      Add to tour
                    </button>
                    <button
                      type="button"
                      onClick={fireBathroomDecline}
                      className="w-full rounded-xl border border-[#1B3A5C]/20 text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Try a different category
                    </button>
                  </div>
                </>
              )}

              {bathroomState === "error" && (
                <>
                  {/* Error notice */}
                  <div className="border-l-4 border-[#C4664A] bg-[#FFF5F2] rounded-r-lg px-4 py-3">
                    <p className="text-sm text-[#1B3A5C]">{bathroomErrorCopy()}</p>
                  </div>

                  {/* CTA */}
                  {bathroomError === "auth" ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Refresh page
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { onPickPlaceIKnow(); onClose(); }}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Use A place I know instead
                    </button>
                  )}
                </>
              )}
            </div>
          ) : view === "snack" ? (
            <div className="flex flex-col gap-4">
              {snackState === "loading" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin text-[#1B3A5C]" />
                  <p className="text-sm text-[#4A5568]">Finding a snack spot on your route…</p>
                </div>
              )}

              {snackState === "preview" && snackCandidate && (
                <>
                  <div className="flex gap-3">
                    {snackCandidate.imageUrl && (
                      <img
                        src={snackCandidate.imageUrl}
                        alt={snackCandidate.name}
                        className="w-24 h-24 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <h3 className="font-serif font-bold text-lg text-[#1B3A5C] leading-tight">
                        {snackCandidate.name}
                      </h3>
                      <span className="inline-flex self-start text-xs border border-[#1B3A5C]/30 text-[#1B3A5C] rounded-full px-2 py-0.5">
                        {snackCandidate.durationMin} min stop
                      </span>
                      {snackCandidate.why && (
                        <p className="text-sm text-[#4A5568] leading-snug">{snackCandidate.why}</p>
                      )}
                      {snackCandidate.familyNote && (
                        <p className="text-sm italic text-[#C4664A] leading-snug">{snackCandidate.familyNote}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                    <button
                      type="button"
                      onClick={fireSnackAccept}
                      className="w-full rounded-xl bg-[#C4664A] text-white px-4 py-3 text-sm font-medium hover:bg-[#B85D42] transition-colors"
                    >
                      Add to tour
                    </button>
                    <button
                      type="button"
                      onClick={fireSnackDecline}
                      className="w-full rounded-xl border border-[#1B3A5C]/20 text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Try a different category
                    </button>
                  </div>
                </>
              )}

              {snackState === "error" && (
                <>
                  <div className="border-l-4 border-[#C4664A] bg-[#FFF5F2] rounded-r-lg px-4 py-3">
                    <p className="text-sm text-[#1B3A5C]">{snackErrorCopy()}</p>
                  </div>

                  {snackError === "auth" ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Refresh page
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { onPickPlaceIKnow(); onClose(); }}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Use A place I know instead
                    </button>
                  )}
                </>
              )}
            </div>
          ) : view === "photo_spot" ? (
            <div className="flex flex-col gap-4">
              {photoSpotState === "loading" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin text-[#1B3A5C]" />
                  <p className="text-sm text-[#4A5568]">Finding a photo spot on your route…</p>
                </div>
              )}

              {photoSpotState === "preview" && photoSpotCandidate && (
                <>
                  <div className="flex gap-3">
                    {photoSpotCandidate.imageUrl && (
                      <img
                        src={photoSpotCandidate.imageUrl}
                        alt={photoSpotCandidate.name}
                        className="w-24 h-24 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <h3 className="font-serif font-bold text-lg text-[#1B3A5C] leading-tight">
                        {photoSpotCandidate.name}
                      </h3>
                      <span className="inline-flex self-start text-xs border border-[#1B3A5C]/30 text-[#1B3A5C] rounded-full px-2 py-0.5">
                        {photoSpotCandidate.durationMin} min stop
                      </span>
                      {photoSpotCandidate.why && (
                        <p className="text-sm text-[#4A5568] leading-snug">{photoSpotCandidate.why}</p>
                      )}
                      {photoSpotCandidate.familyNote && (
                        <p className="text-sm italic text-[#C4664A] leading-snug">{photoSpotCandidate.familyNote}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                    <button
                      type="button"
                      onClick={firePhotoSpotAccept}
                      className="w-full rounded-xl bg-[#C4664A] text-white px-4 py-3 text-sm font-medium hover:bg-[#B85D42] transition-colors"
                    >
                      Add to tour
                    </button>
                    <button
                      type="button"
                      onClick={firePhotoSpotDecline}
                      className="w-full rounded-xl border border-[#1B3A5C]/20 text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Try a different category
                    </button>
                  </div>
                </>
              )}

              {photoSpotState === "error" && (
                <>
                  <div className="border-l-4 border-[#C4664A] bg-[#FFF5F2] rounded-r-lg px-4 py-3">
                    <p className="text-sm text-[#1B3A5C]">{photoSpotErrorCopy()}</p>
                  </div>

                  {photoSpotError === "auth" ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Refresh page
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { onPickPlaceIKnow(); onClose(); }}
                      className="w-full rounded-xl border border-[#1B3A5C] text-[#1B3A5C] px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/5 transition-colors"
                    >
                      Use A place I know instead
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-[#1B3A5C] mb-2">When?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(["auto", "breakfast", "lunch", "dinner"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFoodMealType(type)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        foodMealType === type
                          ? "border-[#1B3A5C] bg-[#1B3A5C] text-white"
                          : "border-[#1B3A5C]/30 bg-white text-[#1B3A5C] hover:border-[#1B3A5C] hover:bg-[#1B3A5C]/5"
                      }`}
                    >
                      {type === "auto" ? "Auto" : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitFood}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[#1B3A5C] text-white px-4 py-3 text-sm font-medium hover:bg-[#1B3A5C]/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Finding a spot...
                  </>
                ) : (
                  "Find me a spot"
                )}
              </button>

              {error && (
                <p className="text-xs text-[#C4664A]">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
