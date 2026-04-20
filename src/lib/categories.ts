// Single source of truth for Flokk's canonical category taxonomy.
// All writes to ManualActivity.type, CommunitySpot.category, and
// SavedItem.categoryTags must use these slugs.

/** Transport markers — excluded from user-facing discovery surfaces. Never normalized away. */
export const TRANSPORT_CATEGORIES = ["train", "flight", "airline", "transport", "transit"] as const;

export type CategorySlug =
  | "food_and_drink"
  | "culture"
  | "nature_and_outdoors"
  | "adventure"
  | "experiences"
  | "sports_and_entertainment"
  | "shopping"
  | "kids_and_family"
  | "lodging"
  | "nightlife"
  | "wellness"
  | "other";

export interface Category {
  slug: CategorySlug;
  label: string;
}

export const CATEGORIES: Category[] = [
  { slug: "food_and_drink",          label: "Food & Drink" },
  { slug: "culture",                  label: "Culture" },
  { slug: "nature_and_outdoors",      label: "Nature & Outdoors" },
  { slug: "adventure",                label: "Adventure" },
  { slug: "experiences",              label: "Experiences" },
  { slug: "sports_and_entertainment", label: "Sports & Entertainment" },
  { slug: "shopping",                 label: "Shopping" },
  { slug: "kids_and_family",          label: "Kids & Family" },
  { slug: "lodging",                  label: "Lodging" },
  { slug: "nightlife",                label: "Nightlife" },
  { slug: "wellness",                 label: "Wellness" },
  { slug: "other",                    label: "Other" },
];

export const CATEGORY_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

/** Map from legacy / display / variant values → canonical slug. */
const LEGACY_MAP: Record<string, CategorySlug> = {
  // food
  "food":                    "food_and_drink",
  "food & drink":            "food_and_drink",
  "dinner":                  "food_and_drink",
  "breakfast":               "food_and_drink",
  "lunch":                   "food_and_drink",
  "seafood":                 "food_and_drink",
  "street food":             "food_and_drink",
  "drinks":                  "food_and_drink",
  "dessert":                 "food_and_drink",
  // culture
  "history":                 "culture",
  "unesco":                  "culture",
  "art":                     "culture",
  "architecture":            "culture",
  "temple":                  "culture",
  "design":                  "culture",
  // experiences
  "activity":                "experiences",
  "experience":              "experiences",
  "tour":                    "experiences",
  "day trip":                "experiences",
  "festival":                "experiences",
  "music":                   "experiences",
  "aquarium":                "experiences",
  "theme park":              "experiences",
  "picnic":                  "experiences",
  "photo":                   "experiences",
  // nature_and_outdoors
  "nature":                  "nature_and_outdoors",
  "outdoor":                 "nature_and_outdoors",
  "outdoors":                "nature_and_outdoors",
  "beach":                   "nature_and_outdoors",
  "wildlife":                "nature_and_outdoors",
  "scenic":                  "nature_and_outdoors",
  "sunset":                  "nature_and_outdoors",
  "sunrise":                 "nature_and_outdoors",
  "garden":                  "nature_and_outdoors",
  "views":                   "nature_and_outdoors",
  // sports_and_entertainment
  "sport":                   "sports_and_entertainment",
  "sports":                  "sports_and_entertainment",
  "entertainment":           "sports_and_entertainment",
  // shopping
  "market":                  "shopping",
  // kids_and_family
  "kids":                    "kids_and_family",
  "family":                  "kids_and_family",
  "kids_camps":              "kids_and_family",
  "kids camps":              "kids_and_family",
  "kids & family":           "kids_and_family",
  // other catch-alls
  "iconic":                  "other",
  "neighbourhood":           "other",
  "tech":                    "other",
  "science":                 "other",
};

/**
 * Normalize any category string to a canonical slug.
 * Returns null only if the input is blank or unmappable (e.g. dietary/transit tags).
 * Never call this on dietary (vg/vgn) or transit (flight/train) tags —
 * those are preserved as-is in categoryTags and are not category slugs.
 */
export function normalizeCategorySlug(raw: string | null | undefined): CategorySlug | null {
  if (!raw?.trim()) return null;
  const lower = raw.trim().toLowerCase();
  if (CATEGORY_SLUGS.has(lower)) return lower as CategorySlug;
  return LEGACY_MAP[lower] ?? null;
}

/**
 * Return the display label for a slug, or the raw value if unrecognized.
 */
export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  const match = CATEGORIES.find((c) => c.slug === slug);
  return match?.label ?? slug;
}
