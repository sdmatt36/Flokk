import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichWithPlaces, nameSimilar, cityMatches } from "@/lib/enrich-with-places";
import { PLACES_INFRA_STATUSES } from "@/lib/google-places";
import { resolveWebsitePlace } from "@/lib/enrich-save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

type PlaceResult = {
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
};

function isGoogleMapsUrl(url: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.com\/maps/i.test(url);
}

function isDirectBusinessUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^(www\.|m\.)/, "");
    return !/instagram|tiktok|youtube|youtu\.be|pinterest|threads|twitter|facebook|airbnb|booking\.com|hotels\.com|expedia|tripadvisor|yelp|tabelog|getyourguide|viator|klook|google\.com|maps\.app|goo\.gl/i.test(h);
  } catch { return false; }
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

// Extract lat/lng from Google Maps URLs that embed coordinates as @lat,lng
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

async function detailsFromPlaceId(placeId: string): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,address_components,geometry&language=en&key=${API_KEY}`);
    const data = await res.json() as {
      status?: string;
      result?: {
        name?: string;
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
      name: data.result.name ?? null,
      formattedAddress: data.result.formatted_address ?? null,
      lat: data.result.geometry?.location?.lat ?? null,
      lng: data.result.geometry?.location?.lng ?? null,
      country,
    };
  } catch { return null; }
}

// Resolve a Google/Maps URL to a PlaceResult.
// rawTitle is required to guard against stale links: if the user renamed a save the
// sourceUrl may still point to the original place. We skip the result when the resolved
// place name no longer matches the save's rawTitle.
async function resolveFromMapsUrl(url: string, rawTitle: string): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const resolved = url.includes("goo.gl") ? await followRedirect(url) : url;

    // Path A: extract ChIJ place_id embedded in URL → Place Details → name check
    const placeId = extractPlaceIdFromUrl(resolved);
    if (placeId) {
      const result = await detailsFromPlaceId(placeId);
      if (result) {
        if (result.name && !nameSimilar(rawTitle, result.name)) {
          console.log(`[backfill-save-places] [link-skip] "${rawTitle}" → place "${result.name}" — stale link, skipping`);
          return null;
        }
        return result;
      }
    }

    // Path B: newer Maps URLs encode coordinates as @lat,lng instead of ChIJ place_id.
    // Search near those coordinates using rawTitle as the query.
    const coords = extractCoordsFromUrl(resolved);
    if (coords) {
      return await findPlaceNearCoords(rawTitle, coords.lat, coords.lng);
    }

    return null;
  } catch { return null; }
}

// Reverse-geocode coordinates to confirm they resolve to a real place.
// Requires destinationCity to be set so we have a reference point; saves with no city
// cannot be verified and fall back to null.
// Country is NOT used as a hard rejection here — if stored destinationCountry is wrong
// (e.g. "Iceland" tagging a Norway save), the resolved country from the coords path is
// trusted and written back to reconcile the label.
// Guard: requires geocoded city to match destinationCity (via province-level token overlap).
// Rejects saves whose stored coords are in the wrong region entirely (e.g. Buenos Aires coords
// for a Uruguay save). Allows cross-border adjacency (Salève/Geneva, South Kuta/Jimbaran).
// Country is NOT checked here — a city match with a different country means reconciliation.
async function verifyCoords(
  lat: number,
  lng: number,
  destinationCity: string | null,
): Promise<{ country: string | null; city: string | null } | null> {
  if (!API_KEY) return null;
  if (!destinationCity) return null;
  try {
    const res = await fetch(`${GEOCODE_URL}?latlng=${lat},${lng}&language=en&key=${API_KEY}`);
    const data = await res.json() as { status?: string; results?: Array<{ address_components: Array<{ long_name: string; short_name: string; types: string[] }> }> };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "") || !data.results?.length) return null;
    const comps = data.results[0].address_components;
    if (!cityMatches(comps, destinationCity)) {
      console.log(`[backfill-save-places] [coords-city-reject] (${lat},${lng}) geocoded outside "${destinationCity}" — skipping coords path`);
      return null;
    }
    const country = comps.find(c => c.types.includes("country"))?.long_name ?? null;
    const city = comps.find(c => c.types.includes("locality"))?.long_name
      ?? comps.find(c => c.types.includes("administrative_area_level_3"))?.long_name
      ?? comps.find(c => c.types.includes("administrative_area_level_2"))?.long_name
      ?? null;
    return { country, city };
  } catch { return null; }
}

// Location-biased place lookup using a 5 km radius to accommodate saves whose stored
// coordinates may be slightly off from the actual place location.
async function findPlaceNearCoords(name: string, lat: number, lng: number): Promise<PlaceResult | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${FIND_PLACE_URL}?input=${encodeURIComponent(name)}&inputtype=textquery` +
      `&locationbias=circle:5000@${lat},${lng}` +
      `&fields=place_id,name,formatted_address,address_components,geometry&language=en&key=${API_KEY}`
    );
    const data = await res.json() as {
      status?: string;
      candidates?: Array<{
        place_id: string;
        name?: string;
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
      name: c.name ?? null,
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
      websiteUrl: true,
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
  let resolvedWebsite = 0;
  let leftNull = 0;
  let countryMismatchRejected = 0;
  let countryReconciled = 0;

  for (const item of items) {
    try {
      let result: PlaceResult | null = null;
      let source = "null";

      // Priority 1: Google Maps URL — ground truth when it name-matches rawTitle.
      // Check mapsUrl first (user-set Maps deep link), then sourceUrl, then websiteUrl.
      // The name guard prevents a stale link (e.g. from a renamed save) from overwriting
      // correct user-edited data with the original place's info.
      const mapsLink = [item.mapsUrl, item.sourceUrl, item.websiteUrl].find(u => u && isGoogleMapsUrl(u)) ?? null;
      if (mapsLink) {
        result = await resolveFromMapsUrl(mapsLink, item.rawTitle!);
        if (result) source = "link";
      }

      // Priority 2: Verified existing coordinates — destinationCity is required as a
      // reference point; country is NOT checked so mislabeled saves (e.g. "Iceland" for
      // a Norway save) get their label reconciled from the geocoded result.
      if (!result && item.lat !== null && item.lng !== null) {
        const verified = await verifyCoords(item.lat, item.lng, item.destinationCity);
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
      // enrichWithPlaces validates against the city (province-level fallback included),
      // reducing cross-city false matches.
      // Country guard: if the resolved place's country contradicts the save's stored
      // destinationCountry, reject — a cross-country name match is almost always wrong
      // (e.g. "Croque Madame La Barra" Uruguay resolving to Buenos Aires, Argentina).
      if (!result && item.destinationCity) {
        const enriched = await enrichWithPlaces(item.rawTitle!, item.destinationCity);
        if (enriched.placeId) {
          const normStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const countryOk = !enriched.country || !item.destinationCountry ||
            normStr(enriched.country) === normStr(item.destinationCountry);
          if (!countryOk) {
            countryMismatchRejected++;
            console.log(`[backfill-save-places] [name-country-reject] "${item.rawTitle}" — resolved ${enriched.country} ≠ stored ${item.destinationCountry}`);
          } else {
            result = {
              placeId: enriched.placeId,
              name: null,
              formattedAddress: enriched.formattedAddress,
              lat: enriched.lat,
              lng: enriched.lng,
              country: enriched.country,
            };
            source = "name";
          }
        }
      }

      // Priority 4: Website HTML extraction — fetch the save's business website, use Claude to
      // extract address, do a precise Places lookup. Only when Priorities 1-3 all failed.
      if (!result) {
        const urlToTry = [item.sourceUrl, item.websiteUrl].find(
          u => u && !isGoogleMapsUrl(u) && isDirectBusinessUrl(u)
        ) ?? null;
        if (urlToTry) {
          console.log(`[backfill-save-places] [website] "${item.rawTitle}" → trying ${urlToTry}`);
          const wr = await resolveWebsitePlace(urlToTry, item.rawTitle!, item.destinationCity, item.destinationCountry);
          if (wr) {
            result = {
              placeId: wr.placeId,
              name: wr.placeName,
              formattedAddress: wr.formattedAddress,
              lat: wr.lat,
              lng: wr.lng,
              country: wr.country,
            };
            source = "website";
          }
        }
      }

      const updateData: Record<string, unknown> = {
        enrichmentAttempts: { increment: 1 },
      };

      if (result) {
        if (result.placeId && !item.googlePlaceId) updateData.googlePlaceId = result.placeId;
        if (result.formattedAddress && !item.address) updateData.address = result.formattedAddress;
        // Write coords only for Maps URL path (ground truth), website path, or when save has none
        if ((source === "link" || source === "website") && result.lat !== null && result.lng !== null) {
          updateData.lat = result.lat;
          updateData.lng = result.lng;
        }
        // Link/coords paths: reconcile destinationCountry from the resolved place.
        // Name path: country was already validated above so writing is safe.
        if (result.country) {
          const normStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (item.destinationCountry && normStr(result.country) !== normStr(item.destinationCountry)) {
            countryReconciled++;
            console.log(`[backfill-save-places] [country-reconcile] "${item.rawTitle}" ${item.destinationCountry} → ${result.country}`);
          }
          updateData.destinationCountry = result.country;
        }

        await db.savedItem.update({ where: { id: item.id }, data: updateData });

        const got = [result.placeId && "placeId", result.formattedAddress && "address"].filter(Boolean).join("+");
        console.log(`[backfill-save-places] [${source}] "${item.rawTitle}" (${item.destinationCity ?? "?"}): ${got}`);

        if (source === "link") resolvedLink++;
        else if (source === "coords") resolvedCoords++;
        else if (source === "website") resolvedWebsite++;
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

  return NextResponse.json({ processed: items.length, resolvedLink, resolvedCoords, resolvedName, resolvedWebsite, leftNull, countryMismatchRejected, countryReconciled, remaining });
}
