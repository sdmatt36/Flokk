import { nanoid } from "nanoid";
import { getTripCoverImage, DEFAULT_COVER } from "@/lib/destination-images";
import { textSearchPhoto } from "@/lib/google-places";

export type TripBuilderInput = {
  cities: string[];              // empty array allowed
  country: string | null;        // null allowed
  countries?: string[];          // defaults to [country] when present
  startDate: string | null;      // ISO date or null
  endDate: string | null;        // ISO date or null
  statusOverride?: "PLANNING" | "COMPLETED" | null;  // when unset, computed from endDate
  isAnonymous?: boolean;         // defaults to true
};

export type TripBuilderOutput = {
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  cities: string[];
  country: string | null;
  countries: string[];
  startDate: Date | null;
  endDate: Date | null;
  status: "PLANNING" | "COMPLETED";
  privacy: "PRIVATE";
  isAnonymous: boolean;
  heroImageUrl: string | null;
  shareToken: string;
};

/**
 * Build the Trip.create data payload from extracted fields. Used by three callers:
 * webhook flight/hotel auto-create, webhook Path 2 operator plan, /api/trips UI POST.
 *
 * Title format: "{country} {MonY}" for multi-city country trips, "{city} {MonY}" for single city.
 * Month format short + 2-digit year with apostrophe (Feb '25). Dates null → title is root only.
 * Hero: country-level for multi-city, city-level for single.
 */
export async function buildTripFromExtraction(input: TripBuilderInput): Promise<TripBuilderOutput> {
  const cities = input.cities.map(c => c.trim()).filter(Boolean);
  const country = input.country?.trim() || null;
  const countries = input.countries && input.countries.length > 0
    ? Array.from(new Set(input.countries.map(c => c.trim()).filter(Boolean)))
    : (country ? [country] : []);

  const destinationCity = cities[0] ?? null;
  const destinationCountry = country;

  // Title root: country when multi-city, single city otherwise.
  const titleRoot = (country && cities.length >= 2) ? country : (destinationCity ?? country ?? "Trip");
  let title = titleRoot;
  if (input.startDate) {
    try {
      const start = new Date(input.startDate);
      const monthYear = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      title = `${titleRoot} ${monthYear.replace(" ", " '")}`;
    } catch { /* fall back to root only */ }
  }

  // Hero priority: manual map → Google Places text search → null (render shows DEFAULT_COVER).
  const mapResolved = (country && cities.length >= 2)
    ? getTripCoverImage(country, country)
    : getTripCoverImage(destinationCity ?? country ?? "", country ?? "");

  let heroImageUrl: string | null = null;
  if (mapResolved !== DEFAULT_COVER) {
    heroImageUrl = mapResolved;
  } else {
    const placesQuery = destinationCity && country
      ? `${destinationCity} ${country}`
      : (destinationCity || country || "");
    if (placesQuery) {
      try {
        heroImageUrl = await textSearchPhoto(placesQuery) ?? null;
      } catch (err) {
        console.error("[trip-builder] Places photo lookup failed", { query: placesQuery, err });
      }
    }
  }

  // Status: explicit override wins, otherwise computed from endDate.
  let status: "PLANNING" | "COMPLETED";
  if (input.statusOverride === "COMPLETED" || input.statusOverride === "PLANNING") {
    status = input.statusOverride;
  } else {
    status = input.endDate && new Date(input.endDate) < new Date() ? "COMPLETED" : "PLANNING";
  }

  return {
    title,
    destinationCity,
    destinationCountry,
    cities,
    country,
    countries,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    status,
    privacy: "PRIVATE",
    isAnonymous: input.isAnonymous ?? true,
    heroImageUrl: heroImageUrl ?? null,
    shareToken: nanoid(12),
  };
}
