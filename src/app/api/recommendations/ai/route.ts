import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeCategorySlug } from "@/lib/categories";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { haversineKm } from "@/lib/geo";
import { buildFlokkerReason } from "@/lib/flokker-reason";
import type { FamilyContext } from "@/lib/flokker-reason";
import { rankRatedPicks } from "@/lib/rank-rated-picks";
import type { CommunitySpotPick } from "@/lib/rank-rated-picks";
import { buildContextHash, buildHaikuContextPrompt } from "@/lib/recommendation-context";
import type { TripContext } from "@/lib/recommendation-context";

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
  avgRating?: number;
};

function calcAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

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
      itineraryItems: { select: { id: true, type: true, title: true, latitude: true, longitude: true } },
      savedItems: {
        where: { tripId, deletedAt: null },
        select: { id: true, rawTitle: true },
      },
    },
  });
  if (!trip || trip.familyProfileId !== profileId) {
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

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: {
      members: {
        select: {
          name: true,
          role: true,
          birthDate: true,
          dietaryRequirements: true,
          foodAllergies: true,
          mobilityNotes: true,
        },
      },
      interests: { select: { interestKey: true } },
    },
  });
  if (!profile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const tripStart = trip.startDate ? new Date(trip.startDate) : new Date();
  const tripEnd   = trip.endDate   ? new Date(trip.endDate)   : tripStart;
  const durationDays = Math.max(1, Math.round((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1);

  const childAges = profile.members
    .filter(m => m.role === "CHILD" && m.birthDate)
    .map(m => calcAge(m.birthDate!, tripStart));

  const familyCtx: FamilyContext = {
    childAges,
    pace: profile.pace ?? null,
    interests: profile.interests.map(i => i.interestKey),
  };

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

  const flokkerRecs: FetchedRec[] = rankedSpots.map(s => ({
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
    avgRating: s.avgRating,
  }));

  // ── Source 3: AI-generated (trip-aware Haiku) ─────────────────────────────
  const placeRatings = await db.placeRating.findMany({
    where: { familyProfileId: profileId },
    orderBy: { rating: "desc" },
    take: 5,
    select: { placeName: true, destinationCity: true, rating: true },
  });

  const recentSaves = await db.savedItem.findMany({
    where: { familyProfileId: profileId },
    select: { categoryTags: true },
    orderBy: { savedAt: "desc" },
    take: 100,
  });
  const catCount: Record<string, number> = {};
  for (const item of recentSaves) {
    for (const tag of item.categoryTags) {
      if (tag) catCount[tag] = (catCount[tag] ?? 0) + 1;
    }
  }
  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const lodgingItem = trip.itineraryItems.find(i => i.type === "LODGING");
  const lodgingAddress = lodgingItem?.title ?? null;

  const plannedActivities = trip.itineraryItems
    .filter(i => i.type === "ACTIVITY")
    .map(i => i.title);
  const savedForTrip = trip.savedItems
    .map(s => s.rawTitle)
    .filter((t): t is string => !!t);

  const familyContextStr = [
    `Adults: ${profile.members.filter(m => m.role === "ADULT").map(m => m.name ?? "Adult").join(", ")}`,
    childAges.length > 0 ? `Children ages: ${childAges.join(", ")}` : null,
    profile.travelStyle ? `Travel style: ${profile.travelStyle}` : null,
    profile.pace ? `Pace: ${profile.pace}` : null,
    profile.interests.length > 0 ? `Interests: ${profile.interests.map(i => i.interestKey).join(", ")}` : null,
    topCategories.length > 0 ? `Top save categories: ${topCategories.join(", ")}` : null,
    placeRatings.length > 0
      ? `Loved places: ${placeRatings.map(r => `${r.placeName} (${r.rating}★)`).join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const haikuPrompt = buildHaikuContextPrompt(tripCtx, {
    familyContext: familyContextStr,
    plannedActivities,
    savedForTrip,
    lodgingAddress,
  });

  const alreadyNamed = [
    ...flokkerRecs.map(r => r.name),
    ...plannedActivities,
    ...savedForTrip,
  ];

  const aiNeeded = AI_TOTAL - eventRecs.length - flokkerRecs.length;

  const systemPrompt = `You are a family travel recommendation engine. You receive structured data about a real family and their trip. Return ONLY valid JSON — no markdown, no preamble. Return an array of exactly ${aiNeeded} recommendations. Do NOT suggest: ${alreadyNamed.join(", ")}. Each recommendation must be:
{
  "name": string,
  "category": string (exactly one of: food_and_drink, culture, nature_and_outdoors, adventure, experiences, sports_and_entertainment, shopping, kids_and_family, lodging, nightlife, wellness, other),
  "whyThisFamily": string (one sentence, specific to this family),
  "ageAppropriate": boolean,
  "budgetTier": string (one of: Free, Budget, Mid, Premium, Luxury),
  "tip": string (one practical sentence),
  "tags": string[],
  "websiteUrl": string (optional — real URL if confident, otherwise omit)
}
Prioritize proximity to lodging. Weight toward family-rhythm (wiggle breaks, snack stops) for families with young children. Trip duration: ${durationDays} days.`;

  const aiRawRecs: FetchedRec[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: haikuPrompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : [];

    for (const r of arr as Array<Record<string, unknown>>) {
      const category = normalizeCategorySlug(r.category as string | null) ?? "other";
      const websiteUrl = (r.websiteUrl as string | null) ?? resolveCanonicalUrl({
        name: r.name as string,
        city: trip.destinationCity ?? "",
        country: trip.destinationCountry ?? undefined,
      });
      let imageUrl: string | null = null;
      let placeId: string | null = null;
      try {
        const enriched = await enrichWithPlaces(r.name as string, trip.destinationCity ?? "");
        imageUrl = enriched.imageUrl;
        placeId = enriched.placeId;
      } catch {
        // enrichment failure is non-fatal
      }
      aiRawRecs.push({
        source: "ai",
        name: r.name as string,
        category,
        whyThisFamily: (r.whyThisFamily as string) ?? "",
        ageAppropriate: (r.ageAppropriate as boolean) ?? true,
        budgetTier: (r.budgetTier as string) ?? "Mid",
        tip: (r.tip as string) ?? "",
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
        websiteUrl,
        imageUrl,
        placeId,
        photoUrl: null,
      });
    }
  } catch (err) {
    console.error("[recommendations/ai] generation failed:", err);
  }

  const recommendations: FetchedRec[] = [...eventRecs, ...flokkerRecs, ...aiRawRecs];

  console.log(
    `[recommendations] tripId=${tripId} sources=event:${eventRecs.length} flokker:${flokkerRecs.length} ai:${aiRawRecs.length} total:${recommendations.length}`
  );

  // Write cache
  await db.trip.update({
    where: { id: tripId },
    data: {
      cachedRecommendations: recommendations as object[],
      cachedRecommendationsGeneratedAt: new Date(),
      cachedRecommendationsContextHash: contextHash,
    },
  });

  return NextResponse.json({ recommendations, cached: false });
}
