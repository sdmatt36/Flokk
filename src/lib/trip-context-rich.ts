import type { PrismaClient } from "@prisma/client";

export type TripSegment = {
  index: number;
  city: string;
  lodgingName: string;
  lodgingLat: number | null;
  lodgingLng: number | null;
  dayStart: number;
  dayEnd: number;
  nights: number;
  recAllocation: number;
};

export type RichTripContext = {
  tripId: string;
  destinationCity: string;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  segments: TripSegment[];
  totalNights: number;

  plannedActivities: Array<{
    title: string;
    type: string;
    dayIndex: number | null;
    lat: number | null;
    lng: number | null;
    segmentCity: string | null;
  }>;

  transitItems: Array<{
    title: string;
    type: string;
    fromCity: string | null;
    toCity: string | null;
    dayIndex: number | null;
  }>;

  savedForTrip: Array<{
    title: string;
    city: string | null;
    dayIndex: number | null;
    categoryTags: string[];
  }>;

  broaderSaves: {
    totalCount: number;
    topCategories: string[];
    sampleTitles: string[];
  };

  family: {
    childAges: number[];
    travelStyle: string | null;
    pace: string | null;
    interests: string[];
    homeCountry: string | null;
    dietaryRequirements: string[];
    mobilityNotes: string[];
  };

  lovedPlaces: Array<{ name: string; city: string | null; rating: number }>;
  totalLovedPlaces: number;
};

export type ItineraryItemInput = {
  type: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  dayIndex: number | null;
  fromCity: string | null;
  toCity: string | null;
};

const TRANSIT_TYPES = new Set(["FLIGHT", "TRAIN", "CAR_RENTAL"]);

function deriveCityFromCheckIn(
  checkIn: ItineraryItemInput,
  allItems: ItineraryItemInput[],
  destinationCity?: string
): string {
  // 1. Explicit toCity on check-in row
  if (checkIn.toCity?.trim()) return checkIn.toCity.trim();

  // 2. Same-day inbound transit toCity (flight/train arriving same day as check-in)
  const dayIdx = checkIn.dayIndex;
  if (dayIdx != null) {
    const inbound = allItems.find(
      (i) =>
        (i.type === "FLIGHT" || i.type === "TRAIN") &&
        i.toCity != null &&
        i.dayIndex === dayIdx
    );
    if (inbound?.toCity) return inbound.toCity.trim();
  }

  // 3. Comma-parse from lodging name (e.g. "Hyatt Regency Seragaki Island, Okinawa" → "Okinawa")
  const name = checkIn.title.replace(/^check[\s-]?in:\s*/i, "").trim();
  const commaIdx = name.lastIndexOf(",");
  if (commaIdx !== -1) {
    const afterComma = name.slice(commaIdx + 1).trim();
    if (afterComma.length > 0) return afterComma;
  }

  // 4. Last word of lodging name (last resort — e.g. "THE NEST NAHA" → "NAHA")
  // Prefer trip destinationCity over a potentially-wrong last word
  if (destinationCity) return destinationCity;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 0) return words[words.length - 1];

  return "Unknown";
}

export function deriveSegments(itineraryItems: ItineraryItemInput[], destinationCity?: string): TripSegment[] {
  const allLodging = itineraryItems.filter((i) => i.type === "LODGING");
  const checkIns = allLodging.filter((i) => /check[\s-]?in/i.test(i.title));
  const checkOuts = allLodging.filter((i) => /check[\s-]?out/i.test(i.title));

  // Deduplicate check-ins by stripped name (keep first occurrence — handles duplicate import rows)
  const seen = new Set<string>();
  const deduped = checkIns.filter((ci) => {
    const name = ci.title.replace(/^check[\s-]?in:\s*/i, "").trim();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const stays = deduped.map((ci) => {
    const ciName = ci.title.replace(/^check[\s-]?in:\s*/i, "").trim();
    const co = checkOuts.find(
      (o) => o.title.replace(/^check[\s-]?out:\s*/i, "").trim() === ciName
    );
    return {
      name: ciName,
      city: deriveCityFromCheckIn(ci, itineraryItems, destinationCity),
      lat: ci.latitude,
      lng: ci.longitude,
      dayStart: ci.dayIndex ?? 0,
      dayEnd: co?.dayIndex ?? (ci.dayIndex ?? 0),
    };
  });

  stays.sort((a, b) => a.dayStart - b.dayStart);

  return stays.map((stay, index) => ({
    index,
    city: stay.city,
    lodgingName: stay.name,
    lodgingLat: stay.lat,
    lodgingLng: stay.lng,
    dayStart: stay.dayStart,
    dayEnd: stay.dayEnd,
    nights: Math.max(0, stay.dayEnd - stay.dayStart),
    recAllocation: 0,
  }));
}

export function allocateRecCounts(segments: TripSegment[], targetTotal: number): TripSegment[] {
  if (segments.length === 0) return [];

  const totalNights = segments.reduce((sum, s) => sum + s.nights, 0);

  if (totalNights === 0) {
    // Equal distribution; remainder goes to first segments
    const base = Math.floor(targetTotal / segments.length);
    const remainder = targetTotal - base * segments.length;
    return segments.map((s, i) => ({
      ...s,
      recAllocation: base + (i < remainder ? 1 : 0),
    }));
  }

  const exactAllocations = segments.map((s) => (s.nights / totalNights) * targetTotal);
  const floors = exactAllocations.map(Math.floor);

  let remaining = targetTotal - floors.reduce((sum, f) => sum + f, 0);

  // Distribute remainder to segments with the largest fractional part (Hamilton method)
  const fractionals = exactAllocations
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  const allocations = [...floors];
  for (let j = 0; j < remaining; j++) {
    allocations[fractionals[j].i]++;
  }

  return segments.map((s, i) => ({ ...s, recAllocation: allocations[i] }));
}

export function assignActivityToSegment(
  activity: { dayIndex: number | null },
  segments: TripSegment[]
): string | null {
  if (activity.dayIndex == null) return null;
  const day = activity.dayIndex;
  // [dayStart, dayEnd) range — transition days assign to arriving segment
  for (const s of segments) {
    if (day >= s.dayStart && day < s.dayEnd) return s.city;
  }
  return null;
}

export async function extractRichTripContext(
  tripId: string,
  db: PrismaClient
): Promise<RichTripContext> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryItems: {
        select: {
          type: true,
          title: true,
          latitude: true,
          longitude: true,
          scheduledDate: true,
          dayIndex: true,
          fromCity: true,
          toCity: true,
        },
      },
      savedItems: {
        where: { deletedAt: null },
        select: {
          rawTitle: true,
          destinationCity: true,
          categoryTags: true,
          dayIndex: true,
        },
      },
      familyProfile: {
        include: {
          members: {
            select: {
              role: true,
              birthDate: true,
              dietaryRequirements: true,
              mobilityNotes: true,
            },
          },
          interests: { select: { interestKey: true } },
        },
      },
    },
  });

  if (!trip || !trip.familyProfile) {
    throw new Error(`Trip ${tripId} not found or missing profile`);
  }

  const profileId = trip.familyProfile.id;

  const [placeRatings, totalLovedPlaces, globalSaves] = await Promise.all([
    db.placeRating.findMany({
      where: { familyProfileId: profileId },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      select: { placeName: true, destinationCity: true, rating: true },
      take: 8,
    }),
    db.placeRating.count({ where: { familyProfileId: profileId } }),
    db.savedItem.findMany({
      where: { familyProfileId: profileId, tripId: null, deletedAt: null },
      orderBy: { savedAt: "desc" },
      select: { rawTitle: true, categoryTags: true },
      take: 200,
    }),
  ]);

  // Trip dates and duration
  const tripStart = trip.startDate ?? new Date();
  const tripEnd = trip.endDate ?? tripStart;
  const durationDays = Math.max(
    1,
    Math.round((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1
  );
  const startDate = trip.startDate ? trip.startDate.toISOString().split("T")[0] : null;
  const endDate = trip.endDate ? trip.endDate.toISOString().split("T")[0] : null;

  // Derive segments with rec allocation
  const rawSegments = deriveSegments(trip.itineraryItems, trip.destinationCity ?? undefined);
  const segments = allocateRecCounts(rawSegments, 12);
  const totalNights = segments.reduce((sum, s) => sum + s.nights, 0);

  // Planned activities (ACTIVITY type only)
  const plannedActivities = trip.itineraryItems
    .filter((i) => i.type === "ACTIVITY")
    .map((i) => ({
      title: i.title,
      type: i.type,
      dayIndex: i.dayIndex,
      lat: i.latitude,
      lng: i.longitude,
      segmentCity: assignActivityToSegment({ dayIndex: i.dayIndex }, segments),
    }));

  // Transit items (FLIGHT, TRAIN, CAR_RENTAL)
  const transitItems = trip.itineraryItems
    .filter((i) => TRANSIT_TYPES.has(i.type))
    .map((i) => ({
      title: i.title,
      type: i.type,
      fromCity: i.fromCity,
      toCity: i.toCity,
      dayIndex: i.dayIndex,
    }));

  // Saved items attached to this trip
  const savedForTrip = trip.savedItems
    .filter((s) => s.rawTitle)
    .map((s) => ({
      title: s.rawTitle!,
      city: s.destinationCity,
      dayIndex: s.dayIndex,
      categoryTags: s.categoryTags,
    }));

  // Broader save signal (global, not trip-attached)
  const catCount: Record<string, number> = {};
  for (const item of globalSaves) {
    for (const tag of item.categoryTags) {
      if (tag) catCount[tag] = (catCount[tag] ?? 0) + 1;
    }
  }
  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);
  const sampleTitles = globalSaves
    .map((s) => s.rawTitle)
    .filter((t): t is string => !!t)
    .slice(0, 10);

  // Family context
  const childAges = trip.familyProfile.members
    .filter((m) => m.role === "CHILD" && m.birthDate)
    .map((m) => {
      let age = tripStart.getFullYear() - m.birthDate!.getFullYear();
      const mn = tripStart.getMonth() - m.birthDate!.getMonth();
      if (mn < 0 || (mn === 0 && tripStart.getDate() < m.birthDate!.getDate())) age--;
      return age;
    });

  const dietaryRequirements = [
    ...new Set(
      trip.familyProfile.members.flatMap((m) => m.dietaryRequirements as string[])
    ),
  ].filter(Boolean);

  const mobilityNotes = trip.familyProfile.members
    .map((m) => m.mobilityNotes)
    .filter((n): n is string => !!n);

  return {
    tripId,
    destinationCity: trip.destinationCity ?? "",
    destinationCountry: trip.destinationCountry ?? null,
    startDate,
    endDate,
    durationDays,
    segments,
    totalNights,
    plannedActivities,
    transitItems,
    savedForTrip,
    broaderSaves: {
      totalCount: globalSaves.length,
      topCategories,
      sampleTitles,
    },
    family: {
      childAges,
      travelStyle: trip.familyProfile.travelStyle?.toString() ?? null,
      pace: trip.familyProfile.pace?.toString() ?? null,
      interests: trip.familyProfile.interests.map((i) => i.interestKey),
      homeCountry: trip.familyProfile.homeCountry ?? null,
      dietaryRequirements,
      mobilityNotes,
    },
    lovedPlaces: placeRatings.map((p) => ({
      name: p.placeName,
      city: p.destinationCity,
      rating: p.rating,
    })),
    totalLovedPlaces,
  };
}
