import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

export type DestinationSuggestion = {
  placeId: string;
  cityName: string;
  countryName: string;
  description: string;
};

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json([], { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  if (!GOOGLE_API_KEY) return NextResponse.json([]);

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", q);
    url.searchParams.set("types", "locality|administrative_area_level_3");
    url.searchParams.set("language", "en");
    url.searchParams.set("key", GOOGLE_API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json() as {
      status: string;
      predictions: Array<{
        place_id: string;
        description: string;
        structured_formatting: { main_text: string; secondary_text: string };
        terms: Array<{ value: string }>;
      }>;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[destinations/lookup] Places API status:", data.status);
      return NextResponse.json([]);
    }

    // Deduplicate by description (formatted address) before mapping
    const seen = new Set<string>();
    const unique = (data.predictions ?? []).filter((p) => {
      if (seen.has(p.description)) return false;
      seen.add(p.description);
      return true;
    });

    const mapped: DestinationSuggestion[] = unique.map((p) => {
      const terms = p.terms ?? [];
      const cityName = terms[0]?.value ?? p.structured_formatting.main_text;
      const countryName = terms[terms.length - 1]?.value ?? "";
      return {
        placeId: p.place_id,
        cityName,
        countryName,
        description: p.description,
      };
    });

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
