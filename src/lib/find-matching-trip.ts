import { db } from "@/lib/db";

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
