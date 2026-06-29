// Single source of truth for resolving a place's MACRO city (Taipei, Istanbul, Lisbon, Tokyo) from
// Google address_components. destinationCity is load-bearing (Saves bucketing, the community
// flywheel, trip auto-attach), so every reverse-geocode and place-details path calls this one
// function and cannot drift.
//
// Precedence (validated against the 2,008-row / 864-change dry-run corpus):
//   1. SPECIAL MUNICIPALITY — admin_area_level_1 IS the city (Istanbul, Taipei, Cairo, Seoul, Tokyo).
//      Precedes locality, so a Tokyo ward-locality (Shibuya) rolls up to "Tokyo". No structural
//      signal distinguishes these from a region admin_1 (Bali, Veneto, Changwat) — confirmed by the
//      component dumps — so a small curated allowlist is required.
//   2. LOCALITY — the city itself, preferring the English exonym (the standalone reverse-geocode
//      locality result returns "Venice"/"Copenhagen" while results[0] returns "Venezia"/"København").
//      Endonyms from place details (single result: "Brugge"/"Milano") are mapped via CITY_EXONYMS.
//   3. postal_town — UK, where locality is absent (London boroughs).
//   4. NO locality and admin_1 NOT special => admin_1 is a REGION. Never snap to it. As a bounded
//      exception, accept admin_2 only when it is an explicitly aliased city label ("Kota Denpasar" ->
//      "Denpasar"); otherwise return NULL so the caller keeps the existing value.

export type AddressComponent = {
  long_name: string;
  short_name?: string;
  types: string[];
};

// A reverse-geocode result: its top-level `types` plus its components. Needed so step 2 can pick the
// STANDALONE locality result (the one carrying the English exonym), not just flattened components.
export type GeoResult = {
  types: string[];
  address_components: AddressComponent[];
};

// Cities where admin_area_level_1 IS the city. Keyed by canonicalizeForMatch(admin_1.long_name) ->
// clean English name. ~stable global set; grow as the corpus surfaces more.
const SPECIAL_MUNICIPALITIES: Record<string, string> = {
  "istanbul": "Istanbul",
  "taipei city": "Taipei",
  "new taipei city": "New Taipei",
  "cairo governorate": "Cairo",
  "giza governorate": "Giza",
  "seoul": "Seoul",
  "busan": "Busan",
  "tokyo": "Tokyo",
  "bangkok": "Bangkok",
  "krung thep maha nakhon": "Bangkok",
  "hong kong": "Hong Kong",
};

// Exonym / admin-label alias map: Google returns the local-language or official-admin name even with
// language=en. Maps it to the clean English city for STORAGE + DISPLAY. Exact-match only — a name
// with no entry passes through unchanged, so Kamakura / Barcelona / Montréal keep their form (and
// accents). Seeded from the 864-change dry-run corpus.
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
  "Venezia": "Venice",
  "Milano": "Milan",
  "Napoli": "Naples",
  "Torino": "Turin",
  "Genova": "Genoa",
  "Brugge": "Bruges",
  "Bruxelles": "Brussels",
  "Antwerpen": "Antwerp",
  "Gent": "Ghent",
  "Sevilla": "Seville",
  "Warszawa": "Warsaw",
  "København": "Copenhagen",
  "Athina": "Athens",
  "Athína": "Athens",
  "Luzern": "Lucerne",
  "Marrakech": "Marrakesh",
  "La Habana": "Havana",
  "Krung Thep Maha Nakhon": "Bangkok",
  "Ciudad de México": "Mexico City",
  "Cartagena de Indias": "Cartagena",
  "Oaxaca de Juárez": "Oaxaca",
  "Kota Denpasar": "Denpasar",
  "Den Haag": "The Hague",
};

// Normalize a resolved city to its clean English form for storage/display. Returns the input
// unchanged when there is no alias (preserving accents like Montréal). Null/empty passes through.
export function normalizeCityName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  const trimmed = name.trim();
  return CITY_EXONYMS[trimmed] ?? trimmed;
}

// Canonical key for MATCHING only (never stored): apply the exonym alias, lowercase, strip
// diacritics. Used on both the save city and the trip cities before comparing, and on admin_1 for
// the SPECIAL_MUNICIPALITIES lookup. normalizeCityName runs first so the alias maps the raw endonym
// (e.g. dotted "İstanbul") before lowercasing.
export function canonicalizeForMatch(name: string | null | undefined): string {
  const aliased = normalizeCityName(name);
  if (!aliased) return "";
  return aliased
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .trim();
}

// Core selection. `standaloneLocality` (reverse-geocode only) is the English exonym from the
// dedicated locality result; when supplied it is preferred over the flattened locality component.
export function pickMacroCity(components: AddressComponent[], standaloneLocality?: string | null): string | null {
  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? null;

  // 1. Special municipality: admin_1 IS the city (rolls up wards/districts; precedes locality).
  const a1 = byType("administrative_area_level_1");
  if (a1) {
    const special = SPECIAL_MUNICIPALITIES[canonicalizeForMatch(a1)];
    if (special) return special;
  }

  // 2. Locality — prefer the standalone-result English exonym, normalize endonyms.
  const locality = standaloneLocality ?? byType("locality");
  if (locality) return normalizeCityName(locality);

  // 3. postal_town (UK).
  const postalTown = byType("postal_town");
  if (postalTown) return normalizeCityName(postalTown);

  // 4. No locality and admin_1 is a REGION (Bali, Veneto, Changwat) — never snap to it. Bounded
  //    exception: accept admin_2 only when it is an explicitly aliased city label (Kota Denpasar).
  const a2 = byType("administrative_area_level_2");
  if (a2) {
    const a2Alias = normalizeCityName(a2);
    if (a2Alias && a2Alias !== a2) return a2Alias;
  }
  return null;
}

// Reverse-geocode entry point: flatten components across all results AND extract the standalone
// locality result (a result whose top-level types include "locality" — Google returns the English
// exonym there). Pass both to pickMacroCity.
export function pickMacroCityFromResults(results: GeoResult[]): string | null {
  const flat = results.flatMap((r) => r.address_components ?? []);
  const localityResult = results.find((r) => r.types?.includes("locality"));
  const standalone =
    localityResult?.address_components.find((c) => c.types.includes("locality"))?.long_name ?? null;
  return pickMacroCity(flat, standalone);
}
