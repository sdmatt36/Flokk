// Read-time "borrowed departing flight" resolver.
//
// A flight is owned by exactly one trip (its arrival trip). The DEPARTING trip — the
// one whose end the flight leaves from — should ALSO surface it at read time, WITHOUT
// a duplicate row (the (familyProfileId, confirmationCode) unique blocks a 2nd booking).
//
// Given a trip, returns the FlightBookings owned by OTHER trips in the SAME family whose
// departing leg leaves at this trip's end (airport-first, city-fuzzy fallback — mirrors
// src/lib/flights/find-related-trips). DISPLAY-ONLY: this never writes.

import type { PrismaClient, Flight, FlightBooking } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";
import { shiftYMD, normalizeCity, normalizeAirport, cityFuzzyEqual } from "@/lib/flights/find-related-trips";

export type BorrowedDepartingFlight = {
  booking: FlightBooking & { flights: Flight[] };
  ownerTripId: string;
  ownerTripName: string;
  departingLegs: Flight[]; // the legs that DEPART this trip (placed on its last day)
};

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

// A leg departs THIS trip if its from-airport is one of the trip's destination airports,
// or (when airports are unavailable) its from-city fuzzily matches a trip city.
function legDepartsTrip(leg: Flight, destAirports: string[], destCities: string[]): boolean {
  const fromAirport = normalizeAirport(leg.fromAirport);
  if (fromAirport && destAirports.includes(fromAirport)) return true;
  const fromCity = normalizeCity(leg.fromCity);
  return !!fromCity && destCities.some((c) => cityFuzzyEqual(fromCity, c));
}

export async function findBorrowedDepartingFlights(
  trip: {
    id: string;
    familyProfileId: string | null;
    endDate: Date | null;
    destinationCity: string | null;
    cities?: string[] | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma?: any,
): Promise<BorrowedDepartingFlight[]> {
  const db: PrismaClient = prisma ?? defaultDb;
  if (!trip.familyProfileId || !trip.endDate) return [];

  const endYmd = ymd(trip.endDate);
  const winStart = shiftYMD(endYmd, -1);
  const winEnd = shiftYMD(endYmd, 2);

  // Derive this trip's destination airports from its OWN flights' arrival airports
  // (e.g. Bali's NRT->DPS yields ["DPS"]) — same derivation the matcher/webhook use.
  const ownFlights = await db.flight.findMany({ where: { tripId: trip.id }, select: { toAirport: true } });
  const destAirports = [...new Set(ownFlights.map((f) => normalizeAirport(f.toAirport)).filter(Boolean))];
  const destCities = [trip.destinationCity, ...(trip.cities ?? [])]
    .map(normalizeCity)
    .filter(Boolean);

  // Candidate bookings: SAME family, OTHER trips, with a leg departing in the window.
  // familyProfileId filter = cross-profile safety (a family's flight never appears elsewhere).
  const bookings = (await db.flightBooking.findMany({
    where: {
      familyProfileId: trip.familyProfileId,
      tripId: { not: trip.id },
      flights: { some: { departureDate: { gte: winStart, lte: winEnd } } },
    },
    include: { flights: true, trip: { select: { title: true } } },
  })) as Array<FlightBooking & { flights: Flight[]; trip: { title: string | null } | null }>;

  const out: BorrowedDepartingFlight[] = [];
  for (const b of bookings) {
    const departingLegs = b.flights.filter(
      (f) =>
        !!f.departureDate &&
        f.departureDate >= winStart &&
        f.departureDate <= winEnd &&
        legDepartsTrip(f, destAirports, destCities),
    );
    if (departingLegs.length === 0) continue; // one card per booking; skip pure connections
    out.push({
      booking: { ...b, flights: b.flights },
      ownerTripId: b.tripId,
      ownerTripName: b.trip?.title ?? "your next trip",
      departingLegs,
    });
  }
  return out;
}
