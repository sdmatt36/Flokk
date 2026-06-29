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
