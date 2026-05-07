import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { haversineMeters, haversineKm } from "@/lib/geo";
import { optimizeRouteOrder } from "@/lib/tour-route-optimization";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { aggregateTripContext, flatChildAges, describePace, topInterests } from "@/lib/trip-context-multi";
import { DestinationType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

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

type ResolvedStop = RawStop & { imageUrl: string | null; websiteUrl: string | null; placeId: string | null; ticketRequired: string | null; placeTypes: string[] };

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
    const data = await res.json() as { results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };
    const loc = data.results?.[0]?.geometry?.location;
    if (!loc) { console.log(`[tour-resolve] geocode failed: ${destinationCity} no results`); return null; }
    console.log(`[tour-resolve] geocode ${destinationCity} → ${loc.lat},${loc.lng}`);
    return { lat: loc.lat, lng: loc.lng };
  } catch (e) {
    console.log(`[tour-resolve] geocode failed: ${destinationCity} ${String(e)}`);
    return null;
  }
}

async function resolveAgainstPlaces(stop: RawStop, destinationCity: string, transport: string, destinationCenter: { lat: number; lng: number } | null): Promise<ResolvedStop | null> {
  try {
    const cityNorm = destinationCity.toLowerCase().split(",")[0].trim();
    const query = encodeURIComponent(`${stop.name} ${stop.address || ""} ${destinationCity}`);
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as {
      results?: Array<{ place_id: string; geometry?: { location?: { lat: number; lng: number } } }>;
    };

    const firstResult = searchData.results?.[0];
    if (!firstResult?.geometry?.location) {
      console.log(`[tour-resolve] NO RESULT "${stop.name}"`);
      return null;
    }

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=name,formatted_address,geometry,photos,address_components,website,types,price_level,editorial_summary&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        photos?: Array<{ photo_reference: string }>;
        website?: string;
        types?: string[];
        price_level?: number;
        editorial_summary?: { overview?: string };
      };
    };

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
    const cityMatch = cityComponents.some(c => {
      const long = (c.long_name ?? "").toLowerCase();
      const short = (c.short_name ?? "").toLowerCase();
      // Strip "County" suffix so "Sonoma County" matches cityNorm "sonoma".
      const longNorm = long.replace(/\s+county$/i, "").trim();
      const shortNorm = short.replace(/\s+county$/i, "").trim();
      return long.includes(cityNorm) ||
             short.includes(cityNorm) ||
             longNorm.includes(cityNorm) ||
             shortNorm.includes(cityNorm);
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
      try {
        const photoRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
          { redirect: "follow" }
        );
        imageUrl = photoRes.url;
      } catch {
        console.log(`[tour-resolve-photo-err] "${stop.name}"`);
      }
    }

    const { lat, lng } = firstResult.geometry.location;
    const websiteUrl = detailsData.result?.website
      ?? `https://www.google.com/maps/place/?q=place_id:${firstResult.place_id}`;
    const placeTypes = detailsData.result?.types ?? [];
    const priceLevel = detailsData.result?.price_level;
    const editorialSummary = detailsData.result?.editorial_summary?.overview;
    const ticketRequired = deriveTicketSignal(placeTypes, priceLevel, editorialSummary);
    console.log(`[tour-resolve] OK "${stop.name}" -> ${lat},${lng}${imageUrl ? " [photo]" : ""} ticket=${ticketRequired}`);
    return { ...stop, lat, lng, imageUrl, websiteUrl, placeId: firstResult.place_id, ticketRequired, placeTypes };
  } catch (e) {
    console.error("[tour-resolve] error:", stop.name, e);
    if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) return { ...stop, imageUrl: null, websiteUrl: resolveCanonicalUrl({ name: stop.name, city: destinationCity }), placeId: null, ticketRequired: null, placeTypes: [] };
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    prompt: string;
    destinationCity: string;
    familyProfileId?: string;
    durationLabel?: string;
    transport?: string;
    tripId?: string;
  };
  const { prompt, destinationCity } = body;
  const durationLabel = body.durationLabel ?? "";
  const transport = body.transport ?? "Walking";
  const tripId = body.tripId ?? null;

  if (!prompt || !destinationCity) {
    return NextResponse.json({ error: "prompt and destinationCity are required" }, { status: 400 });
  }

  let maxMinutes: number;
  let targetStops: number;
  if (durationLabel === "2 hours") {
    maxMinutes = 120;
    targetStops = 3;
  } else if (durationLabel === "Full day (8 hrs)") {
    maxMinutes = 480;
    targetStops = 7;
  } else {
    maxMinutes = 240;
    targetStops = 5;
  }

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
    } else {
      const profile = await db.familyProfile.findUnique({
        where: { id: profileId },
        include: {
          members: { select: { name: true, role: true, dietaryRequirements: true, birthDate: true } },
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
              return `${m.name ?? "Child"} (age ${age ?? "unknown"})`;
            }
            return `${m.name ?? "Adult"} (adult)`;
          })
          .join(", ");

        if (childAges.length > 0) {
          youngestChildAge = Math.min(...childAges);
          childAgesContext = `children aged ${childAges.join(", ")}`;
        }

        const interestList = profile.interests.map(i => i.interestKey).join(", ");
        const allDietary = [...new Set(profile.members.flatMap(m => m.dietaryRequirements as string[]))];
        const parts: string[] = [];
        if (memberList) parts.push(`Family: ${memberList}`);
        if (profile.travelStyle) parts.push(`Travel style: ${profile.travelStyle}`);
        if (profile.pace) parts.push(`Pace: ${profile.pace}`);
        if (interestList) parts.push(`Interests: ${interestList}`);
        if (allDietary.length > 0) parts.push(`Dietary notes: ${allDietary.join(", ")}`);
        familyContext = parts.join(". ");
      }
    }

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

    const tourId: string = crypto.randomUUID();
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

    const emitTourStopTool: Anthropic.Tool = {
      name: "emit_tour_stop",
      description: `Emit one stop for the tour. Call this tool exactly ${targetStops} times, once per stop, in order.`,
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          duration: { type: "number", description: "Minutes at this stop" },
          travelTime: { type: "number", description: "Minutes to travel to the NEXT stop, 0 for the last stop" },
          why: { type: "string", description: "One sentence on why this stop fits the theme. When referencing children, use first names only — NEVER include ages in parentheses (e.g. write 'Beau and Miles' not 'Beau (10) and Miles (7)')." },
          familyNote: { type: "string", description: `Specific note for this family: ${childAgesContext}` },
          themeRelevance: { type: "string", description: `Specific justification for why this exact venue directly serves the theme "${prompt}". Name what happens at this venue that fits the theme. Avoid vague phrases like "provides atmosphere", "complements", or "adds variety". If you cannot justify the stop concretely, choose a different venue.` },
        },
        required: ["name", "address", "lat", "lng", "duration", "travelTime", "why", "familyNote", "themeRelevance"],
      },
    };

    // ── Anchor instruction (injected into system prompt when trip context exists) ──
    const anchorInstruction = anchorLat !== null && anchorLng !== null
      ? `\n\nThe user's lodging is at coordinates ${anchorLat}, ${anchorLng}. The tour must be anchored near this location:\n- Walking: first stop within 1km of lodging, last stop within 1km of lodging (round-trip from base)\n- Metro / Transit: first stop within 1.5km of lodging or a transit station within 800m of lodging\n- Driving: first stop within 5km of lodging, last stop within 5km of lodging`
      : "";

    const systemPrompt = `You are a family travel expert building themed day tours. Call emit_tour_stop exactly ${targetStops} times — once per stop, in order.

ABSOLUTE RULES — violating any of these means the tour fails:
1. Every stop MUST be a real, operating venue physically located IN ${destinationCity}. No venues from other cities. No "branch" workarounds. No closed or fictional places.
2. Every stop MUST directly serve the theme. No tangential sightseeing added for variety.
3. ${transport === "Walking" ? `Walking tour: every consecutive stop pair MUST be within ${maxWalk} minutes walk (~${maxDistMeters}m) of each other. Cluster tightly in one neighborhood.` : transport === "Metro / Transit" ? "Metro tour: stops can span the city but must be reachable by public transit." : "Car tour: no distance constraint."}
4. Total time (sum of all duration + travelTime) must not exceed ${maxMinutes} minutes.
5. familyNote MUST reference the specific children: ${childAgesContext}. Tailor to their ages.
6. In the why field, NEVER include ages in parentheses after names. Write "Beau and Miles" not "Beau (10) and Miles (7)". First names alone are sufficient.${anchorInstruction}`;

    const userMessage = `${seededContext}Tour theme: ${prompt}. Destination: ${destinationCity}. Duration: ${durationLabel || "Half day (4 hrs)"}. Transport: ${transport}. Family: ${familyContext || "not specified"}`;

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

      const completedStops: PersistedStop[] = [];
      let orderIndex = 0;
      let currentToolName: string | null = null;
      let currentToolJson = "";
      let partialTour = false;
      let rejectedCount = 0;
      const finalSystemPrompt = extraInstruction ? `${systemPrompt}\n\n${extraInstruction}` : systemPrompt;

      const stream = anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: finalSystemPrompt,
        tools: [emitTourStopTool],
        tool_choice: { type: "tool", name: "emit_tour_stop" },
        messages: [{ role: "user", content: userMessage }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          currentToolName = event.content_block.name;
          currentToolJson = "";
        } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
          currentToolJson += event.delta.partial_json;
        } else if (event.type === "content_block_stop" && currentToolName === "emit_tour_stop") {
          try {
            const rawStop = JSON.parse(currentToolJson) as RawStop;
            const resolved = await resolveAgainstPlaces(rawStop, destinationCity, transport, destinationCenter);
            if (!resolved) {
              rejectedCount++;
            } else {
              console.log(`[tour-relevance] "${resolved.name}" -> "${(rawStop.themeRelevance ?? "").slice(0, 120)}"`);
              const weak = hasWeakThemeRelevance(rawStop.themeRelevance);
              if (weak) {
                // BUG FIX: previously incremented rejectedCount but still wrote to DB.
                // Now correctly skips the stop when themeRelevance is weak.
                console.log(`[tour-theme-weak] "${rawStop.name}" -> "${rawStop.themeRelevance ?? ""}"`);
                rejectedCount++;
              } else {
                const stopId = crypto.randomUUID();
                const idx = orderIndex++;

                if (!dryRun) {
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
                }

                completedStops.push({ ...resolved, id: stopId, orderIndex: idx });
              }
            }
          } catch (e) {
            console.error("[tours/generate] failed to parse stop tool call:", e);
            partialTour = true;
          }
          currentToolName = null;
          currentToolJson = "";
        } else if (event.type === "message_stop") {
          console.log(`[tour-stream] attempt ${attempt}${dryRun ? " (dry-run)" : ""}: ${completedStops.length} accepted, ${rejectedCount} rejected`);
        }
      }

      if (completedStops.length < targetStops) partialTour = true;

      return { completedStops, rejectedCount, partialTour };
    }

    // ── Attempt 0: initial stream ──────────────────────────────────────────────
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
    if (transport === "Walking" && walkViolations > 0) {
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

    // ── Attempt 3: under-emission retry — fill missing stops ─────────────────
    // Triggered whenever accepted stop count < targetStops after all prior attempts.
    // Appends to (not replaces) existing stops. Passes already-accepted names so
    // Claude doesn't repeat them. Each new stop goes through the same
    // resolveAgainstPlaces + themeRelevance gates.
    if (completedStops.length < targetStops) {
      const missing = targetStops - completedStops.length;
      const alreadyAccepted = completedStops.map(s => s.name);
      console.log(`[tour-underemission-retry] target=${targetStops} got=${completedStops.length}, retrying for ${missing} stops`);

      const fillInstruction = `ALREADY ACCEPTED STOPS — DO NOT REPEAT THESE (they are already in the tour):\n${alreadyAccepted.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nYou must emit exactly ${missing} NEW stop(s) that are DIFFERENT from the above list. All original constraints still apply.`;

      const fillTool: Anthropic.Tool = {
        ...emitTourStopTool,
        description: `Emit exactly ${missing} new stop(s) for the tour. Do NOT repeat any already-accepted stop.`,
      };

      const fillStream = anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: `${systemPrompt}\n\n${fillInstruction}`,
        tools: [fillTool],
        tool_choice: { type: "tool", name: "emit_tour_stop" },
        messages: [{ role: "user", content: userMessage }],
      });

      let fillToolName: string | null = null;
      let fillToolJson = "";
      let fillOrderIndex = completedStops.length;

      for await (const event of fillStream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          fillToolName = event.content_block.name;
          fillToolJson = "";
        } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
          fillToolJson += event.delta.partial_json;
        } else if (event.type === "content_block_stop" && fillToolName === "emit_tour_stop") {
          try {
            const rawStop = JSON.parse(fillToolJson) as RawStop;
            const isDuplicate = alreadyAccepted.some(
              n => n.toLowerCase() === (rawStop.name ?? "").toLowerCase()
            );
            if (isDuplicate) {
              console.log(`[tour-underemission-retry] duplicate skipped: "${rawStop.name}"`);
            } else {
              const resolved = await resolveAgainstPlaces(rawStop, destinationCity, transport, destinationCenter);
              if (resolved && !hasWeakThemeRelevance(rawStop.themeRelevance)) {
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
                completedStops.push({ ...resolved, id: stopId, orderIndex: idx });
                console.log(`[tour-underemission-retry] added "${resolved.name}" (${completedStops.length}/${targetStops})`);
              }
            }
          } catch (e) {
            console.error("[tour-underemission-retry] parse error:", e);
          }
          fillToolName = null;
          fillToolJson = "";
        } else if (event.type === "message_stop") {
          console.log(`[tour-underemission-retry] filled to ${completedStops.length}/${targetStops}`);
        }
      }
    }

    // ── Post-stream: DB is source of truth ───────────────────────────────────
    // Re-fetch so finalStopsFromDb reflects all attempts (including under-emission fills).
    let finalStopsFromDb = await db.tourStop.findMany({
      where: { tourId, deletedAt: null },
      orderBy: { orderIndex: "asc" },
    });

    // ── Route optimization ────────────────────────────────────────────────────
    const stopsWithCoords = finalStopsFromDb.filter(s => s.lat != null && s.lng != null);
    if (stopsWithCoords.length >= 3) {
      try {
        const optimized = optimizeRouteOrder(
          stopsWithCoords.map(s => ({ id: s.id, lat: s.lat!, lng: s.lng! }))
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

    // ── Response ───────────────────────────────────────────────────────────────
    const finalPartialTour = finalStopsFromDb.length < targetStops || !!clusterViolation;
    return NextResponse.json({
      tourId,
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
      generatedAt: new Date().toISOString(),
      ...(finalPartialTour ? { partialTour: true } : {}),
      ...(finalWalkViolations > 0 ? { walkViolations: finalWalkViolations } : {}),
      ...(clusterViolation ? { clusterViolation } : {}),
      ...(anchorViolation ? { anchorViolation } : {}),
    });

  } catch (err) {
    console.error("[tours/generate] error:", err);
    return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
  }
}
