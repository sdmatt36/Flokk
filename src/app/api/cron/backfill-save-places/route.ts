import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { PLACES_INFRA_STATUSES } from "@/lib/google-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

type PlaceResult = {
  placeId: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
};

function isGoogleMapsUrl(url: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.com\/maps/i.test(url);
}

async function followRedirect(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
    return res.url || url;
  } catch { return url; }
}

function extractPlaceIdFromUrl(url: string): string | null {
  const match = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

async function detailsFromPlaceId(placeId: string): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,address_components,geometry&language=en&key=${API_KEY}`);
    const data = await res.json() as {
      status?: string;
      result?: {
        formatted_address?: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
        geometry?: { location?: { lat: number; lng: number } };
      };
    };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "") || !data.result) return null;
    const comps = data.result.address_components ?? [];
    const country = comps.find(c => c.types.includes("country"))?.long_name ?? null;
    return {
      placeId,
      formattedAddress: data.result.formatted_address ?? null,
      lat: data.result.geometry?.location?.lat ?? null,
      lng: data.result.geometry?.location?.lng ?? null,
      country,
    };
  } catch { return null; }
}

// Resolve a Google/Maps URL to a PlaceResult via redirect + place details.
async function resolveFromMapsUrl(url: string): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const resolved = url.includes("goo.gl") ? await followRedirect(url) : url;
    const placeId = extractPlaceIdFromUrl(resolved);
    if (!placeId) return null;
    return await detailsFromPlaceId(placeId);
  } catch { return null; }
}

// Reverse-geocode coordinates to verify internal consistency before trusting them.
// Returns null if country or city can't be verified against the save's stored values.
async function verifyCoords(
  lat: number,
  lng: number,
  destinationCountry: string | null,
  destinationCity: string | null,
): Promise<{ country: string | null; city: string | null } | null> {
  if (!API_KEY) return null;
  // Require at least a city to verify — country-only is too broad (Bali ≠ Jakarta, both Indonesia)
  if (!destinationCity) return null;
  try {
    const res = await fetch(`${GEOCODE_URL}?latlng=${lat},${lng}&language=en&key=${API_KEY}`);
    const data = await res.json() as { status?: string; results?: Array<{ address_components: Array<{ long_name: string; types: string[] }> }> };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "") || !data.results?.length) return null;
    const comps = data.results[0].address_components;
    const country = comps.find(c => c.types.includes("country"))?.long_name ?? null;
    // Check locality first, then sub-district (admin_area_level_3 covers "South Kuta"/"Kuta Selatan"),
    // then district (admin_area_level_2), so granular matches take priority over broad regency names.
    const city = comps.find(c => c.types.includes("locality"))?.long_name
      ?? comps.find(c => c.types.includes("administrative_area_level_3"))?.long_name
      ?? comps.find(c => c.types.includes("administrative_area_level_2"))?.long_name
      ?? null;

    // Country check: if destinationCountry is set, geocoded country must match
    if (destinationCountry && country) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (norm(country) !== norm(destinationCountry)) return null;
    }

    // City check: required — destinationCity must fuzzy-match geocoded city.
    // Falls back to token overlap to handle translated names ("South Kuta" ↔ "Kuta Selatan").
    if (!city) return null;
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    const gc = norm(city);
    const dc = norm(destinationCity);
    const gcTokens = gc.split(/\s+/);
    const dcTokens = dc.split(/\s+/);
    const hasTokenOverlap = gcTokens.some(t => t.length > 2 && dcTokens.includes(t)) ||
      dcTokens.some(t => t.length > 2 && gcTokens.includes(t));
    if (!gc.includes(dc) && !dc.includes(gc) && !hasTokenOverlap) return null;

    return { country, city };
  } catch { return null; }
}

// Location-biased place lookup when coordinates are verified trustworthy.
// Uses a 1 km radius so results are tightly constrained to the save's known location.
async function findPlaceNearCoords(name: string, lat: number, lng: number): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${FIND_PLACE_URL}?input=${encodeURIComponent(name)}&inputtype=textquery` +
      `&locationbias=circle:1000@${lat},${lng}` +
      `&fields=place_id,formatted_address,address_components,geometry&language=en&key=${API_KEY}`
    );
    const data = await res.json() as {
      status?: string;
      candidates?: Array<{
        place_id: string;
        formatted_address?: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
        geometry?: { location?: { lat: number; lng: number } };
      }>;
    };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "") || !data.candidates?.length) return null;
    const c = data.candidates[0];
    const comps = c.address_components ?? [];
    const country = comps.find(comp => comp.types.includes("country"))?.long_name ?? null;
    return {
      placeId: c.place_id,
      formattedAddress: c.formatted_address ?? null,
      lat: c.geometry?.location?.lat ?? null,
      lng: c.geometry?.location?.lng ?? null,
      country,
    };
  } catch { return null; }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.savedItem.findMany({
    where: {
      OR: [{ googlePlaceId: null }, { address: null }],
      deletedAt: null,
      rawTitle: { not: null },
      enrichmentAttempts: { lt: 3 },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      sourceUrl: true,
      mapsUrl: true,
      lat: true,
      lng: true,
      googlePlaceId: true,
      address: true,
      enrichmentAttempts: true,
    },
    take: 25,
    orderBy: { savedAt: "desc" },
  });

  console.log(`[backfill-save-places] Processing ${items.length} saves`);

  let resolvedLink = 0;
  let resolvedCoords = 0;
  let resolvedName = 0;
  let leftNull = 0;

  for (const item of items) {
    try {
      let result: PlaceResult | null = null;
      let source = "null";

      // Priority 1: Google Maps URL — ground truth for the exact place the user saved
      const mapsLink = [item.mapsUrl, item.sourceUrl].find(u => u && isGoogleMapsUrl(u)) ?? null;
      if (mapsLink) {
        result = await resolveFromMapsUrl(mapsLink);
        if (result) source = "link";
      }

      // Priority 2: Verified existing coordinates — location-biased search in a 1 km radius.
      // Only used when destinationCity is set so we can confirm the coords are internally consistent.
      if (!result && item.lat !== null && item.lng !== null) {
        const verified = await verifyCoords(item.lat, item.lng, item.destinationCountry, item.destinationCity);
        if (verified) {
          result = await findPlaceNearCoords(item.rawTitle!, item.lat, item.lng);
          // Don't overwrite trustworthy stored coords — only take address/placeId/country
          if (result) {
            result = { ...result, lat: item.lat, lng: item.lng };
            source = "coords";
          }
        }
      }

      // Priority 3: Text search by name + city — only when destinationCity is set.
      // enrichWithPlaces validates the result against the city, reducing cross-city matches.
      if (!result && item.destinationCity) {
        const enriched = await enrichWithPlaces(item.rawTitle!, item.destinationCity);
        if (enriched.placeId) {
          result = {
            placeId: enriched.placeId,
            formattedAddress: enriched.formattedAddress,
            lat: enriched.lat,
            lng: enriched.lng,
            country: enriched.country,
          };
          source = "name";
        }
      }

      const updateData: Record<string, unknown> = {
        enrichmentAttempts: { increment: 1 },
      };

      if (result) {
        if (result.placeId && !item.googlePlaceId) updateData.googlePlaceId = result.placeId;
        if (result.formattedAddress && !item.address) updateData.address = result.formattedAddress;
        // Write coords only for Maps URL path (ground truth) or when save has none
        if (source === "link" && result.lat !== null && result.lng !== null) {
          updateData.lat = result.lat;
          updateData.lng = result.lng;
        }
        if (result.country) updateData.destinationCountry = result.country;

        await db.savedItem.update({ where: { id: item.id }, data: updateData });

        const got = [result.placeId && "placeId", result.formattedAddress && "address"].filter(Boolean).join("+");
        console.log(`[backfill-save-places] [${source}] "${item.rawTitle}" (${item.destinationCity ?? "?"}): ${got}`);

        if (source === "link") resolvedLink++;
        else if (source === "coords") resolvedCoords++;
        else resolvedName++;
      } else {
        await db.savedItem.update({ where: { id: item.id }, data: updateData });
        leftNull++;
        console.log(`[backfill-save-places] [null] "${item.rawTitle}" (${item.destinationCity ?? "?"})`);
      }
    } catch (err) {
      leftNull++;
      console.error(`[backfill-save-places] Error for ${item.id} (${item.rawTitle}):`, err);
    }
  }

  const remaining = await db.savedItem.count({
    where: {
      OR: [{ googlePlaceId: null }, { address: null }],
      deletedAt: null,
      rawTitle: { not: null },
      enrichmentAttempts: { lt: 3 },
    },
  });

  return NextResponse.json({ processed: items.length, resolvedLink, resolvedCoords, resolvedName, leftNull, remaining });
}
