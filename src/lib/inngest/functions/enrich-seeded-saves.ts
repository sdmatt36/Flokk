import { inngest } from "../client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const BATCH_SIZE = 10;

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

interface PlaceDetails {
  website?: string;
  photoUrl?: string;
  rating?: number;
}

async function getPlaceDetails(
  title: string,
  lat: number | null,
  lng: number | null
): Promise<PlaceDetails> {
  const locationBias =
    lat != null && lng != null ? `&location=${lat},${lng}&radius=5000` : "";
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(title)}&inputtype=textquery&fields=website,photos,rating${locationBias}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    candidates: {
      website?: string;
      rating?: number;
      photos?: { photo_reference: string }[];
    }[];
  };
  if (data.status !== "OK" || !data.candidates[0]) return {};
  const c = data.candidates[0];
  const result: PlaceDetails = {};
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
      messages: [
        {
          role: "user",
          content: `Write a 1-2 sentence family travel description for "${title}"${location ? ` in ${location}` : ""}. Focus on what makes it good for families with kids. Be specific and practical. Return only the description text.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") return null;
    return content.text.trim();
  } catch (e) {
    console.error("[enrich-seeded] claude error:", e);
    return null;
  }
}

export const enrichSeededSaves = inngest.createFunction(
  { id: "enrich-seeded-saves", retries: 2 },
  { event: "saves/enrich-seeded" },
  async ({ step }) => {
    // Fetch all SavedItems where lat is null AND parent trip is PUBLIC
    const items = await step.run("fetch-items", async () => {
      return await db.savedItem.findMany({
        where: {
          OR: [{ lat: null }, { extractionStatus: { not: "ENRICHED" } }],
          trip: { privacy: "PUBLIC" },
        },
        select: {
          id: true,
          rawTitle: true,
          rawDescription: true,
          destinationCity: true,
          destinationCountry: true,
          mediaThumbnailUrl: true,
          sourceUrl: true,
        },
      });
    });

    console.log(`[enrich-seeded] found ${items.length} items to enrich`);

    if (items.length === 0) {
      return { status: "nothing_to_enrich" };
    }

    let enriched = 0;
    let skipped = 0;

    // Process in batches of BATCH_SIZE
    for (let batchStart = 0; batchStart < items.length; batchStart += BATCH_SIZE) {
      const batch = items.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

      await step.run(`enrich-batch-${batchNum}`, async () => {
        for (const item of batch) {
          const title = item.rawTitle ?? "";
          if (!title) {
            skipped++;
            return;
          }

          const updateData: Record<string, unknown> = {};

          // Step 1: Geocode → lat/lng
          const coords = await geocode(title, item.destinationCity, item.destinationCountry);
          if (coords) {
            updateData.lat = coords.lat;
            updateData.lng = coords.lng;
          }

          // Step 2: Places → website (→ sourceUrl), photo, rating (→ relevanceScore)
          const place = await getPlaceDetails(
            title,
            coords?.lat ?? null,
            coords?.lng ?? null
          );
          if (place.website && !item.sourceUrl) {
            updateData.sourceUrl = place.website;
          }
          if (place.photoUrl && !item.mediaThumbnailUrl) {
            updateData.mediaThumbnailUrl = place.photoUrl;
          }
          if (typeof place.rating === "number") {
            updateData.relevanceScore = place.rating;
          }

          // Step 3: Claude → description if missing
          if (!item.rawDescription) {
            const description = await generateDescription(title, item.destinationCity, item.destinationCountry);
            if (description) {
              updateData.rawDescription = description;
            }
          }

          // Step 4: UPDATE only — never delete
          // Only mark ENRICHED if we actually got coordinates
          if (updateData.lat != null) updateData.extractionStatus = "ENRICHED";

          if (Object.keys(updateData).length > 0) {
            await db.savedItem.update({
              where: { id: item.id },
              data: updateData,
            });
            enriched++;
            console.log(`[enrich-seeded] Enriched ${enriched} of ${items.length} items`);
          } else {
            skipped++;
          }
        }
      });

      // 500ms delay between batches (skip after last batch)
      if (batchStart + BATCH_SIZE < items.length) {
        await step.sleep(`delay-after-batch-${batchNum}`, 500);
      }
    }

    console.log(`[enrich-seeded] done. enriched=${enriched} skipped=${skipped} total=${items.length}`);
    return { status: "complete", total: items.length, enriched, skipped };
  }
);
