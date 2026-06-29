// Single source of truth for resolving a place's MACRO city (Taipei, Istanbul, Lisbon, Denpasar)
// from Google address_components, instead of a district / freguesia / kota / ward. destinationCity
// is load-bearing (it drives Saves bucketing, the community flywheel, and trip auto-attach), so both
// the reverse-geocode path (enrich-save.ts) and the place-details path (enrich-with-places.ts) call
// this one function and cannot drift.
//
// Precedence (validated against real Google output for the failing + working rows):
//   1. locality            — the city itself; a colloquial_area+locality combo counts (e.g. "Taipei")
//   2. postal_town         — UK, where locality is absent (e.g. London boroughs)
//   3. administrative_area_level_1 — the macro admin, used only when no locality exists
//                            (e.g. "İstanbul"; in Türkiye the province is the city)
//
// administrative_area_level_2 and _3 are intentionally DROPPED: those are the district / freguesia
// that produced 文山區 / Beyoğlu / Santa Maria Maior / Kota Denpasar. Returns long_name (the full,
// language=en city name) or null.
//
// IMPORTANT: for reverse-geocode, pass the components FLATTENED across all results[] — the locality
// is frequently its own result, not results[0] (which leads with the establishment/district).

export type AddressComponent = {
  long_name: string;
  short_name?: string;
  types: string[];
};

export function pickMacroCity(components: AddressComponent[]): string | null {
  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? null;
  return (
    byType("locality") ??
    byType("postal_town") ??
    byType("administrative_area_level_1")
  );
}

// Exonym alias map: Google often returns the local-language name even with language=en. Maps the
// endonym to the clean English city name for STORAGE + DISPLAY. Exact-match only — a name with no
// entry passes through unchanged, so Kamakura / Barcelona / Montréal / Cancún keep their form (and
// accents). Growable: add cases as we hit them. Keys are Google's exact long_name output.
const CITY_EXONYMS: Record<string, string> = {
  "İstanbul": "Istanbul",
  "Lisboa": "Lisbon",
  "Roma": "Rome",
  "Firenze": "Florence",
  "München": "Munich",
  "Wien": "Vienna",
  "Praha": "Prague",
  "Genève": "Geneva",
  "Köln": "Cologne",
  "Moskva": "Moscow",
};

// Normalize a resolved city to its clean English form for storage/display. Returns the input
// unchanged when there is no alias (preserving accents like Montréal). Null/empty passes through.
export function normalizeCityName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  const trimmed = name.trim();
  return CITY_EXONYMS[trimmed] ?? trimmed;
}

// Canonical key for MATCHING only (never stored): apply the exonym alias, lowercase, strip
// diacritics. Used on BOTH the save city and the trip cities before comparing, so an "İstanbul"
// save matches an "Istanbul" trip and "Montréal" matches "Montreal" even for rows that slipped
// through unnormalized. normalizeCityName runs first so the alias maps the raw endonym (e.g. the
// dotted "İstanbul") before any lowercasing.
export function canonicalizeForMatch(name: string | null | undefined): string {
  const aliased = normalizeCityName(name);
  if (!aliased) return "";
  return aliased
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .trim();
}
