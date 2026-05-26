import { db } from "@/lib/db";
import { resolveGooglePhotoUrl } from "@/lib/google-places";
import { resolveProfileId } from "@/lib/profile-access";
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

// Matches the Stop type consumed by TourResults — DB field names mapped to UI names.
export type UIStop = {
  id: string;
  orderIndex: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
  imageUrl?: string | null;
  websiteUrl?: string | null;
};

export type InsertResult =
  | {
      ok: true;
      tourStop: { id: string; name: string; orderIndex: number };
      pickedPlace: { name: string; placeId: string; rating: number; address: string };
      allStops: UIStop[];
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

// ── Bathroom suggest types ─────────────────────────────────────────────────────

export type PrefetchedCandidate = {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  durationMin: number;
  why: string | null;
  familyNote: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  placeId: string | null;
  ticketRequired: string | null;
  placeTypes: string[];
};

export type BathroomErrorCode = "no_candidates" | "places_resolution_failed" | "out_of_area";

export type BathroomCandidateResult =
  | { candidate: PrefetchedCandidate; insertAfterStopId: string }
  | { error: BathroomErrorCode };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aVal =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function childrenAgesSummary(members: Array<{ role: string; birthDate: Date | null }>): string {
  const today = new Date();
  const ages = members
    .filter(m => m.role === "CHILD")
    .map(m => {
      if (!m.birthDate) return null;
      return Math.floor((today.getTime() - m.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    })
    .filter((age): age is number => age !== null);
  if (ages.length === 0) return "family with children";
  return `children aged ${ages.join(", ")}`;
}

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

// ─── Main export — add-stop insertion ─────────────────────────────────────────

export async function addStopToTour(opts: {
  tourId: string;
  userId: string;
  category: StopCategory;
  mealType?: MealType;
  prefetchedCandidate?: PrefetchedCandidate;
}): Promise<InsertResult> {
  const { tourId, userId, category, mealType, prefetchedCandidate } = opts;
  const config = CATEGORY_CONFIGS[category];

  // Non-implemented categories require a prefetchedCandidate to bypass the AI/Places path.
  if (!config.implemented && !prefetchedCandidate) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=not_implemented`);
    return { ok: false, reason: "not_implemented", message: "This stop type isn't available yet." };
  }

  const familyProfileId = await resolveProfileId(userId);
  if (!familyProfileId) {
    console.log(`[add-stop] tourId=${tourId} category=${category} reason=internal_error (no_profile)`);
    return { ok: false, reason: "internal_error", message: "Couldn't add a stop. Try again." };
  }

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      familyProfileId: true,
      destinationCity: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, placeTypes: true, lat: true, lng: true },
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

  // ── Prefetched path: caller already resolved the candidate (suggest-stop flow) ──
  if (prefetchedCandidate) {
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
        name: prefetchedCandidate.name,
        address: prefetchedCandidate.address,
        lat: prefetchedCandidate.lat,
        lng: prefetchedCandidate.lng,
        durationMin: prefetchedCandidate.durationMin,
        travelTimeMin: null,
        why: prefetchedCandidate.why,
        familyNote: prefetchedCandidate.familyNote,
        imageUrl: prefetchedCandidate.imageUrl,
        websiteUrl: prefetchedCandidate.websiteUrl,
        placeId: prefetchedCandidate.placeId,
        ticketRequired: prefetchedCandidate.ticketRequired ?? "free",
        placeTypes: prefetchedCandidate.placeTypes,
      },
    });

    const pickedPlace = {
      name: prefetchedCandidate.name,
      placeId: prefetchedCandidate.placeId ?? "",
      rating: 0,
      address: prefetchedCandidate.address ?? "",
    };

    const updatedRows = await db.tourStop.findMany({
      where: { tourId, deletedAt: null },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true, orderIndex: true, name: true, address: true,
        lat: true, lng: true, durationMin: true, travelTimeMin: true,
        why: true, familyNote: true, imageUrl: true, websiteUrl: true,
      },
    });

    const allStops: UIStop[] = updatedRows.map(s => ({
      id: s.id,
      orderIndex: s.orderIndex,
      name: s.name,
      address: s.address ?? "",
      lat: s.lat ?? 0,
      lng: s.lng ?? 0,
      duration: s.durationMin ?? 0,
      travelTime: s.travelTimeMin ?? 0,
      why: s.why ?? "",
      familyNote: s.familyNote ?? "",
      imageUrl: s.imageUrl ?? null,
      websiteUrl: s.websiteUrl ?? null,
    }));

    console.log(`[add-stop] tourId=${tourId} category=${category} reason=ok (prefetched) place=${pickedPlace.name} allStopsCount=${allStops.length}`);
    return {
      ok: true,
      tourStop: { id: newStop.id, name: newStop.name, orderIndex: newStop.orderIndex },
      pickedPlace,
      allStops,
    };
  }

  // ── AI + Places path (food; other categories require prefetchedCandidate) ────

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

  const promptLines = buildFoodPrompt(
    mealType ?? "auto",
    tour.destinationCity,
    allAllergies,
    allDietary,
    hasChildren
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

  // Re-query the full live stops list so the frontend can update local state immediately.
  const updatedRows = await db.tourStop.findMany({
    where: { tourId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true, orderIndex: true, name: true, address: true,
      lat: true, lng: true, durationMin: true, travelTimeMin: true,
      why: true, familyNote: true, imageUrl: true, websiteUrl: true,
    },
  });

  const allStops: UIStop[] = updatedRows.map(s => ({
    id: s.id,
    orderIndex: s.orderIndex,
    name: s.name,
    address: s.address ?? "",
    lat: s.lat ?? 0,
    lng: s.lng ?? 0,
    duration: s.durationMin ?? 0,
    travelTime: s.travelTimeMin ?? 0,
    why: s.why ?? "",
    familyNote: s.familyNote ?? "",
    imageUrl: s.imageUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
  }));

  console.log(`[add-stop] tourId=${tourId} category=${category} reason=ok place=${pickedPlace.name} allStopsCount=${allStops.length}`);
  return {
    ok: true,
    tourStop: { id: newStop.id, name: newStop.name, orderIndex: newStop.orderIndex },
    pickedPlace,
    allStops,
  };
}

// ─── Bathroom candidate resolver ───────────────────────────────────────────────

export async function resolveBathroomCandidate(opts: {
  tourId: string;
  userId: string;
}): Promise<BathroomCandidateResult> {
  const { tourId, userId } = opts;

  const familyProfileId = await resolveProfileId(userId);
  if (!familyProfileId) {
    console.log(`[bathroom-suggest] tourId=${tourId} error=no_profile`);
    return { error: "no_candidates" };
  }

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      familyProfileId: true,
      destinationCity: true,
      destinationCenterLat: true,
      destinationCenterLng: true,
      transport: true,
      inputGroup: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, lat: true, lng: true, orderIndex: true },
      },
    },
  });

  if (!tour || tour.familyProfileId !== familyProfileId) {
    console.log(`[bathroom-suggest] tourId=${tourId} error=not_found_or_wrong_owner`);
    return { error: "no_candidates" };
  }

  if (tour.stops.length === 0) {
    console.log(`[bathroom-suggest] tourId=${tourId} error=no_stops`);
    return { error: "no_candidates" };
  }

  const profile = await db.familyProfile.findUnique({
    where: { id: familyProfileId },
    select: {
      members: { select: { role: true, birthDate: true } },
    },
  });

  const kidsAgesStr = childrenAgesSummary(
    (profile?.members ?? []).map(m => ({ role: m.role as string, birthDate: m.birthDate }))
  );

  // Find the adjacent stop pair with the greatest haversine distance for midpoint biasing
  const validStops = tour.stops.filter(
    (s): s is typeof s & { lat: number; lng: number } => s.lat !== null && s.lng !== null
  );

  let priorStopId: string;
  let priorStopName: string;
  let nextStopName: string;
  let midpointLat: number;
  let midpointLng: number;

  if (validStops.length < 2) {
    const last = tour.stops[tour.stops.length - 1];
    priorStopId   = last.id;
    priorStopName = last.name;
    nextStopName  = "(end of tour)";
    midpointLat   = last.lat ?? (tour.destinationCenterLat ?? 0);
    midpointLng   = last.lng ?? (tour.destinationCenterLng ?? 0);
  } else {
    let maxDist = -1;
    let bestIdx = 0;
    for (let i = 0; i < validStops.length - 1; i++) {
      const dist = haversineKm(
        { lat: validStops[i].lat, lng: validStops[i].lng },
        { lat: validStops[i + 1].lat, lng: validStops[i + 1].lng }
      );
      if (dist > maxDist) { maxDist = dist; bestIdx = i; }
    }
    priorStopId   = validStops[bestIdx].id;
    priorStopName = validStops[bestIdx].name;
    nextStopName  = validStops[bestIdx + 1].name;
    midpointLat   = (validStops[bestIdx].lat + validStops[bestIdx + 1].lat) / 2;
    midpointLng   = (validStops[bestIdx].lng + validStops[bestIdx + 1].lng) / 2;
  }

  const transport = tour.transport ?? "Walking";

  const systemPrompt = `You are recommending ONE bathroom-friendly stop for a family currently on a guided tour in ${tour.destinationCity}.

Family context: ${kidsAgesStr}. Transport mode between stops: ${transport}.
They just visited "${priorStopName}" and are walking to "${nextStopName}". Suggest a venue between these two stops that has accessible public restrooms.

ACCEPTABLE VENUE TYPES (in priority order):
1. Hotels with public lobby restrooms — this is a common travel trick; major chains and well-known boutique hotels in tourist areas typically allow lobby restroom use.
2. Train stations and transit hubs.
3. Shopping malls and department stores.
4. Museums and tourist information centers.
5. Large fast-casual restaurants and coffee chains where a purchase is reasonable.
6. Large parks with public facilities.

RULES:
- The venue MUST be a real, named, locatable place in ${tour.destinationCity}. No generic "find a Starbucks." Name a specific one.
- Prefer venues genuinely between the two stops on a plausible walking route.
- durationMin: 10. familyNote: one sentence acknowledging this is a quick stop with a kid-friendly reason (e.g. "Clean lobby restrooms, and the lobby itself is fun to look at.").
- why: one sentence on why this venue specifically works for a bathroom break here.

Return ONLY a JSON object, no prose, no markdown:
{ "name": "...", "why": "...", "familyNote": "...", "durationMin": 10 }`;

  let aiName = "";
  let aiWhy = "";
  let aiFamilyNote = "";
  let aiDurationMin = 10;

  try {
    const anthropic = new Anthropic();
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: systemPrompt }],
    });
    const text = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { name?: string; why?: string; familyNote?: string; durationMin?: number };
    aiName        = parsed.name?.trim() ?? "";
    aiWhy         = parsed.why?.trim() ?? "";
    aiFamilyNote  = parsed.familyNote?.trim() ?? "";
    aiDurationMin = typeof parsed.durationMin === "number" ? parsed.durationMin : 10;
  } catch {
    console.log(`[bathroom-suggest] tourId=${tourId} error=claude_parse_failed`);
    return { error: "no_candidates" };
  }

  if (!aiName) {
    console.log(`[bathroom-suggest] tourId=${tourId} error=no_place_name`);
    return { error: "no_candidates" };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!gKey) {
    console.log(`[bathroom-suggest] tourId=${tourId} error=no_places_key`);
    return { error: "places_resolution_failed" };
  }

  type PlacesResult = {
    place_id: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
    types?: string[];
  };

  let firstResult: PlacesResult | null = null;
  try {
    const query = `${aiName} ${tour.destinationCity}`;
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${gKey}`
    );
    const searchData = await searchRes.json() as { results?: PlacesResult[] };
    firstResult = searchData.results?.[0] ?? null;
  } catch {
    console.log(`[bathroom-suggest] tourId=${tourId} place="${aiName}" error=places_fetch_failed`);
    return { error: "places_resolution_failed" };
  }

  if (!firstResult?.geometry?.location) {
    console.log(`[bathroom-suggest] tourId=${tourId} place="${aiName}" error=no_places_result`);
    return { error: "places_resolution_failed" };
  }

  const resolvedLat = firstResult.geometry.location.lat;
  const resolvedLng = firstResult.geometry.location.lng;

  // Fetch place details for city-guard address_components, photo, and website
  type AddressComponent = { long_name: string; short_name: string; types: string[] };
  let addressComponents: AddressComponent[] = [];
  let websiteUrl: string | null = null;
  let imageUrl: string | null = null;
  let resolvedAddress: string | null = firstResult.formatted_address ?? null;

  try {
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=address_components,formatted_address,website,photos&key=${gKey}`
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        address_components?: AddressComponent[];
        formatted_address?: string;
        website?: string;
        photos?: Array<{ photo_reference: string }>;
      };
    };
    addressComponents = detailsData.result?.address_components ?? [];
    resolvedAddress   = detailsData.result?.formatted_address ?? resolvedAddress;
    websiteUrl        = detailsData.result?.website ?? null;
    const photoRef    = detailsData.result?.photos?.[0]?.photo_reference ?? null;
    if (photoRef) {
      const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${gKey}`;
      imageUrl = await resolveGooglePhotoUrl(photoApiUrl);
    }
  } catch {
    // Details fetch is non-fatal; city guard falls through to distance guard
  }

  // City-match guard
  const cityNorm = tour.destinationCity.toLowerCase().split(",")[0].trim();
  const CITY_COMPONENT_TYPES = ["locality", "administrative_area_level_1", "postal_town", "sublocality"];
  const cityComponents = addressComponents.filter(c => c.types?.some(t => CITY_COMPONENT_TYPES.includes(t)));
  const cityMatch =
    cityComponents.length > 0 &&
    cityComponents.some(c => {
      const long  = (c.long_name ?? "").toLowerCase();
      const short = (c.short_name ?? "").toLowerCase();
      return (
        long.includes(cityNorm)  || short.includes(cityNorm) ||
        cityNorm.includes(long)  || cityNorm.includes(short)
      );
    });

  // Distance guard: result must be within 2km of the segment midpoint
  const distKm = haversineKm(
    { lat: resolvedLat, lng: resolvedLng },
    { lat: midpointLat, lng: midpointLng }
  );
  const distanceMatch = distKm <= 2;

  if (!cityMatch && !distanceMatch) {
    const componentNames = cityComponents.map(c => c.long_name).join(", ") || "none";
    console.log(`[bathroom-suggest] tourId=${tourId} place="${aiName}" REJECTED city=${componentNames} dist=${distKm.toFixed(1)}km`);
    return { error: "out_of_area" };
  }

  const candidate: PrefetchedCandidate = {
    name: aiName,
    address: resolvedAddress,
    lat: resolvedLat,
    lng: resolvedLng,
    durationMin: aiDurationMin,
    why: aiWhy || null,
    familyNote: aiFamilyNote || null,
    imageUrl,
    websiteUrl,
    placeId: firstResult.place_id,
    ticketRequired: "free",
    placeTypes: firstResult.types ?? [],
  };

  console.log(`[bathroom-suggest] tourId=${tourId} place="${aiName}" ACCEPTED insertAfterStopId=${priorStopId} dist=${distKm.toFixed(1)}km`);
  return { candidate, insertAfterStopId: priorStopId };
}
