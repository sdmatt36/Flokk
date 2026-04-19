// src/lib/google-places.ts
//
// Entry point for place lookup via Google Places text search + details.
// Scope: URL resolution with name-similarity guard, place name normalization.
// NOT a consolidation of all Places API calls in the codebase — photo enrichment,
// geocoding, and autocomplete callers remain in their own modules and were not
// migrated in this prompt. Future consolidation is a separate scoped effort.

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";

export interface PlacesResult {
  placeId: string;
  name: string;
  website: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name normalization — the canonical place-name cleaner for the codebase.
// Replaces prior cleanVenueName. Covers:
//   1. Meal/activity prefix stripping ("Dinner at X" → "X")
//   2. Tabelog/review-site suffix removal (from old cleanVenueName)
//   3. Country-route and parenthetical cleanup (from old cleanVenueName)
//   4. Whitespace collapse
// ─────────────────────────────────────────────────────────────────────────────

// Prefixes that describe context of a visit but don't change what the place IS.
// Order matters: longer/more-specific patterns first.
const CONTEXT_PREFIXES: RegExp[] = [
  /^check[-\s]?in\s*[:\-]\s*/i,
  /^check[-\s]?out\s*[:\-]\s*/i,
  /^(breakfast|brunch|lunch|dinner|snack|drinks|cocktails|coffee|tea|desserts?)\s+at\s+/i,
  /^(visit(ing)?|touring|tour\s+of)\s+/i,
  /^(morning|afternoon|evening|night|day)\s+at\s+/i,
  /^stop\s+(at|by)\s+/i,
  /^shopping\s+at\s+/i,
  /^stay(ing)?\s+at\s+/i,
];

// Suffix noise carried over from old cleanVenueName.
const SUFFIX_NOISE: RegExp[] = [
  /\s*\|\s*Tabelog.*$/i,
  /\s+-\s+[^|]+\/[^|]+$/i,
  /\s*\([^)]*\/[^)]*\)\s*$/u,
];

/**
 * Normalize a raw place name into its canonical form.
 * Preserves original if stripping would leave too little to identify the place.
 */
export function normalizePlaceName(raw: string): string {
  if (!raw) return raw;

  let name = raw.trim();

  // Strip context prefixes. Bounded to 3 passes.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const rx of CONTEXT_PREFIXES) {
      const stripped = name.replace(rx, "");
      if (stripped !== name) {
        name = stripped.trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  // Suffix noise
  for (const rx of SUFFIX_NOISE) {
    name = name.replace(rx, "");
  }

  // Collapse whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Safety: if stripping left something too short, return original (trimmed)
  if (name.length < 3) return raw.trim();

  return name;
}

// ─────────────────────────────────────────────────────────────────────────────
// Junk filter — names that should not be resolved against Places at all.
// ─────────────────────────────────────────────────────────────────────────────

const JUNK_PATTERNS = [/instagram/i, /airbnb/i, /\broom\b/i];

export function isJunkPlaceName(title: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(title));
}

// ─────────────────────────────────────────────────────────────────────────────
// Name similarity guard
// ─────────────────────────────────────────────────────────────────────────────

export function nameSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const wordsA = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wordsB = norm(b).split(" ").filter((w) => w.length > 2);
  const overlap = wordsB.filter((w) => wordsA.has(w)).length;
  return overlap > 0 || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

// ─────────────────────────────────────────────────────────────────────────────
// Places lookup. Returns null on any failure mode.
// ─────────────────────────────────────────────────────────────────────────────

export async function lookupPlace(rawName: string, city: string): Promise<PlacesResult | null> {
  if (!API_KEY || !rawName?.trim()) return null;

  const normalized = normalizePlaceName(rawName);
  if (isJunkPlaceName(normalized)) return null;

  try {
    const query = [normalized, city.trim()].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `${PLACES_TEXT_SEARCH}?query=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    const searchData = (await searchRes.json()) as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailsRes = await fetch(
      `${PLACES_DETAILS}?place_id=${placeId}&fields=name,website&key=${API_KEY}`
    );
    const detailsData = (await detailsRes.json()) as {
      result?: { name?: string; website?: string };
    };
    const placesName = detailsData.result?.name;
    const website = detailsData.result?.website ?? null;
    if (!placesName) return null;

    // Compare Places result against normalized name (not raw)
    if (!nameSimilar(normalized, placesName)) return null;

    return { placeId, name: placesName, website };
  } catch {
    return null;
  }
}

/**
 * Thin URL-only wrapper for callers that don't need the full lookup result.
 */
export async function resolvePlaceUrl(rawName: string, city: string): Promise<string | null> {
  const result = await lookupPlace(rawName, city);
  return result?.website ?? null;
}

/**
 * Whether a place name deserves a URL lookup attempt.
 * Returns false for junk names — distinguishes "tried and got nothing" from
 * "this was never going to have a URL."
 */
export function deservesUrl(rawName: string): boolean {
  if (!rawName?.trim()) return false;
  const normalized = normalizePlaceName(rawName);
  return !isJunkPlaceName(normalized);
}

// ─────────────────────────────────────────────────────────────────────────────
// Country resolution via Places text search + address_components.
// Used by backfill scripts to populate SavedItem.destinationCountry and
// CommunitySpot.country. Separate from lookupPlace to avoid modifying the
// URL-resolution path.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the country for a known place name + city.
 * Performs a text search to get a place_id, then fetches address_components
 * to extract the country long_name.
 * Returns null on any failure — callers must treat null as "unresolvable".
 */
export async function resolveCountry(
  name: string,
  city: string
): Promise<string | null> {
  if (!API_KEY || !name?.trim() || !city?.trim()) return null;

  try {
    const query = [normalizePlaceName(name), city.trim()].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `${PLACES_TEXT_SEARCH}?query=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    const searchData = (await searchRes.json()) as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailsRes = await fetch(
      `${PLACES_DETAILS}?place_id=${placeId}&fields=address_components&key=${API_KEY}`
    );
    const detailsData = (await detailsRes.json()) as {
      result?: {
        address_components?: Array<{ long_name: string; types: string[] }>;
      };
    };
    const components = detailsData.result?.address_components ?? [];
    const countryComp = components.find((c) => c.types.includes("country"));
    return countryComp?.long_name ?? null;
  } catch {
    return null;
  }
}
