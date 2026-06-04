import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getItemImage } from "@/lib/destination-images";
import { resolveSaveLink } from "@/lib/save-link";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const IMPORT_SOURCE_METHODS = new Set(["maps_import", "SHARED_TRIP_IMPORT"]);
const FLIGHT_TAGS = [
  "flight", "airfare", "airline", "airflight", "flights",
  "Flight", "Airline", "Airfare",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedSaveItem = {
  id: string;
  coverImageUrl: string;
  displayTitle: string;
  destinationCity: string | null;
  destinationCountry: string | null;
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
};

type FeedSection = {
  type: "upcoming" | "past" | "unassigned" | "imported";
  tripId?: string;
  tripName?: string;
  tripStatus?: string;
  tripEndDate?: string | null;
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

function resolveDisplayTitle(rawTitle: string | null, city: string | null): string {
  if (!rawTitle) return "Saved place";
  if (rawTitle.startsWith("http")) return city ? `Place in ${city}` : "Saved place";
  return rawTitle;
}

type DbSave = {
  id: string;
  rawTitle: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  sourceMethod: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  lat: number | null;
  lng: number | null;
  savedAt: Date;
  tripId: string | null;
  dayIndex: number | null;
  isBooked: boolean;
  userRating: number | null;
  needsAdvanceBooking: boolean;
  advanceBookingReason: string | null;
  communitySpot: { photoUrl: string | null; websiteUrl: string | null } | null;
  tripDocuments: { type: string }[];
};

function buildFeedItem(s: DbSave): FeedSaveItem {
  const photoUrl =
    sanitizeThumbnailUrl(s.placePhotoUrl) ??
    sanitizeThumbnailUrl(s.communitySpot?.photoUrl ?? null) ??
    null;
  const thumbUrl = sanitizeThumbnailUrl(s.mediaThumbnailUrl);
  const displayTitle = resolveDisplayTitle(s.rawTitle, s.destinationCity);
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
      communitySpotWebsiteUrl: s.communitySpot?.websiteUrl ?? null,
      lat: s.lat,
      lng: s.lng,
      rawTitle: s.rawTitle,
      destinationCity: s.destinationCity,
    })?.url ?? null;

  return {
    id: s.id,
    coverImageUrl,
    displayTitle,
    destinationCity: s.destinationCity,
    destinationCountry: s.destinationCountry,
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
  };
}

function sortSaves(items: FeedSaveItem[]): FeedSaveItem[] {
  return [...items].sort((a, b) => {
    if (a.needsAdvanceBooking && !b.needsAdvanceBooking) return -1;
    if (!a.needsAdvanceBooking && b.needsAdvanceBooking) return 1;
    return a.displayTitle.localeCompare(b.displayTitle);
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

  const now = new Date();

  // ── Trips ──────────────────────────────────────────────────────────────────
  const allTrips = await db.trip.findMany({
    where: { familyProfileId: profileId, isPlacesLibrary: false },
    select: {
      id: true,
      title: true,
      status: true,
      destinationCity: true,
      startDate: true,
      endDate: true,
    },
  });

  const upcomingTrips = allTrips
    .filter((t) => !t.endDate || t.endDate >= now)
    .sort((a, b) => {
      const aStart = a.startDate ? a.startDate.getTime() : Infinity;
      const bStart = b.startDate ? b.startDate.getTime() : Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  const pastTrips = allTrips.filter((t) => t.endDate && t.endDate < now);
  const upcomingTripIds = new Set(upcomingTrips.map((t) => t.id));
  const pastTripIds = new Set(pastTrips.map((t) => t.id));

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
      websiteUrl: true,
      sourceUrl: true,
      lat: true,
      lng: true,
      savedAt: true,
      tripId: true,
      dayIndex: true,
      isBooked: true,
      userRating: true,
      needsAdvanceBooking: true,
      advanceBookingReason: true,
      communitySpot: { select: { photoUrl: true, websiteUrl: true } },
      tripDocuments: { select: { type: true } },
    },
  });

  // ── Bucketing ──────────────────────────────────────────────────────────────
  const upcomingBuckets = new Map<string, FeedSaveItem[]>(
    upcomingTrips.map((t) => [t.id, []]),
  );
  const pastCityMap = new Map<string, FeedSaveItem[]>();
  const unassigned: FeedSaveItem[] = [];
  const imported: FeedSaveItem[] = [];

  for (const s of saves) {
    if (!s.tripId && IMPORT_SOURCE_METHODS.has(s.sourceMethod ?? "")) {
      imported.push(buildFeedItem(s));
      continue;
    }
    if (s.tripId && upcomingTripIds.has(s.tripId)) {
      upcomingBuckets.get(s.tripId)!.push(buildFeedItem(s));
      continue;
    }
    if (s.tripId && pastTripIds.has(s.tripId)) {
      const city = s.destinationCity ?? "Unknown";
      const list = pastCityMap.get(city) ?? [];
      list.push(buildFeedItem(s));
      pastCityMap.set(city, list);
      continue;
    }
    unassigned.push(buildFeedItem(s));
  }

  // ── Assemble sections ──────────────────────────────────────────────────────
  const sections: FeedSection[] = [];

  for (const t of upcomingTrips) {
    sections.push({
      type: "upcoming",
      tripId: t.id,
      tripName: t.title,
      tripStatus: t.status,
      tripEndDate: t.endDate ? t.endDate.toISOString() : null,
      saves: sortSaves(upcomingBuckets.get(t.id) ?? []),
      suggestedSaves: [],
    });
  }

  const sortedPastCities = [...pastCityMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [city, citySaves] of sortedPastCities) {
    sections.push({
      type: "past",
      city,
      saves: sortSaves(citySaves),
      suggestedSaves: [],
    });
  }

  if (unassigned.length > 0) {
    sections.push({
      type: "unassigned",
      saves: sortSaves(unassigned),
      suggestedSaves: [],
    });
  }

  if (imported.length > 0) {
    sections.push({
      type: "imported",
      saves: sortSaves(imported),
      suggestedSaves: [],
    });
  }

  const totalCount = sections.reduce((sum, s) => sum + s.saves.length, 0);

  return NextResponse.json({ sections, totalCount }, NO_STORE);
}
