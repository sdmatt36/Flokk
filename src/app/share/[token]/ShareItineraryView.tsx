"use client";

import { useState } from "react";
import { ShareActivityCard, type SerializableItem } from "./ShareActivityCard";
import { SaveDayButton, type SaveableItem } from "./SaveDayButton";

const CATEGORY_ORDER = ["Lodging", "Food", "Culture", "Kids", "Outdoor", "Shopping", "Transportation", "Other"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

function getCategory(tag: string | null, title?: string | null): Category {
  const check = (s: string): Category | null => {
    const t = s.toLowerCase().trim();
    if (t === "stay" || t === "lodging" || t.includes("hotel") || t.includes("hostel") || t.includes("accommodation")) return "Lodging";
    if (
      t === "food" || t.includes("food") || t.includes("restaurant") || t.includes("restaurants") ||
      t.includes("cafe") || t.includes("dining") || t.includes("lunch") || t.includes("dinner") ||
      t.includes("breakfast") || t.includes("brunch") || t.includes("taco") || t.includes("burger") ||
      t.includes("bbq") || t.includes("grill") || t.includes("bistro") || t.includes("brasserie") ||
      t.includes("tavern") || t.includes("pub") || t.includes("eatery") || t.includes("sushi") ||
      t.includes("ramen") || t.includes("noodle") || t.includes("pizza") || t.includes("bakery") ||
      t.includes("bakers") || t.includes("patisserie") || t.includes("snack") || t.includes("buffet") ||
      t.includes("steakhouse") || t.includes("seafood") || t.includes("izakaya") || t.includes("yakitori") ||
      t.includes("hotpot") || t.includes("dim sum") || t.includes("curry") || t.includes("deli") ||
      t.includes("sandwich") || t.includes("mipo") || t.includes("sam ryan")
    ) return "Food";
    if (
      t === "culture" || t.includes("culture") || t.includes("museum") || t.includes("art") ||
      t.includes("temple") || t.includes("shrine") || t.includes("gallery") || t.includes("village") ||
      t.includes("district") || t.includes("hanok") || t.includes("dmz") || t.includes("insider") ||
      t.includes("tour") || t.includes("cathedral") || t.includes("church") || t.includes("castle") ||
      t.includes("fortress") || t.includes("tower") || t.includes("ruins") || t.includes("heritage") ||
      t.includes("traditional") || t.includes("folk") || t.includes("cultural") || t.includes("exhibition") ||
      t.includes("cemetery") || t.includes("memorial") || t.includes("statue") || t.includes("landmark") ||
      t.includes("viewpoint") || t.includes("observatory") || t.includes("lookout") || t.includes("panorama")
    ) return "Culture";
    if (
      t === "kids" || t === "family" || t.includes("kid") || t.includes("child") || t.includes("family") ||
      t.includes("lego") || t.includes("science") || t.includes("discovery") || t.includes("wonder") ||
      t.includes("adventure") || t.includes("trampoline") || t.includes("bowling") || t.includes("arcade") ||
      t.includes("laser tag") || t.includes("escape room") || t.includes("water park") ||
      t.includes("safari") || t.includes("farm") || t.includes("petting")
    ) return "Kids";
    if (
      t === "outdoor" || t === "outdoors" || t.includes("outdoor") || t.includes("park") ||
      t.includes("hike") || t.includes("beach") || t.includes("nature") || t.includes("garden") ||
      t.includes("cable car") || t.includes("sky cab") || t.includes("gondola") || t.includes("chairlift") ||
      t.includes("tram") || t.includes("river") || t.includes("lake") || t.includes("waterfall") ||
      t.includes("forest") || t.includes("botanical") || t.includes("national park") || t.includes("coast") ||
      t.includes("cliff") || t.includes("valley") || t.includes("island") || t.includes("sunrise") ||
      t.includes("sunset") || t.includes("scenic") || t.includes("namsam") || t.includes("namsan")
    ) return "Outdoor";
    if (t === "shopping" || t.includes("shop") || t.includes("market") || t.includes("mall")) return "Shopping";
    if (t === "flt" || t === "rail" || t === "transportation" || t.includes("transport") || t.includes("flight") || t.includes("train") || t.includes("transit")) return "Transportation";
    return null;
  };

  if (tag) {
    const result = check(tag);
    if (result) return result;
  }
  if (title) {
    const result = check(title);
    if (result) return result;
  }
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
    categoryGroups[getCategory(item.tag, item.title)].push(item);
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

              <div className="space-y-4 w-full">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
