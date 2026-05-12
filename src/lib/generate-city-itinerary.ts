import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { searchUnsplashPhotoWithCredit } from "@/lib/unsplash";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

const CANONICAL_CATEGORIES = new Set([
  "food_and_drink", "culture", "nature_and_outdoors", "adventure",
  "experiences", "sports_and_entertainment", "shopping", "kids_and_family",
  "lodging", "nightlife", "wellness", "other",
]);

interface GeneratedActivity {
  title: string;
  description: string;
  categorySlug: string;
}

interface GeneratedDay {
  dayLabel: string;
  neighborhood: string;
  activities: GeneratedActivity[];
}

interface GeneratedItinerary {
  title: string;
  description: string;
  heroImageQuery: string;
  days: GeneratedDay[];
}

interface ActivityEnrichment {
  lat: number | null;
  lng: number | null;
  placePhotoUrl: string | null;
  websiteUrl: string | null;
  enriched: boolean;
}

export interface GenerateCityItineraryResult {
  status: "success" | "skipped" | "error";
  tripId: string | null;
  citySlug?: string;
  cityName?: string;
  savedItemCount?: number;
  enrichedCount?: number;
  heroImageUrl?: string | null;
  skipReason?: string;
  error?: string;
}

async function callSonnet(cityName: string, countryName: string): Promise<{ itinerary: GeneratedItinerary; numDays: number } | null> {
  const numDays = ([3, 5, 7] as const)[Math.floor(Math.random() * 3)];
  const actsPerDay = numDays === 7 ? "2-3" : "3-4";

  const prompt = `You are writing a ${numDays}-day family travel itinerary for ${cityName}, ${countryName}. This will appear publicly on Flokk, a family travel planning platform. The itinerary will be browsed by parents with kids ages 5-14 planning a trip.

Output requirements:
- ${numDays} days total
- ${actsPerDay} activities per day (mix of: morning anchor, lunch/food, afternoon activity, evening if relevant)
- Activities must be REAL places with specific names (not "a local cafe" — give the actual cafe name)
- Mix categories across the trip: food_and_drink, culture, nature_and_outdoors, kids_and_family, experiences, adventure, shopping
- Family-appropriate: nothing 21+, nothing requiring extreme fitness, nothing that requires 6+ hour commitment from kids
- Geographic clustering: activities within a day should be near each other (walking or short transit). Use neighborhoods to anchor each day.
- Trip title: evocative, specific (e.g. "Amsterdam with Kids: Canals, Cookies, and Cargo Bikes", not "Amsterdam Family Trip")
- Description: 2-3 sentences, plain prose, no em-dashes, no AI-voice tells

Categories must be from this set exactly: food_and_drink, culture, nature_and_outdoors, adventure, experiences, sports_and_entertainment, shopping, kids_and_family, lodging, nightlife, wellness, other

Return strict JSON only, no markdown:
{
  "title": "...",
  "description": "...",
  "heroImageQuery": "${cityName} families travel",
  "days": [
    {
      "dayLabel": "Day 1: ...",
      "neighborhood": "...",
      "activities": [
        { "title": "Exact Place Name", "description": "One or two sentences. Specific, actionable, family-relevant.", "categorySlug": "culture" }
      ]
    }
  ]
}`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as GeneratedItinerary;
    if (!Array.isArray(parsed.days) || parsed.days.length === 0) return null;
    // Clamp any unknown categories to "experiences"
    for (const day of parsed.days) {
      for (const act of day.activities) {
        if (!CANONICAL_CATEGORIES.has(act.categorySlug)) act.categorySlug = "experiences";
      }
    }
    return { itinerary: parsed, numDays };
  } catch {
    return null;
  }
}

async function enrichActivity(title: string, cityName: string): Promise<ActivityEnrichment> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { lat: null, lng: null, placePhotoUrl: null, websiteUrl: null, enriched: false };

  try {
    const query = `${title} ${cityName}`;
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    if (!searchRes.ok) return { lat: null, lng: null, placePhotoUrl: null, websiteUrl: null, enriched: false };

    const searchData = await searchRes.json() as {
      results?: Array<{
        place_id: string;
        geometry?: { location?: { lat: number; lng: number } };
        photos?: Array<{ photo_reference: string }>;
      }>;
    };

    const first = searchData.results?.[0];
    if (!first?.place_id) return { lat: null, lng: null, placePhotoUrl: null, websiteUrl: null, enriched: false };

    const lat = first.geometry?.location?.lat ?? null;
    const lng = first.geometry?.location?.lng ?? null;
    const photoRef = first.photos?.[0]?.photo_reference ?? null;

    // Photo URL and website in parallel
    const [placePhotoUrl, websiteUrl] = await Promise.all([
      (async () => {
        if (!photoRef) return null;
        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
        try {
          const pr = await fetch(photoApiUrl, { redirect: "follow" });
          return pr.ok && pr.url !== photoApiUrl ? pr.url : null;
        } catch { return null; }
      })(),
      (async () => {
        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(first.place_id)}&fields=website&key=${apiKey}`
          );
          if (!detailRes.ok) return null;
          const detail = await detailRes.json() as { result?: { website?: string } };
          return detail.result?.website ?? null;
        } catch { return null; }
      })(),
    ]);

    return { lat, lng, placePhotoUrl, websiteUrl, enriched: true };
  } catch {
    return { lat: null, lng: null, placePhotoUrl: null, websiteUrl: null, enriched: false };
  }
}

export async function generateCityItinerary(citySlug: string): Promise<GenerateCityItineraryResult> {
  // 1. Lookup city + country
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    include: { country: { select: { name: true } } },
  });
  if (!city) return { status: "error", tripId: null, error: `City not found: ${citySlug}` };

  const cityName = city.name;
  const countryName = city.country.name;

  // 2. Idempotency: skip if a FlokkerExample trip already exists for this city
  const existing = await db.trip.findFirst({
    where: { familyProfileId: DEMO_PROFILE_ID, destinationCity: cityName, isFlokkerExample: true },
    select: { id: true },
  });
  if (existing) {
    return { status: "skipped", tripId: existing.id, citySlug, cityName, skipReason: "trip already exists" };
  }

  // 3. Generate itinerary content via Sonnet
  const generated = await callSonnet(cityName, countryName);
  if (!generated) {
    return { status: "error", tripId: null, error: "Sonnet generation failed or returned invalid JSON" };
  }
  const { itinerary, numDays } = generated;

  // 4. Fetch Unsplash hero image
  const hero = await searchUnsplashPhotoWithCredit(
    itinerary.heroImageQuery || `${cityName} city travel families`
  );
  const heroImageUrl = hero?.url ?? null;

  // 5. Enrich all activities via Google Places (5 parallel per batch, sequential batches)
  const flatActivities: Array<{
    dayIndex: number;
    sortOrder: number;
    act: GeneratedActivity;
    enrich: ActivityEnrichment;
  }> = [];

  const BATCH_SIZE = 5;

  for (let d = 0; d < itinerary.days.length; d++) {
    const day = itinerary.days[d];
    const activities = day.activities;
    const enriched: ActivityEnrichment[] = [];

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((act) => enrichActivity(act.title, cityName))
      );
      enriched.push(...results);
    }

    for (let i = 0; i < activities.length; i++) {
      flatActivities.push({
        dayIndex: d + 1,
        sortOrder: i,
        act: activities[i],
        enrich: enriched[i],
      });
    }
  }

  const enrichedCount = flatActivities.filter((a) => a.enrich.enriched).length;

  // 6. Persist Trip + SavedItems in a single atomic create
  const startDate = new Date("2025-04-20T12:00:00Z");
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + numDays - 1);

  const trip = await db.trip.create({
    data: {
      familyProfileId: DEMO_PROFILE_ID,
      title: itinerary.title,
      destinationCity: cityName,
      destinationCountry: countryName,
      startDate,
      endDate,
      status: "COMPLETED",
      privacy: "PUBLIC",
      isPublic: true,
      isAnonymous: true,
      isFlokkerExample: true,
      shareToken: nanoid(12),
      heroImageUrl,
      savedItems: {
        create: flatActivities.map(({ dayIndex, sortOrder, act, enrich }) => ({
          familyProfileId: DEMO_PROFILE_ID,
          rawTitle: act.title,
          rawDescription: act.description,
          sourceMethod: "URL_PASTE",
          extractionStatus: enrich.enriched ? "ENRICHED" : "ENRICHMENT_FAILED",
          status: "TRIP_ASSIGNED",
          categoryTags: [act.categorySlug],
          dayIndex,
          sortOrder,
          destinationCity: cityName,
          destinationCountry: countryName,
          isBooked: true,
          bookedAt: new Date(),
          lat: enrich.lat,
          lng: enrich.lng,
          placePhotoUrl: enrich.placePhotoUrl,
          websiteUrl: enrich.websiteUrl,
        })),
      },
    },
    select: { id: true },
  });

  return {
    status: "success",
    tripId: trip.id,
    citySlug,
    cityName,
    savedItemCount: flatActivities.length,
    enrichedCount,
    heroImageUrl,
  };
}
