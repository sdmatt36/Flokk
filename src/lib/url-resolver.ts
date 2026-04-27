// Universal URL resolver per spec: Universal URL Rule (Operating Discipline).
// Priority: Places website → Google Maps place URL → generic search URL.
// Never returns null, empty string, or undefined.

export function resolveCanonicalUrl(input: {
  website?: string | null;
  placeId?: string | null;
  name: string;
  city: string;
  country?: string | null;
}): string {
  if (input.website) return input.website;
  if (input.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${input.placeId}`;
  }
  const terms = [input.name, input.city, input.country].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
}
