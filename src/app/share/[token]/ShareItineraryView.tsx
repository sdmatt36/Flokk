"use client";

import { useState } from "react";
import { ShareActivityCard, type SerializableItem } from "./ShareActivityCard";
import { SaveDayButton, type SaveableItem } from "./SaveDayButton";

const CATEGORY_ORDER = ["Lodging", "Food", "Culture", "Kids", "Outdoor", "Shopping", "Transportation", "Other"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

function getCategory(tag: string | null): Category {
  if (!tag) return "Other";
  const t = tag.toLowerCase();
  if (t === "stay") return "Lodging";
  if (t === "food" || t.includes("food") || t.includes("restaurant") || t.includes("cafe") || t.includes("dining")) return "Food";
  if (t === "culture" || t.includes("culture") || t.includes("museum") || t.includes("art") || t.includes("temple")) return "Culture";
  if (t === "kids" || t.includes("kid") || t.includes("child") || t.includes("family")) return "Kids";
  if (t === "outdoor" || t.includes("outdoor") || t.includes("park") || t.includes("hike") || t.includes("beach") || t.includes("nature")) return "Outdoor";
  if (t === "shopping" || t.includes("shop") || t.includes("market")) return "Shopping";
  if (t === "flt" || t === "rail" || t === "transportation" || t.includes("transport") || t.includes("flight") || t.includes("train")) return "Transportation";
  return "Other";
}

export interface DayData {
  index: number;
  label: string;
  city: string | null;
  items: SerializableItem[];
  saveItems: SaveableItem[];
}

export function ShareItineraryView({
  days,
  isLoggedIn,
  shareToken,
  heroImageUrl,
}: {
  days: DayData[];
  isLoggedIn: boolean;
  shareToken: string;
  heroImageUrl: string | null;
}) {
  const [viewMode, setViewMode] = useState<"day" | "category">("day");

  const allItems = days.flatMap((d) => d.items);

  const categoryGroups = CATEGORY_ORDER.reduce<Record<Category, SerializableItem[]>>(
    (acc, cat) => { acc[cat] = []; return acc; },
    {} as Record<Category, SerializableItem[]>
  );
  for (const item of allItems) {
    categoryGroups[getCategory(item.tag)].push(item);
  }

  return (
    <section style={{ marginTop: "28px" }}>
      {/* Day / Category toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode("day")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            viewMode === "day"
              ? "bg-[#1B3A5C] text-white"
              : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          By day
        </button>
        <button
          onClick={() => setViewMode("category")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            viewMode === "category"
              ? "bg-[#1B3A5C] text-white"
              : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          By category
        </button>
      </div>

      {viewMode === "day" ? (
        /* ── Day view ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {days.map((day, dayIdx) => (
            <div key={day.index}>
              {/* Day header */}
              <div
                className="border-b border-stone-200 pb-2 mb-4"
                style={{ marginTop: dayIdx === 0 ? 0 : "32px" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#1B3A5C]">{day.label}</h2>
                    {day.city && (
                      <p className="text-xs uppercase tracking-widest text-stone-400 mt-0.5">
                        {day.city}
                      </p>
                    )}
                  </div>
                  <SaveDayButton
                    isLoggedIn={isLoggedIn}
                    currentPath={`/share/${shareToken}`}
                    items={day.saveItems}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {day.items.map((item) => (
                  <ShareActivityCard
                    key={item.id}
                    item={item}
                    isLoggedIn={isLoggedIn}
                    heroImageUrl={heroImageUrl}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Category view ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {CATEGORY_ORDER.filter((cat) => categoryGroups[cat].length > 0).map((cat) => (
            <div key={cat}>
              <h2 className="text-lg font-bold text-[#1B3A5C] mb-3">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categoryGroups[cat].map((item) => (
                  <ShareActivityCard
                    key={item.id}
                    item={item}
                    isLoggedIn={isLoggedIn}
                    heroImageUrl={heroImageUrl}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
