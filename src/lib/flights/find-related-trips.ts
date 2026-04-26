/**
 * find-related-trips.ts
 *
 * Pure utility — no DB calls.
 *
 * For a flight extraction, identifies ALL trips that have a relationship to
 * any of the extracted legs by date range. Used by the email-inbound webhook
 * to write FlightBooking + ItineraryItem rows for every trip a booking touches.
 *
 * Only intended for flight bookings. Caller must check extracted.type === "flight"
 * before calling.
 *
 * Leg-belongs-to-trip rule (matches synthesize-booking.ts):
 *   A leg belongs to trip T if leg.departure OR leg.arrival falls within
 *   [T.startDate, T.endDate] (inclusive, lexical YYYY-MM-DD comparison).
 */

export type TripRecord = {
  id: string;
  title?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
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

/**
 * Returns true if `dateStr` (YYYY-MM-DD or YYYY-MM-DDTHH:MM) falls within
 * [tripStart, tripEnd] inclusive (lexical ISO comparison).
 */
function inRange(
  dateStr: string | null | undefined,
  tripStart: string,
  tripEnd: string,
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= tripStart && d <= tripEnd;
}

/**
 * For each leg in extracted.legs, checks whether any leg's departure or
 * arrival datetime falls within any trip's [startDate, endDate].
 *
 * Also includes the primary matched trip (primaryTripId) if provided.
 *
 * Returns array deduplicated by trip.id, sorted by confidence descending.
 * All leg-date matches use confidence 0.9 (above the 0.85 caller threshold).
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
    // Claude emits departure/arrival as "YYYY-MM-DDTHH:MM"
    const depStr = typeof leg.departure === "string" ? leg.departure : null;
    const arrStr = typeof leg.arrival === "string" ? leg.arrival : null;

    if (!depStr && !arrStr) continue;

    for (const trip of userTrips) {
      const tripStart = toYMD(trip.startDate);
      const tripEnd = toYMD(trip.endDate);
      if (!tripStart || !tripEnd) continue;

      const matched =
        inRange(depStr, tripStart, tripEnd) ||
        inRange(arrStr, tripStart, tripEnd);

      if (!matched) continue;

      const confidence = 0.9;
      const existing = map.get(trip.id);
      if (!existing || existing.confidence < confidence) {
        map.set(trip.id, { trip, confidence, matchType: "leg-date-match" });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}
