import { db } from "@/lib/db";
import { canonicalizeForMatch } from "./city-resolution";

// Finds the best matching trip for a given destination.
// Includes completed (past) trips — upcoming trips are preferred, then most recent past trip.
// Priority: exact city match → exact country match.
// Returns null if no match or city/country are both null.

export async function findMatchingTrip(
  familyProfileId: string,
  city: string | null,
  country?: string | null
): Promise<{ id: string; title: string; destinationCity: string | null } | null> {
  const now = new Date();

  function pickBest<T extends { id: string; title: string; destinationCity: string | null; startDate: Date | null; endDate: Date | null }>(
    trips: T[]
  ): { id: string; title: string; destinationCity: string | null } {
    if (trips.length === 1) return trips[0];
    const upcoming = trips.filter(t => t.endDate && t.endDate.getTime() >= now.getTime());
    const past = trips.filter(t => !t.endDate || t.endDate.getTime() < now.getTime());
    if (upcoming.length > 0) {
      upcoming.sort((a, b) => {
        const da = a.startDate?.getTime() ?? Infinity;
        const db2 = b.startDate?.getTime() ?? Infinity;
        return da - db2;
      });
      return upcoming[0];
    }
    past.sort((a, b) => {
      const da = a.startDate?.getTime() ?? 0;
      const db2 = b.startDate?.getTime() ?? 0;
      return db2 - da; // most recent past trip first
    });
    return past[0];
  }

  // Step 1: city match
  if (city) {
    try {
      const trips = await db.trip.findMany({
        where: {
          familyProfileId,
          destinationCity: { equals: city, mode: "insensitive" },
          isPlacesLibrary: false,
        },
        select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true },
      });
      if (trips.length > 0) return pickBest(trips);
    } catch (e) {
      console.error("[findMatchingTrip] city query failed:", e);
    }
  }

  // Step 2: country fallback
  if (country) {
    try {
      const trips = await db.trip.findMany({
        where: {
          familyProfileId,
          destinationCountry: { equals: country, mode: "insensitive" },
          isPlacesLibrary: false,
        },
        select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true },
      });
      if (trips.length > 0) return pickBest(trips);
    } catch (e) {
      console.error("[findMatchingTrip] country query failed:", e);
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Restricted, upcoming-only matcher for trip auto-attach.
//
// Unlike findMatchingTrip above (which falls back to PAST trips), this NEVER
// matches a past/completed trip. It is used by the enrichment auto-attach and the
// one-time backfill scrub so that city-matched saves connect to a live trip only.
// findMatchingTrip is deliberately left unchanged for its existing callers.
// ─────────────────────────────────────────────────────────────────────────────

export type UpcomingMatchTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  cities: string[];
  startDate: Date | null;
  endDate: Date | null;
};

// "Upcoming" reuses the exact definition the bucketing uses for upcomingTripIndex
// (saves-bucketing.ts): a trip with no endDate, or an endDate at/after now.
export function isUpcomingTrip(trip: { endDate: Date | null }, now: Date = new Date()): boolean {
  return !trip.endDate || trip.endDate.getTime() >= now.getTime();
}

// Pure matcher: case-insensitive, trimmed exact match of the save's destinationCity
// against the UNION of each UPCOMING trip's destinationCity + cities[].
// Tiebreak when several upcoming trips share the city: soonest startDate first
// (a null startDate sorts last). Returns null on no match. NEVER returns a past trip.
export function findMatchingUpcomingTrip(
  destinationCity: string | null,
  trips: UpcomingMatchTrip[],
  now: Date = new Date(),
): UpcomingMatchTrip | null {
  if (!destinationCity) return null;
  // Canonicalize both sides (alias + lowercase + strip diacritics) so an "İstanbul" save matches an
  // "Istanbul" trip even for rows that slipped through unnormalized. Storage is unaffected — this is
  // compare-time only.
  const target = canonicalizeForMatch(destinationCity);
  if (!target) return null;

  const matches = trips.filter((t) => {
    if (!isUpcomingTrip(t, now)) return false;
    const cities = [t.destinationCity, ...(t.cities ?? [])]
      .filter((c): c is string => typeof c === "string" && c.trim() !== "")
      .map((c) => canonicalizeForMatch(c));
    return cities.includes(target);
  });
  if (matches.length === 0) return null;

  matches.sort(
    (a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity),
  );
  return matches[0];
}

// PART 2 guard — ALL conditions must hold for an auto-attach to be allowed.
// Keeps mis-resolved saves (e.g. an Airbnb homepage that geocoded to Maryland with
// a null city) OUT of trips: they stay trip-less and fall to Unassigned.
export type AttachGuardInput = {
  tripId: string | null;
  destinationCity: string | null;
  needsPlaceConfirmation: boolean | null;
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
  sourceMethod: string | null;
};

export function passesAttachGuard(save: AttachGuardInput): boolean {
  if (save.tripId) return false;                          // already attached
  if (save.sourceMethod === "maps_import") return false;  // imported bucket — never touch
  if (!save.destinationCity || save.destinationCity.trim() === "") return false; // need a resolved city
  if (save.needsPlaceConfirmation === true) return false; // low-confidence place identity
  const hasResolvedPlace = !!save.googlePlaceId || (save.lat != null && save.lng != null);
  if (!hasResolvedPlace) return false;                    // junk-geocode guard
  return true;
}

const UPCOMING_TRIP_SELECT = {
  id: true,
  title: true,
  destinationCity: true,
  cities: true,
  startDate: true,
  endDate: true,
} as const;

// Single-save auto-attach used by the enrichment path. Fetches the save fresh (so it
// sees the just-resolved destinationCity), applies the guard + upcoming-only matcher,
// and — on a confident match — writes the canonical assignment shape used by the
// manual/URL save branches: { tripId, status: "TRIP_ASSIGNED" }.
export async function autoAttachSaveToUpcomingTrip(
  savedItemId: string,
): Promise<{ attached: boolean; tripId?: string }> {
  const save = await db.savedItem.findUnique({
    where: { id: savedItemId },
    select: {
      id: true,
      tripId: true,
      familyProfileId: true,
      destinationCity: true,
      needsPlaceConfirmation: true,
      googlePlaceId: true,
      lat: true,
      lng: true,
      sourceMethod: true,
    },
  });
  if (!save) return { attached: false };
  if (!passesAttachGuard(save)) return { attached: false };

  const trips = await db.trip.findMany({
    where: { familyProfileId: save.familyProfileId, isPlacesLibrary: false },
    select: UPCOMING_TRIP_SELECT,
  });

  const match = findMatchingUpcomingTrip(save.destinationCity, trips);
  if (!match) return { attached: false };

  await db.savedItem.update({
    where: { id: save.id },
    data: { tripId: match.id, status: "TRIP_ASSIGNED" },
  });
  return { attached: true, tripId: match.id };
}
