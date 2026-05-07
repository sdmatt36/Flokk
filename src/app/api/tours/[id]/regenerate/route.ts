import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { findBestInsertionIndex } from "@/lib/tour-route-optimization";
import { haversineKm } from "@/lib/geo";

// Note: helpers duplicated from generate/route.ts (refactor to shared lib deferred)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

type ResolvedStop = RawStop & { imageUrl: string | null; websiteUrl: string | null };
type PersistedStop = ResolvedStop & { id: string; orderIndex: number };

function formatStop(s: PersistedStop) {
  return {
    id: s.id,
    orderIndex: s.orderIndex,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    duration: s.duration,
    travelTime: s.travelTime,
    why: s.why,
    familyNote: s.familyNote,
    imageUrl: s.imageUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
  };
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
    if (!loc) { console.log(`[regen-resolve] geocode failed: ${destinationCity} no results`); return null; }
    console.log(`[regen-resolve] geocode ${destinationCity} → ${loc.lat},${loc.lng}`);
    return { lat: loc.lat, lng: loc.lng };
  } catch (e) {
    console.log(`[regen-resolve] geocode failed: ${destinationCity} ${String(e)}`);
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
    if (!firstResult?.geometry?.location) return null;

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=name,formatted_address,geometry,photos,address_components,website&language=en&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        photos?: Array<{ photo_reference: string }>;
        website?: string;
      };
    };

    const components = detailsData.result?.address_components ?? [];

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
      console.log(`[regen-resolve] REJECTED "${stop.name}" — city ${componentList}, ${distInfo} (mode: ${transport})`);
      return null;
    }
    const acceptedVia = cityMatch ? "cityName" : `distance ${distKm!.toFixed(1)}km`;
    console.log(`[regen-resolve] ACCEPTED "${stop.name}" via ${acceptedVia}`);

    const photoRef = detailsData.result?.photos?.[0]?.photo_reference;
    let imageUrl: string | null = null;
    if (photoRef) {
      try {
        const photoRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
          { redirect: "follow" }
        );
        imageUrl = photoRes.url;
      } catch { /* non-fatal */ }
    }

    const { lat, lng } = firstResult.geometry.location;
    const websiteUrl = detailsData.result?.website ?? null;
    return { ...stop, lat, lng, imageUrl, websiteUrl };
  } catch (e) {
    console.error("[regen-resolve] error:", stop.name, e);
    if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) return { ...stop, imageUrl: null, websiteUrl: null };
    return null;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const profileId = await resolveProfileId(userId);
  if (!profileId) return new Response("Unauthorized", { status: 401 });

  const { id: tourId } = await context.params;
  const body = await req.json() as { count?: number };
  const count = Math.max(1, Math.min(5, body.count ?? 1));

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    include: {
      stops: { orderBy: { orderIndex: "asc" } },
      familyProfile: {
        include: {
          members: { select: { role: true, birthDate: true } },
        },
      },
    },
  });
  if (!tour) return new Response("Tour not found", { status: 404 });
  if (tour.familyProfileId !== profileId) return new Response("Forbidden", { status: 403 });

  const activeStops = tour.stops.filter(s => !s.deletedAt);
  const rejectedNames = tour.stops.filter(s => s.deletedAt).map(s => s.name);

  // Family context
  const childAges = tour.familyProfile.members
    .filter(m => m.role === "CHILD" && m.birthDate != null)
    .map(m => ageFromBirthDate(m.birthDate))
    .filter((a): a is number => a !== null);
  const youngestChildAge = childAges.length ? Math.min(...childAges) : null;
  const maxWalk = maxWalkMinutes(youngestChildAge);
  const childAgesContext = childAges.length
    ? `children aged ${childAges.join(", ")}`
    : "ages not specified";

  const acceptedSummary = activeStops.length > 0
    ? activeStops.map((s, i) => `${i + 1}. ${s.name}${s.why ? ` — ${s.why}` : ""}`).join("\n")
    : "(no stops accepted yet)";

  const rejectedClause = rejectedNames.length > 0
    ? `\n\nABSOLUTELY DO NOT include any of these previously rejected stops:\n${rejectedNames.map(n => `- ${n}`).join("\n")}`
    : "";

  const transport = tour.transport;
  const destinationCity = tour.destinationCity;

  const destinationCenter = await getDestinationCenter(destinationCity);
  if (!destinationCenter) {
    console.log(`[regen-resolve] no destination center for ${destinationCity}; cityName-match only`);
  }

  const systemPrompt = `You are a family travel expert adding replacement stops to an existing themed tour. Call emit_tour_stop exactly ${count} time(s) — once per stop.

ABSOLUTE RULES — violating any of these means the tour fails:
1. Every stop MUST be a real, operating venue physically located IN ${destinationCity}. No venues from other cities. No "branch" workarounds. No closed or fictional places.
2. Every stop MUST directly serve the theme: "${tour.prompt}". No tangential sightseeing added for variety.
3. ${transport === "Walking" ? `Walking tour: every stop MUST be within ${maxWalk} minutes walk (~${maxWalk * 80}m) of the existing stops. Cluster tightly in one neighborhood.` : transport === "Metro / Transit" ? "Metro tour: stops can span the city but must be reachable by public transit." : "Car tour: no distance constraint."}
4. familyNote MUST reference the specific children: ${childAgesContext}. Tailor to their ages.

The user has already accepted these stops and wants you to ADD to them, not replace them:
${acceptedSummary}

Generate stops that complement the accepted set thematically. They must fit the same theme, the same destination city, and the same transport mode.${rejectedClause}`;

  const emitTourStopTool: Anthropic.Tool = {
    name: "emit_tour_stop",
    description: `Emit one replacement stop for the tour. Call this tool exactly ${count} time(s), once per stop.`,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        lat: { type: "number" },
        lng: { type: "number" },
        duration: { type: "number", description: "Minutes at this stop" },
        travelTime: { type: "number", description: "Minutes to travel to the NEXT stop, 0 for the last stop" },
        why: { type: "string", description: "One sentence on why this stop fits the theme" },
        familyNote: { type: "string", description: `Specific note for this family: ${childAgesContext}` },
        themeRelevance: { type: "string", description: `Specific justification for why this exact venue directly serves the theme "${tour.prompt}". Avoid vague phrases like "provides atmosphere", "complements", or "adds variety". If you cannot justify the stop concretely, choose a different venue.` },
      },
      required: ["name", "address", "lat", "lng", "duration", "travelTime", "why", "familyNote", "themeRelevance"],
    },
  };

  const userMessage = `Tour theme: ${tour.prompt}. Destination: ${destinationCity}. Transport: ${transport}. Generate ${count} replacement stop(s) to append to the existing ${activeStops.length} accepted stops.`;

  const newlyCreatedStops: PersistedStop[] = [];
  let currentToolName: string | null = null;
  let currentToolJson = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
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
          if (resolved) {
            const weak = hasWeakThemeRelevance(rawStop.themeRelevance);
            if (!weak) {
              const stopId = crypto.randomUUID();

              // Find optimal insertion slot in the current active route
              const currentActive = await db.tourStop.findMany({
                where: { tourId, deletedAt: null },
                orderBy: { orderIndex: "asc" },
                select: { id: true, orderIndex: true, lat: true, lng: true },
              });

              const coordStops = currentActive.filter(s => s.lat != null && s.lng != null);

              let insertionOrderIndex: number;
              if (coordStops.length === 0 || resolved.lat == null || resolved.lng == null) {
                // No coords to optimize against — append
                const maxIdx = currentActive.length > 0
                  ? Math.max(...currentActive.map(s => s.orderIndex))
                  : -1;
                insertionOrderIndex = maxIdx + 1;
              } else {
                const insertionPos = findBestInsertionIndex(
                  coordStops.map(s => ({ id: s.id, lat: s.lat!, lng: s.lng! })),
                  { id: stopId, lat: resolved.lat, lng: resolved.lng }
                );

                if (insertionPos >= coordStops.length) {
                  // Append at end — no shifts needed
                  const maxIdx = currentActive[currentActive.length - 1]?.orderIndex ?? -1;
                  insertionOrderIndex = maxIdx + 1;
                } else {
                  // Insert at position — shift existing stops up
                  const targetOrderIndex = coordStops[insertionPos].orderIndex;
                  await db.tourStop.updateMany({
                    where: {
                      tourId,
                      deletedAt: null,
                      orderIndex: { gte: targetOrderIndex },
                    },
                    data: {
                      orderIndex: { increment: 1 },
                    },
                  });
                  insertionOrderIndex = targetOrderIndex;
                }
              }

              await db.tourStop.create({
                data: {
                  id: stopId,
                  tourId,
                  orderIndex: insertionOrderIndex,
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
                },
              });

              newlyCreatedStops.push({ ...resolved, id: stopId, orderIndex: insertionOrderIndex });
            }
          }
        } catch (e) {
          console.error("[regen] failed to parse stop:", e);
        }
        currentToolName = null;
        currentToolJson = "";
      }
    }
  } catch (err) {
    console.error("[regen] stream error:", err);
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }

  // Return all active stops in their new order so the client can fully replace its state
  const finalActive = await db.tourStop.findMany({
    where: { tourId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
  });

  const finalFormatted = finalActive.map(s => ({
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

  return NextResponse.json({
    newStops: newlyCreatedStops.map(formatStop),
    allActive: finalFormatted,
  });
}
