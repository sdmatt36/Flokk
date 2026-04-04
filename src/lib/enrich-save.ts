// Standalone enrichment utility — called directly from saves API route.
// Extracted from src/lib/inngest/functions/enrich-saved-item.ts (which is now disabled).

import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import he from "he";
import { getVenueImage } from "@/lib/destination-images";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

async function fetchWithScrapingBee(url: string): Promise<string | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return null;
  try {
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&premium_proxy=false`;
    const res = await fetch(sbUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractOgImageFromHtml(html: string): string | null {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match?.[1] ?? null;
}

const PLACE_TYPE_MAP: Record<string, string> = {
  restaurant: "food",
  cafe: "food",
  bar: "food",
  food: "food",
  lodging: "lodging",
  tourist_attraction: "culture",
  museum: "culture",
  art_gallery: "culture",
  park: "outdoor",
  natural_feature: "outdoor",
  shopping_mall: "shopping",
  store: "shopping",
};

async function resolveRedirect(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.url;
  } catch {
    try {
      const res = await fetch(url, { redirect: "follow" });
      return res.url;
    } catch {
      return url;
    }
  }
}

function extractGoogleMapsPlace(url: string): string | null {
  try {
    // Pattern: /maps/place/Place+Name/@lat,lng or /maps/place/Place+Name/
    const placeMatch = url.match(/maps\/place\/([^/@?]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
    }
    // Pattern: ?q=Place+Name
    const qMatch = url.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      return decodeURIComponent(qMatch[1].replace(/\+/g, " ")).trim();
    }
    return null;
  } catch {
    return null;
  }
}

interface GoogleMapsLookupResult {
  title: string;
  lat: number;
  lng: number;
  photoUrl?: string;
  rating?: number;
  category?: string;
}

async function lookupGoogleMapsPlace(
  placeName: string
): Promise<GoogleMapsLookupResult | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
      `input=${encodeURIComponent(placeName)}&inputtype=textquery&` +
      `fields=name,geometry,photos,rating,types&` +
      `language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      candidates: {
        name?: string;
        geometry?: { location: { lat: number; lng: number } };
        photos?: { photo_reference: string }[];
        rating?: number;
        types?: string[];
      }[];
    };
    if (data.status !== "OK" || !data.candidates[0]) return null;
    const c = data.candidates[0];
    if (!c.name || !c.geometry) return null;

    const result: GoogleMapsLookupResult = {
      title: c.name,
      lat: c.geometry.location.lat,
      lng: c.geometry.location.lng,
    };
    if (typeof c.rating === "number") result.rating = c.rating;
    if (c.photos?.[0]?.photo_reference) {
      result.photoUrl =
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&` +
        `photo_reference=${c.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
    }
    const matchedType = c.types?.find((t) => PLACE_TYPE_MAP[t]);
    result.category = matchedType ? PLACE_TYPE_MAP[matchedType] : "culture";
    return result;
  } catch {
    return null;
  }
}

function isInstagramCaption(title: string): boolean {
  return /on Instagram/i.test(title) || /^[^:]+:\s*[""]/.test(title);
}

function cleanInstagramFallback(rawTitle: string | null): string {
  if (!rawTitle) return "Instagram save";
  let clean = rawTitle
    .replace(/^.+on Instagram:\s*/i, "")
    .replace(/^["']/, "")
    .replace(/#\w+/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/\d+[KkMm]?\s*likes?.*$/i, "")
    .replace(/\d+\s*comments?.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .trim();
  if (clean.length > 60) clean = clean.substring(0, 57) + "...";
  return clean || "Instagram save";
}

async function extractInstagramTitle(
  caption: string,
  city: string | null,
  country: string | null
): Promise<{ title: string; description: string } | null> {
  try {
    const location = [city, country].filter(Boolean).join(", ");
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Extract the place name from this Instagram caption and write a one-sentence description.

Caption: "${caption}"
${location ? `Known location context: ${location}` : ""}

Rules:
- Title: the place name only, max 5 words. Format "Place Name, City" if the city is clear from context. Never include the Instagram username, the phrase "on Instagram", quote marks, hashtags (#), @ mentions, or engagement text like "Would you visit".
- Description: one sentence about the place for family travelers. No hashtags, no usernames, no engagement bait.
- If you cannot identify a specific named place, return null for both.

Respond with JSON only: {"title":"...","description":"..."} or {"title":null,"description":null}`,
      }],
    });
    const content = response.content[0];
    if (content.type !== "text") return null;
    const parsed = JSON.parse(content.text.trim()) as { title: string | null; description: string | null };
    if (!parsed.title) return null;
    return { title: parsed.title, description: parsed.description ?? "" };
  } catch {
    return null;
  }
}

async function geocode(
  title: string,
  city: string | null,
  country: string | null
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = [title, city, country].filter(Boolean).join(", ");
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results: { geometry: { location: { lat: number; lng: number } } }[];
    };
    if (data.status !== "OK" || !data.results[0]) return null;
    return data.results[0].geometry.location;
  } catch {
    return null;
  }
}

async function getPlaceDetails(
  title: string,
  lat: number | null,
  lng: number | null
): Promise<{ website?: string; photoUrl?: string; rating?: number }> {
  try {
    const locationBias =
      lat != null && lng != null ? `&location=${lat},${lng}&radius=5000` : "";
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(title)}&inputtype=textquery&fields=website,photos,rating${locationBias}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      candidates: { website?: string; rating?: number; photos?: { photo_reference: string }[] }[];
    };
    if (data.status !== "OK" || !data.candidates[0]) return {};
    const c = data.candidates[0];
    const result: { website?: string; photoUrl?: string; rating?: number } = {};
    if (c.website) result.website = c.website;
    if (typeof c.rating === "number") result.rating = c.rating;
    if (c.photos?.[0]?.photo_reference) {
      result.photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${c.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
    }
    return result;
  } catch {
    return {};
  }
}

async function generateDescription(
  title: string,
  city: string | null,
  country: string | null
): Promise<string | null> {
  try {
    const location = [city, country].filter(Boolean).join(", ");
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `Write a 1-2 sentence family travel description for "${title}"${location ? ` in ${location}` : ""}. Focus on what makes it good for families with kids. Be specific and practical. Return only the description text.

If you cannot determine a specific named place, restaurant, hotel, or attraction from the title provided, return exactly: null

Only return content when you are confident it describes a real, specific place. Never return generic phrases like "saved based on your interests" or "a great pick for families" when you don't have specific information about the actual place.`,
      }],
    });
    const content = response.content[0];
    if (content.type !== "text") return null;
    const text = content.text.trim();
    if (text === "null" || text.toLowerCase() === "null") return null;
    return text;
  } catch {
    return null;
  }
}

export async function enrichSavedItem(savedItemId: string): Promise<void> {
  const item = await db.savedItem.findUnique({
    where: { id: savedItemId },
    select: {
      id: true,
      rawTitle: true,
      rawDescription: true,
      destinationCity: true,
      destinationCountry: true,
      sourceUrl: true,
      sourceType: true,
      lat: true,
      mediaThumbnailUrl: true,
    },
  });

  if (!item || !item.rawTitle) {
    console.log(`[enrich] skipped ${savedItemId}: no item or title`);
    return;
  }

  const stripRawUnicode = (str: string) => str.replace(/&#x[0-9a-fA-F]+;/gi, "").trim();
  const cleanTitle = stripRawUnicode(he.decode(item.rawTitle));
  const cleanDescription = item.rawDescription
    ? stripRawUnicode(he.decode(item.rawDescription))
    : null;

  let workingTitle = cleanTitle;
  let workingDescription = cleanDescription;
  let coords: { lat: number; lng: number } | null = null;
  let place: { website?: string; photoUrl?: string; rating?: number } = {};
  let mapsCategory: string | null = null;
  let skipNormalEnrichment = false;
  let instagramPlaceFound = false;

  // Step 0: Google Maps — extract place name from URL, skip OG title, go straight to Places API
  const isGoogleMaps =
    item.sourceType === "GOOGLE_MAPS" ||
    /maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl/.test(item.sourceUrl ?? "");

  if (isGoogleMaps && item.sourceUrl) {
    let resolvedUrl = item.sourceUrl;
    if (item.sourceUrl.includes("maps.app.goo.gl") || item.sourceUrl.includes("goo.gl")) {
      resolvedUrl = await resolveRedirect(item.sourceUrl);
      console.log(`[enrich] resolved redirect: ${resolvedUrl}`);
    }
    const parsedName = extractGoogleMapsPlace(resolvedUrl);
    if (parsedName) {
      const mapsPlace = await lookupGoogleMapsPlace(parsedName);
      if (mapsPlace) {
        workingTitle = mapsPlace.title;
        coords = { lat: mapsPlace.lat, lng: mapsPlace.lng };
        if (mapsPlace.photoUrl) place.photoUrl = mapsPlace.photoUrl;
        if (typeof mapsPlace.rating === "number") place.rating = mapsPlace.rating;
        if (mapsPlace.category) mapsCategory = mapsPlace.category;
        skipNormalEnrichment = true;
        console.log(`[enrich] Google Maps fast-path: "${workingTitle}" (${coords.lat}, ${coords.lng})`);
      }
    }
  }

  if (!skipNormalEnrichment) {
    // Step 1: Extract clean title/description from Instagram captions
    if (item.sourceType === "INSTAGRAM" || isInstagramCaption(cleanTitle)) {
      const extracted = await extractInstagramTitle(cleanTitle, item.destinationCity, item.destinationCountry);
      if (extracted) {
        workingTitle = extracted.title;
        workingDescription = extracted.description || cleanDescription;
        instagramPlaceFound = true;
      } else {
        // Claude couldn't identify a specific place — clean the caption and flag for user confirmation
        workingTitle = cleanInstagramFallback(item.rawTitle);
      }
    }

    // Step 2: Geocode if lat is null
    if (item.lat == null) {
      coords = await geocode(workingTitle, item.destinationCity, item.destinationCountry);
    }

    // Step 3: Places — website, photo, rating (skip if venue map has a curated photo)
    const curatedPhoto = getVenueImage(workingTitle);
    if (curatedPhoto) {
      place = { photoUrl: curatedPhoto };
    } else {
      place = await getPlaceDetails(workingTitle, coords?.lat ?? null, coords?.lng ?? null);
    }
  }

  // Step 3b: ScrapingBee fallback for Airbnb and Instagram when no photo found
  // Note: Instagram og:image URLs (cdninstagram.com) are blocked by sanitizeThumbnailUrl()
  // at display time — ScrapingBee is most useful for Airbnb where the CDN is not blocked.
  if (!place.photoUrl && !item.mediaThumbnailUrl &&
      (item.sourceUrl?.includes("airbnb.com") || item.sourceUrl?.includes("instagram.com")) &&
      process.env.SCRAPINGBEE_API_KEY) {
    console.log("[enrich-save] Trying ScrapingBee for:", item.sourceUrl);
    const html = await fetchWithScrapingBee(item.sourceUrl!);
    if (html) {
      const sbImage = extractOgImageFromHtml(html);
      if (sbImage) {
        place.photoUrl = sbImage;
        console.log("[enrich-save] ScrapingBee image extracted successfully");
      }
    }
  }

  // Step 4: Claude description if still missing
  let description: string | null = null;
  if (!workingDescription) {
    description = await generateDescription(workingTitle, item.destinationCity, item.destinationCountry);
  }

  // Step 5: UPDATE — never delete, only add missing data
  // If title is empty after all extraction steps, fall back to URL hostname (e.g. "airbnb.com")
  let finalTitle = workingTitle;
  if (!finalTitle && item.sourceUrl) {
    try {
      finalTitle = new URL(item.sourceUrl).hostname.replace("www.", "");
    } catch {
      // keep workingTitle (empty string)
    }
  }

  const updateData: Record<string, unknown> = {};
  updateData.rawTitle = finalTitle;
  if (workingDescription) updateData.rawDescription = workingDescription;
  if (coords) { updateData.lat = coords.lat; updateData.lng = coords.lng; }
  if (place.website && !item.sourceUrl) updateData.sourceUrl = place.website;
  if (place.photoUrl) updateData.placePhotoUrl = place.photoUrl;
  if (typeof place.rating === "number") updateData.relevanceScore = place.rating;
  if (description && !workingDescription) updateData.rawDescription = description;
  if (mapsCategory) updateData.categoryTags = [mapsCategory];
  // Flag Instagram saves where Claude couldn't identify a specific place — prompt user to identify
  if ((item.sourceType === "INSTAGRAM" || isInstagramCaption(cleanTitle)) && !instagramPlaceFound && !skipNormalEnrichment) {
    updateData.needsPlaceConfirmation = true;
  }
  updateData.extractionStatus = "ENRICHED";

  await db.savedItem.update({ where: { id: item.id }, data: updateData });
  console.log(`[enrich] enriched ${savedItemId}: ${Object.keys(updateData).join(", ")}`);
}
