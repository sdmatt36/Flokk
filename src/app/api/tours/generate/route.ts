import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { haversineMeters } from "@/lib/geo";
import { optimizeRouteOrder } from "@/lib/tour-route-optimization";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

type ResolvedStop = RawStop & { imageUrl: string | null };

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

async function resolveAgainstPlaces(stop: RawStop, destinationCity: string, transport: string): Promise<ResolvedStop | null> {
  try {
    const cityNorm = destinationCity.toLowerCase().split(",")[0].trim();
    const query = encodeURIComponent(`${stop.name} ${stop.address || ""} ${destinationCity}`);
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`
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
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=name,formatted_address,geometry,photos,address_components&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        photos?: Array<{ photo_reference: string }>;
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
    if (!cityMatch) {
      const componentList = cityComponents.map(c => c.long_name).join(", ") || "none";
      console.log(`[tour-resolve] REJECTED "${stop.name}" — city components ${componentList} do not match "${cityNorm}" (mode: ${transport}, allowed: ${allowedTypes.join("|")})`);
      return null;
    }

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
    console.log(`[tour-resolve] OK "${stop.name}" -> ${lat},${lng}${imageUrl ? " [photo]" : ""}`);
    return { ...stop, lat, lng, imageUrl };
  } catch (e) {
    console.error("[tour-resolve] error:", stop.name, e);
    if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) return { ...stop, imageUrl: null };
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
  };
  const { prompt, destinationCity } = body;
  const durationLabel = body.durationLabel ?? "";
  const transport = body.transport ?? "Walking";

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

    const profile = await db.familyProfile.findUnique({
      where: { id: profileId },
      include: {
        members: { select: { name: true, role: true, dietaryRequirements: true, birthDate: true } },
        interests: { select: { interestKey: true } },
      },
    });

    let familyContext = "";
    let youngestChildAge: number | null = null;
    let childAgesContext = "ages not specified";

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

    const maxWalk = maxWalkMinutes(youngestChildAge);

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
          why: { type: "string", description: "One sentence on why this stop fits the theme" },
          familyNote: { type: "string", description: `Specific note for this family: ${childAgesContext}` },
          themeRelevance: { type: "string", description: `Specific justification for why this exact venue directly serves the theme "${prompt}". Name what happens at this venue that fits the theme. Avoid vague phrases like "provides atmosphere", "complements", or "adds variety". If you cannot justify the stop concretely, choose a different venue.` },
        },
        required: ["name", "address", "lat", "lng", "duration", "travelTime", "why", "familyNote", "themeRelevance"],
      },
    };

    const systemPrompt = `You are a family travel expert building themed day tours. Call emit_tour_stop exactly ${targetStops} times — once per stop, in order.

ABSOLUTE RULES — violating any of these means the tour fails:
1. Every stop MUST be a real, operating venue physically located IN ${destinationCity}. No venues from other cities. No "branch" workarounds. No closed or fictional places.
2. Every stop MUST directly serve the theme. No tangential sightseeing added for variety.
3. ${transport === "Walking" ? `Walking tour: every consecutive stop pair MUST be within ${maxWalk} minutes walk (~${maxWalk * 80}m) of each other. Cluster tightly in one neighborhood.` : transport === "Metro / Transit" ? "Metro tour: stops can span the city but must be reachable by public transit." : "Car tour: no distance constraint."}
4. Total time (sum of all duration + travelTime) must not exceed ${maxMinutes} minutes.
5. familyNote MUST reference the specific children: ${childAgesContext}. Tailor to their ages.`;

    const userMessage = `${seededContext}Tour theme: ${prompt}. Destination: ${destinationCity}. Duration: ${durationLabel || "Half day (4 hrs)"}. Transport: ${transport}. Family: ${familyContext || "not specified"}`;

    type PersistedStop = ResolvedStop & { id: string; orderIndex: number };

    async function runStream(attempt: number, extraInstruction = ""): Promise<{ completedStops: PersistedStop[]; rejectedCount: number; partialTour: boolean }> {
      if (attempt > 0) {
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
            const resolved = await resolveAgainstPlaces(rawStop, destinationCity, transport);
            if (!resolved) {
              rejectedCount++;
            } else {
              console.log(`[tour-relevance] "${resolved.name}" -> "${(rawStop.themeRelevance ?? "").slice(0, 120)}"`);
              const weak = hasWeakThemeRelevance(rawStop.themeRelevance);
              if (weak) {
                console.log(`[tour-theme-weak] "${rawStop.name}" -> "${rawStop.themeRelevance ?? ""}"`);
                rejectedCount++;
              }
              const stopId = crypto.randomUUID();
              const idx = orderIndex++;

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
                },
              });

              completedStops.push({ ...resolved, id: stopId, orderIndex: idx });
            }
          } catch (e) {
            console.error("[tours/generate] failed to parse stop tool call:", e);
            partialTour = true;
          }
          currentToolName = null;
          currentToolJson = "";
        } else if (event.type === "message_stop") {
          console.log(`[tour-stream] attempt ${attempt}: ${completedStops.length} accepted, ${rejectedCount} rejected`);
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
    const maxDistMeters = maxWalk * 80;
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

    // ── Attempt 2: walk-violation retry with clustering hint ──────────────────
    if (transport === "Walking" && walkViolations > 0) {
      const clusteringHint = `CRITICAL: The previous attempt produced stops that were too far apart for walking with kids. ALL stops MUST cluster within a single neighborhood or district. Every consecutive stop pair MUST be within ${maxWalk} minutes walk (~${maxDistMeters}m). If you cannot find ${targetStops} venues on theme within one walkable area, return fewer stops rather than spreading across the city.`;
      console.log(`[tour-walk-retry] ${walkViolations} walk violations detected — retrying with clustering hint`);
      const retryResult = await runStream(2, clusteringHint);
      if (retryResult.completedStops.length >= Math.min(2, completedStops.length)) {
        let retryViolations = 0;
        for (let i = 1; i < retryResult.completedStops.length; i++) {
          const prev = retryResult.completedStops[i - 1];
          const curr = retryResult.completedStops[i];
          if (prev.lat && prev.lng && curr.lat && curr.lng) {
            const dist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
            if (dist > maxDistMeters) retryViolations++;
          }
        }
        if (retryViolations < walkViolations) {
          console.log(`[tour-walk-retry-success] was ${walkViolations} violations, now ${retryViolations}`);
          completedStops = retryResult.completedStops;
          partialTour = retryResult.partialTour;
          walkViolations = retryViolations;
        } else {
          console.log(`[tour-walk-retry-noop] retry had ${retryViolations} violations, keeping original`);
        }
      }
    }

    // ── Post-stream: DB is source of truth ───────────────────────────────────
    // completedStops can diverge from DB when retries run deleteMany then
    // are discarded (noop path) or produce fewer stops than expected.
    // Re-fetch from DB before any further processing or response building.
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

    // ── Response ───────────────────────────────────────────────────────────────
    const finalPartialTour = finalStopsFromDb.length < targetStops;
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
      })),
      destinationCity,
      prompt,
      durationLabel,
      transport,
      generatedAt: new Date().toISOString(),
      ...(finalPartialTour ? { partialTour: true } : {}),
      ...(finalWalkViolations > 0 ? { walkViolations: finalWalkViolations } : {}),
    });

  } catch (err) {
    console.error("[tours/generate] error:", err);
    return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
  }
}
