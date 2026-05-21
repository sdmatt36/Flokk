import { db } from "@/lib/db";
import { resolveGooglePhotoUrl } from "@/lib/google-places";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StopCategory = "food" | "bathroom" | "snack" | "photo_spot" | "rest";
export type MealType = "auto" | "breakfast" | "lunch" | "dinner";

export type CategoryOptions =
  | { category: "food"; mealType?: MealType }
  | { category: "bathroom" }
  | { category: "snack" }
  | { category: "photo_spot" }
  | { category: "rest" };

type CategoryConfig = {
  placeTypes: Set<string>;
  primaryExclusions: Set<string>;
  allowMultiple: boolean;
  defaultDurationMinutes: number;
  implemented: boolean;
};

// Empty sets on non-implemented categories are intentional — not read because
// implemented:false short-circuits before they're used.
const CATEGORY_CONFIGS: Record<StopCategory, CategoryConfig> = {
  food: {
    placeTypes: new Set(["restaurant", "meal_takeaway"]),
    primaryExclusions: new Set([
      "lodging", "tourist_attraction", "shopping_mall",
      "museum", "park", "amusement_park", "spa",
    ]),
    allowMultiple: false,
    defaultDurationMinutes: 45,
    implemented: true,
  },
  bathroom:  { placeTypes: new Set(), primaryExclusions: new Set(), allowMultiple: true,  defaultDurationMinutes: 10, implemented: false },
  snack:     { placeTypes: new Set(), primaryExclusions: new Set(), allowMultiple: true,  defaultDurationMinutes: 20, implemented: false },
  photo_spot:{ placeTypes: new Set(), primaryExclusions: new Set(), allowMultiple: true,  defaultDurationMinutes: 15, implemented: false },
  rest:      { placeTypes: new Set(), primaryExclusions: new Set(), allowMultiple: false, defaultDurationMinutes: 30, implemented: false },
};

export type InsertResult =
  | {
      ok: true;
      tourStop: { id: string; name: string; orderIndex: number };
      pickedPlace: { name: string; placeId: string; rating: number; address: string };
    }
  | {
      ok: false;
      reason:
        | "tour_not_found"
        | "wrong_owner"
        | "too_few_stops"
        | "already_has_this_category"
        | "not_implemented"
        | "invalid_options"
        | "no_meal_gap"
        | "no_candidates"
        | "all_filtered_out"
        | "internal_error";
      message: string;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanCategoryLabel(c: StopCategory): string {
  switch (c) {
    case "food":       return "meal";
    case "bathroom":   return "bathroom";
    case "snack":      return "snack";
    case "photo_spot": return "photo";
    case "rest":       return "rest";
  }
}

function buildFoodPrompt(
  mealType: MealType,
  destinationCity: string,
  allAllergies: string[],
  allDietary: string[],
  hasChildren: boolean
): string[] {
  const lines: string[] = [];
  if (mealType === "breakfast") {
    lines.push(`Recommend one specific, real breakfast spot in ${destinationCity} for a walking tour. The user wants a breakfast stop.`);
    lines.push("Good picks: cafes, bakeries, breakfast restaurants, coffee shops with food. Prefer places with a sit-down breakfast menu.");
  } else if (mealType === "lunch") {
    lines.push(`Recommend one specific, real lunch restaurant in ${destinationCity} for a walking tour. The user wants a lunch stop.`);
    lines.push("Prefer sit-down restaurants with a lunch menu.");
  } else if (mealType === "dinner") {
    lines.push(`Recommend one specific, real dinner restaurant in ${destinationCity} for a walking tour. The user wants a dinner stop.`);
    lines.push("Prefer sit-down dinner restaurants with a full evening menu.");
  } else {
    lines.push(`Recommend one specific, real restaurant in ${destinationCity} for a walking tour meal stop.`);
  }
  if (allAllergies.length > 0)
    lines.push(`Hard constraint — avoid any restaurant that serves or cross-contaminates: ${allAllergies.join(", ")}.`);
  if (allDietary.length > 0)
    lines.push(`Dietary preferences: ${allDietary.join(", ")}.`);
  if (hasChildren)
    lines.push("Family has children — choose a restaurant welcoming to kids.");
  lines.push(
    `Respond with a JSON object only, no markdown:\n{"name": "<exact restaurant name>", "why": "<one sentence why this is a great pick>", "familyNote": "<one short phrase for the family>"}`
  );
  return lines;
}

function buildPromptForCategory(
  category: StopCategory,
  options: CategoryOptions,
  destinationCity: string,
  allAllergies: string[],
  allDietary: string[],
  hasChildren: boolean
): string[] {
  switch (category) {
    case "food":
      return buildFoodPrompt(
        (options as Extract<CategoryOptions, { category: "food" }>).mealType ?? "auto",
        destinationCity,
        allAllergies,
        allDietary,
        hasChildren
      );
    case "bathroom":
    case "snack":
    case "photo_spot":
    case "rest":
      // Unreachable — implemented:false short-circuits before this executes.
      throw new Error(`Prompt builder not implemented for category: ${category}`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function addStopToTour(
  tourId: string,
  familyProfileId: string,
  options: CategoryOptions
): Promise<InsertResult> {
  const category = options.category;
  const config = CATEGORY_CONFIGS[category];

  if (!config.implemented) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=not_implemented`);
    return { ok: false, reason: "not_implemented", message: "This stop type isn't available yet." };
  }

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      familyProfileId: true,
      destinationCity: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, placeTypes: true },
      },
    },
  });

  if (!tour) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=tour_not_found`);
    return { ok: false, reason: "tour_not_found", message: "Tour not found." };
  }
  if (tour.familyProfileId !== familyProfileId) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=wrong_owner`);
    return { ok: false, reason: "wrong_owner", message: "You don't have permission to modify this tour." };
  }
  if (tour.stops.length < 2) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=too_few_stops`);
    return { ok: false, reason: "too_few_stops", message: "This tour needs at least 2 stops." };
  }

  if (!config.allowMultiple) {
    const alreadyHasThis = tour.stops.some(s => {
      const types = s.placeTypes as string[];
      return types.some(t => config.placeTypes.has(t)) && !types.some(t => config.primaryExclusions.has(t));
    });
    if (alreadyHasThis) {
      console.log(`[add-stop] tourId=${tourId} category=${category} reason=already_has_this_category`);
      return {
        ok: false,
        reason: "already_has_this_category",
        message: `This tour already has a ${humanCategoryLabel(category)} stop.`,
      };
    }
  }

  const profile = await db.familyProfile.findUnique({
    where: { id: familyProfileId },
    select: {
      members: { select: { role: true, foodAllergies: true, dietaryRequirements: true } },
    },
  });

  const hasChildren = profile?.members.some(m => m.role === "CHILD") ?? false;
  const allAllergies = [
    ...new Set((profile?.members ?? []).flatMap(m => m.foodAllergies as string[])),
  ];
  const allDietary = [
    ...new Set((profile?.members ?? []).flatMap(m => m.dietaryRequirements as string[])),
  ];

  const promptLines = buildPromptForCategory(
    category, options, tour.destinationCity, allAllergies, allDietary, hasChildren
  );

  let placeName = "";
  let why = "";
  let familyNote = "";

  try {
    const anthropic = new Anthropic();
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: promptLines.join("\n") }],
    });
    const text = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { name?: string; why?: string; familyNote?: string };
    placeName  = parsed.name?.trim() ?? "";
    why        = parsed.why?.trim() ?? "";
    familyNote = parsed.familyNote?.trim() ?? "";
  } catch {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=internal_error (claude_parse_failed)`);
    return { ok: false, reason: "internal_error", message: "Couldn't add a stop. Try again." };
  }

  if (!placeName) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=internal_error (no_place_name)`);
    return { ok: false, reason: "internal_error", message: "Couldn't add a stop. Try again." };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  let lat: number | null = null;
  let lng: number | null = null;
  let address: string | null = null;
  let placeId: string | null = null;
  let imageUrl: string | null = null;
  let websiteUrl: string | null = null;
  let rating = 0;
  const placeTypes: string[] = [];

  if (gKey) {
    try {
      const query = `${placeName} ${tour.destinationCity}`;
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${gKey}`
      );
      const searchData = (await searchRes.json()) as {
        results?: Array<{
          place_id: string;
          formatted_address?: string;
          geometry?: { location: { lat: number; lng: number } };
          types?: string[];
          rating?: number;
        }>;
      };
      const first = searchData.results?.[0];
      if (first) {
        placeId = first.place_id;
        address = first.formatted_address ?? null;
        lat     = first.geometry?.location.lat ?? null;
        lng     = first.geometry?.location.lng ?? null;
        rating  = first.rating ?? 0;
        placeTypes.push(...(first.types ?? []));

        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,photos&key=${gKey}`
        );
        const detailsData = (await detailsRes.json()) as {
          result?: { website?: string; photos?: Array<{ photo_reference: string }> };
        };
        websiteUrl = detailsData.result?.website ?? null;
        const photoRef = detailsData.result?.photos?.[0]?.photo_reference ?? null;
        if (photoRef) {
          const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${gKey}`;
          imageUrl = await resolveGooglePhotoUrl(photoApiUrl);
        }
      }
    } catch {
      // Place lookup is best-effort; stop is still inserted with null spatial data
    }
  }

  const insertAt = Math.max(1, Math.floor(tour.stops.length * 0.4));
  const stopsToShift = tour.stops.filter(s => s.orderIndex >= insertAt);
  await Promise.all(
    stopsToShift.map(s =>
      db.tourStop.update({ where: { id: s.id }, data: { orderIndex: s.orderIndex + 1 } })
    )
  );

  const newStopId = crypto.randomUUID();
  const newStop = await db.tourStop.create({
    data: {
      id: newStopId,
      tourId,
      orderIndex: insertAt,
      name: placeName,
      address,
      lat,
      lng,
      durationMin: config.defaultDurationMinutes,
      travelTimeMin: null,
      why: why || null,
      familyNote: familyNote || null,
      imageUrl,
      websiteUrl,
      placeId,
      ticketRequired: "free",
      placeTypes,
    },
  });

  const pickedPlace = { name: placeName, placeId: placeId ?? "", rating, address: address ?? "" };

  console.log(`[add-stop] tourId=${tourId} category=${category} reason=ok place=${pickedPlace.name}`);
  return {
    ok: true,
    tourStop: { id: newStop.id, name: newStop.name, orderIndex: newStop.orderIndex },
    pickedPlace,
  };
}
