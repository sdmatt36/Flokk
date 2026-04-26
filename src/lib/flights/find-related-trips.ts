/**
 * find-related-trips.ts
 *
 * Pure utility — no DB calls.
 *
 * For a flight extraction, identifies ALL trips that have a semantic relationship
 * to any of the extracted legs. Used by the email-inbound webhook to write
 * FlightBooking + ItineraryItem rows for every trip a booking touches.
 *
 * Only intended for flight bookings. Caller must check extracted.type === "flight"
 * before calling.
 *
 * Matching rule (two signals required for high confidence):
 *   DESTINATION MATCH: leg.toCity or leg.fromCity matches trip.destinationCity
 *     (case-insensitive). fromCity covers return-from-destination legs
 *     (e.g. CMB→LHR departs Colombo, which is Sri Lanka's destination).
 *   DATE-IN-RANGE: leg.departure or leg.arrival falls within
 *     [trip.startDate, trip.endDate] (inclusive, lexical YYYY-MM-DD comparison).
 *
 * Confidence levels:
 *   0.95 — destination match AND date in range  → accepted (>= 0.85 threshold)
 *   0.85 — destination match alone (date outside range)  → accepted
 *   0.70 — date in range only, no destination match  → below threshold, NOT written
 *
 * This prevents long-range "home base" trips (e.g. Kamakura Jan–Jun) from
 * matching bookings just because their date range encompasses a departure date.
 */

export type TripRecord = {
  id: string;
  title?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
};

export type RelatedTrip = {
  trip: TripRecord;
  confidence: number;
  matchType: string;
};

function toYMD(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

/** Returns true if dateStr (YYYY-MM-DD or YYYY-MM-DDTHH:MM) is within [start, end] inclusive. */
function inRange(
  dateStr: string | null | undefined,
  tripStart: string,
  tripEnd: string,
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= tripStart && d <= tripEnd;
}

const normalizeCity = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

/**
 * Returns true if the leg's arrival city matches the trip's destination city
 * (case-insensitive). Only toCity is checked — fromCity matching causes false
 * positives when a leg departs from a city that happens to be another trip's
 * destination (e.g. HND→SIN fromCity="Tokyo" would incorrectly match a past
 * "Tokyo" trip). Primary trips are seeded via primaryTripId so they don't
 * need fromCity matching to appear in the results.
 */
function destinationMatch(leg: Record<string, unknown>, trip: TripRecord): boolean {
  const tripCity = normalizeCity(trip.destinationCity);
  if (!tripCity) return false;

  const legToCity = normalizeCity(leg.toCity as string | null | undefined);
  return !!legToCity && legToCity === tripCity;
}

/**
 * For each leg in extracted.legs, scores each user trip against the combined
 * destination-match + date-in-range rule. Also seeds the primary matched trip.
 *
 * Returns array deduplicated by trip.id (highest confidence wins), sorted
 * by confidence descending.
 */
export function findAllRelatedTrips(
  extracted: Record<string, unknown>,
  userTrips: TripRecord[],
  primaryTripId?: string | null,
): RelatedTrip[] {
  const map = new Map<string, RelatedTrip>();

  // Seed with the primary P0/P1/P2/P3 matched trip
  if (primaryTripId) {
    const primary = userTrips.find((t) => t.id === primaryTripId);
    if (primary) {
      map.set(primaryTripId, { trip: primary, confidence: 0.9, matchType: "primary-match" });
    }
  }

  const rawLegs = Array.isArray(extracted.legs)
    ? (extracted.legs as Array<Record<string, unknown>>)
    : [];

  for (const leg of rawLegs) {
    const depStr = typeof leg.departure === "string" ? leg.departure : null;
    const arrStr = typeof leg.arrival   === "string" ? leg.arrival   : null;

    for (const trip of userTrips) {
      const tripStart = toYMD(trip.startDate);
      const tripEnd   = toYMD(trip.endDate);

      const hasDestMatch = destinationMatch(leg, trip);
      const hasDateMatch = !!(tripStart && tripEnd) &&
        (inRange(depStr, tripStart, tripEnd) || inRange(arrStr, tripStart, tripEnd));

      let confidence: number;
      let matchType: string;

      if (hasDestMatch && hasDateMatch) {
        confidence = 0.95;
        matchType  = "leg-dest-date-match";
      } else if (hasDestMatch) {
        confidence = 0.85;
        matchType  = "leg-dest-match";
      } else if (hasDateMatch) {
        // Date-only: below threshold — included for diagnostics but won't trigger writes
        confidence = 0.70;
        matchType  = "leg-date-only";
      } else {
        continue;
      }

      const existing = map.get(trip.id);
      if (!existing || existing.confidence < confidence) {
        map.set(trip.id, { trip, confidence, matchType });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}
