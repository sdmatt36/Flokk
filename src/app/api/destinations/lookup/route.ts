import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

export type DestinationSuggestion = {
  placeId: string;
  cityName: string;
  countryName: string;
  region: string;
  description: string;
};

// Geographic area types we accept. Excludes establishments, POIs, hotels, etc.
// natural_feature and archipelago are needed for islands (Maui, Bali, Kauai, Oahu).
// administrative_area_level_1 is needed for states (Hawaii, Alaska).
// administrative_area_level_2 is needed for counties/islands when they are the canonical entity.
const ALLOWED_TYPES = new Set([
  "locality",
  "sublocality",
  "colloquial_area",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "natural_feature",
  "archipelago",
]);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  if (!GOOGLE_API_KEY) return NextResponse.json([]);

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", q);
    url.searchParams.set("language", "en");
    url.searchParams.set("key", GOOGLE_API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json() as {
      status: string;
      predictions: Array<{
        place_id: string;
        description: string;
        types: string[];
        structured_formatting: { main_text: string; secondary_text: string };
        terms: Array<{ value: string }>;
      }>;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[destinations/lookup] Places API status:", data.status);
      return NextResponse.json([]);
    }

    // Keep only geographic area types — drops establishments, hotels, restaurants, POIs.
    // Islands (natural_feature) and states (admin_level_1) surface correctly once
    // the old types=(cities) filter is gone.
    const geographic = (data.predictions ?? []).slice(0, 15).filter((p) =>
      p.types.some((t) => ALLOWED_TYPES.has(t))
    );

    // Deduplicate by description (formatted address) before mapping
    const seen = new Set<string>();
    const unique = geographic.filter((p) => {
      if (seen.has(p.description)) return false;
      seen.add(p.description);
      return true;
    });

    // Fetch address_components per result to get admin_area_level_1 (e.g. "Scotland")
    const mapped: DestinationSuggestion[] = await Promise.all(
      unique.slice(0, 6).map(async (p) => {
        // Strip " County" suffix from admin_level_2 results so "Maui County" → "Maui"
        const rawCityName = p.structured_formatting.main_text;
        const isCounty = p.types.includes("administrative_area_level_2");
        const cityName =
          isCounty && rawCityName.endsWith(" County")
            ? rawCityName.slice(0, -" County".length)
            : rawCityName;

        let region = "";
        let countryName = "";
        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=address_components&key=${GOOGLE_API_KEY}`
          );
          const detailData = await detailRes.json() as {
            result?: { address_components?: Array<{ long_name: string; short_name: string; types: string[] }> };
          };
          const components = detailData.result?.address_components ?? [];
          const adminArea = components.find((c) => c.types.includes("administrative_area_level_1"));
          const countryComponent = components.find((c) => c.types.includes("country"));
          if (adminArea) region = adminArea.long_name;
          if (countryComponent) countryName = countryComponent.long_name;
        } catch { /* region/country stays empty on error */ }

        return {
          placeId: p.place_id,
          cityName,
          countryName,
          region,
          description: p.description,
        };
      })
    );

    // Sort non-US results first when the query resembles a well-known international city
    const hasInternationalMatch = mapped.some((s) => s.countryName !== "United States");
    const suggestions: DestinationSuggestion[] = hasInternationalMatch
      ? [...mapped.filter((s) => s.countryName !== "United States"), ...mapped.filter((s) => s.countryName === "United States")]
      : mapped;

    return NextResponse.json(suggestions.slice(0, 6));
  } catch (e) {
    console.error("[destinations/lookup] error:", e);
    return NextResponse.json([]);
  }
}
