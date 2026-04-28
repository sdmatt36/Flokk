// Shared Google Places enrichment utility.
// textsearch → details(name+website+photos) → follow redirect for CDN URL.
// Same pattern as src/app/api/cron/enrich-manual-activities.
// Returns null on any failure — never throws.

import { extractSearchableTitle } from "./extract-searchable-title";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

// NFD-decompose then strip combining marks so "Ryōan-ji" → "ryoan ji".
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameSimilar(a: string, b: string): boolean {
  const wordsA = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wordsB = norm(b).split(" ").filter((w) => w.length > 2);
  const overlap = wordsB.filter((w) => wordsA.has(w)).length;
  return overlap > 0 || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

function cityMatches(
  components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined,
  destinationCity: string | null | undefined
): boolean {
  if (!destinationCity) return true;
  const target = norm(destinationCity);
  if (!target) return true;
  if (!components || components.length === 0) return false;
  const CITY_TYPES = ["locality", "administrative_area_level_1", "administrative_area_level_2", "sublocality", "sublocality_level_1", "postal_town"];
  for (const comp of components) {
    if (!comp.types.some(t => CITY_TYPES.includes(t))) continue;
    const long = norm(comp.long_name);
    const short = norm(comp.short_name);
    if (!long && !short) continue;
    if (long.includes(target) || short.includes(target) || (target.length >= 4 && (long.includes(target.slice(0, 4)) || short.includes(target.slice(0, 4))))) {
      return true;
    }
  }
  return false;
}

export async function enrichWithPlaces(
  name: string,
  city: string
): Promise<{ imageUrl: string | null; website: string | null; city: string | null; placeId: string | null; lat: number | null; lng: number | null }> {
  if (!GOOGLE_MAPS_API_KEY || !name.trim()) return { imageUrl: null, website: null, city: null, placeId: null, lat: null, lng: null };

  try {
    const candidates = extractSearchableTitle(name);
    if (candidates.length === 0) return { imageUrl: null, website: null, city: null, placeId: null, lat: null, lng: null };

    for (const candidate of candidates) {
      const query = [candidate.trim(), city.trim()].filter(Boolean).join(" ");

      // Step 1: Text search → place_id
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=en&key=${GOOGLE_MAPS_API_KEY}`
      );
      const searchData = await searchRes.json() as { results?: { place_id: string }[] };
      const placeId = searchData.results?.[0]?.place_id ?? null;
      if (!placeId) continue;

      // Step 2: Place details → name + website + photo_reference + address_components + geometry
      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,photos,address_components,geometry&language=en&key=${GOOGLE_MAPS_API_KEY}`
      );
      const detailsData = await detailsRes.json() as {
        result?: {
          name?: string;
          website?: string;
          photos?: { photo_reference: string }[];
          address_components?: { long_name: string; short_name: string; types: string[] }[];
          geometry?: { location?: { lat: number; lng: number } };
        };
      };
      const result = detailsData.result;
      if (!result) continue;

      const placesName = result.name ?? "";
      const addressComponents = result.address_components ?? [];

      // Validate: candidate must be similar to Places result name, and city must match
      if (placesName && !nameSimilar(candidate, placesName)) continue;
      if (!cityMatches(addressComponents as Array<{ long_name: string; short_name: string; types: string[] }>, city)) continue;

      console.log(`[enrich-match] "${name}" matched via candidate "${candidate}" -> place "${placesName}"`);

      const website = result.website ?? null;
      const photoRef = result.photos?.[0]?.photo_reference ?? null;
      const lat = result.geometry?.location?.lat ?? null;
      const lng = result.geometry?.location?.lng ?? null;

      // Extract city from address_components: locality → postal_town → admin_area_level_2 → admin_area_level_1
      // postal_town is used in UK addresses where locality is absent (e.g. London boroughs)
      const locality = addressComponents.find(c => c.types.includes("locality"));
      const postalTown = addressComponents.find(c => c.types.includes("postal_town"));
      const adminArea2 = addressComponents.find(c => c.types.includes("administrative_area_level_2"));
      const adminArea1 = addressComponents.find(c => c.types.includes("administrative_area_level_1"));
      const extractedCity = locality?.long_name ?? postalTown?.long_name ?? adminArea2?.long_name ?? adminArea1?.long_name ?? null;

      let imageUrl: string | null = null;

      if (photoRef) {
        // Follow photo redirect to get CDN URL
        const photoRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`,
          { redirect: "follow" }
        );
        const finalUrl = photoRes.url;
        if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
          imageUrl = finalUrl;
        }
      }

      // OpenGraph fallback: no Places image and website available
      if (!imageUrl && website) {
        try {
          const r = await fetch(website, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4000),
          });
          const html = await r.text();
          const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
                  || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
          if (m?.[1]) {
            imageUrl = m[1];
            console.log("[enrich] OpenGraph image found:", imageUrl);
          }
        } catch {
          console.log("[enrich] OpenGraph fetch failed, leaving image null");
        }
      }

      return { imageUrl, website, city: extractedCity, placeId, lat, lng };
    }

    // All candidates exhausted without a valid Places match
    console.log(`[enrich-no-match] "${name}" exhausted ${candidates.length} candidates`);
    return { imageUrl: null, website: null, city: null, placeId: null, lat: null, lng: null };
  } catch {
    return { imageUrl: null, website: null, city: null, placeId: null, lat: null, lng: null };
  }
}
