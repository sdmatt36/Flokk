import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// All seed spots attributed to Matt's profile, distinguished by isAiGenerated: true.
// Post-demo cleanup: UPDATE "CommunitySpot" SET "isPublic" = false WHERE "isAiGenerated" = true;
const SEED_AUTHOR_PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";

export const WAVE1_CITY_SLUGS = [
  "paris", "london", "new-york-city", "rome", "barcelona",
  "orlando", "banff", "reykjavik", "sydney", "cape-town",
] as const;

const CITY_ANCHORS: Record<string, string[]> = {
  paris: [
    "Eiffel Tower", "Louvre Museum", "Palace of Versailles", "Tuileries Garden",
    "Luxembourg Gardens", "Disneyland Paris", "Seine River Cruise", "Notre-Dame Cathedral",
    "Musée d'Orsay", "Sainte-Chapelle",
  ],
  london: [
    "Tower of London", "Natural History Museum", "British Museum", "Hyde Park",
    "Thames Riverboat Tour", "Warner Bros. Studio Tour The Making of Harry Potter",
    "Borough Market", "Tower Bridge", "Shakespeare's Globe Theatre", "Hampton Court Palace",
  ],
  "new-york-city": [
    "American Museum of Natural History", "Central Park", "Top of the Rock Observation Deck",
    "Statue of Liberty", "Brooklyn Bridge", "Coney Island", "Museum of Modern Art",
    "Times Square", "Metropolitan Museum of Art", "The High Line",
  ],
  rome: [
    "Colosseum", "Vatican Museums", "Trevi Fountain", "Borghese Gallery",
    "Pantheon", "Spanish Steps", "Roman Forum", "Castel Sant'Angelo",
    "Piazza Navona", "Trastevere",
  ],
  barcelona: [
    "Sagrada Família", "Park Güell", "La Boqueria", "Magic Fountain of Montjuïc",
    "Barceloneta Beach", "Picasso Museum", "Casa Batlló", "Montserrat",
    "Tibidabo Amusement Park", "Camp Nou",
  ],
  orlando: [
    "Magic Kingdom", "EPCOT", "Disney's Animal Kingdom", "Hollywood Studios",
    "Universal Studios Florida", "Islands of Adventure", "Discovery Cove",
    "SeaWorld Orlando", "Legoland Florida", "Volcano Bay",
  ],
  banff: [
    "Lake Louise", "Moraine Lake", "Banff Gondola", "Johnston Canyon",
    "Lake Minnewanka", "Fairmont Banff Springs", "Cave and Basin National Historic Site",
    "Bow Falls", "Vermilion Lakes", "Sulphur Mountain",
  ],
  reykjavik: [
    "Golden Circle Day Tour", "Blue Lagoon", "Sky Lagoon", "Whale Watching Tour Reykjavik",
    "Hallgrímskirkja", "Perlan Museum", "Þingvellir National Park",
    "Geysir Geothermal Area", "Gullfoss Waterfall", "Harpa Concert Hall",
  ],
  sydney: [
    "Sydney Opera House", "Taronga Zoo", "Bondi to Coogee Coastal Walk", "Manly Ferry",
    "Blue Mountains National Park", "Sydney Tower Eye", "Darling Harbour",
    "Royal Botanic Garden Sydney", "SEA LIFE Sydney Aquarium", "Featherdale Wildlife Park",
  ],
  "cape-town": [
    "Table Mountain Aerial Cableway", "Boulders Beach Penguin Colony", "V&A Waterfront",
    "Robben Island", "Kirstenbosch National Botanical Garden", "Cape Point",
    "Two Oceans Aquarium", "Bo-Kaap", "Camps Bay Beach", "District Six Museum",
  ],
};

const CANONICAL_CATEGORIES = [
  "food_and_drink", "culture", "nature_and_outdoors", "adventure",
  "experiences", "sports_and_entertainment", "shopping", "kids_and_family",
  "lodging", "nightlife", "wellness", "other",
];

interface GeneratedSpot {
  name: string;
  category: string;
  description: string;
}

interface PlaceEnrichment {
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  photoUrl: string | null;
}

async function generateSpots(
  cityName: string,
  countryName: string,
  citySlug: string,
  count: number
): Promise<GeneratedSpot[]> {
  const anchors = CITY_ANCHORS[citySlug] ?? [];
  const extra = count - anchors.length;

  const prompt = `You are seeding family-travel CommunitySpots for Flokk, a family travel planning app.

City: ${cityName}, ${countryName}
Target count: exactly ${count} spots

Must include these ${anchors.length} anchor activities (ground truth — include all, use the names as given):
${anchors.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Add ${extra} additional spots beyond the anchors. Choose a mix that gives families a complete city guide. Prioritize: local restaurants, family-friendly hotels, parks, day tours, and hidden gems.

Canonical category slugs (use EXACTLY one per spot):
${CANONICAL_CATEGORIES.join(", ")}

Return ONLY valid JSON, no markdown fences:
{
  "spots": [
    {
      "name": "Exact official place name",
      "category": "canonical_slug",
      "description": "One or two sentences. Specific, engaging, family-friendly. Mention what makes it special for families with kids."
    }
  ]
}

Rules:
- Exactly ${count} spots in the array
- Include all ${anchors.length} anchors first, then the additional spots
- Use at least 5 different categories across the full list
- descriptions: 1-2 sentences, no generic filler like "a great place to visit"`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as { spots?: unknown[] };
    if (!Array.isArray(parsed.spots)) return [];
    return (parsed.spots as GeneratedSpot[]).filter(
      (s) =>
        s &&
        typeof s.name === "string" &&
        s.name.trim().length > 0 &&
        CANONICAL_CATEGORIES.includes(s.category)
    );
  } catch {
    return [];
  }
}

async function enrichWithPlaces(name: string, cityName: string): Promise<PlaceEnrichment> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { placeId: null, lat: null, lng: null, address: null, photoUrl: null };

  try {
    const query = `${name} ${cityName}`;
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    if (!searchRes.ok) return { placeId: null, lat: null, lng: null, address: null, photoUrl: null };

    const searchData = await searchRes.json() as {
      results?: Array<{
        place_id: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
        photos?: Array<{ photo_reference: string }>;
      }>;
    };

    const first = searchData.results?.[0];
    if (!first?.place_id) return { placeId: null, lat: null, lng: null, address: null, photoUrl: null };

    const lat = first.geometry?.location?.lat ?? null;
    const lng = first.geometry?.location?.lng ?? null;
    const address = first.formatted_address ?? null;
    const photoRef = first.photos?.[0]?.photo_reference ?? null;

    let photoUrl: string | null = null;
    if (photoRef) {
      const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
      try {
        const photoRes = await fetch(photoApiUrl, { redirect: "follow" });
        if (photoRes.ok && photoRes.url && photoRes.url !== photoApiUrl) {
          photoUrl = photoRes.url;
        }
      } catch {
        // Photo resolution is best-effort
      }
    }

    return { placeId: first.place_id, lat, lng, address, photoUrl };
  } catch {
    return { placeId: null, lat: null, lng: null, address: null, photoUrl: null };
  }
}

export interface SeedCityResult {
  citySlug: string;
  cityName: string;
  requested: number;
  generated: number;
  enriched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function seedCity(citySlug: string, count = 20): Promise<SeedCityResult> {
  const result: SeedCityResult = {
    citySlug,
    cityName: citySlug,
    requested: count,
    generated: 0,
    enriched: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  const city = await db.city.findUnique({
    where: { slug: citySlug },
    include: { country: { select: { name: true } } },
  });
  if (!city) {
    result.errors.push(`City not found for slug: ${citySlug}`);
    return result;
  }
  result.cityName = city.name;
  const countryName = city.country.name;

  let generatedSpots: GeneratedSpot[];
  try {
    generatedSpots = await generateSpots(city.name, countryName, citySlug, count);
  } catch (e) {
    result.errors.push(`Sonnet generation failed: ${String(e)}`);
    return result;
  }
  result.generated = generatedSpots.length;

  // Enrich with Places API — batches of 5 in parallel, cities are called sequentially
  const BATCH_SIZE = 5;
  const enriched: Array<GeneratedSpot & PlaceEnrichment> = [];

  for (let i = 0; i < generatedSpots.length; i += BATCH_SIZE) {
    const batch = generatedSpots.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (spot) => {
        const places = await enrichWithPlaces(spot.name, city.name);
        return { ...spot, ...places };
      })
    );
    enriched.push(...batchResults);
  }

  result.enriched = enriched.filter((s) => s.placeId !== null).length;

  // Upsert each spot
  for (const spot of enriched) {
    try {
      if (spot.placeId) {
        await db.communitySpot.upsert({
          where: { googlePlaceId: spot.placeId },
          create: {
            name: spot.name,
            city: city.name,
            country: countryName,
            category: spot.category,
            description: spot.description,
            lat: spot.lat,
            lng: spot.lng,
            address: spot.address,
            photoUrl: spot.photoUrl,
            googlePlaceId: spot.placeId,
            shareToken: nanoid(12),
            isPublic: true,
            isAiGenerated: true,
            averageRating: 4.2,
            ratingCount: 3,
            contributionCount: 0,
            authorProfileId: SEED_AUTHOR_PROFILE_ID,
            cityId: city.id,
          },
          update: {
            // Safe re-run: refresh AI-generated description and category.
            // Do not overwrite photoUrl or rating if real data was added.
            description: spot.description,
            category: spot.category,
            isAiGenerated: true,
          },
        });
      } else {
        // No Places match — find-or-create by (city, name) insensitive
        const existing = await db.communitySpot.findFirst({
          where: {
            city: { equals: city.name, mode: "insensitive" },
            name: { equals: spot.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existing) {
          result.skipped++;
          continue;
        }
        await db.communitySpot.create({
          data: {
            name: spot.name,
            city: city.name,
            country: countryName,
            category: spot.category,
            description: spot.description,
            lat: spot.lat,
            lng: spot.lng,
            address: spot.address,
            photoUrl: spot.photoUrl,
            shareToken: nanoid(12),
            isPublic: true,
            isAiGenerated: true,
            averageRating: 4.2,
            ratingCount: 3,
            contributionCount: 0,
            authorProfileId: SEED_AUTHOR_PROFILE_ID,
            cityId: city.id,
          },
        });
      }
      result.inserted++;
    } catch (e) {
      result.errors.push(`"${spot.name}": ${String(e)}`);
      result.skipped++;
    }
  }

  return result;
}
