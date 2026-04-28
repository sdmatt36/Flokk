import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { extractRichTripContext } from "@/lib/trip-context-rich";
import type { RichTripContext } from "@/lib/trip-context-rich";
import { fetchSportsDBEvents } from "@/lib/events/thesportsdb";
import type { RawEvent, EventCategory } from "@/lib/events/types";
import { generateTicketUrl } from "@/lib/events/ticket-urls";
import { haversineKm } from "@/lib/geo";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TIME_BOUND_CATEGORIES: EventCategory[] = [
  "live_music",
  "sports_events",
  "comedy_shows",
  "seasonal_events",
  "family_kids",
];

const KID_FRIENDLY_AGE_THRESHOLD = 14;
const TOP_N_ENRICH = 8;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
      familyProfile: {
        include: {
          interests: { select: { interestKey: true } },
          members: { select: { birthDate: true, role: true } },
        },
      },
    },
  });

  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Filter to time-bound categories enabled in profile
  const enabledInterests = trip.familyProfile?.interests.map((i) => i.interestKey) ?? [];
  const enabledTimeBound = TIME_BOUND_CATEGORIES.filter((c) => enabledInterests.includes(c));

  // Implicit kid-friendly: explicit toggle OR any child under threshold at trip start
  const tripStart = trip.startDate ? new Date(trip.startDate) : new Date();
  const childUnderThreshold = (trip.familyProfile?.members ?? [])
    .filter((m) => m.role === "CHILD" && m.birthDate)
    .some((m) => {
      const age = (tripStart.getTime() - m.birthDate!.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age < KID_FRIENDLY_AGE_THRESHOLD;
    });
  const applyKidFriendly = enabledInterests.includes("kid_friendly") || childUnderThreshold;

  console.log(
    `[events] tripId=${tripId} categories=[${enabledTimeBound.join(",")}] kidFriendly=${applyKidFriendly}`
  );

  // No time-bound categories enabled — write stable hash and return empty
  if (enabledTimeBound.length === 0) {
    await db.trip.update({
      where: { id: tripId },
      data: { eventsContextHash: "no_categories", eventsGeneratedAt: new Date() },
    });
    return NextResponse.json({
      events: [],
      cached: false,
      reason: "no_time_bound_categories_enabled",
    });
  }

  // Extract rich context for segments
  const richContext = await extractRichTripContext(tripId, db);

  // Context hash: segments + enabled categories + kid-friendly flag
  const segmentSig = richContext.segments
    .map((s) => `${s.city}:${s.dayStart}-${s.dayEnd}`)
    .sort()
    .join("|");
  const contextHash = crypto
    .createHash("sha256")
    .update(`${tripId}|${segmentSig}|${enabledTimeBound.slice().sort().join(",")}|${applyKidFriendly}`)
    .digest("hex")
    .slice(0, 16);

  // Cache check: 24-hour TTL
  if (
    trip.eventsContextHash === contextHash &&
    trip.eventsGeneratedAt &&
    Date.now() - trip.eventsGeneratedAt.getTime() < CACHE_TTL_MS
  ) {
    const cachedEvents = await db.event.findMany({
      where: { tripId },
      orderBy: { startDateTime: "asc" },
    });
    console.log(`[events] cache hit tripId=${tripId} count=${cachedEvents.length}`);
    return NextResponse.json({ events: cachedEvents, cached: true });
  }

  console.log(`[events] cache miss tripId=${tripId} — generating`);

  // Query providers per segment
  const allRawEvents: RawEvent[] = [];
  let providerErrorCount = 0;

  for (const segment of richContext.segments) {
    const segStart = new Date(tripStart);
    segStart.setDate(segStart.getDate() + segment.dayStart);
    const segEnd = new Date(tripStart);
    segEnd.setDate(segEnd.getDate() + segment.dayEnd);

    const queryParams = {
      city: segment.city,
      country: trip.destinationCountry ?? null,
      startDate: segStart,
      endDate: segEnd,
      categories: enabledTimeBound,
    };

    // Phase A: only TheSportsDB fires. Other categories no-op in adapter.
    try {
      const sportsEvents = await fetchSportsDBEvents(queryParams);
      allRawEvents.push(...sportsEvents);
    } catch (err) {
      console.warn(`[events] thesportsdb failed for segment ${segment.city}:`, err);
      providerErrorCount++;
    }
  }

  console.log(`[events] raw fetched: ${allRawEvents.length}, errors: ${providerErrorCount}`);

  // Deduplicate by (sourceProvider, sourceEventId)
  const seen = new Set<string>();
  const dedupedEvents: RawEvent[] = [];
  for (const e of allRawEvents) {
    const key = `${e.sourceProvider}:${e.sourceEventId}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedEvents.push(e);
    }
  }

  // Kid-friendly filter
  let filteredEvents = dedupedEvents;
  if (applyKidFriendly) {
    const beforeCount = filteredEvents.length;
    filteredEvents = filteredEvents.filter(isKidFriendly);
    console.log(`[events] kid_friendly filter applied, removed ${beforeCount - filteredEvents.length}`);
  }

  // Relevance scoring
  const scored = filteredEvents.map((e) => {
    let score = 1.0;

    // Find owning segment by date
    const segment = richContext.segments.find((s) => {
      const segStart = new Date(tripStart);
      segStart.setDate(segStart.getDate() + s.dayStart);
      const segEnd = new Date(tripStart);
      segEnd.setDate(segEnd.getDate() + s.dayEnd);
      return e.startDateTime >= segStart && e.startDateTime <= segEnd;
    });

    // Proximity boost (venue coords only available on paid tier)
    if (
      segment &&
      e.venueLat != null &&
      e.venueLng != null &&
      segment.lodgingLat != null &&
      segment.lodgingLng != null
    ) {
      const dist = haversineKm(
        { lat: e.venueLat, lng: e.venueLng },
        { lat: segment.lodgingLat, lng: segment.lodgingLng }
      );
      if (dist < 5) score += 1.0;
      else if (dist < 15) score += 0.5;
      else if (dist > 50) score -= 0.3;
    }

    // Weekend boost
    const day = e.startDateTime.getDay();
    if (day === 5 || day === 6 || day === 0) score += 0.1;

    return { event: e, score, segmentCity: segment?.city ?? null };
  });

  scored.sort((a, b) => b.score - a.score);

  // Top N get Haiku enrichment
  const topN = scored.slice(0, TOP_N_ENRICH);
  const rest = scored.slice(TOP_N_ENRICH);

  let enrichmentSucceeded = true;
  const enrichedTop: Array<{
    event: RawEvent;
    segmentCity: string | null;
    whyThisFamily: string | null;
    relevanceScore: number;
  }> = [];

  if (topN.length > 0) {
    try {
      const CONCURRENCY = 4;
      for (let i = 0; i < topN.length; i += CONCURRENCY) {
        const batch = topN.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async ({ event, score, segmentCity }) => ({
            event,
            segmentCity,
            whyThisFamily: await generateWhyThisFamily(event, richContext),
            relevanceScore: score,
          }))
        );
        enrichedTop.push(...batchResults);
      }
    } catch (err) {
      console.error("[events] Haiku enrichment failed:", err);
      enrichmentSucceeded = false;
    }
  }

  const finalEvents = [
    ...enrichedTop,
    ...rest.map(({ event, score, segmentCity }) => ({
      event,
      segmentCity,
      whyThisFamily: null,
      relevanceScore: score,
    })),
  ];

  console.log("[events]", {
    tripId,
    rawCount: allRawEvents.length,
    afterDedup: dedupedEvents.length,
    afterKidFriendly: filteredEvents.length,
    final: finalEvents.length,
    enriched: enrichedTop.length,
    enrichmentSucceeded,
    willCache: enrichmentSucceeded || topN.length === 0,
  });

  // Cache write conditional: only when enrichment succeeded OR nothing to enrich
  const shouldCache = enrichmentSucceeded || topN.length === 0;

  if (shouldCache) {
    await db.event.deleteMany({ where: { tripId } });

    if (finalEvents.length > 0) {
      await db.event.createMany({
        data: finalEvents.map(({ event, segmentCity, whyThisFamily, relevanceScore }) => ({
          id: crypto.randomBytes(12).toString("hex"),
          tripId,
          segmentCity: segmentCity ?? "",
          category: event.category,
          title: event.title,
          venue: event.venue,
          venueLat: event.venueLat,
          venueLng: event.venueLng,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          description: event.description,
          imageUrl: event.imageUrl,
          ticketUrl: event.ticketUrl ?? generateTicketUrl({
            title: event.title,
            venue: event.venue,
            startDateTime: event.startDateTime,
            category: event.category,
          }),
          affiliateProvider: null,
          sourceProvider: event.sourceProvider,
          sourceEventId: event.sourceEventId,
          whyThisFamily,
          relevanceScore,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        })),
      });
    }

    await db.trip.update({
      where: { id: tripId },
      data: { eventsContextHash: contextHash, eventsGeneratedAt: new Date() },
    });
  }

  // Return fresh from DB to include generated IDs and timestamps
  const finalDb = await db.event.findMany({
    where: { tripId },
    orderBy: { startDateTime: "asc" },
  });

  return NextResponse.json({
    events: finalDb,
    cached: false,
    enrichmentFailed: !enrichmentSucceeded,
  });
}

function isKidFriendly(event: RawEvent): boolean {
  const titleLower = event.title.toLowerCase();
  const descLower = (event.description ?? "").toLowerCase();

  const adultMarkers = [
    "18+", "21+", "adults only", "adult content",
    "burlesque", "after dark", "explicit",
  ];
  if (adultMarkers.some((m) => titleLower.includes(m) || descLower.includes(m))) return false;

  // Late-night events (21:00+) excluded for young kids; sports games excepted
  if (event.startDateTime.getHours() >= 21) {
    if (event.category === "sports_events") return true;
    return false;
  }

  return true;
}

async function generateWhyThisFamily(
  event: RawEvent,
  richContext: RichTripContext
): Promise<string | null> {
  const systemPrompt =
    "You are reasoning about which events match a specific family. Given an event and a family's trip context, taste signals, and travel patterns, generate ONE short sentence (max 25 words) explaining why this specific family would enjoy this specific event. Reference inferred patterns from their loved places and saves — do NOT recommend things just because they match a category label. Return ONLY the sentence as plain text, no JSON, no quotes.";

  const userPrompt = [
    "EVENT:",
    event.title,
    event.venue ? `Venue: ${event.venue}` : null,
    `Date: ${event.startDateTime.toISOString().split("T")[0]}`,
    `Category: ${event.category}`,
    "",
    "FAMILY CONTEXT:",
    `Children ages: ${richContext.family.childAges.join(", ") || "(none)"}`,
    `Travel style: ${richContext.family.travelStyle ?? "unspecified"}, Pace: ${richContext.family.pace ?? "unspecified"}`,
    `Interests: ${richContext.family.interests.join(", ") || "(none)"}`,
    "",
    "TASTE SIGNALS (infer patterns, do NOT match literally):",
    `Past loved: ${richContext.lovedPlaces.map((p) => `${p.name}${p.city ? ` (${p.city})` : ""}`).join(", ")}`,
    `Recent saves: ${richContext.broaderSaves.sampleTitles.join(", ")}`,
    "",
    "Return one sentence (max 25 words) on why THIS family would enjoy THIS event. Reference their inferred preference patterns. Plain text only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return raw.length > 0 ? raw : null;
  } catch (err) {
    console.warn("[events] generateWhyThisFamily failed:", err);
    return null;
  }
}
