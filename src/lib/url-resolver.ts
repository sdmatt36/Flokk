// Universal URL resolver per spec: Universal URL Rule (Operating Discipline).
// P1: Places website field. P2: Google Maps place URL via placeId.
// Returns null when neither is available — null is preferable to a Google search URL
// that would render a "Visit website" button pointing at Google instead of the venue.

export function resolveCanonicalUrl(input: {
  website?: string | null;
  placeId?: string | null;
  name: string;
  city: string;
  country?: string | null;
}): string | null {
  if (input.website) return input.website;
  if (input.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${input.placeId}`;
  }
  return null;
}
