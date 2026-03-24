import { inngest } from "../client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

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
          sourceUrl: true,
          lat: true,
        },
      });
    });

    if (!item || !item.rawTitle) {
      return { status: "skipped", reason: "no_item_or_title" };
    }

    // Step 1: Geocode if lat is null
    const coords = await step.run("geocode", async () => {
      if (item.lat != null) return null;
      return await geocode(item.rawTitle!, item.destinationCity, item.destinationCountry);
    });

    // Step 2: Places — website, photo, rating
    const place = await step.run("places", async () => {
      const lat = coords?.lat ?? null;
      const lng = coords?.lng ?? null;
      return await getPlaceDetails(item.rawTitle!, lat, lng);
    });

    // Step 3: Claude description if missing
    const description = await step.run("describe", async () => {
      if (item.rawDescription) return null;
      return await generateDescription(item.rawTitle!, item.destinationCity, item.destinationCountry);
    });

    // Step 4: UPDATE — never delete, only add missing data
    await step.run("update", async () => {
      const updateData: Record<string, unknown> = {};
      if (coords) { updateData.lat = coords.lat; updateData.lng = coords.lng; }
      if (place.website && !item.sourceUrl) updateData.sourceUrl = place.website;
      if (place.photoUrl && !item.mediaThumbnailUrl) updateData.mediaThumbnailUrl = place.photoUrl;
      if (typeof place.rating === "number") updateData.relevanceScore = place.rating;
      if (description) updateData.rawDescription = description;
      // Only mark ENRICHED after all enrichment steps have been attempted
      updateData.extractionStatus = "ENRICHED";

      await db.savedItem.update({ where: { id: item.id }, data: updateData });
      console.log(`[enrich-saved-item] enriched ${savedItemId}: ${Object.keys(updateData).join(", ")}`);
    });

    return { status: "complete", savedItemId };
  }
);
