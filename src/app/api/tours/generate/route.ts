import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { haversineMeters, haversineKm } from "@/lib/geo";
import { optimizeRouteOrder } from "@/lib/tour-route-optimization";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { resolveGooglePhotoUrl, PLACES_INFRA_STATUSES, PlacesInfraError } from "@/lib/google-places";
import { aggregateTripContext, flatChildAges, describePace, topInterests } from "@/lib/trip-context-multi";
import { DestinationType, Prisma } from "@prisma/client";
import { gradeTour, graderFlagsToInstruction, type GraderFamilyContext, type GraderGenerationInputs, type GraderStop } from "@/lib/tour-grader";
import { generatePublicWhyForStops } from "@/lib/generate-public-why";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

// Hard time budget — must stay well under Vercel's 120s maxDuration so the
// graceful-exit path (graderRanAt write + NextResponse) always wins the race.
const BUDGET_MS           = 95_000;
const RESERVE_WALK_RETRY  = 35_000;
const RESERVE_FILL_PASS   = 35_000;
const RESERVE_GRADE1      = 12_000;
const RESERVE_REGEN       = 55_000;

// Returns the id of the stop best matching the user's named start point.
// Tries case-insensitive name containment (either direction), falls back to [0]?.id.
function findStartPointId(startPoint: string, stops: Array<{ id: string; name: string | null }>): string | undefined {
  const norm = startPoint.toLowerCase().trim();
  const match = stops.find(s => {
    const sName = (s.name ?? "").toLowerCase();
    return sName.includes(norm) || norm.includes(sName);
  });
  return match?.id ?? stops[0]?.id;
}

async function resolveDestinationCanonical(destinationCity: string): Promise<{
  destinationPlaceId: string;
  destinationName: string;
  destinationStructured: Record<string, string>;
  destinationType: DestinationType;
} | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const acRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(destinationCity)}&types=(cities)&language=en&key=${GOOGLE_API_KEY}`
    );
    const acData = await acRes.json() as {
      status: string;
      predictions: Array<{
        place_id: string;
        description: string;
        structured_formatting: { main_text: string };
      }>;
    };
    if (PLACES_INFRA_STATUSES.has(acData.status)) {
      console.error(`[places] INFRA status=${acData.status} context=resolveDestinationCanonical input="${destinationCity}"`);
      return null;
    }
    if (acData.status !== "OK" || !acData.predictions?.length) return null;
    const top = acData.predictions[0];
    const placeId = top.place_id;
    const mainText = top.structured_formatting.main_text;

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,types&key=${GOOGLE_API_KEY}`
    );
    const detailData = await detailRes.json() as {
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        types?: string[];
      };
    };
    const components = detailData.result?.address_components ?? [];
    const placeTypes = detailData.result?.types ?? [];

    const locality = components.find(c => c.types.includes("locality"));
    const adminArea1 = components.find(c => c.types.includes("administrative_area_level_1"));
    const countryComp = components.find(c => c.types.includes("country"));

    const structured: Record<string, string> = {};
    if (locality) {
      structured.city = locality.long_name;
    } else if (!placeTypes.includes("administrative_area_level_1") && !placeTypes.includes("country")) {
      structured.island = mainText;
    }
    if (adminArea1) {
      structured.state = adminArea1.long_name;
      structured.stateShort = adminArea1.short_name;
    }
    if (countryComp) {
      structured.country = countryComp.long_name;
      structured.countryShort = countryComp.short_name;
    }

    let destinationType: DestinationType = DestinationType.CITY;
    if (placeTypes.includes("country")) destinationType = DestinationType.COUNTRY;
    else if (placeTypes.includes("administrative_area_level_1")) destinationType = DestinationType.STATE;
    else if (!locality) destinationType = DestinationType.ISLAND;

    return { destinationPlaceId: placeId, destinationName: top.description, destinationStructured: structured, destinationType };
  } catch (err) {
    console.error("[tours/generate] canonical resolution failed:", err);
    return null;
  }
}

interface RawStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
  themeRelevance: string;
}

function hasWeakThemeRelevance(text: string | undefined | null): boolean {
  if (!text) return true;
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 30) return true;
  const vaguePhrases = [
    "provides atmosphere",
    "adds variety",
    "complements the theme",
    "scenic addition",
    "adjacent to the theme",
    "nearby attraction",
    "adds charm",
    "enhances the experience",
  ];
  return vaguePhrases.some(p => trimmed.includes(p));
}

function scrubEmDash(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  return s.replace(/—/g, ", ").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
}

type ResolvedStop = RawStop & { imageUrl: string | null; websiteUrl: string | null; placeId: string | null; ticketRequired: string | null; placeTypes: string[]; businessStatus: string | null };

function deriveTicketSignal(
  types: string[],
  priceLevel: number | undefined,
  editorialSummary: string | undefined
): string {
  const FREE_TYPES = ["park", "natural_feature", "neighborhood", "route", "political", "locality", "sublocality", "church", "place_of_worship"];
  const TICKET_TYPES = ["museum", "art_gallery", "aquarium", "zoo", "amusement_park", "tourist_attraction", "stadium", "bowling_alley", "movie_theater", "theme_park"];
  const ADVANCE_TYPES = ["amusement_park", "zoo", "aquarium", "theme_park"];

  if (ADVANCE_TYPES.some(t => types.includes(t))) return "advance-booking-recommended";
  if (TICKET_TYPES.some(t => types.includes(t))) {
    if (priceLevel !== undefined && priceLevel === 0) return "free";
    return "ticket-required";
  }
  if (FREE_TYPES.some(t => types.includes(t))) return "free";
  const summary = (editorialSummary ?? "").toLowerCase();
  if (summary.includes("free admission") || summary.includes("no admission")) return "free";
  if (summary.includes("admission") || summary.includes("ticket")) return "ticket-required";
  return "unknown";
}

function ageFromBirthDate(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function maxWalkMinutes(youngestChildAge: number | null): number {
  if (youngestChildAge === null) return 15;
  if (youngestChildAge < 5) return 6;
  if (youngestChildAge <= 10) return 10;
  return 15;
}

function getMaxStopRadiusKm(transport: string): number {
  const t = transport.toLowerCase();
  if (t === "walking") return 8;
  if (t.includes("transit") || t.includes("metro")) return 25;
  if (t.includes("car") || t.includes("driving")) return 50;
  return 15;
}

async function getDestinationCenter(destinationCity: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(destinationCity)}&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json() as { status?: string; results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };
    if (PLACES_INFRA_STATUSES.has(data.status ?? "")) {
      console.error(`[places] INFRA status=${data.status} context=getDestinationCenter city="${destinationCity}"`);
      return null;
    }
    const loc = data.results?.[0]?.geometry?.location;
    if (!loc) { console.log(`[tour-resolve] geocode failed: ${destinationCity} no results`); return null; }
    console.log(`[tour-resolve] geocode ${destinationCity} → ${loc.lat},${loc.lng}`);
    return { lat: loc.lat, lng: loc.lng };
  } catch (e) {
    console.log(`[tour-resolve] geocode failed: ${destinationCity} ${String(e)}`);
    return null;
  }
}

// English→local name aliases for cities where the English name doesn't match
// the local name returned by Google Places address_components.
const CITY_ALIASES: Record<string, string[]> = {
  lisbon: ["lisboa"],
  rome: ["roma"],
  athens: ["athina", "athína"],
  naples: ["napoli"],
  florence: ["firenze"],
  venice: ["venezia"],
  milan: ["milano"],
  cologne: ["köln", "koln"],
  munich: ["münchen", "munchen"],
  vienna: ["wien"],
  warsaw: ["warszawa"],
  prague: ["praha"],
  brussels: ["bruxelles", "brussel"],
  "new york city": ["new york"],
  "new york": ["new york city"],
  bangkok: ["krung thep", "กรุงเทพ"],
};

async function resolveAgainstPlaces(stop: RawStop, destinationCity: string, transport: string, destinationCenter: { lat: number; lng: number } | null): Promise<ResolvedStop | null> {
  try {
    const cityNorm = destinationCity.toLowerCase().split(",")[0].trim();
    const query = encodeURIComponent(`${stop.name} ${stop.address || ""} ${destinationCity}`);
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as {
      status?: string;
      results?: Array<{ place_id: string; geometry?: { location?: { lat: number; lng: number } } }>;
    };
    if (PLACES_INFRA_STATUSES.has(searchData.status ?? "")) {
      throw new PlacesInfraError(searchData.status ?? "UNKNOWN_ERROR", `resolveAgainstPlaces:textsearch name="${stop.name}"`);
    }

    const firstResult = searchData.results?.[0];
    if (!firstResult?.geometry?.location) {
      console.log(`[tour-resolve] NO RESULT "${stop.name}"`);
      return null;
    }

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=name,formatted_address,geometry,photos,address_components,website,types,price_level,editorial_summary,business_status&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      status?: string;
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        photos?: Array<{ photo_reference: string }>;
        website?: string;
        types?: string[];
        price_level?: number;
        editorial_summary?: { overview?: string };
        business_status?: string;
      };
    };
    if (PLACES_INFRA_STATUSES.has(detailsData.status ?? "")) {
      throw new PlacesInfraError(detailsData.status ?? "UNKNOWN_ERROR", `resolveAgainstPlaces:details placeId="${firstResult.place_id}"`);
    }

    const components = detailsData.result?.address_components ?? [];

    // Walking stays strict: only match locality-level components to prevent
    // e.g. a Tokyo walking tour accepting venues in neighboring prefectures.
    // Driving and Transit also accept county/borough (admin_area_level_2) so
    // regional destinations like "Sonoma" match wine-country venues in Sonoma County.
    const STRICT_TYPES = ["locality", "postal_town", "sublocality", "administrative_area_level_1"];
    const PERMISSIVE_TYPES = [
      ...STRICT_TYPES,
      "administrative_area_level_2",
    ];
    const isStrictMode = transport === "Walking";
    const allowedTypes = isStrictMode ? STRICT_TYPES : PERMISSIVE_TYPES;

    const cityComponents = components.filter(c =>
      c.types?.some((t: string) => allowedTypes.includes(t))
    );
    const cityAliases = CITY_ALIASES[cityNorm] ?? [];
    const cityMatch = cityComponents.some(c => {
      const long = (c.long_name ?? "").toLowerCase();
      const short = (c.short_name ?? "").toLowerCase();
      // Strip "County" suffix so "Sonoma County" matches cityNorm "sonoma".
      const longNorm = long.replace(/\s+county$/i, "").trim();
      const shortNorm = short.replace(/\s+county$/i, "").trim();
      // Bidirectional check: component includes cityNorm OR cityNorm includes component.
      // The second direction catches "new york city" containing "new york".
      const directMatch = long.includes(cityNorm) || short.includes(cityNorm) ||
             longNorm.includes(cityNorm) || shortNorm.includes(cityNorm) ||
             cityNorm.includes(longNorm) || cityNorm.includes(shortNorm);
      if (directMatch) return true;
      // Alias check: for cities with different English vs local names (Rome/Roma, Lisbon/Lisboa).
      return cityAliases.some(alias =>
        long.includes(alias) || short.includes(alias) ||
        longNorm.includes(alias) || shortNorm.includes(alias)
      );
    });
    const venueLocation = firstResult.geometry.location;
    let distanceMatch = false;
    let distKm: number | null = null;
    if (destinationCenter && venueLocation) {
      distKm = haversineKm(destinationCenter, venueLocation);
      distanceMatch = distKm <= getMaxStopRadiusKm(transport);
    }

    if (!cityMatch && !distanceMatch) {
      const componentList = cityComponents.map(c => c.long_name).join(", ") || "none";
      const distInfo = distKm !== null ? `distance ${distKm.toFixed(1)}km > ${getMaxStopRadiusKm(transport)}km` : "no distance data";
      console.log(`[tour-resolve] REJECTED "${stop.name}" — city ${componentList}, ${distInfo} (mode: ${transport})`);
      return null;
    }
    const acceptedVia = cityMatch ? "cityName" : `distance ${distKm!.toFixed(1)}km`;
    console.log(`[tour-resolve] ACCEPTED "${stop.name}" via ${acceptedVia}`);

    const photoRef = detailsData.result?.photos?.[0]?.photo_reference;
    let imageUrl: string | null = null;
    if (photoRef) {
      const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      imageUrl = await resolveGooglePhotoUrl(photoApiUrl);
    }

    const { lat, lng } = firstResult.geometry.location;
    const websiteUrl = detailsData.result?.website
      ?? `https://www.google.com/maps/place/?q=place_id:${firstResult.place_id}`;
    const placeTypes = detailsData.result?.types ?? [];
    const priceLevel = detailsData.result?.price_level;
    const editorialSummary = detailsData.result?.editorial_summary?.overview;
    const businessStatus = detailsData.result?.business_status ?? null;
    const ticketRequired = deriveTicketSignal(placeTypes, priceLevel, editorialSummary);
    console.log(`[tour-resolve] OK "${stop.name}" -> ${lat},${lng}${imageUrl ? " [photo]" : ""} ticket=${ticketRequired} status=${businessStatus ?? "unknown"}`);
    return { ...stop, lat, lng, imageUrl, websiteUrl, placeId: firstResult.place_id, ticketRequired, placeTypes, businessStatus };
  } catch (e) {
    if (e instanceof PlacesInfraError) throw e;
    console.error("[tour-resolve] error:", stop.name, e);
    if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) return { ...stop, imageUrl: null, websiteUrl: resolveCanonicalUrl({ name: stop.name, city: destinationCity }), placeId: null, ticketRequired: null, placeTypes: [], businessStatus: null };
    return null;
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    prompt: string;
    destinationCity: string;
    familyProfileId?: string;
    durationLabel?: string;
    transport?: string;
    tripId?: string;
    inputStartPoint?: string;
    inputGroup?: string;
    inputVibe?: string[];
    inputDurationHr?: number;
  };
  const { prompt, destinationCity } = body;
  const durationLabel = body.durationLabel ?? "";
  const transport = body.transport ?? "Walking";
  const tripId = body.tripId ?? null;
  const inputStartPoint = body.inputStartPoint?.trim() || null;
  const inputGroup = body.inputGroup ?? "family_kids";
  const inputVibe: string[] = body.inputVibe ?? [];
  const inputDurationHr = body.inputDurationHr ?? null;

  const GROUP_LABELS: Record<string, string> = {
    adults_only: "Adults only — NO children present",
    family_kids: "Family with children",
    solo: "Solo traveler",
    couple: "Two adults (couple)",
    friends: "Group of adult friends",
  };
  const inputGroupLabel = GROUP_LABELS[inputGroup] ?? "Group of travelers";
  const isNoChildren = ["adults_only", "solo", "couple", "friends"].includes(inputGroup);
  const vibeLabel = inputVibe.length > 0 ? inputVibe.map(v => v.replace(/_/g, " ")).join(", ") : "(no specific vibe)";

  if (!prompt || !destinationCity) {
    return NextResponse.json({ error: "prompt and destinationCity are required" }, { status: 400 });
  }

  let maxMinutes: number;
  let targetStops: number;
  if (durationLabel === "1 hour") {
    maxMinutes = 60;
    targetStops = 2;
  } else if (durationLabel === "2 hours") {
    maxMinutes = 120;
    targetStops = 3;
  } else if (durationLabel === "3 hours") {
    maxMinutes = 180;
    targetStops = 4;
  } else if (durationLabel === "Full day (8 hrs)") {
    maxMinutes = 480;
    targetStops = inputGroup === "family_kids" ? 6 : 8;
  } else {
    // "Half day (4 hrs)" or unrecognised — default 4 hrs
    maxMinutes = 240;
    targetStops = 6;
  }

  let tourId: string | undefined;
  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ error: "Family profile required to generate tours" }, { status: 400 });
    }

    // When a tripId is provided, aggregate context across all collaborator families.
    // When generating a standalone tour (no tripId), fall back to single-profile context.
    let familyContext = "";
    let youngestChildAge: number | null = null;
    let childAgesContext = "ages not specified";
    let childNames: string[] = [];

    // Grader context — structured version of what the generator actually receives
    let graderAges: number[] = [];
    let graderDietary: string[] = [];
    let graderFoodAllergies: string[] = [];
    let graderPaceStr: string | null = null;
    let graderStyleStr: string | null = null;
    let graderInterestKeys: string[] = [];

    if (tripId) {
      const aggCtx = await aggregateTripContext(tripId);
      const allChildAges = flatChildAges(aggCtx);
      if (allChildAges.length > 0) {
        youngestChildAge = Math.min(...allChildAges);
        childAgesContext = `children aged ${allChildAges.join(", ")}`;
      }
      const parts: string[] = [];
      if (aggCtx.isMultiFamily) {
        parts.push(`Multiple families: ${aggCtx.contributingFamilies.map(f => f.familyName ?? "Family").join(", ")}`);
      }
      if (aggCtx.styleCues.length > 0) parts.push(`Travel style: ${aggCtx.styleCues.join(", ")}`);
      const pace = describePace(aggCtx);
      if (pace) parts.push(`Pace: ${pace}`);
      const interests = topInterests(aggCtx, 8);
      if (interests.length > 0) parts.push(`Interests: ${interests.join(", ")}`);
      if (aggCtx.dietaryRestrictions.length > 0) parts.push(`Dietary (must accommodate ALL families): ${aggCtx.dietaryRestrictions.join(", ")}`);
      familyContext = parts.join(". ");

      graderAges = allChildAges;
      graderDietary = aggCtx.dietaryRestrictions;
      graderInterestKeys = interests;
      graderPaceStr = pace || null;
      graderStyleStr = aggCtx.styleCues.length > 0 ? aggCtx.styleCues.join(", ") : null;
    } else {
      const profile = await db.familyProfile.findUnique({
        where: { id: profileId },
        include: {
          members: { select: { name: true, role: true, dietaryRequirements: true, foodAllergies: true, birthDate: true } },
          interests: { select: { interestKey: true } },
        },
      });

      if (profile) {
        const childAges: number[] = [];
        const memberList = profile.members
          .map(m => {
            const age = ageFromBirthDate(m.birthDate);
            if (m.role === "CHILD") {
              if (age !== null) childAges.push(age);
              if (m.name) childNames.push(m.name);
              return m.name ?? "Child";
            }
            return m.name ?? "Adult";
          })
          .join(", ");

        if (childAges.length > 0) {
          youngestChildAge = Math.min(...childAges);
          childAgesContext = `children aged ${childAges.join(", ")}`;
        }

        const interestList = profile.interests.map(i => i.interestKey).join(", ");
        const allDietary = [...new Set(profile.members.flatMap(m => m.dietaryRequirements as string[]))];
        const allAllergies = [...new Set(profile.members.flatMap(m => m.foodAllergies as string[]))];
        const parts: string[] = [];
        if (memberList) parts.push(`Family: ${memberList}`);
        if (profile.travelStyle) parts.push(`Travel style: ${profile.travelStyle}`);
        if (profile.pace) parts.push(`Pace: ${profile.pace}`);
        if (interestList) parts.push(`Interests: ${interestList}`);
        if (allDietary.length > 0) parts.push(`Dietary notes: ${allDietary.join(", ")}`);
        if (allAllergies.length > 0) parts.push(`Food allergies (hard constraint, never include conflicting venues): ${allAllergies.join(", ")}`);
        familyContext = parts.join(". ");

        graderAges = childAges;
        graderDietary = allDietary;
        graderFoodAllergies = allAllergies;
        graderInterestKeys = profile.interests.map(i => i.interestKey);
        graderPaceStr = profile.pace ?? null;
        graderStyleStr = profile.travelStyle ?? null;
      }
    }

    if (isNoChildren) {
      familyContext = "";
      youngestChildAge = null;
      graderAges = [];
      graderDietary = [];
      graderFoodAllergies = [];
      graderPaceStr = null;
      graderStyleStr = null;
      graderInterestKeys = [];
    }

    // businessStatusMap: populated during stop resolution so the grader can check CLOSED_VENUE
    const businessStatusMap = new Map<string, string | null>();

    const maxWalk = maxWalkMinutes(youngestChildAge);
    const maxDistMeters = maxWalk * 80;

    // ── Hotel anchor lookup ───────────────────────────────────────────────────
    let anchorLat: number | null = null;
    let anchorLng: number | null = null;
    if (tripId) {
      const lodging = await db.itineraryItem.findFirst({
        where: {
          tripId,
          type: "LODGING",
          title: { startsWith: "Check-in:", mode: "insensitive" },
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { scheduledDate: "asc" },
        select: { latitude: true, longitude: true },
      });
      if (lodging?.latitude && lodging.longitude) {
        anchorLat = lodging.latitude;
        anchorLng = lodging.longitude;
        console.log(`[tour-anchor] using lodging anchor ${anchorLat},${anchorLng} for trip ${tripId}`);
      }
    }

    const cityPattern = `%${destinationCity}%`;
    const [manualActivityRows, itineraryItemRows] = await Promise.all([
      db.$queryRaw<Array<{ id: string; title: string; address: string | null; lat: number | null; lng: number | null; imageUrl: string | null; avg_rating: number }>>`
        SELECT ma.id, ma.title, ma.address, ma.lat, ma.lng, ma."imageUrl", AVG(pr.rating)::float AS avg_rating
        FROM "ManualActivity" ma
        INNER JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE ma.city ILIKE ${cityPattern}
        GROUP BY ma.id, ma.title, ma.address, ma.lat, ma.lng, ma."imageUrl"
        ORDER BY avg_rating DESC
        LIMIT 20
      `,
      db.$queryRaw<Array<{ title: string; address: string | null; latitude: number | null; longitude: number | null; avg_rating: number }>>`
        SELECT ii.title, ii.address, ii.latitude, ii.longitude, AVG(pr.rating)::float AS avg_rating
        FROM "ItineraryItem" ii
        INNER JOIN "PlaceRating" pr ON pr."itineraryItemId" = ii.id
        WHERE ii."toCity" ILIKE ${cityPattern}
        GROUP BY ii.id, ii.title, ii.address, ii.latitude, ii.longitude
        ORDER BY avg_rating DESC
        LIMIT 10
      `,
    ]);

    const seededPlaces = [
      ...manualActivityRows.map(r => ({ name: r.title, address: r.address ?? "", lat: r.lat ?? 0, lng: r.lng ?? 0, avgRating: r.avg_rating })),
      ...itineraryItemRows.map(r => ({ name: r.title, address: r.address ?? "", lat: r.latitude ?? 0, lng: r.longitude ?? 0, avgRating: r.avg_rating })),
    ];

    const seededContext = seededPlaces.length > 0
      ? `Community-rated places in ${destinationCity} from real families (use these first when relevant):\n${seededPlaces.map(p => `${p.name} — ${p.address} (rated ${p.avgRating.toFixed(1)}/5)`).join("\n")}\n\n`
      : "";

    tourId = crypto.randomUUID();
    const tourTitle = prompt.trim().length <= 10
      ? `${destinationCity} tour`
      : prompt.trim().slice(0, 60);
    await db.generatedTour.create({
      data: {
        id: tourId,
        title: tourTitle,
        destinationCity,
        destinationCountry: null,
        prompt,
        durationLabel,
        transport,
        familyProfileId: profileId,
        categoryTags: [],
        originalTargetStops: targetStops,
        inputGroup,
        inputVibe,
        inputDurationHr,
        inputStartPoint,
      },
    });

    // Resolve canonical destination fields server-side. Non-blocking — tour generation
    // proceeds regardless of success or failure. Populates destinationPlaceId,
    // destinationName, destinationStructured for deduped pill display in Your Tours.
    try {
      const canonical = await resolveDestinationCanonical(destinationCity);
      if (canonical) {
        await db.generatedTour.update({
          where: { id: tourId },
          data: {
            destinationPlaceId: canonical.destinationPlaceId,
            destinationName: canonical.destinationName,
            destinationStructured: canonical.destinationStructured,
            destinationType: canonical.destinationType,
          },
        });
      }
    } catch (err) {
      console.error("[tours/generate] canonical persist failed, proceeding:", err);
    }

    const destinationCenter = await getDestinationCenter(destinationCity);
    if (!destinationCenter) {
      console.log(`[tour-resolve] no destination center for ${destinationCity}; cityName-match only`);
    }

    // ── Group framing helpers (A6) ────────────────────────────────────────────
    const GROUP_FRAMING: Record<string, string> = {
      adults_only: '"the group", "you all", or "adults-only" framing. No child references.',
      family_kids: `"with the kids" or "family-friendly". Use children's first names when context provides them, otherwise "the kids".`,
      solo: '"you" throughout — "a solo walk", "on your own". Never refer to a group or companion.',
      couple: '"the two of you", "a couple", "for couples". Never refer to solo or large group.',
      friends: '"the group", "with friends". No solo or couple framing.',
    };

    const vibeInterpretationRules = (() => {
      const rules: string[] = [];
      const vibeStopFloor = Math.max(1, Math.round(targetStops * 0.4));
      if (inputVibe.includes("parks_play")) rules.push(`"parks_play" vibe: MINIMUM ${vibeStopFloor} stops must be parks, playgrounds, green spaces, outdoor activity zones, or climbing structures. These are the spine of the tour. Non-negotiable.`);
      if (inputVibe.includes("sweets")) rules.push(`"sweets" vibe: MINIMUM ${vibeStopFloor} stops must be dedicated sweets venues — bakeries, gelato, candy stores, chocolatiers, dessert cafes, pastry shops. Sweets IS the theme. Other stops complement; sweets dominate.`);
      if (inputVibe.includes("animals")) rules.push(`"animals" vibe: MINIMUM ${Math.min(vibeStopFloor, 3)} stops must be animal-focused — zoos, aquariums, wildlife sanctuaries, urban farms, butterfly gardens, insect museums, animal encounters. Mandatory, not optional.`);
      if (inputVibe.includes("food_markets")) rules.push(`"food_markets" vibe: MINIMUM ${vibeStopFloor} stops must be food markets, street food stalls, culinary halls, or food-focused venues.`);
      if (inputVibe.includes("culture")) rules.push(`"culture" vibe: MINIMUM ${vibeStopFloor} stops must be cultural venues — museums, galleries, historic sites, temples, palaces, heritage districts.`);
      if (inputVibe.includes("nature")) rules.push(`"nature" vibe: MINIMUM ${vibeStopFloor} stops must be outdoor/nature venues — parks, gardens, viewpoints, rivers, nature trails, botanical gardens.`);
      if (inputVibe.length >= 2 && !inputVibe.includes("surprise") && !inputVibe.includes("blend")) {
        const perVibe = Math.max(1, Math.floor(targetStops / inputVibe.length));
        rules.push(`MULTIPLE VIBES (${inputVibe.length} selected): Distribute stops roughly evenly — at least ${perVibe} stop(s) per vibe. Do not over-index on one and ignore others.`);
      }
      return rules.length > 0 ? `\nVIBE EMPHASIS:\n${rules.join("\n")}` : "";
    })();

    const whyDescription = isNoChildren
      ? inputGroup === "solo"
        ? 'One sentence on why this stop fits the theme. Use "you" framing throughout — "You\'ll love…", "Perfect for your solo afternoon."'
        : inputGroup === "couple"
          ? 'One sentence on why this stop fits the theme. Use "the two of you" framing — "A perfect spot for the two of you to…"'
          : inputGroup === "friends"
            ? 'One sentence on why this stop fits the theme. Use "the group" or "your crew" framing.'
            : 'One sentence on why this stop fits the theme. Reference the group naturally with adults-only framing.'
      : 'One sentence on why this stop fits the theme. Lead with what the KIDS will enjoy — kids are the primary audience, parents are secondary. E.g.: "The kids will love the castle ruins while adults take in the views." NOT: "Adults can sit while kids explore."';

    const familyNoteDescription = isNoChildren
      ? inputGroup === "solo"
        ? 'What makes this stop great for a solo traveler. Use "you" framing.'
        : inputGroup === "couple"
          ? 'What makes this stop special for a couple.'
          : inputGroup === "friends"
            ? 'What makes this stop fun for a group of adult friends.'
            : 'What makes this stop great for this adults-only group.'
      : `Specific note tailored to the group: ${childAgesContext}. What will the children experience or enjoy here? If this stop has public bathrooms, say so explicitly (e.g. "Clean public restrooms available on the lower level.").`;

    const emitTourMetadataTool: Anthropic.Tool = {
      name: "emit_tour_metadata",
      description: "Emit the title and subtitle for this tour. Call this ONCE.",
      input_schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Vivid, specific 4-8 word tour title. Not the city name alone, not generic. Examples: 'Hidden Lanes and Night Markets', 'Temple Hopping by Metro', 'Ramen Alleys of Shinjuku'.",
          },
          subtitle: {
            type: "string",
            description: "One sentence (15-25 words) that sets the mood and tells the traveler what makes this tour special. Specific to the theme, destination, and group. Do NOT name specific venues. Do NOT write 'kicks off at X' or 'starts the day at X' — the starting stop is chosen after this step.",
          },
        },
        required: ["title", "subtitle"],
      },
    };

    const emitTourStopTool: Anthropic.Tool = {
      name: "emit_tour_stop",
      description: `Emit one stop for the tour. Call this tool exactly ${targetStops} times, once per stop, in order.`,
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "ONE specific venue name only. Never use '/' between alternatives or list two options. If uncertain which venue to pick, choose one and commit." },
          address: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          duration: { type: "number", description: "Minutes at this stop" },
          travelTime: { type: "number", description: "Minutes to travel to the NEXT stop, 0 for the last stop" },
          why: { type: "string", description: whyDescription },
          familyNote: { type: "string", description: familyNoteDescription },
          themeRelevance: { type: "string", description: `Specific justification for why this exact venue directly serves the theme "${prompt}". Name what happens at this venue that fits the theme. Avoid vague phrases like "provides atmosphere", "complements", or "adds variety". If you cannot justify the stop concretely, choose a different venue.` },
        },
        required: ["name", "address", "lat", "lng", "duration", "travelTime", "why", "familyNote", "themeRelevance"],
      },
    };

    // ── Anchor instruction (injected into system prompt when trip context exists) ──
    const anchorInstruction = anchorLat !== null && anchorLng !== null
      ? `\n\nThe user's lodging is at coordinates ${anchorLat}, ${anchorLng}. The tour must be anchored near this location:\n- Walking: first stop within 1km of lodging, last stop within 1km of lodging (round-trip from base)\n- Metro / Transit: first stop within 1.5km of lodging or a transit station within 800m of lodging\n- Driving: first stop within 5km of lodging, last stop within 5km of lodging`
      : "";

    const startingPointInstruction = inputStartPoint
      ? `\n\nSTARTING POINT: "${inputStartPoint}"
THIS IS STOP 1. The user expects to begin here.
- If "${inputStartPoint}" is a specific named venue, use it verbatim as Stop 1.
- If "${inputStartPoint}" is a broader area or landmark (e.g. "Times Square", "Tuileries", "Downtown"), choose the most iconic specific venue AT that location as Stop 1 (e.g. "Times Square" → "TKTS Booth at Father Duffy Square"; "Tuileries" → "Jardin des Tuileries main entrance"). DO NOT silently skip or move past the starting point.`
      : "";

    const familyNoteRule = isNoChildren
      ? `5. In the why field, use correct group framing (see GROUP FRAMING below). Do not mention children.`
      : `5. familyNote MUST reference the specific children: ${childAgesContext}. Tailor to their ages.
6. In the why field, lead with what the KIDS will enjoy — kids are the primary audience, parents are secondary. Good: "The kids will love the castle ruins while adults take in the views." Bad: "Adults can relax while kids play."`;

    const themeTermsRule = `THEME BALANCE: if the theme contains multiple terms joined by "and", "with", "plus", or similar connectors, the stop mix MUST cover each term with at least one stop. Do not over-index on one term and drop another. "parks and treats" → ≥1 park AND ≥1 sweets/treat stop; "museums and cafes" → ≥1 museum AND ≥1 cafe.`;

    const kidsSweetsRule = isNoChildren ? "" : targetStops <= 2
      ? `KIDS SWEETS + BATHROOMS (short tour, ${targetStops} stops): One of your ${targetStops} stops MUST be a café, dessert spot, or restaurant that serves treats AND has clean restrooms. Combine both requirements in one stop. Non-negotiable — reserve this slot FIRST.`
      : `KIDS SWEETS: ≥1 gelato, ice cream, pastry, or sweets stop MUST appear in your INITIAL generation. Reserve this slot BEFORE selecting other stops. Non-negotiable — cannot be deferred to expansion passes.`;

    const kidsBathroomRule = isNoChildren || targetStops <= 2 ? "" : `KIDS BATHROOMS: ≥1 stop with reliable public bathrooms (museum, large park with facilities, shopping mall, transit hub, or fast-casual restaurant) MUST appear in your INITIAL generation. Do NOT defer this. The familyNote on that exact stop MUST explicitly mention bathroom availability — use a phrase like "Clean public restrooms available", "Public bathrooms on site", or "Restroom facilities available here". A stop without this exact note does NOT count as the bathroom stop.`;

    const mealCadenceRule = `MEAL CADENCE (MANDATORY when applicable):
- If the tour's total scheduled duration spans the lunch window (11:30-14:00) OR the dinner window (17:30-19:30), you MUST include at least one full meal stop in the tour.
- A "meal stop" is a sit-down restaurant or substantial quick-service venue, duration 30-60 minutes. Sweet shops, dessert venues, snack stops, ice cream stands, beverage-only cafes, and bakery-only stops do NOT count as a meal.
- Position the meal stop near the meal time itself: lunch stop should land around 12:00-13:00, dinner stop around 18:00-19:00. The meal stop must NOT be the first or last stop of the tour.
- When the family includes children, strongly prefer kid-friendly venues (counter-style seating, casual atmosphere, kids menu when available).
- Respect the family's stated dietary requirements and food allergies from the family context block above. These are HARD CONSTRAINTS, not preferences. A peanut-allergic family near a peanut-sauce-heavy cuisine: pick a different venue.
- If the tour duration does not span either meal window (e.g. a 2-hour morning tour ending at 11am), do NOT force a meal stop just to have one.`;

    const groupFramingRule = `GROUP FRAMING: This tour is for ${inputGroupLabel}. Use ${GROUP_FRAMING[inputGroup] ?? '"the group"'} in every why and familyNote field. Never default to "adults-only" for a solo tour, or use group language for a solo traveler.`;

    const emDashRule = `COPY RULE — NO EM DASHES: Never use em dashes (—) anywhere in any output field. Replace with a comma, period, or parentheses. BAD: "Time Out Market — a legendary food hall." GOOD: "Time Out Market. A legendary food hall." or "Time Out Market (a legendary food hall)."`;

    const nameRules = isNoChildren ? "" : `NAME FORMAT: Use family member first names only in output. Never write ages in parentheses, brackets, or after the name in any form. Ages are context for you to calibrate appropriateness — not text to quote back. GOOD: "Beau and Miles will love this." BAD: "Beau (10) and Miles (8) will love this."
NAME CONSISTENCY: If you use specific names in any stop, use those same names throughout ALL stops. Do not switch between first names and generic descriptions ("the 10-year-old", "the kids") mid-tour.`;

    const soloContextRule = inputGroup === "solo"
      ? `\nSOLO NOTE: This is a personal solo trip for one adult taking time away from others. Use "you" framing exclusively throughout all why and familyNote fields. Zero references to companions, family members, group, or anyone's names.`
      : "";

    const stopCountRule = `STOP COUNT: You MUST call emit_tour_stop exactly ${targetStops} times. Not ${targetStops - 1}, not fewer. If a stop is hard to find, substitute the nearest similar venue. Ending with fewer stops than required means the tour fails.`;

    const namedPlaceRule = `NAMED-PLACE RULE: If the tour theme mentions any specific place, attraction, neighborhood, park, market, or venue by name (e.g. "Central Park", "Shinjuku", "the Louvre", "Tsukiji Market"), that exact named place MUST appear as a stop. It is a hard requirement — do not substitute a "similar" alternative.`;

    const systemPrompt = `You are a travel expert building themed day tours. Call emit_tour_stop exactly ${targetStops} times — once per stop, in order.

ABSOLUTE RULES — violating any of these means the tour fails:
1. Every stop MUST be a real, operating venue physically located IN ${destinationCity}. No venues from other cities. No "branch" workarounds. No closed or fictional places.
2. Every stop MUST directly serve the theme. No tangential sightseeing added for variety.
3. ${transport === "Walking" ? `Walking tour: every consecutive stop pair MUST be within ${maxWalk} minutes walk (~${maxDistMeters}m) of each other. Cluster tightly in one neighborhood.` : transport === "Metro / Transit" ? "Metro tour: stops can span the city but must be reachable by public transit." : "Car tour: no distance constraint."}
4. Total time (sum of all duration + travelTime) must not exceed ${maxMinutes} minutes.
${familyNoteRule}

${stopCountRule}
${namedPlaceRule}
${emDashRule}
${themeTermsRule}
${kidsSweetsRule ? kidsSweetsRule + "\n" : ""}${kidsBathroomRule ? kidsBathroomRule + "\n" : ""}${mealCadenceRule ? mealCadenceRule + "\n" : ""}${nameRules ? nameRules + "\n" : ""}${groupFramingRule}${soloContextRule}${vibeInterpretationRules}${startingPointInstruction}${anchorInstruction}`;

    const userMessage = [
      seededContext || null,
      `Tour theme: ${prompt}`,
      `Destination: ${destinationCity}`,
      `Duration: ${durationLabel || "Half day (4 hrs)"}`,
      `Transport: ${transport}`,
      `Group: ${inputGroupLabel}`,
      inputVibe.length > 0 ? `Vibe: ${vibeLabel}` : null,
      inputStartPoint ? `Starting point: ${inputStartPoint}` : null,
      familyContext ? `Traveler context: ${familyContext}` : null,
    ].filter(Boolean).join("\n");

    // ── Pre-stream: emit_tour_metadata (title + subtitle) ─────────────────────
    let tourGeneratedTitle: string | null = null;
    let tourGeneratedSubtitle: string | null = null;
    const tMetaStart = Date.now();
    console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=metadata_start total_elapsed_ms=${tMetaStart - t0}`);
    try {
      const metadataResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: `You are naming a themed day tour. Generate a vivid, specific title and subtitle. Call emit_tour_metadata exactly once.\nGroup framing: ${GROUP_FRAMING[inputGroup] ?? "natural group language"}. Match this in the subtitle — solo tours say "solo" or "for one", couples say "the two of you", family tours say "with the kids", etc. Never mislabel the group type.\nSubtitle rules: describe theme, mood, and group experience. Do NOT name specific venues. Do NOT write "kicks off at X" or "starts the day at X" — the starting stop is chosen after this step.\nGrammar: use "an" before vowel sounds (e.g., "an adults-only walk"), "a" before consonant sounds.${childNames.length > 0 ? `\nNAME CONSISTENCY: The family's children are named: ${childNames.join(", ")}. If the subtitle references children by name, use exactly these names. Do not use generic terms like "the kids" if you choose to name them.` : ""}\n${emDashRule}`,
        tools: [emitTourMetadataTool],
        tool_choice: { type: "tool", name: "emit_tour_metadata" },
        messages: [{ role: "user", content: userMessage }],
      });
      const metaTool = metadataResponse.content.find(
        b => b.type === "tool_use" && b.name === "emit_tour_metadata"
      );
      if (metaTool && metaTool.type === "tool_use") {
        const meta = metaTool.input as { title: string; subtitle: string };
        tourGeneratedTitle = scrubEmDash(meta.title?.trim() || null);
        tourGeneratedSubtitle = scrubEmDash(meta.subtitle?.trim() || null);
      }
      if (tourGeneratedTitle || tourGeneratedSubtitle) {
        await db.generatedTour.update({
          where: { id: tourId },
          data: {
            ...(tourGeneratedTitle ? { title: tourGeneratedTitle } : {}),
            ...(tourGeneratedSubtitle ? { subtitle: tourGeneratedSubtitle } : {}),
          },
        });
        console.log(`[tour-metadata] title="${tourGeneratedTitle}" subtitle="${tourGeneratedSubtitle?.slice(0, 60)}"`);
      }
    } catch (err) {
      console.error("[tour-metadata] failed, proceeding without metadata:", err);
    }
    console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=metadata_complete ms=${Date.now() - tMetaStart} total_elapsed_ms=${Date.now() - t0}`);

    type PersistedStop = ResolvedStop & { id: string; orderIndex: number };

    // ── runStream — core generation loop ─────────────────────────────────────
    // dryRun=true: resolves and validates stops but does NOT write to DB.
    //   Used for walk-retry dry run so original stops survive if retry is rejected.
    // dryRun=false (default): writes each accepted stop to DB immediately.
    async function runStream(
      attempt: number,
      extraInstruction = "",
      dryRun = false,
    ): Promise<{ completedStops: PersistedStop[]; rejectedCount: number; partialTour: boolean }> {
      // Only wipe existing stops when writing for real (not dry-run)
      if (attempt > 0 && !dryRun) {
        await db.tourStop.deleteMany({ where: { tourId } });
      }

      const tStreamPassStart = Date.now();
      console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=stream_start attempt=${attempt}${dryRun ? "_dry" : ""} total_elapsed_ms=${tStreamPassStart - t0}`);
      const completedStops: PersistedStop[] = [];
      let orderIndex = 0;
      let currentToolName: string | null = null;
      let currentToolJson = "";
      let partialTour = false;
      let rejectedCount = 0;
      const finalSystemPrompt = extraInstruction ? `${systemPrompt}\n\n${extraInstruction}` : systemPrompt;

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: finalSystemPrompt,
        tools: [emitTourStopTool],
        tool_choice: { type: "tool", name: "emit_tour_stop" },
        messages: [{ role: "user", content: userMessage }],
      });

      // Phase A — drain stream, accumulate raw stops without blocking on Places
      const rawQueue: Array<{ raw: RawStop; emissionIndex: number }> = [];
      let emissionIndex = 0;
      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          currentToolName = event.content_block.name;
          currentToolJson = "";
        } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
          currentToolJson += event.delta.partial_json;
        } else if (event.type === "content_block_stop" && currentToolName === "emit_tour_stop") {
          try {
            const rawStop = JSON.parse(currentToolJson) as RawStop;
            rawStop.why = scrubEmDash(rawStop.why) ?? "";
            rawStop.familyNote = scrubEmDash(rawStop.familyNote) ?? "";
            rawQueue.push({ raw: rawStop, emissionIndex: emissionIndex++ });
          } catch (e) {
            console.error("[tours/generate] failed to parse stop tool call:", e);
            partialTour = true;
          }
          currentToolName = null;
          currentToolJson = "";
        }
      }

      // Phase B — resolve all stops in parallel
      const resolveStartMs = Date.now();
      const resolveResults = await Promise.allSettled(
        rawQueue.map(({ raw }) => resolveAgainstPlaces(raw, destinationCity, transport, destinationCenter))
      );
      for (const r of resolveResults) {
        if (r.status === "rejected" && r.reason instanceof PlacesInfraError) throw r.reason;
      }
      console.log("[tour-gen] places-parallel-resolved", {
        callSite: "main",
        requested: rawQueue.length,
        fulfilled: resolveResults.filter(r => r.status === "fulfilled").length,
        rejected: resolveResults.filter(r => r.status === "rejected").length,
        elapsedMs: Date.now() - resolveStartMs,
      });

      // Phase C — filter accepted stops and write to DB in emission order
      for (let i = 0; i < rawQueue.length; i++) {
        const { raw } = rawQueue[i];
        const result = resolveResults[i];
        if (result.status === "rejected" || !result.value) {
          rejectedCount++;
          continue;
        }
        const resolved = result.value;
        console.log(`[tour-relevance] "${resolved.name}" -> "${(raw.themeRelevance ?? "").slice(0, 120)}"`);
        const weak = hasWeakThemeRelevance(raw.themeRelevance);
        if (weak) {
          // BUG FIX: previously incremented rejectedCount but still wrote to DB.
          // Now correctly skips the stop when themeRelevance is weak.
          console.log(`[tour-theme-weak] "${raw.name}" -> "${raw.themeRelevance ?? ""}"`);
          rejectedCount++;
          continue;
        }
        const stopId = crypto.randomUUID();
        const idx = orderIndex++;

        if (!dryRun) {
          await db.tourStop.create({
            data: {
              id: stopId,
              tourId: tourId!,
              orderIndex: idx,
              name: resolved.name,
              address: resolved.address || null,
              lat: resolved.lat || null,
              lng: resolved.lng || null,
              durationMin: resolved.duration || null,
              travelTimeMin: resolved.travelTime || null,
              why: resolved.why || null,
              familyNote: resolved.familyNote || null,
              imageUrl: resolved.imageUrl,
              websiteUrl: resolved.websiteUrl,
              placeId: resolved.placeId ?? null,
              ticketRequired: resolved.ticketRequired,
              placeTypes: resolved.placeTypes ?? [],
            },
          });
        }

        businessStatusMap.set(resolved.placeId ?? resolved.name, resolved.businessStatus ?? null);
        completedStops.push({ ...resolved, id: stopId, orderIndex: idx });
      }

      console.log(`[tour-stream] attempt ${attempt}${dryRun ? " (dry-run)" : ""}: ${completedStops.length} accepted, ${rejectedCount} rejected`);

      if (completedStops.length < targetStops) partialTour = true;
      console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=stream_complete attempt=${attempt}${dryRun ? "_dry" : ""} ms=${Date.now() - tStreamPassStart} accepted=${completedStops.length} rejected=${rejectedCount} total_elapsed_ms=${Date.now() - t0}`);

      return { completedStops, rejectedCount, partialTour };
    }

    // ── Attempt 0: initial stream ──────────────────────────────────────────────
    const tGenerationStart = Date.now();
    let { completedStops, rejectedCount, partialTour } = await runStream(0);

    // ── Attempt 1: rejection retry (hard city-mismatch + soft theme-weak) ─────
    if (rejectedCount >= 2) {
      console.log(`[tour-retry] ${rejectedCount} rejected stops — retrying`);
      ({ completedStops, rejectedCount, partialTour } = await runStream(1));
    }

    // ── Walk-distance validation ───────────────────────────────────────────────
    let walkViolations = 0;
    if (transport === "Walking" && completedStops.length >= 2) {
      for (let i = 1; i < completedStops.length; i++) {
        const prev = completedStops[i - 1];
        const curr = completedStops[i];
        if (prev.lat && prev.lng && curr.lat && curr.lng) {
          const dist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
          if (dist > maxDistMeters) {
            walkViolations++;
            console.log(`[tour-walk-violation] "${prev.name}" → "${curr.name}": ${Math.round(dist)}m (max ${maxDistMeters}m)`);
          }
        }
      }
    }

    // ── Attempt 2: walk-violation retry — DRY RUN, commit only if better ─────
    // BUG FIX: Previous version deleted original DB rows before running retry.
    // If retry was rejected ("noop"), the DB was left empty. Now:
    //   1. Run retry in dry-run mode (no DB writes, original rows untouched)
    //   2. If retry improves violations: atomically delete originals + write retry
    //   3. If retry doesn't improve: discard retry buffer, original rows survive
    // Walk-retry skipped when: (a) pass-0 was short — fill loop clustering hint handles it;
    // (b) budget is too tight for a ~35s dry-run stream; (c) no violations.
    if (transport === "Walking" && walkViolations > 0 && completedStops.length < targetStops) {
      console.log(`[tour-walk-retry-skip] short pass (${completedStops.length}/${targetStops} stops) — fill loop handles clustering`);
    } else if (transport === "Walking" && walkViolations > 0 && Date.now() - t0 + RESERVE_WALK_RETRY > BUDGET_MS) {
      console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=walk_retry_budget_skip total_elapsed_ms=${Date.now() - t0}`);
    } else if (transport === "Walking" && walkViolations > 0) {
      const clusteringHint = `CRITICAL: All stops MUST be in one walkable cluster — every stop within 1.5km of every other stop. Pick a single neighborhood or area and find all ${targetStops} stops within it. If you cannot find ${targetStops} venues meeting this constraint, return your best ${targetStops} options that are tightly clustered, NOT a smaller list spread out. Geographic clustering is more important than minor theme variety. Every consecutive stop pair MUST be within ${maxWalk} minutes walk (~${maxDistMeters}m).`;
      console.log(`[tour-walk-retry] ${walkViolations} walk violations — dry-run retry with clustering hint`);
      const retryResult = await runStream(2, clusteringHint, true); // dryRun=true

      // Calculate violations on dry-run output
      let retryViolations = 0;
      for (let i = 1; i < retryResult.completedStops.length; i++) {
        const prev = retryResult.completedStops[i - 1];
        const curr = retryResult.completedStops[i];
        if (prev.lat && prev.lng && curr.lat && curr.lng) {
          const dist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
          if (dist > maxDistMeters) retryViolations++;
        }
      }

      if (retryViolations < walkViolations && retryResult.completedStops.length >= Math.min(2, completedStops.length)) {
        // Accept retry: atomically replace DB stops
        console.log(`[tour-walk-retry-success] was ${walkViolations} violations, now ${retryViolations} — committing retry`);
        await db.tourStop.deleteMany({ where: { tourId } });
        let retryIdx = 0;
        for (const s of retryResult.completedStops) {
          await db.tourStop.create({
            data: {
              id: s.id,
              tourId,
              orderIndex: retryIdx,
              name: s.name,
              address: s.address || null,
              lat: s.lat || null,
              lng: s.lng || null,
              durationMin: s.duration || null,
              travelTimeMin: s.travelTime || null,
              why: s.why || null,
              familyNote: s.familyNote || null,
              imageUrl: s.imageUrl,
              websiteUrl: s.websiteUrl,
              placeId: s.placeId ?? null,
              ticketRequired: s.ticketRequired ?? null,
              placeTypes: s.placeTypes ?? [],
            },
          });
          s.orderIndex = retryIdx++;
        }
        completedStops = retryResult.completedStops;
        partialTour = retryResult.partialTour;
        walkViolations = retryViolations;
      } else {
        // Discard retry buffer — original DB rows are untouched
        console.log(`[tour-walk-retry-noop] retry had ${retryViolations} violations (original ${walkViolations}), keeping original`);
      }
    }

    // ── Attempt 3+: fill loop — run up to 3 passes until targetStops is reached ─
    // Each pass appends new stops without replacing existing ones.
    // Passes the growing list of accepted names to prevent duplicates.
    // Stops early if a pass produces zero new accepted stops (prevents spinning).
    {
      let fillPass = 0;
      const MAX_FILL_PASSES = 3;

      while (completedStops.length < targetStops && fillPass < MAX_FILL_PASSES) {
        if (Date.now() - t0 + RESERVE_FILL_PASS > BUDGET_MS) {
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=fill_budget_skip have=${completedStops.length}/${targetStops} total_elapsed_ms=${Date.now() - t0}`);
          break;
        }
        fillPass++;
        const missing = targetStops - completedStops.length;
        const alreadyAccepted = completedStops.map(s => s.name);
        const tFillStart = Date.now();
        console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=fill_start pass=${fillPass} need=${missing} total_elapsed_ms=${tFillStart - t0}`);
        console.log(`[tour-fill] pass ${fillPass}/${MAX_FILL_PASSES}: need ${missing} more stops (have ${completedStops.length}/${targetStops})`);

        const fillInstruction = `ALREADY ACCEPTED STOPS — DO NOT REPEAT THESE (they are already in the tour):\n${alreadyAccepted.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nYou must emit exactly ${missing} NEW stop(s) that are DIFFERENT from the above list. Choose DIFFERENT venue types and areas of the city than what is already listed. All original constraints still apply.`;

        const fillTool: Anthropic.Tool = {
          ...emitTourStopTool,
          description: `Emit exactly ${missing} new stop(s) for the tour. Do NOT repeat any already-accepted stop.`,
        };

        const fillStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: `${systemPrompt}\n\n${fillInstruction}`,
          tools: [fillTool],
          tool_choice: { type: "tool", name: "emit_tour_stop" },
          messages: [{ role: "user", content: userMessage }],
        });

        let fillToolName: string | null = null;
        let fillToolJson = "";
        let fillOrderIndex = completedStops.length;
        const beforeFill = completedStops.length;

        // Phase A — drain fill stream, accumulate non-duplicate raw stops
        const fillRawQueue: Array<{ raw: RawStop; emissionIndex: number }> = [];
        let fillEmissionIndex = 0;
        for await (const event of fillStream) {
          if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            fillToolName = event.content_block.name;
            fillToolJson = "";
          } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            fillToolJson += event.delta.partial_json;
          } else if (event.type === "content_block_stop" && fillToolName === "emit_tour_stop") {
            try {
              const rawStop = JSON.parse(fillToolJson) as RawStop;
              rawStop.why = scrubEmDash(rawStop.why) ?? "";
              rawStop.familyNote = scrubEmDash(rawStop.familyNote) ?? "";
              const isDuplicate = alreadyAccepted.some(
                n => n.toLowerCase() === (rawStop.name ?? "").toLowerCase()
              );
              if (isDuplicate) {
                console.log(`[tour-fill] duplicate skipped: "${rawStop.name}"`);
              } else {
                fillRawQueue.push({ raw: rawStop, emissionIndex: fillEmissionIndex++ });
              }
            } catch (e) {
              if (e instanceof PlacesInfraError) throw e;
              console.error("[tour-fill] parse error:", e);
            }
            fillToolName = null;
            fillToolJson = "";
          } else if (event.type === "message_stop") {
            console.log(`[tour-fill] pass ${fillPass} done: ${completedStops.length}/${targetStops}`);
          }
        }

        // Phase B — resolve all fill stops in parallel
        const fillResolveStartMs = Date.now();
        const fillResolveResults = await Promise.allSettled(
          fillRawQueue.map(({ raw }) => resolveAgainstPlaces(raw, destinationCity, transport, destinationCenter))
        );
        for (const r of fillResolveResults) {
          if (r.status === "rejected" && r.reason instanceof PlacesInfraError) throw r.reason;
        }
        console.log("[tour-gen] places-parallel-resolved", {
          callSite: "fill",
          requested: fillRawQueue.length,
          fulfilled: fillResolveResults.filter(r => r.status === "fulfilled").length,
          rejected: fillResolveResults.filter(r => r.status === "rejected").length,
          elapsedMs: Date.now() - fillResolveStartMs,
        });

        // Phase C — filter and write accepted fill stops in emission order
        for (let i = 0; i < fillRawQueue.length; i++) {
          const { raw: rawStop } = fillRawQueue[i];
          const fillResult = fillResolveResults[i];
          if (fillResult.status === "rejected" || !fillResult.value || hasWeakThemeRelevance(rawStop.themeRelevance)) {
            continue;
          }
          const resolved = fillResult.value;
          const stopId = crypto.randomUUID();
          const idx = fillOrderIndex++;
          await db.tourStop.create({
            data: {
              id: stopId,
              tourId,
              orderIndex: idx,
              name: resolved.name,
              address: resolved.address || null,
              lat: resolved.lat || null,
              lng: resolved.lng || null,
              durationMin: resolved.duration || null,
              travelTimeMin: resolved.travelTime || null,
              why: resolved.why || null,
              familyNote: resolved.familyNote || null,
              imageUrl: resolved.imageUrl,
              websiteUrl: resolved.websiteUrl,
              placeId: resolved.placeId ?? null,
              ticketRequired: resolved.ticketRequired,
              placeTypes: resolved.placeTypes ?? [],
            },
          });
          businessStatusMap.set(resolved.placeId ?? resolved.name, resolved.businessStatus ?? null);
          completedStops.push({ ...resolved, id: stopId, orderIndex: idx });
          console.log(`[tour-fill] added "${resolved.name}" (${completedStops.length}/${targetStops})`);
        }

        console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=fill_complete pass=${fillPass} ms=${Date.now() - tFillStart} stops_added=${completedStops.length - beforeFill} total_elapsed_ms=${Date.now() - t0}`);
        if (completedStops.length === beforeFill) {
          console.log(`[tour-fill] pass ${fillPass} added 0 stops — stopping fill loop`);
          break;
        }
      }
    }

    // ── Post-stream: DB is source of truth ───────────────────────────────────
    // Re-fetch so finalStopsFromDb reflects all attempts (including under-emission fills).
    let finalStopsFromDb = await db.tourStop.findMany({
      where: { tourId, deletedAt: null },
      orderBy: { orderIndex: "asc" },
    });

    if (finalStopsFromDb.length < targetStops) {
      console.warn(`[tour-underdelivery] WARN: ${finalStopsFromDb.length}/${targetStops} stops delivered for tour ${tourId} (${durationLabel}, ${destinationCity})`);
    }

    // B1 verification: log if any capitalized two-word sequence from the prompt
    // is not represented in the final stop names (named-place rule adherence).
    {
      const namedPlaceMatches = prompt.match(/\b[A-Z][a-z]+ (?:[A-Z][a-z]+|[Oo]f|[Tt]he)\b/g) ?? [];
      for (const named of namedPlaceMatches) {
        const norm = named.toLowerCase();
        const present = finalStopsFromDb.some(s => (s.name ?? "").toLowerCase().includes(norm));
        if (!present) {
          console.warn(`[tour-named-place] WARN: "${named}" from prompt not found in any stop name for tour ${tourId}`);
        }
      }
    }

    if (!isNoChildren && finalStopsFromDb.length > 2) {
      const bathroomRe = /restroom|bathroom|toilet|WC|facilities/i;
      const hasBathroomMention = finalStopsFromDb.some(s => bathroomRe.test(s.familyNote ?? ""));
      if (!hasBathroomMention) {
        console.warn(`[tour-bathroom-missing] WARN: no bathroom mention in any familyNote for tour ${tourId}`);
      }
    }

    // ── Route optimization ────────────────────────────────────────────────────
    const stopsWithCoords = finalStopsFromDb.filter(s => s.lat != null && s.lng != null);
    if (stopsWithCoords.length >= 3) {
      try {
        const pinnedFirstId = inputStartPoint ? findStartPointId(inputStartPoint, finalStopsFromDb) : undefined;
        console.log(`[tour-start-point] inputStartPoint="${inputStartPoint ?? "none"}" preOptimStop1="${finalStopsFromDb[0]?.name ?? "none"}" pinnedFirstId="${pinnedFirstId ?? "none"}"`);
        const optimized = optimizeRouteOrder(
          stopsWithCoords.map(s => ({ id: s.id, lat: s.lat!, lng: s.lng! })),
          pinnedFirstId
        );

        const newOrderById = new Map<string, number>();
        optimized.forEach((s, i) => newOrderById.set(s.id, i));

        await Promise.all(
          optimized.map(s =>
            db.tourStop.update({
              where: { id: s.id },
              data: { orderIndex: newOrderById.get(s.id)! },
            })
          )
        );

        // Re-fetch to get canonical post-optimization order.
        finalStopsFromDb = await db.tourStop.findMany({
          where: { tourId, deletedAt: null },
          orderBy: { orderIndex: "asc" },
        });

        console.log(`[tour-start-point] postOptimStop1="${finalStopsFromDb[0]?.name ?? "none"}" (inputStartPoint="${inputStartPoint ?? "none"}")`);
        console.log("[generate] route optimization applied", {
          tourId,
          stopCount: finalStopsFromDb.length,
        });
      } catch (e) {
        console.error("[generate] route optimization failed, returning unoptimized order", {
          tourId,
          error: e instanceof Error ? e.message : String(e),
        });
        // finalStopsFromDb already holds pre-optimization fetch — use it as-is.
      }
    }

    const tGenerationEnd = Date.now();
    console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=generation_complete ms=${tGenerationEnd - tGenerationStart} total_elapsed_ms=${tGenerationEnd - t0} stops=${finalStopsFromDb.length}`);

    // ── GRADER v1 ─────────────────────────────────────────────────────────────
    // CONTRACT B: never blocks the user — all grader errors fall through silently.
    // ONE bounded regeneration max. Grader result always persisted to DB.
    let dbGraderScore: number | null = null;
    let dbGraderStatus: string | null = null;
    let dbGraderFlags: Prisma.InputJsonValue | null = null;
    let dbGraderRanAt: Date | null = null;

    if (finalStopsFromDb.length > 0) {
      try {
        const graderInputs: GraderGenerationInputs = { prompt, transport, inputGroup, inputVibe, inputDurationHr };
        const graderFamilyCtxObj: GraderFamilyContext = {
          ages: graderAges,
          dietary: graderDietary,
          foodAllergies: graderFoodAllergies,
          pace: graderPaceStr,
          travelStyle: graderStyleStr,
          interestKeys: graderInterestKeys,
        };

        const buildGraderStops = (dbStops: typeof finalStopsFromDb): GraderStop[] =>
          dbStops.map(s => ({
            placeId: s.placeId,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            placeTypes: s.placeTypes,
            businessStatus: businessStatusMap.get(s.placeId ?? s.name) ?? null,
            why: s.why,
            familyNote: s.familyNote,
          }));

        if (Date.now() - t0 + RESERVE_GRADE1 > BUDGET_MS) {
          // Not enough headroom to run grade1 and still return within budget.
          dbGraderStatus = finalStopsFromDb.length < targetStops ? "partial_budget" : "ungraded_budget";
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=grade1_budget_skip status=${dbGraderStatus} total_elapsed_ms=${Date.now() - t0}`);
        } else {

        const tGrade1Start = Date.now();
        const grade1 = await gradeTour(buildGraderStops(finalStopsFromDb), graderFamilyCtxObj, graderInputs);
        console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=grade1_complete ms=${Date.now() - tGrade1Start} total_elapsed_ms=${Date.now() - t0} score=${grade1.score} regenerate=${grade1.regenerate}`);

        if (!grade1.regenerate) {
          dbGraderStatus = "pass";
          dbGraderScore = grade1.score;
          dbGraderFlags = grade1.flags as unknown as Prisma.InputJsonValue;
        } else if (Date.now() - t0 + RESERVE_REGEN > BUDGET_MS) {
          // Not enough headroom to run regen and still return within budget.
          dbGraderStatus = "ungraded_budget";
          dbGraderScore = grade1.score;
          dbGraderFlags = grade1.flags as unknown as Prisma.InputJsonValue;
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=regen_budget_skip score=${grade1.score} total_elapsed_ms=${Date.now() - t0}`);
        } else {
          console.log(`[tour-grader] grade1 score=${grade1.score} regenerate=true — running bounded regeneration`);
          const originalSnapshot = [...finalStopsFromDb];
          const regenInstruction = graderFlagsToInstruction(grade1.flags, grade1.reasons);

          // One bounded regeneration: clears DB stops and re-streams
          try {
          const tRegenStart = Date.now();
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=regen_start total_elapsed_ms=${tRegenStart - t0}`);
          const regenResult = await runStream(9, regenInstruction);
          completedStops = regenResult.completedStops;

          // Fill loop for the regen pass (same logic as original, up to 3 passes)
          let regenFillPass = 0;
          while (completedStops.length < targetStops && regenFillPass < 3) {
            regenFillPass++;
            const missing = targetStops - completedStops.length;
            const alreadyAccepted = completedStops.map(s => s.name);
            const rfFillInstruction = `ALREADY ACCEPTED STOPS — DO NOT REPEAT THESE:\n${alreadyAccepted.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nEmit exactly ${missing} NEW stop(s).\n\n${regenInstruction}`;
            const rfFillTool: Anthropic.Tool = { ...emitTourStopTool, description: `Emit exactly ${missing} new stop(s). Do NOT repeat any already-accepted stop.` };
            const rfStream = anthropic.messages.stream({
              model: "claude-sonnet-4-6", max_tokens: 4096,
              system: `${systemPrompt}\n\n${rfFillInstruction}`,
              tools: [rfFillTool], tool_choice: { type: "tool", name: "emit_tour_stop" },
              messages: [{ role: "user", content: userMessage }],
            });
            let rfToolName: string | null = null, rfToolJson = "";
            let rfOrderIndex = completedStops.length;
            const beforeRf = completedStops.length;

            // Phase A — drain regen-fill stream, accumulate non-duplicate raw stops
            const rfRawQueue: Array<{ raw: RawStop; emissionIndex: number }> = [];
            let rfEmissionIndex = 0;
            for await (const event of rfStream) {
              if (event.type === "content_block_start" && event.content_block.type === "tool_use") { rfToolName = event.content_block.name; rfToolJson = ""; }
              else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") { rfToolJson += event.delta.partial_json; }
              else if (event.type === "content_block_stop" && rfToolName === "emit_tour_stop") {
                try {
                  const rs = JSON.parse(rfToolJson) as RawStop;
                  rs.why = scrubEmDash(rs.why) ?? ""; rs.familyNote = scrubEmDash(rs.familyNote) ?? "";
                  if (!alreadyAccepted.some(n => n.toLowerCase() === (rs.name ?? "").toLowerCase())) {
                    rfRawQueue.push({ raw: rs, emissionIndex: rfEmissionIndex++ });
                  }
                } catch (rfErr) { if (rfErr instanceof PlacesInfraError) throw rfErr; }
                rfToolName = null; rfToolJson = "";
              }
            }

            // Phase B — resolve all regen-fill stops in parallel
            const rfResolveStartMs = Date.now();
            const rfResolveResults = await Promise.allSettled(
              rfRawQueue.map(({ raw }) => resolveAgainstPlaces(raw, destinationCity, transport, destinationCenter))
            );
            for (const r of rfResolveResults) {
              if (r.status === "rejected" && r.reason instanceof PlacesInfraError) throw r.reason;
            }
            console.log("[tour-gen] places-parallel-resolved", {
              callSite: "regenFill",
              requested: rfRawQueue.length,
              fulfilled: rfResolveResults.filter(r => r.status === "fulfilled").length,
              rejected: rfResolveResults.filter(r => r.status === "rejected").length,
              elapsedMs: Date.now() - rfResolveStartMs,
            });

            // Phase C — filter and write accepted regen-fill stops in emission order
            for (let i = 0; i < rfRawQueue.length; i++) {
              const { raw: rs } = rfRawQueue[i];
              const rfResult = rfResolveResults[i];
              if (rfResult.status === "rejected" || !rfResult.value || hasWeakThemeRelevance(rs.themeRelevance)) continue;
              const res2 = rfResult.value;
              const sid = crypto.randomUUID(); const idx2 = rfOrderIndex++;
              await db.tourStop.create({ data: { id: sid, tourId, orderIndex: idx2, name: res2.name, address: res2.address || null, lat: res2.lat || null, lng: res2.lng || null, durationMin: res2.duration || null, travelTimeMin: res2.travelTime || null, why: res2.why || null, familyNote: res2.familyNote || null, imageUrl: res2.imageUrl, websiteUrl: res2.websiteUrl, placeId: res2.placeId ?? null, ticketRequired: res2.ticketRequired, placeTypes: res2.placeTypes ?? [] } });
              businessStatusMap.set(res2.placeId ?? res2.name, res2.businessStatus ?? null);
              completedStops.push({ ...res2, id: sid, orderIndex: idx2 });
            }

            if (completedStops.length === beforeRf) break;
          }

          // Re-fetch and re-optimize the regen candidate
          let regenFinalStops = await db.tourStop.findMany({ where: { tourId, deletedAt: null }, orderBy: { orderIndex: "asc" } });
          const regenWithCoords = regenFinalStops.filter(s => s.lat != null && s.lng != null);
          if (regenWithCoords.length >= 3) {
            try {
              const pf2 = inputStartPoint ? findStartPointId(inputStartPoint, regenFinalStops) : undefined;
              const opt2 = optimizeRouteOrder(regenWithCoords.map(s => ({ id: s.id, lat: s.lat!, lng: s.lng! })), pf2);
              await Promise.all(opt2.map((s, i) => db.tourStop.update({ where: { id: s.id }, data: { orderIndex: i } })));
              regenFinalStops = await db.tourStop.findMany({ where: { tourId, deletedAt: null }, orderBy: { orderIndex: "asc" } });
            } catch { /* optimization failure — use unoptimized */ }
          }

          // Grade regen candidate and keep the higher-scoring version
          const tGrade2Start = Date.now();
          const grade2 = await gradeTour(buildGraderStops(regenFinalStops), graderFamilyCtxObj, graderInputs);
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=grade2_complete ms=${Date.now() - tGrade2Start} regen_total_ms=${Date.now() - tRegenStart} total_elapsed_ms=${Date.now() - t0} score=${grade2.score}`);
          if (grade2.score >= grade1.score) {
            finalStopsFromDb = regenFinalStops;
            dbGraderScore = grade2.score;
            dbGraderFlags = grade2.flags as unknown as Prisma.InputJsonValue;
            const grade2StillInsufficient = grade2.flags.some(f => f.code === "INSUFFICIENT_STOPS");
            dbGraderStatus = (grade2.score >= 70 && !grade2StillInsufficient) ? "regenerated_pass" : "low_confidence";
            console.log(`[tour-grader] kept regen: grade2=${grade2.score} >= grade1=${grade1.score} status=${dbGraderStatus}`);
          } else {
            // Restore original snapshot — regen was worse
            await db.tourStop.deleteMany({ where: { tourId } });
            let restoreIdx = 0;
            for (const s of originalSnapshot) {
              await db.tourStop.create({ data: { id: s.id, tourId, orderIndex: restoreIdx++, name: s.name, address: s.address, lat: s.lat, lng: s.lng, durationMin: s.durationMin, travelTimeMin: s.travelTimeMin, why: s.why, familyNote: s.familyNote, imageUrl: s.imageUrl, websiteUrl: s.websiteUrl, placeId: s.placeId, ticketRequired: s.ticketRequired, placeTypes: s.placeTypes ?? [] } });
            }
            finalStopsFromDb = await db.tourStop.findMany({ where: { tourId, deletedAt: null }, orderBy: { orderIndex: "asc" } });
            dbGraderScore = grade1.score;
            dbGraderFlags = grade1.flags as unknown as Prisma.InputJsonValue;
            dbGraderStatus = "low_confidence";
            console.log(`[tour-grader] kept original: grade2=${grade2.score} < grade1=${grade1.score} status=low_confidence`);
          }
          } catch (regenInfraErr) {
            if (!(regenInfraErr instanceof PlacesInfraError)) throw regenInfraErr;
            console.error(`[tour-grader] PlacesInfraError during regen: ${regenInfraErr.message} — restoring original`);
            await db.tourStop.deleteMany({ where: { tourId } });
            let restoreIdx = 0;
            for (const s of originalSnapshot) {
              await db.tourStop.create({ data: { id: s.id, tourId, orderIndex: restoreIdx++, name: s.name, address: s.address, lat: s.lat, lng: s.lng, durationMin: s.durationMin, travelTimeMin: s.travelTimeMin, why: s.why, familyNote: s.familyNote, imageUrl: s.imageUrl, websiteUrl: s.websiteUrl, placeId: s.placeId, ticketRequired: s.ticketRequired, placeTypes: s.placeTypes ?? [] } });
            }
            finalStopsFromDb = await db.tourStop.findMany({ where: { tourId, deletedAt: null }, orderBy: { orderIndex: "asc" } });
            dbGraderScore = grade1.score;
            dbGraderFlags = grade1.flags as unknown as Prisma.InputJsonValue;
            dbGraderStatus = "low_confidence";
          }
        }
        } // close: else { // grade1 ran (not budget-skipped)

        // Persist grader result — awaited in its own try/catch so write failure never propagates
        try {
          dbGraderRanAt = new Date();
          const tWriteStart = Date.now();
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=write_start total_elapsed_ms=${tWriteStart - t0}`);
          await db.generatedTour.update({
            where: { id: tourId },
            data: { graderScore: dbGraderScore, graderStatus: dbGraderStatus, graderFlags: dbGraderFlags ?? Prisma.JsonNull, graderRanAt: dbGraderRanAt },
          });
          console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=write_committed ms=${Date.now() - tWriteStart} total_elapsed_ms=${Date.now() - t0} committed=true`);
        } catch (err) {
          console.error(`[grader] WRITE_FAILED tourId=${tourId ?? "?"} graderScore=${dbGraderScore} status=${dbGraderStatus} err=${err instanceof Error ? err.message : String(err)}`);
          // Do NOT rethrow. A grader-write failure must never turn a good tour into a user-facing error.
        }

      } catch (graderErr) {
        console.error("[tour-grader] grader pipeline failed, shipping without grade:", graderErr);
      }
    }

    // ── GUARANTEE: graderRanAt is ALWAYS written before we return ─────────────
    // If the grader block above ran and committed, this is a no-op (dbGraderRanAt !== null).
    // Fires for: 0-stop complete failures, budget-skip paths, and any graderErr throw.
    if (!dbGraderRanAt && tourId) {
      const safeStatus = finalStopsFromDb.length > 0 ? "ungraded_budget" : "partial_budget";
      dbGraderStatus = dbGraderStatus ?? safeStatus;
      dbGraderRanAt = new Date();
      try {
        await db.generatedTour.update({
          where: { id: tourId },
          data: {
            graderStatus: dbGraderStatus,
            graderRanAt: dbGraderRanAt,
            graderScore: dbGraderScore,
            graderFlags: dbGraderFlags ?? Prisma.JsonNull,
          },
        });
        console.log(`[grader-timing] tourId=${tourId} phase=safety_write status=${dbGraderStatus} total_elapsed_ms=${Date.now() - t0}`);
      } catch (safeWriteErr) {
        console.error(`[grader] SAFETY_WRITE_FAILED tourId=${tourId}:`, safeWriteErr);
      }
    }

    // ── Walk violations (recomputed from final DB state) ──────────────────────
    let finalWalkViolations = 0;
    if (transport === "Walking" && finalStopsFromDb.length >= 2) {
      for (let i = 1; i < finalStopsFromDb.length; i++) {
        const a = finalStopsFromDb[i - 1];
        const b = finalStopsFromDb[i];
        if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
          const dist = haversineMeters(a.lat, a.lng, b.lat, b.lng);
          if (dist > maxDistMeters) finalWalkViolations++;
        }
      }
    }

    // ── Cluster diameter check (walking only) ─────────────────────────────────
    // Max pairwise distance across ALL stops, not just adjacent pairs.
    // Catches cases like Edinburgh Zoo + Gorgie City Farm (2.6km apart) which
    // are individually on-theme but form an unworkable walking cluster.
    let clusterDiameter = 0;
    const maxDiameterMeters = youngestChildAge !== null
      ? youngestChildAge < 5 ? 1500
        : youngestChildAge <= 10 ? 3000
        : 5000
      : 5000;

    if (transport === "Walking" && finalStopsFromDb.length >= 2) {
      for (let i = 0; i < finalStopsFromDb.length; i++) {
        for (let j = i + 1; j < finalStopsFromDb.length; j++) {
          const a = finalStopsFromDb[i];
          const b = finalStopsFromDb[j];
          if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
            const dist = haversineMeters(a.lat, a.lng, b.lat, b.lng);
            if (dist > clusterDiameter) clusterDiameter = dist;
          }
        }
      }
    }

    const clusterViolation = transport === "Walking" && clusterDiameter > maxDiameterMeters
      ? { maxDistance: Math.round(clusterDiameter), threshold: maxDiameterMeters }
      : null;

    if (clusterViolation) {
      console.log(`[tour-cluster-violation] diameter=${clusterViolation.maxDistance}m exceeds threshold=${clusterViolation.threshold}m (youngest age ${youngestChildAge ?? "unknown"})`);
    }

    // ── Hotel anchor proximity check ──────────────────────────────────────────
    // Validates that first and last stops are within range of the lodging anchor.
    // Does not auto-retry — surfaces anchorViolation in response for user to regenerate.
    let anchorViolation: { distance: number; threshold: number } | null = null;
    if (anchorLat !== null && anchorLng !== null && finalStopsFromDb.length >= 1) {
      const anchorThreshold = transport === "Walking" ? 1000
        : transport === "Metro / Transit" ? 1500
        : 5000;
      const firstStop = finalStopsFromDb[0];
      const lastStop = finalStopsFromDb[finalStopsFromDb.length - 1];
      const firstDist = (firstStop.lat != null && firstStop.lng != null)
        ? haversineMeters(anchorLat, anchorLng, firstStop.lat, firstStop.lng)
        : Infinity;
      const lastDist = (lastStop.lat != null && lastStop.lng != null)
        ? haversineMeters(anchorLat, anchorLng, lastStop.lat, lastStop.lng)
        : Infinity;
      if (firstDist > anchorThreshold || lastDist > anchorThreshold) {
        const maxEndpointDist = Math.max(
          firstDist === Infinity ? 0 : firstDist,
          lastDist === Infinity ? 0 : lastDist,
        );
        anchorViolation = { distance: Math.round(maxEndpointDist), threshold: anchorThreshold };
        console.log(`[tour-anchor-violation] first=${Math.round(firstDist)}m, last=${Math.round(lastDist)}m from lodging (threshold=${anchorThreshold}m)`);
      }
    }

    // ── publicWhy generation (neutral, public-safe stop copy) ────────────────
    // Runs only when time budget allows; backfill endpoint covers any skipped stops.
    if (tourId && finalStopsFromDb.length > 0 && Date.now() - t0 < 108_000) {
      const stopsNeedingPublicWhy = finalStopsFromDb.filter(s => !s.publicWhy);
      if (stopsNeedingPublicWhy.length > 0) {
        try {
          await generatePublicWhyForStops(stopsNeedingPublicWhy, destinationCity);
        } catch (publicWhyErr) {
          console.error("[publicWhy] generation pipeline failed:", publicWhyErr);
        }
      }
    }

    // ── Response ───────────────────────────────────────────────────────────────
    const finalPartialTour = finalStopsFromDb.length < targetStops || !!clusterViolation;
    console.log(`[grader-timing] tourId=${tourId ?? "?"} phase=handler_returning total_elapsed_ms=${Date.now() - t0}`);
    return NextResponse.json({
      tourId,
      title: tourGeneratedTitle ?? tourTitle,
      subtitle: tourGeneratedSubtitle ?? null,
      originalTargetStops: targetStops,
      stops: finalStopsFromDb.map(s => ({
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
        ticketRequired: s.ticketRequired ?? null,
      })),
      destinationCity,
      prompt,
      durationLabel,
      transport,
      inputGroup,
      inputVibe,
      inputDurationHr,
      generatedAt: new Date().toISOString(),
      ...(finalPartialTour ? { partialTour: true } : {}),
      ...(finalWalkViolations > 0 ? { walkViolations: finalWalkViolations } : {}),
      ...(clusterViolation ? { clusterViolation } : {}),
      ...(anchorViolation ? { anchorViolation } : {}),
    });

  } catch (err) {
    if (err instanceof PlacesInfraError) {
      console.error(`[tours/generate] PLACES_UPSTREAM_DENIED: ${err.message}`);
      if (tourId) {
        await db.generatedTour.delete({ where: { id: tourId } }).catch(() => {});
      }
      return NextResponse.json({ error: "PLACES_UPSTREAM_DENIED" }, { status: 502 });
    }
    console.error("[tours/generate] error:", err);
    return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
  }
}
