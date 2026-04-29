import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip } from "@/lib/trip-permissions";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeCategorySlug } from "@/lib/categories";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { haversineKm } from "@/lib/geo";
import { buildFlokkerReason } from "@/lib/flokker-reason";
import type { FamilyContext } from "@/lib/flokker-reason";
import { rankRatedPicks } from "@/lib/rank-rated-picks";
import type { CommunitySpotPick } from "@/lib/rank-rated-picks";
import { buildContextHash } from "@/lib/recommendation-context";
import type { TripContext } from "@/lib/recommendation-context";
import { extractRichTripContext, allocateRecCounts } from "@/lib/trip-context-rich";
import { computeProximity, formatProximityLabel } from "@/lib/proximity-format";
import type { ActivityForProximity } from "@/lib/proximity-format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FLOKKER_SLOT = 4;
const AI_TOTAL = 12;
const FLOKK_PROXIMITY_KM = 30;

export type FetchedRec = {
  source: "event" | "flokker" | "ai";
  name: string;
  category: string;
  whyThisFamily: string;
  ageAppropriate: boolean;
  budgetTier: string;
  tip: string;
  tags: string[];
  websiteUrl: string | null;
  imageUrl: string | null;
  placeId: string | null;
  photoUrl: string | null;
  lat: number | null;
  lng: number | null;
  segmentCity: string | null;
  proximityLabel: string | null;
  avgRating?: number;
};

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryItems: { select: { id: true, type: true, title: true, latitude: true, longitude: true, dayIndex: true } },
      savedItems: {
        where: { tripId, deletedAt: null },
        select: { id: true, rawTitle: true },
      },
    },
  });
  if (!trip || !(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!trip.destinationCity || trip.destinationCity.trim() === "") {
    return NextResponse.json({ recommendations: [], error: "no_destination" }, { status: 200 });
  }

  // Build context hash to check cache validity
  const tripCtx: TripContext = {
    tripId,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry ?? null,
    lodgingLat: trip.accommodationLat ?? null,
    lodgingLng: trip.accommodationLng ?? null,
    itineraryItemIds: trip.itineraryItems.map(i => i.id),
    savedItemIds: trip.savedItems.map(s => s.id),
  };
  const contextHash = buildContextHash(tripCtx);

  if (
    trip.cachedRecommendationsContextHash === contextHash &&
    trip.cachedRecommendations !== null &&
    trip.cachedRecommendations !== undefined
  ) {
    console.log(`[recommendations] cache hit tripId=${tripId}`);
    return NextResponse.json({ recommendations: trip.cachedRecommendations, cached: true });
  }

  console.log(`[recommendations] cache miss tripId=${tripId} — generating`);

  const richContext = await extractRichTripContext(tripId, db);

  const familyCtx: FamilyContext = {
    childAges: richContext.family.childAges,
    pace: richContext.family.pace,
    interests: richContext.family.interests,
  };
  const durationDays = richContext.durationDays;

  // ── Source 1: Local Events (Phase A placeholder) ──────────────────────────
  const eventRecs: FetchedRec[] = [];

  // ── Source 2: Flokker-rated CommunitySpots ────────────────────────────────
  const cityNorm = trip.destinationCity.toLowerCase().trim();
  const rawSpots = await db.communitySpot.findMany({
    where: {
      city: { contains: cityNorm.split(" ")[0], mode: "insensitive" },
      averageRating: { gte: 4.0 },
      ratingCount: { gte: 1 },
    },
    select: {
      id: true,
      name: true,
      city: true,
      lat: true,
      lng: true,
      averageRating: true,
      ratingCount: true,
      googlePlaceId: true,
      photoUrl: true,
      websiteUrl: true,
      category: true,
    },
    take: 40,
  });

  const spotPicks: CommunitySpotPick[] = rawSpots
    .filter(s => {
      if (!trip.accommodationLat || !trip.accommodationLng) return true;
      if (!s.lat || !s.lng) return false;  // fail closed when proximity is enforceable
      return haversineKm(
        { lat: trip.accommodationLat, lng: trip.accommodationLng },
        { lat: s.lat, lng: s.lng }
      ) <= FLOKK_PROXIMITY_KM;
    })
    .map(s => ({
      id: s.id,
      name: s.name,
      destinationCity: s.city,
      lat: s.lat,
      lng: s.lng,
      avgRating: s.averageRating ?? 4.0,
      ratingCount: s.ratingCount,
      googlePlaceId: s.googlePlaceId ?? null,
      photoUrl: s.photoUrl ?? null,
    }));

  const rankedSpots = rankRatedPicks(spotPicks, familyCtx).slice(0, FLOKKER_SLOT);

  const flokkerRecs: FetchedRec[] = rankedSpots.map(s => {
    // Assign to nearest segment lodging — flokker query already filters to trip city
    let flokkerSegmentCity: string | null = richContext.destinationCity || null;
    if (s.lat && s.lng && richContext.segments.length > 0) {
      let minDist = Infinity;
      for (const seg of richContext.segments) {
        if (seg.lodgingLat == null || seg.lodgingLng == null) continue;
        const d = haversineKm({ lat: s.lat, lng: s.lng }, { lat: seg.lodgingLat, lng: seg.lodgingLng });
        if (d < minDist) { minDist = d; flokkerSegmentCity = seg.city; }
      }
    }
    return {
      source: "flokker",
      name: s.name,
      category: normalizeCategorySlug(
        rawSpots.find(r => r.id === s.id)?.category ?? null
      ) ?? "other",
      whyThisFamily: buildFlokkerReason(s, familyCtx),
      ageAppropriate: true,
      budgetTier: "Mid",
      tip: "",
      tags: [],
      websiteUrl: rawSpots.find(r => r.id === s.id)?.websiteUrl ?? null,
      imageUrl: s.photoUrl,
      placeId: s.googlePlaceId,
      photoUrl: s.photoUrl,
      lat: s.lat,
      lng: s.lng,
      segmentCity: flokkerSegmentCity,
      proximityLabel: null,
      avgRating: s.avgRating,
    };
  });

  // ── Source 3: AI-generated (multi-segment trip-aware Haiku) ─────────────────
  const alreadyNamed = [
    ...flokkerRecs.map(r => r.name),
    ...richContext.plannedActivities.map(a => a.title),
    ...richContext.savedForTrip.map(s => s.title),
  ];

  const aiNeeded = AI_TOTAL - eventRecs.length - flokkerRecs.length;

  // Re-allocate per-segment rec counts for the actual AI target
  const segsForPrompt = allocateRecCounts(richContext.segments, aiNeeded);

  const systemPrompt = `You are a family travel recommendation engine. You receive structured trip context with segments, planned activities, family profile, and historical preferences. Return ONLY valid JSON — no markdown, no preamble.

CRITICAL REQUIREMENTS:
1. Each recommendation must include segmentCity matching exactly one of the trip's segment cities
2. Do NOT duplicate already-planned or already-saved items: ${alreadyNamed.join(", ")}
3. Each recommendation must be a unique physical place — never multiple recommendations for the same venue with different framings
4. Past loved places and broader saves are TASTE SIGNALS, not items to match. Reason about the family's preferences from these patterns and apply those preferences to THIS trip. Do NOT recommend literal equivalents. Recommend things in THIS trip's destination cities that fit the INFERRED preference patterns.

Generate exactly ${aiNeeded} recommendations distributed across segments per the allocation in the user message.`;

  const haikuPrompt = [
    `This family is on a ${durationDays}-day trip with ${segsForPrompt.length} segment${segsForPrompt.length !== 1 ? "s" : ""} based on their actual bookings:`,
    "",
    ...segsForPrompt.map((s, i) =>
      `Segment ${i + 1}: Days ${s.dayStart}–${s.dayEnd} (${s.nights} nights) staying at ${s.lodgingName} in ${s.city}. Generate ${s.recAllocation} recommendations for this segment, near ${s.lodgingName}.`
    ),
    "",
    richContext.transitItems.length > 0
      ? `Transit on this trip:\n${richContext.transitItems.map(t => `- Day ${t.dayIndex ?? "?"}: ${t.title} (${t.fromCity ?? "?"} → ${t.toCity ?? "?"})`).join("\n")}`
      : null,
    "",
    "Already planned activities (do not duplicate or suggest variants):",
    richContext.plannedActivities.length > 0
      ? richContext.plannedActivities.map(a => `- Day ${a.dayIndex ?? "?"} (${a.segmentCity ?? "unassigned"}): ${a.title}`).join("\n")
      : "(none)",
    "",
    "Already saved for this trip (do not duplicate):",
    richContext.savedForTrip.length > 0
      ? richContext.savedForTrip.map(s => `- ${s.title}${s.city ? ` (${s.city})` : ""}`).join("\n")
      : "(none)",
    "",
    "Family profile:",
    `- Adults with kids ages: ${richContext.family.childAges.join(", ") || "(none)"}`,
    `- Travel style: ${richContext.family.travelStyle || "unspecified"}, Pace: ${richContext.family.pace || "unspecified"}`,
    `- Interests: ${richContext.family.interests.join(", ") || "(none specified)"}`,
    `- Home country: ${richContext.family.homeCountry || "unspecified"}`,
    richContext.family.dietaryRequirements.length > 0 ? `- Dietary: ${richContext.family.dietaryRequirements.join(", ")}` : null,
    richContext.family.mobilityNotes.length > 0 ? `- Mobility: ${richContext.family.mobilityNotes.join(", ")}` : null,
    "",
    "Family taste signals — INFER patterns, do NOT match literally:",
    "",
    `Past trips, top ${richContext.lovedPlaces.length} of ${richContext.totalLovedPlaces} highly-rated experiences:`,
    richContext.lovedPlaces.map(p => `${p.name}${p.city ? ` (${p.city})` : ""}`).join(", "),
    "",
    `Recent saves (broader interest signal, ${richContext.broaderSaves.totalCount} saves total):`,
    richContext.broaderSaves.sampleTitles.join(", "),
    "",
    `Top save categories: ${richContext.broaderSaves.topCategories.join(", ")}`,
    "",
    "These reveal what kinds of experiences resonate with this family. Reason about the patterns (e.g. 'walkable urban exploration', 'food markets and local cuisine', 'family-scale entertainment', 'outdoor activity in nature', 'immersive cultural experiences') and apply those patterns to recommendations for THIS trip's segment cities. Do NOT recommend literal equivalents.",
    "",
    `Generate exactly ${aiNeeded} recommendations distributed per segment allocations above. Each rec MUST specify segmentCity from this set: ${richContext.segments.map(s => s.city).join(", ")}.`,
    "",
    "Return JSON array. Each rec:",
    "{",
    '  "name": string,',
    '  "category": string (exactly one of: food_and_drink, culture, nature_and_outdoors, adventure, experiences, sports_and_entertainment, shopping, kids_and_family, lodging, nightlife, wellness, other),',
    `  "segmentCity": string (REQUIRED — must match a segment city exactly: ${richContext.segments.map(s => `"${s.city}"`).join(" or ")}),`,
    '  "whyThisFamily": string (specific reasoning for this family\'s inferred patterns or trip context),',
    '  "ageAppropriate": boolean,',
    '  "budgetTier": string (one of: Free, Budget, Mid, Premium, Luxury),',
    '  "tip": string (one practical sentence),',
    '  "tags": string[],',
    '  "websiteUrl": string (optional — real URL if confident)',
    "}",
  ].filter((s): s is string => s !== null).join("\n");

  let aiGenerationSucceeded = false;
  const aiRawRecs: FetchedRec[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: haikuPrompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[recommendations/ai] JSON parse failed", {
        tripId,
        rawLength: raw.length,
        cleanedLength: cleaned.length,
        rawPreview: raw.slice(0, 500),
        stopReason: response.stop_reason,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      throw parseErr;
    }

    const arr = Array.isArray(parsed) ? parsed : [];

    // Parse and prepare rec metadata (cheap, sequential)
    const recMeta = (arr as Array<Record<string, unknown>>).map(r => {
      const recCity = typeof r.segmentCity === "string" ? r.segmentCity : (trip.destinationCity ?? "");
      return {
        raw: r,
        category: normalizeCategorySlug(r.category as string | null) ?? "other",
        recCity,
        websiteUrl: (r.websiteUrl as string | null) ?? resolveCanonicalUrl({
          name: r.name as string,
          city: recCity,
          country: trip.destinationCountry ?? undefined,
        }),
      };
    });

    // Batch enrichWithPlaces calls with concurrency limit of 4
    const CONCURRENCY = 4;
    const enrichmentResults: Array<{ imageUrl: string | null; placeId: string | null; lat: number | null; lng: number | null }> = [];

    for (let i = 0; i < recMeta.length; i += CONCURRENCY) {
      const batch = recMeta.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (m) => {
          try {
            const e = await enrichWithPlaces(m.raw.name as string, m.recCity);
            return { imageUrl: e.imageUrl, placeId: e.placeId, lat: e.lat, lng: e.lng };
          } catch {
            return { imageUrl: null, placeId: null, lat: null, lng: null };
          }
        })
      );
      enrichmentResults.push(...batchResults);
    }

    // Build final aiRawRecs from metadata + enrichment results
    for (let i = 0; i < recMeta.length; i++) {
      const m = recMeta[i];
      const enriched = enrichmentResults[i];
      aiRawRecs.push({
        source: "ai",
        name: m.raw.name as string,
        category: m.category,
        whyThisFamily: (m.raw.whyThisFamily as string) ?? "",
        ageAppropriate: (m.raw.ageAppropriate as boolean) ?? true,
        budgetTier: (m.raw.budgetTier as string) ?? "Mid",
        tip: (m.raw.tip as string) ?? "",
        tags: Array.isArray(m.raw.tags) ? (m.raw.tags as string[]) : [],
        websiteUrl: m.websiteUrl,
        imageUrl: enriched.imageUrl,
        placeId: enriched.placeId,
        lat: enriched.lat,
        lng: enriched.lng,
        segmentCity: typeof m.raw.segmentCity === "string" ? m.raw.segmentCity : null,
        proximityLabel: null,
        photoUrl: null,
      });
    }

    aiGenerationSucceeded = true;
  } catch (err) {
    console.error("[recommendations/ai] generation failed", {
      tripId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    });
  }

  const recommendations: FetchedRec[] = [...eventRecs, ...flokkerRecs, ...aiRawRecs].map(rec => {
    const segment = rec.segmentCity
      ? richContext.segments.find(s => s.city.toLowerCase() === rec.segmentCity!.toLowerCase())
      : null;

    if (!segment || segment.lodgingLat == null || segment.lodgingLng == null) {
      return { ...rec, proximityLabel: null };
    }

    // Activities scoped to this segment, with placeholder-coord filter
    const sameSegmentActivities: ActivityForProximity[] = richContext.plannedActivities
      .filter(a =>
        a.segmentCity?.toLowerCase() === segment.city.toLowerCase() &&
        a.lat != null && a.lng != null
      )
      .filter(a => {
        // Exclude activities within 1km of segment lodging whose title lacks a segment-city token
        // — catches tour-style activities geocoded to city-center pickup points
        const distFromLodging = haversineKm(
          { lat: a.lat!, lng: a.lng! },
          { lat: segment.lodgingLat!, lng: segment.lodgingLng! }
        );
        if (distFromLodging < 1) {
          const titleLower = (a.title ?? "").toLowerCase();
          const segToken = segment.city.toLowerCase();
          if (!titleLower.includes(segToken)) return false;
        }
        return true;
      })
      .map(a => ({
        title: a.title,
        lat: a.lat!,
        lng: a.lng!,
        dayIndex: a.dayIndex ?? null,
      }));

    return {
      ...rec,
      proximityLabel: formatProximityLabel(computeProximity(
        rec.lat,
        rec.lng,
        segment.lodgingLat,
        segment.lodgingLng,
        segment.lodgingName,
        sameSegmentActivities,
      )),
    };
  });

  const shouldCache = aiGenerationSucceeded || aiNeeded === 0;

  console.log("[recommendations]", {
    tripId,
    sources: { event: eventRecs.length, flokker: flokkerRecs.length, ai: aiRawRecs.length },
    total: recommendations.length,
    aiGenerationSucceeded,
    aiNeeded,
    willCache: shouldCache,
  });

  if (shouldCache) {
    await db.trip.update({
      where: { id: tripId },
      data: {
        cachedRecommendations: recommendations as object[],
        cachedRecommendationsGeneratedAt: new Date(),
        cachedRecommendationsContextHash: contextHash,
      },
    });
  }

  return NextResponse.json({
    recommendations,
    cached: false,
    aiGenerationFailed: !aiGenerationSucceeded && aiNeeded > 0,
  });
}
