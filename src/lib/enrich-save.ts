// Standalone enrichment utility — called directly from saves API route.
// Extracted from src/lib/inngest/functions/enrich-saved-item.ts (which is now disabled).

import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import he from "he";
import { getVenueImage } from "@/lib/destination-images";
import { verifyWebsiteUrl } from "@/lib/activity-intelligence";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { mapPlaceTypesToCanonicalSlugs, normalizeCategorySlug } from "@/lib/categories";

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

function extractOgMeta(html: string, field: string): string | null {
  const match =
    html.match(new RegExp(`<meta[^>]+property=["']og:${field}["'][^>]+content=["']([^"']+)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${field}["']`, "i"));
  const raw = match?.[1] ?? null;
  return raw ? he.decode(raw) : null;
}

function extractOgImageFromHtml(html: string): string | null {
  return extractOgMeta(html, "image");
}

const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "pinterest", "threads"] as const;
type SocialPlatform = typeof SOCIAL_PLATFORMS[number];


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
    const slugs = mapPlaceTypesToCanonicalSlugs(c.types);
    result.category = slugs[0] ?? "experiences";
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

async function extractSocialCaption(
  caption: string,
  platform: SocialPlatform | "blog" | "unknown"
): Promise<{ title: string | null; description: string; destinationCity: string | null; destinationCountry: string | null; category: string | null } | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are reading a ${platform} caption/description to help a family travel app organize the save.
Extract these fields from the caption and return as JSON.

TITLE — the specific place, venue, or landmark being shown. Use hashtags, account handles, and
context as strong signals. Example: caption mentions "the coolest stadium in Hokkaido" with
#nipponhamfighters → title should be "Es Con Field Hokkaido" because the Nippon-Ham Fighters
play there. Caption mentions "best sushi in Tokyo" with #sukiyabashi → title "Sukiyabashi Jiro".
If you are genuinely unsure even after considering hashtags and context, return null. Format:
"Place Name" or "Place Name, City". Never include usernames, "on Instagram", quotes, hashtags,
or @mentions.

DESCRIPTION — a 1-2 sentence clean summary. Strip all hashtags and @mentions.

DESTINATIONCITY — the city if mentioned or clearly inferred. Example: caption says "Hokkaido"
and mentions a stadium → "Kitahiroshima" (where Es Con Field is). If only the region is named,
return the region or nearest major city. Return null if no location context at all.

DESTINATIONCOUNTRY — the country if mentioned, inferred from city, or inferred from hashtags
like #livinginjapan, #lifeinspain, #visittokyo.

CATEGORY — one of: food_and_drink, culture, nature_and_outdoors, adventure, experiences,
sports_and_entertainment, shopping, kids_and_family, lodging, nightlife, wellness, other.
Pick the best fit based on the caption's subject matter.

Return ONLY a JSON object. No other text.
{
  "title": string or null,
  "description": string,
  "destinationCity": string or null,
  "destinationCountry": string or null,
  "category": string or null
}

Caption:
${caption}`,
      }],
    });
    const content = response.content[0];
    if (content.type !== "text") return null;
    const text = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(text) as {
      title: string | null;
      description: string;
      destinationCity: string | null;
      destinationCountry: string | null;
      category: string | null;
    };
    return {
      title: parsed.title ?? null,
      description: parsed.description ?? "",
      destinationCity: parsed.destinationCity ?? null,
      destinationCountry: parsed.destinationCountry ?? null,
      category: parsed.category ?? null,
    };
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
    if (c.website) {
      const verified = await verifyWebsiteUrl(c.website);
      if (verified) result.website = verified;
    }
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

async function getGooglePlacesPhoto(
  name: string,
  city: string,
  lat?: number | null,
  lng?: number | null
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${city}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_MAPS_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) {
      console.log(`[PLACES PHOTO] No place found for "${name} ${city}"`);
      return null;
    }

    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json() as { result?: { photos?: { photo_reference: string }[] } };
    const photoRef = detailData.result?.photos?.[0]?.photo_reference;
    if (!photoRef) {
      console.log(`[PLACES PHOTO] No photo for place_id=${placeId}`);
      return null;
    }

    const redirectUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
    const photoRes = await fetch(redirectUrl, { redirect: 'follow' });
    const finalUrl = photoRes.url;
    if (!finalUrl || finalUrl === redirectUrl) {
      console.log(`[PLACES PHOTO] Redirect did not resolve for "${name}"`);
      return null;
    }
    console.log(`[PLACES PHOTO] ✓ Resolved for "${name}" → ${finalUrl.slice(0, 80)}`);
    return finalUrl;
  } catch (e) {
    console.log(`[PLACES PHOTO] Error for "${name}":`, e);
    return null;
  }
}

const SPORTS_REGEX = /\b(giants|twins|lakers|dodgers|yankees|cubs|sox|fc |united|athletic|baseball|football|basketball|soccer|nba|mlb|nfl|kbo)\b/i;

async function getStadiumPhoto(teamName: string, city: string): Promise<string | null> {
  const queries = [
    `${teamName} stadium ${city}`,
    `${teamName} ballpark ${city}`,
    `${teamName} arena ${city}`,
  ];
  for (const q of queries) {
    const photo = await getGooglePlacesPhoto(q, "");
    if (photo) return photo;
  }
  return null;
}

async function reverseGeocodeCity(
  lat: number,
  lng: number
): Promise<{ city: string | null; country: string | null }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { city: null, country: null };
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${key}`;
    const res = await fetch(url);
    const data = await res.json() as { results?: { address_components: { types: string[]; long_name: string }[] }[] };
    const components = data?.results?.[0]?.address_components ?? [];
    const getComponent = (types: string[]) => {
      for (const t of types) {
        const found = components.find((c) => c.types.includes(t));
        if (found) return found.long_name;
      }
      return null;
    };
    const city =
      getComponent(["locality"]) ??
      getComponent(["administrative_area_level_2"]) ??
      getComponent(["administrative_area_level_1"]);
    const country = getComponent(["country"]);
    return { city, country };
  } catch (err) {
    console.error("[reverseGeocodeCity] failed:", err);
    return { city: null, country: null };
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
      sourceMethod: true,
      sourcePlatform: true,
      lat: true,
      mediaThumbnailUrl: true,
      categoryTags: true,
    },
  });

  if (!item || !item.rawTitle) {
    console.log(`[enrich] skipped ${savedItemId}: no item or title`);
    return;
  }

  try {

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
  let socialPlaceFound = false;
  let sbThumbnail: string | null = null;
  let socialCity: string | null = null;
  let socialCountry: string | null = null;
  let socialCategory: string | null = null;

  // Step 0: Google Maps — extract place name from URL, skip OG title, go straight to Places API
  const isGoogleMaps =
    item.sourcePlatform === "google_maps" ||
    /maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl/.test(item.sourceUrl ?? "");

  if (isGoogleMaps && item.sourceUrl) {
    try {
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
          // Reverse-geocode lat/lng to pull destinationCity and destinationCountry
          if (!item.destinationCity || !item.destinationCountry) {
            const rev = await reverseGeocodeCity(mapsPlace.lat, mapsPlace.lng);
            if (rev.city) socialCity = rev.city;
            if (rev.country) socialCountry = rev.country;
            console.log(`[enrich] Google Maps reverse-geocode: city=${rev.city} country=${rev.country}`);
          }
          skipNormalEnrichment = true;
          console.log(`[enrich] Google Maps fast-path: "${workingTitle}" (${coords.lat}, ${coords.lng})`);
        }
      }
    } catch (err) {
      console.error(`[enrich] Google Maps fast-path failed for ${item.id}:`, err);
      // skipNormalEnrichment stays false — normal flow runs as fallback
    }
  }

  if (!skipNormalEnrichment) {
    // Step 1: Extract caption and place data for social platform saves
    const platform = (item.sourcePlatform ?? "unknown") as SocialPlatform | "unknown";
    if ((SOCIAL_PLATFORMS as readonly string[]).includes(platform) || isInstagramCaption(cleanTitle)) {
      // Fetch caption via ScrapingBee — og:title/og:description has the full caption.
      // Direct fetch is blocked by Instagram/TikTok auth; ScrapingBee bypasses this.
      let socialCaption = cleanTitle;
      if (item.sourceUrl && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[enrich-save] Fetching ${platform} caption via ScrapingBee:`, item.sourceUrl);
        const html = await fetchWithScrapingBee(item.sourceUrl);
        if (html) {
          const ogTitle = extractOgMeta(html, "title");
          const ogDesc = extractOgMeta(html, "description");
          // YouTube: prefer og:description (richer) over og:title (short video title)
          const captionSource = platform === "youtube" && ogDesc && ogDesc.length > (ogTitle?.length ?? 0)
            ? ogDesc
            : (ogTitle && ogTitle.length > 20 ? ogTitle : null);
          if (captionSource) {
            socialCaption = captionSource;
            console.log(`[enrich-save] ${platform} caption:`, socialCaption.slice(0, 100));
          }
          const sbImg = extractOgImageFromHtml(html);
          if (sbImg) sbThumbnail = sbImg;
        }
      }
      const extracted = await extractSocialCaption(
        socialCaption,
        (SOCIAL_PLATFORMS as readonly string[]).includes(platform)
          ? platform as SocialPlatform
          : "unknown"
      );
      if (extracted) {
        if (extracted.title) {
          workingTitle = extracted.title;
          socialPlaceFound = true;
        } else {
          // Claude couldn't identify a specific place — clean the caption and flag for user confirmation
          workingTitle = cleanInstagramFallback(item.rawTitle);
        }
        workingDescription = extracted.description || cleanDescription;
        if (extracted.destinationCity) socialCity = extracted.destinationCity;
        if (extracted.destinationCountry) socialCountry = extracted.destinationCountry;
        if (extracted.category) socialCategory = extracted.category;
      } else {
        workingTitle = cleanInstagramFallback(item.rawTitle);
      }
    }

    // Step 2: Geocode if lat is null
    if (item.lat == null) {
      coords = await geocode(workingTitle, item.destinationCity, item.destinationCountry);
    }

    // Step 3: Places — website, photo, rating
    // Try Google Places textsearch→details (two-step, more reliable photo results) first,
    // then fall back to findplacefromtext (one-step) for website/rating.
    const curatedPhoto = getVenueImage(workingTitle);
    if (curatedPhoto) {
      place = { photoUrl: curatedPhoto };
    } else {
      // Primary: textsearch + place/details for photo
      const placesPhoto = item.destinationCity
        ? await getGooglePlacesPhoto(workingTitle, item.destinationCity, coords?.lat, coords?.lng)
        : null;
      // Fallback: findplacefromtext for website, rating, and photo if textsearch found nothing
      place = await getPlaceDetails(workingTitle, coords?.lat ?? null, coords?.lng ?? null);
      if (placesPhoto) place.photoUrl = placesPhoto;
    }
  }

  // Step 3b: Sports stadium photo if Places returned nothing
  if (!place.photoUrl && item.destinationCity && SPORTS_REGEX.test(workingTitle)) {
    const stadiumPhoto = await getStadiumPhoto(workingTitle, item.destinationCity);
    if (stadiumPhoto) {
      place.photoUrl = stadiumPhoto;
      console.log(`[SPORTS PHOTO] ✓ Stadium photo for "${workingTitle}"`);
    }
  }

  // Step 3c: ScrapingBee fallback for Airbnb when no photo found
  // Instagram caption + image are fetched in Step 1 — sbThumbnail holds the og:image result.
  if (!place.photoUrl && !item.mediaThumbnailUrl &&
      item.sourceUrl?.includes("airbnb.com") &&
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
  if (sbThumbnail) updateData.mediaThumbnailUrl = sbThumbnail;
  if (typeof place.rating === "number") updateData.relevanceScore = place.rating;
  if (description && !workingDescription) updateData.rawDescription = description;
  if (mapsCategory) {
    const slug = normalizeCategorySlug(mapsCategory) ?? mapsCategory;
    updateData.categoryTags = normalizeAndDedupeCategoryTags([slug]);
  }
  if (!item.destinationCity && socialCity) updateData.destinationCity = socialCity;
  if (!item.destinationCountry && socialCountry) updateData.destinationCountry = socialCountry;
  if (socialCategory && (!item.categoryTags || item.categoryTags.length === 0) && !mapsCategory) {
    const slug = normalizeCategorySlug(socialCategory) ?? socialCategory;
    updateData.categoryTags = normalizeAndDedupeCategoryTags([slug]);
  }
  // Flag social saves where Claude couldn't identify a specific place — prompt user to identify
  if (((SOCIAL_PLATFORMS as readonly string[]).includes(item.sourcePlatform ?? "") || isInstagramCaption(cleanTitle)) && !socialPlaceFound && !skipNormalEnrichment) {
    updateData.needsPlaceConfirmation = true;
  }
  updateData.extractionStatus = "ENRICHED";

  await db.savedItem.update({ where: { id: item.id }, data: updateData });
  console.log(`[enrich] enriched ${savedItemId}: ${Object.keys(updateData).join(", ")}`);

  } catch (err) {
    console.error(`[enrichSavedItem] failed for ${savedItemId}:`, err);
    await db.savedItem.update({
      where: { id: savedItemId },
      data: { extractionStatus: "FAILED" },
    });
  }
}
