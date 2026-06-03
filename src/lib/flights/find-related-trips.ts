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
 *   DESTINATION MATCH: leg.toCity matches trip.destinationCity (case-insensitive).
 *   FROM-CITY MATCH: leg.fromCity matches trip.destinationCity — covers departing legs
 *     (e.g. TPE→PDX departing from Taipei while a Taipei trip is active).
 *     ONLY accepted when combined with date-in-range to prevent false positives on
 *     completed trips whose city appears as origin for an unrelated booking.
 *   DATE-IN-RANGE: leg.departure or leg.arrival falls within
 *     [trip.startDate, trip.endDate] (inclusive, lexical YYYY-MM-DD comparison).
 *
 * Confidence levels:
 *   0.95 — toCity dest match AND date in range  → accepted (>= 0.85 threshold)
 *   0.90 — fromCity dest match AND date in range → accepted (departing leg)
 *   0.85 — toCity dest match alone (date outside range)  → accepted
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
 * Returns true if the leg's arrival city (toCity) matches the trip's destination city.
 * fromCity is intentionally not checked here — it is evaluated separately in the
 * scoring loop with a date-in-range guard to avoid false positives on past trips.
 */
function destinationMatch(leg: Record<string, unknown>, trip: TripRecord): boolean {
  const tripCity = normalizeCity(trip.destinationCity);
  if (!tripCity) return false;

  const legToCity = normalizeCity(leg.toCity as string | null | undefined);
  return !!legToCity && legToCity === tripCity;
}

/**
 * Returns true if the leg's departure city (fromCity) matches the trip's destination city.
 * Only used when the departure date is also within the trip's date range, so that
 * completed trips whose destination city happens to appear as a departure city for an
 * unrelated booking do not get a false match.
 */
function fromCityDestinationMatch(leg: Record<string, unknown>, trip: TripRecord): boolean {
  const tripCity = normalizeCity(trip.destinationCity);
  if (!tripCity) return false;

  const legFromCity = normalizeCity(leg.fromCity as string | null | undefined);
  return !!legFromCity && legFromCity === tripCity;
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

  // When legs[] is absent, synthesize from scalar fields so fromCity matching
  // fires even for extractions that don't populate the legs array.
  const legsToCheck: Array<Record<string, unknown>> = rawLegs.length > 0 ? rawLegs : (() => {
    const synth: Array<Record<string, unknown>> = [];
    if (extracted.fromAirport || extracted.fromCity) {
      synth.push({
        from: extracted.fromAirport ?? null,
        to: extracted.toAirport ?? null,
        fromCity: extracted.fromCity ?? null,
        toCity: extracted.toCity ?? null,
        departure: typeof extracted.departureDate === "string"
          ? `${extracted.departureDate}T${typeof extracted.departureTime === "string" ? extracted.departureTime : "00:00"}`
          : null,
        arrival: typeof extracted.arrivalDate === "string"
          ? `${extracted.arrivalDate}T${typeof extracted.arrivalTime === "string" ? extracted.arrivalTime : "00:00"}`
          : null,
      });
    }
    if (typeof extracted.returnDepartureDate === "string" && (extracted.returnFromAirport || extracted.toAirport)) {
      synth.push({
        from: extracted.returnFromAirport ?? extracted.toAirport ?? null,
        to: extracted.returnToAirport ?? extracted.fromAirport ?? null,
        fromCity: extracted.toCity ?? null,
        toCity: extracted.fromCity ?? null,
        departure: `${extracted.returnDepartureDate}T${typeof extracted.returnDepartureTime === "string" ? extracted.returnDepartureTime : "00:00"}`,
        arrival: typeof extracted.returnArrivalDate === "string"
          ? `${extracted.returnArrivalDate}T${typeof extracted.returnArrivalTime === "string" ? extracted.returnArrivalTime : "00:00"}`
          : null,
      });
    }
    return synth;
  })();

  for (const leg of legsToCheck) {
    const depStr = typeof leg.departure === "string" ? leg.departure : null;
    const arrStr = typeof leg.arrival   === "string" ? leg.arrival   : null;

    for (const trip of userTrips) {
      const tripStart = toYMD(trip.startDate);
      const tripEnd   = toYMD(trip.endDate);

      const hasDestMatch = destinationMatch(leg, trip);
      const hasDateMatch = !!(tripStart && tripEnd) &&
        (inRange(depStr, tripStart, tripEnd) || inRange(arrStr, tripStart, tripEnd));
      // fromCity match requires date-in-range to prevent false positives on past trips
      const hasFromCityDestMatch = hasDateMatch && fromCityDestinationMatch(leg, trip);

      let confidence: number;
      let matchType: string;

      if (hasDestMatch && hasDateMatch) {
        confidence = 0.95;
        matchType  = "leg-dest-date-match";
      } else if (hasFromCityDestMatch) {
        // Departure from trip's destination city while trip is active (e.g. TPE→PDX
        // departing Taipei while the Taipei trip is ongoing). Date guard is already
        // enforced in hasFromCityDestMatch so no separate branch needed.
        confidence = 0.90;
        matchType  = "leg-from-city-date-match";
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
