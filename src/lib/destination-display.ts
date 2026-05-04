export type DestinationStructured = {
  city?: string;
  island?: string;
  state?: string;
  region?: string;
  country?: string;
  stateShort?: string;
  countryShort?: string;
  colloquial?: string;
};

// Compose a pill-friendly display name from structured destination components.
// Rules by taxonomy:
//   US city   → "City, ST"     (e.g. "Aspen, CO")
//   Intl city → "City, Country" (e.g. "Tokyo, Japan")
//   Island    → "Island, Country" (e.g. "Ko Samui, Thailand")
//   Country   → "Country" (e.g. "Cambodia")
//   Region    → "Region, Country" (e.g. "Okinawa, Japan")
export function formatDestinationDisplay(
  structured: DestinationStructured | null | undefined,
  fallback: string,
): string {
  if (!structured) return fallback;
  const { city, island, state, region, country, stateShort, countryShort, colloquial } = structured;
  const primary = colloquial ?? island ?? city ?? region ?? state;
  if (!primary) return country ?? fallback;
  if (countryShort === "US") {
    return stateShort ? `${primary}, ${stateShort}` : `${primary}, USA`;
  }
  return country ? `${primary}, ${country}` : primary;
}
