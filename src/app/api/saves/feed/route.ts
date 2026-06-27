import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getItemImage } from "@/lib/destination-images";
import { resolveSaveLink } from "@/lib/save-link";
import { bucketSaves } from "@/lib/saves-bucketing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const FLIGHT_TAGS = [
  "flight", "airfare", "airline", "airflight", "flights",
  "Flight", "Airline", "Airfare",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedSaveItem = {
  id: string;
  coverImageUrl: string;
  displayTitle: string;
  rawTitle: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  address: string | null;
  categoryTags: string[];
  needsAdvanceBooking: boolean;
  advanceBookingReason: string | null;
  dayIndex: number | null;
  hasItineraryLink: boolean;
  hasBooking: boolean;
  isBooked: boolean;
  userRating: number | null;
  link: string | null;
  savedAt: string;
  isPending: boolean;
  communitySpotId: string | null;
};

type FeedSection = {
  type: "upcoming" | "past" | "unassigned" | "imported";
  tripId?: string;
  tripName?: string;
  tripStatus?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  dateRange?: string | null;
  city?: string;
  saves: FeedSaveItem[];
  suggestedSaves: FeedSaveItem[]; // reserved — Tier 1/2/3 deferred
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/[?&]key=AIza/i.test(url)) return null;
  return url;
}

function extractDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function resolveDisplayTitle(rawTitle: string | null, sourceUrl: string | null, city: string | null): string {
  if (rawTitle && !rawTitle.startsWith("http")) return rawTitle;
  const urlForDomain = rawTitle?.startsWith("http") ? rawTitle : sourceUrl;
  if (urlForDomain) {
    const domain = extractDomain(urlForDomain);
    if (domain) return domain;
  }
  if (city) return `Place in ${city}`;
  return "Saved link";
}

function formatTripDateRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const monthFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (!endIso) return start.toLocaleDateString("en-US", monthFmt);
  const end = new Date(endIso);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}`;
  }
  return `${start.toLocaleDateString("en-US", monthFmt)} – ${end.toLocaleDateString("en-US", monthFmt)}`;
}

type DbSave = {
  id: string;
  rawTitle: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  address: string | null;
  categoryTags: string[];
  sourceMethod: string | null;
  extractionStatus: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  affiliateUrl: string | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  savedAt: Date;
  tripId: string | null;
  dayIndex: number | null;
  isBooked: boolean;
  userRating: number | null;
  needsAdvanceBooking: boolean;
  advanceBookingReason: string | null;
  communitySpotId: string | null;
  communitySpot: { photoUrl: string | null; websiteUrl: string | null } | null;
  tripDocuments: { type: string }[];
};

function buildFeedItem(s: DbSave): FeedSaveItem {
  const photoUrl =
    sanitizeThumbnailUrl(s.placePhotoUrl) ??
    sanitizeThumbnailUrl(s.communitySpot?.photoUrl ?? null) ??
    null;
  const thumbUrl = sanitizeThumbnailUrl(s.mediaThumbnailUrl);
  const displayTitle = resolveDisplayTitle(s.rawTitle, s.sourceUrl, s.destinationCity);
  const coverImageUrl = getItemImage(
    s.rawTitle,
    photoUrl,
    thumbUrl,
    s.categoryTags[0] ?? null,
    s.destinationCity,
    s.destinationCountry,
  );
  const hasBooking = s.tripDocuments.some((d) => d.type === "booking");
  const hasItineraryLink = s.dayIndex != null || s.tripDocuments.length > 0;
  const link =
    resolveSaveLink({
      websiteUrl: s.websiteUrl,
      sourceUrl: s.sourceUrl,
      affiliateUrl: s.affiliateUrl,
      communitySpotWebsiteUrl: s.communitySpot?.websiteUrl ?? null,
      googlePlaceId: s.googlePlaceId,
      mapsUrl: s.mapsUrl,
      lat: s.lat,
      lng: s.lng,
      rawTitle: s.rawTitle,
      destinationCity: s.destinationCity,
    })?.url ?? null;

  return {
    id: s.id,
    coverImageUrl,
    displayTitle,
    rawTitle: s.rawTitle ?? null,
    destinationCity: s.destinationCity,
    destinationCountry: s.destinationCountry,
    address: s.address ?? null,
    categoryTags: s.categoryTags,
    needsAdvanceBooking: s.needsAdvanceBooking,
    advanceBookingReason: s.advanceBookingReason,
    dayIndex: s.dayIndex,
    hasItineraryLink,
    hasBooking,
    isBooked: s.isBooked,
    userRating: s.userRating,
    link,
    savedAt: s.savedAt.toISOString(),
    isPending: s.extractionStatus === "PENDING",
    communitySpotId: s.communitySpotId,
  };
}

// Card ordering within a section. "recent" (default) = newest savedAt first;
// "az" = alphabetical on the resolved displayTitle (never raw rawTitle, which holds
// a URL for un-enriched saves). Advance-booking items stay pinned to the top in both.
type SortMode = "recent" | "az";

function parseSortMode(raw: string | null): SortMode {
  return raw === "az" ? "az" : "recent";
}

function sortSaves(items: FeedSaveItem[], mode: SortMode): FeedSaveItem[] {
  return [...items].sort((a, b) => {
    if (a.needsAdvanceBooking && !b.needsAdvanceBooking) return -1;
    if (!a.needsAdvanceBooking && b.needsAdvanceBooking) return 1;
    if (mode === "az") return a.displayTitle.localeCompare(b.displayTitle);
    // recent: ISO 8601 strings compare lexicographically = chronologically; desc = newest first.
    return b.savedAt.localeCompare(a.savedAt);
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "no-user" },
      { status: 401, ...NO_STORE },
    );
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json(
      { error: "Not found", reason: "no-profile" },
      { status: 404, ...NO_STORE },
    );
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sortMode = parseSortMode(searchParams.get("sort"));

  // ── Trips ──────────────────────────────────────────────────────────────────
  const allTrips = await db.trip.findMany({
    where: { familyProfileId: profileId, isPlacesLibrary: false },
    select: {
      id: true,
      title: true,
      status: true,
      destinationCity: true,
      cities: true,
      country: true,
      countries: true,
      startDate: true,
      endDate: true,
    },
  });

  // ── Saves ──────────────────────────────────────────────────────────────────
  const saves = await db.savedItem.findMany({
    where: {
      familyProfileId: profileId,
      deletedAt: null,
      ...(category && category !== "all"
        ? { categoryTags: { has: category } }
        : {}),
      ...(search
        ? {
            OR: [
              { rawTitle: { contains: search, mode: "insensitive" } },
              { destinationCity: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      NOT: [
        {
          AND: [
            { categoryTags: { isEmpty: false } },
            { categoryTags: { hasSome: FLIGHT_TAGS } },
          ],
        },
        { AND: [{ lat: null }, { rawTitle: { contains: "flight", mode: "insensitive" } }] },
        { AND: [{ lat: null }, { rawTitle: { contains: "airline", mode: "insensitive" } }] },
        { AND: [{ lat: null }, { rawTitle: { contains: "airfare", mode: "insensitive" } }] },
        {
          AND: [
            { sourceUrl: { not: null } },
            { sourceUrl: { contains: "/travel/flights", mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: { savedAt: "desc" },
    select: {
      id: true,
      rawTitle: true,
      placePhotoUrl: true,
      mediaThumbnailUrl: true,
      destinationCity: true,
      destinationCountry: true,
      categoryTags: true,
      sourceMethod: true,
      extractionStatus: true,
      websiteUrl: true,
      sourceUrl: true,
      affiliateUrl: true,
      googlePlaceId: true,
      mapsUrl: true,
      lat: true,
      lng: true,
      savedAt: true,
      tripId: true,
      dayIndex: true,
      isBooked: true,
      userRating: true,
      needsAdvanceBooking: true,
      advanceBookingReason: true,
      address: true,
      communitySpotId: true,
      communitySpot: { select: { photoUrl: true, websiteUrl: true } },
      tripDocuments: { select: { type: true } },
    },
  });

  // ── Bucketing ──────────────────────────────────────────────────────────────
  const { upcomingSections, pastCityMap, unassigned, imported } =
    bucketSaves<DbSave>(saves, allTrips, {});

  const tripStatusById = new Map(allTrips.map((t) => [t.id, t.status]));

  // ── Assemble sections ──────────────────────────────────────────────────────
  const sections: FeedSection[] = [];

  for (const s of upcomingSections) {
    sections.push({
      type: "upcoming",
      tripId: s.tripId,
      tripName: s.tripName,
      tripStatus: tripStatusById.get(s.tripId),
      tripStartDate: s.startDate,
      tripEndDate: s.endDate,
      dateRange: s.startDate ? formatTripDateRange(s.startDate, s.endDate) : null,
      saves: sortSaves(s.explicitSaves.map(buildFeedItem), sortMode),
      suggestedSaves: [],
    });
  }

  // Past-city GROUP order honors the same mode: az = city name; recent = the city
  // whose newest save is most recent first.
  const sortedPastCities = [...pastCityMap.entries()].sort(([cityA, savesA], [cityB, savesB]) => {
    if (sortMode === "az") return cityA.localeCompare(cityB);
    const newestA = Math.max(...savesA.map((s) => s.savedAt.getTime()));
    const newestB = Math.max(...savesB.map((s) => s.savedAt.getTime()));
    return newestB - newestA;
  });
  for (const [city, citySaves] of sortedPastCities) {
    sections.push({
      type: "past",
      city,
      saves: sortSaves(citySaves.map(buildFeedItem), sortMode),
      suggestedSaves: [],
    });
  }

  if (unassigned.length > 0) {
    sections.push({
      type: "unassigned",
      saves: sortSaves(unassigned.map(buildFeedItem), sortMode),
      suggestedSaves: [],
    });
  }

  if (imported.length > 0) {
    sections.push({
      type: "imported",
      saves: sortSaves(imported.map(buildFeedItem), sortMode),
      suggestedSaves: [],
    });
  }

  const totalCount = sections.reduce((sum, s) => sum + s.saves.length, 0);

  return NextResponse.json({ sections, totalCount }, NO_STORE);
}
