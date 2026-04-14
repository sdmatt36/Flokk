import { db } from "@/lib/db";

// Finds the best matching active trip for a given destination.
// Priority: exact city match → exact country match.
// When multiple trips match at the same level, picks nearest startDate to today.
// Returns null if no match or city/country are both null.

export async function findMatchingTrip(
  familyProfileId: string,
  city: string | null,
  country?: string | null
): Promise<{ id: string; title: string; destinationCity: string | null } | null> {
  const today = new Date();

  function pickNearest<T extends { id: string; title: string; destinationCity: string | null; startDate: Date | null }>(
    trips: T[]
  ): { id: string; title: string; destinationCity: string | null } {
    if (trips.length === 1) return trips[0];
    trips.sort((a, b) => {
      const da = a.startDate ? Math.abs(a.startDate.getTime() - today.getTime()) : Infinity;
      const db2 = b.startDate ? Math.abs(b.startDate.getTime() - today.getTime()) : Infinity;
      return da - db2;
    });
    return trips[0];
  }

  // Step 1: city match
  if (city) {
    try {
      const trips = await db.trip.findMany({
        where: {
          familyProfileId,
          destinationCity: { equals: city, mode: "insensitive" },
          status: { not: "COMPLETED" },
        },
        select: { id: true, title: true, destinationCity: true, startDate: true },
      });
      if (trips.length > 0) return pickNearest(trips);
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
          status: { not: "COMPLETED" },
        },
        select: { id: true, title: true, destinationCity: true, startDate: true },
      });
      if (trips.length > 0) return pickNearest(trips);
    } catch (e) {
      console.error("[findMatchingTrip] country query failed:", e);
    }
  }

  return null;
}
