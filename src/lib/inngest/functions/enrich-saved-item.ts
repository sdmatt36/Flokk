// DISABLED — enrichment moved to direct call in saves API route.
// See src/lib/enrich-save.ts. Inngest trigger removed from saves route.
// Kept here so the Inngest serve handler doesn't break on import.
import { inngest } from "../client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import he from "he";
import { getVenueImage } from "@/lib/destination-images";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

function isInstagramCaption(title: string): boolean {
  return /on Instagram/i.test(title) || /^[^:]+:\s*[""]/.test(title);
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
  const query = [title, city, country].filter(Boolean).join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results: { geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status !== "OK" || !data.results[0]) return null;
  return data.results[0].geometry.location;
}

async function getPlaceDetails(
  title: string,
  lat: number | null,
  lng: number | null
): Promise<{ website?: string; photoUrl?: string; rating?: number }> {
  const locationBias =
    lat != null && lng != null ? `&location=${lat},${lng}&radius=5000` : "";
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(title)}&inputtype=textquery&fields=website,photos,rating${locationBias}&key=${GOOGLE_MAPS_API_KEY}`;
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
        content: `Write a 1-2 sentence family travel description for "${title}"${location ? ` in ${location}` : ""}. Focus on what makes it good for families with kids. Be specific and practical. Return only the description text.`,
      }],
    });
    const content = response.content[0];
    if (content.type !== "text") return null;
    return content.text.trim();
  } catch {
    return null;
  }
}

// Enriches a single SavedItem — triggered after any new save is created.
// Steps: geocode (if lat null) → Places website/photo/rating → Claude description → UPDATE.
export const enrichSavedItem = inngest.createFunction(
  { id: "enrich-saved-item", retries: 3 },
  { event: "saves/enrich-item" },
  async ({ event, step }) => {
    const { savedItemId } = event.data as { savedItemId: string };

    const item = await step.run("fetch-item", async () => {
      return await db.savedItem.findUnique({
        where: { id: savedItemId },
        select: {
          id: true,
          rawTitle: true,
          rawDescription: true,
          destinationCity: true,
          destinationCountry: true,
          mediaThumbnailUrl: true,
          placePhotoUrl: true,
          sourceUrl: true,
          sourceType: true,
          lat: true,
        },
      });
    });

    if (!item || !item.rawTitle) {
      return { status: "skipped", reason: "no_item_or_title" };
    }

    const stripRawUnicode = (str: string) => str.replace(/&#x[0-9a-fA-F]+;/gi, "").trim();
    const cleanTitle = stripRawUnicode(he.decode(item.rawTitle));
    const cleanDescription = item.rawDescription
      ? stripRawUnicode(he.decode(item.rawDescription))
      : null;

    // Step 1: Extract clean title/description from Instagram captions
    const instagramExtracted = await step.run("extract-instagram-title", async () => {
      if (item.sourceType !== "INSTAGRAM" && !isInstagramCaption(cleanTitle)) return null;
      return await extractInstagramTitle(cleanTitle, item.destinationCity, item.destinationCountry);
    });

    // Use extracted title for all downstream steps if available
    const workingTitle = instagramExtracted?.title ?? cleanTitle;
    const workingDescription = instagramExtracted?.description || cleanDescription;

    // Step 2: Geocode if lat is null
    const coords = await step.run("geocode", async () => {
      if (item.lat != null) return null;
      return await geocode(workingTitle, item.destinationCity, item.destinationCountry);
    });

    // Step 3: Places — website, photo, rating (skipped if venue map has a curated photo)
    const curatedPhoto = getVenueImage(workingTitle);
    const place = await step.run("places", async () => {
      if (curatedPhoto) return { photoUrl: curatedPhoto } as { website?: string; photoUrl?: string; rating?: number };
      const lat = coords?.lat ?? null;
      const lng = coords?.lng ?? null;
      return await getPlaceDetails(workingTitle, lat, lng);
    });

    // Step 4: Claude description if missing
    const description = await step.run("describe", async () => {
      if (workingDescription) return null;
      return await generateDescription(workingTitle, item.destinationCity, item.destinationCountry);
    });

    // Step 5: UPDATE — never delete, only add missing data
    await step.run("update", async () => {
      const updateData: Record<string, unknown> = {};
      // Always write cleaned title; use extracted description if available
      updateData.rawTitle = workingTitle;
      if (workingDescription) updateData.rawDescription = workingDescription;
      if (coords) { updateData.lat = coords.lat; updateData.lng = coords.lng; }
      if (place.website && !item.sourceUrl) updateData.sourceUrl = place.website;
      if (place.photoUrl) updateData.placePhotoUrl = place.photoUrl;
      if (typeof place.rating === "number") updateData.relevanceScore = place.rating;
      if (description && !workingDescription) updateData.rawDescription = description;
      // Only mark ENRICHED after all enrichment steps have been attempted
      updateData.extractionStatus = "ENRICHED";

      await db.savedItem.update({ where: { id: item.id }, data: updateData });
      console.log(`[enrich-saved-item] enriched ${savedItemId}: ${Object.keys(updateData).join(", ")}`);
    });

    return { status: "complete", savedItemId };
  }
);
