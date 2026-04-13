// Shared Google Places enrichment utility.
// textsearch → details(website+photos) → follow redirect for CDN URL.
// Same pattern as src/app/api/cron/enrich-manual-activities.
// Returns null on any failure — never throws.

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

export async function enrichWithPlaces(
  name: string,
  city: string
): Promise<{ imageUrl: string | null; website: string | null }> {
  if (!GOOGLE_MAPS_API_KEY || !name.trim()) return { imageUrl: null, website: null };

  try {
    const query = [name.trim(), city.trim()].filter(Boolean).join(" ");

    // Step 1: Text search → place_id
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return { imageUrl: null, website: null };

    // Step 2: Place details → website + photo_reference
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,photos&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: { website?: string; photos?: { photo_reference: string }[] };
    };
    const result = detailsData.result;
    if (!result) return { imageUrl: null, website: null };

    const website = result.website ?? null;
    const photoRef = result.photos?.[0]?.photo_reference ?? null;

    // Step 3: Follow photo redirect to get CDN URL
    let imageUrl: string | null = null;
    if (photoRef) {
      const photoRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`,
        { redirect: "follow" }
      );
      const finalUrl = photoRes.url;
      if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
        imageUrl = finalUrl;
      }
    }

    return { imageUrl, website };
  } catch {
    return { imageUrl: null, website: null };
  }
}
