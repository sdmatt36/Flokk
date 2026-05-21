"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, X, MapPin, Utensils,
  Coffee, Camera, Toilet, Armchair, Loader2,
} from "lucide-react";

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

type View = "categories" | "food";
type MealType = "auto" | "breakfast" | "lunch" | "dinner";

const CATEGORIES = [
  { key: "place_i_know", icon: MapPin,    label: "A place I know", implemented: true,  action: "manual"          },
  { key: "food",         icon: Utensils,  label: "Food",           implemented: true,  action: "food_subscreen"  },
  { key: "snack",        icon: Coffee,    label: "Snack",          implemented: false, action: null              },
  { key: "bathroom",     icon: Toilet,    label: "Bathroom",       implemented: false, action: null              },
  { key: "photo_spot",   icon: Camera,    label: "Photo spot",     implemented: false, action: null              },
  { key: "rest",         icon: Armchair,  label: "Rest",           implemented: false, action: null              },
] as const;

export default function AddStopSheet({ tourId, isOpen, onClose, onPickPlaceIKnow, onStopsUpdated }: AddStopSheetProps) {
  const [view, setView] = useState<View>("categories");
  const [foodMealType, setFoodMealType] = useState<MealType>("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setView("categories");
      setFoodMealType("auto");
      setError(null);
      setIsSubmitting(false);
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
