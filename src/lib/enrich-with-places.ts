// Shared Google Places enrichment utility.
// textsearch → details(name+website+photos) → follow redirect for CDN URL.
// Same pattern as src/app/api/cron/enrich-manual-activities.
// Returns null on any failure — never throws.

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

export function nameSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
  const wordsA = new Set(norm(a).split(' ').filter(w => w.length > 2))
  const wordsB = norm(b).split(' ').filter(w => w.length > 2)
  const overlap = wordsB.filter(w => wordsA.has(w)).length
  return overlap > 0 || norm(a).includes(norm(b)) || norm(b).includes(norm(a))
}

export async function enrichWithPlaces(
  name: string,
  city: string
): Promise<{ imageUrl: string | null; website: string | null; city: string | null }> {
  if (!GOOGLE_MAPS_API_KEY || !name.trim()) return { imageUrl: null, website: null, city: null };

  try {
    const query = [name.trim(), city.trim()].filter(Boolean).join(" ");

    // Step 1: Text search → place_id
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return { imageUrl: null, website: null, city: null };

    // Step 2: Place details → name + website + photo_reference + address_components
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,photos,address_components&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        name?: string;
        website?: string;
        photos?: { photo_reference: string }[];
        address_components?: { long_name: string; types: string[] }[];
      };
    };
    const result = detailsData.result;
    if (!result) return { imageUrl: null, website: null, city: null };

    const website = result.website ?? null;
    const photoRef = result.photos?.[0]?.photo_reference ?? null;

    // Extract city from address_components: locality → postal_town → admin_area_level_2 → admin_area_level_1
    // postal_town is used in UK addresses where locality is absent (e.g. London boroughs)
    const addressComponents = result.address_components ?? [];
    const locality = addressComponents.find(c => c.types.includes("locality"));
    const postalTown = addressComponents.find(c => c.types.includes("postal_town"));
    const adminArea2 = addressComponents.find(c => c.types.includes("administrative_area_level_2"));
    const adminArea1 = addressComponents.find(c => c.types.includes("administrative_area_level_1"));
    const extractedCity = locality?.long_name ?? postalTown?.long_name ?? adminArea2?.long_name ?? adminArea1?.long_name ?? null;

    // Step 3: Validate Places result name before using image
    const placesName = result.name ?? "";
    let imageUrl: string | null = null;

    if (placesName && !nameSimilar(name, placesName)) {
      console.log("[enrich] Places name mismatch -- skipping image. Searched:", name, "Got:", placesName);
      // fall through to OpenGraph fallback below
    } else if (photoRef) {
      // Step 4: Follow photo redirect to get CDN URL
      const photoRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`,
        { redirect: "follow" }
      );
      const finalUrl = photoRes.url;
      if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
        imageUrl = finalUrl;
      }
    }

    // OpenGraph fallback: no Places image (mismatch or no photo) and website available
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

    return { imageUrl, website, city: extractedCity };
  } catch {
    return { imageUrl: null, website: null, city: null };
  }
}
