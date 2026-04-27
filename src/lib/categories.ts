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
  { slug: "adventure",                label: "Adventure" },
  { slug: "culture",                  label: "Culture" },
  { slug: "experiences",              label: "Experiences" },
  { slug: "food_and_drink",          label: "Food & Drink" },
  { slug: "kids_and_family",          label: "Kids & Family" },
  { slug: "lodging",                  label: "Lodging" },
  { slug: "nature_and_outdoors",      label: "Nature & Outdoors" },
  { slug: "nightlife",                label: "Nightlife" },
  { slug: "shopping",                 label: "Shopping" },
  { slug: "sports_and_entertainment", label: "Sports & Entertainment" },
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

/** Google Places API type → canonical CategorySlug. First specific match wins; generic fallback to "experiences". */
const SPECIFIC_TYPE_MAP: Record<string, string> = {
  // food_and_drink
  restaurant:              "food_and_drink",
  cafe:                    "food_and_drink",
  bar:                     "food_and_drink",
  bakery:                  "food_and_drink",
  meal_takeaway:           "food_and_drink",
  meal_delivery:           "food_and_drink",
  food:                    "food_and_drink",
  // lodging
  lodging:                 "lodging",
  hotel:                   "lodging",
  // culture
  museum:                  "culture",
  art_gallery:             "culture",
  library:                 "culture",
  place_of_worship:        "culture",
  hindu_temple:            "culture",
  church:                  "culture",
  mosque:                  "culture",
  synagogue:               "culture",
  cemetery:                "culture",
  historical_landmark:     "culture",
  // nature_and_outdoors
  park:                    "nature_and_outdoors",
  natural_feature:         "nature_and_outdoors",
  campground:              "nature_and_outdoors",
  beach:                   "nature_and_outdoors",
  // kids_and_family
  amusement_park:          "kids_and_family",
  zoo:                     "kids_and_family",
  aquarium:                "kids_and_family",
  // shopping
  shopping_mall:           "shopping",
  store:                   "shopping",
  department_store:        "shopping",
  clothing_store:          "shopping",
  book_store:              "shopping",
  supermarket:             "shopping",
  grocery_or_supermarket:  "shopping",
  // nightlife
  night_club:              "nightlife",
  casino:                  "nightlife",
  // wellness
  spa:                     "wellness",
  gym:                     "wellness",
  beauty_salon:            "wellness",
  hair_care:               "wellness",
  // sports_and_entertainment
  stadium:                 "sports_and_entertainment",
  bowling_alley:           "sports_and_entertainment",
  movie_theater:           "sports_and_entertainment",
  arcade:                  "sports_and_entertainment",
};

const GENERIC_TYPES = new Set(["tourist_attraction", "point_of_interest", "establishment"]);

export function mapPlaceTypesToCanonicalSlugs(placeTypes: string[] | null | undefined): string[] {
  if (!placeTypes || placeTypes.length === 0) return [];
  for (const t of placeTypes) {
    const slug = SPECIFIC_TYPE_MAP[t];
    if (slug) return [slug];
  }
  if (placeTypes.some(t => GENERIC_TYPES.has(t))) return ["experiences"];
  return [];
}
