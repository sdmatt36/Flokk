// Discipline 4.11 (Trip Lifecycle). Bucketing reads dates, not status. Status drift does not affect UI correctness.

export type TripPhase = "current" | "upcoming" | "past";

export function getTripPhase(trip: { startDate: Date | string | null; endDate: Date | string | null }): TripPhase {
  if (trip.startDate == null || trip.endDate == null) return "upcoming";
  const now = new Date();
  const start = trip.startDate instanceof Date ? trip.startDate : new Date(trip.startDate);
  const end = trip.endDate instanceof Date ? trip.endDate : new Date(trip.endDate);
  if (end < now) return "past";
  if (start > now) return "upcoming";
  return "current";
}

export function bucketTrips<T extends { startDate: Date | string | null; endDate: Date | string | null }>(
  trips: T[]
): { current: T[]; upcoming: T[]; past: T[] } {
  const current: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const trip of trips) {
    const phase = getTripPhase(trip);
    if (phase === "current") current.push(trip);
    else if (phase === "upcoming") upcoming.push(trip);
    else past.push(trip);
  }

  current.sort((a, b) => {
    const aEnd = a.endDate instanceof Date ? a.endDate : new Date(a.endDate ?? 0);
    const bEnd = b.endDate instanceof Date ? b.endDate : new Date(b.endDate ?? 0);
    return aEnd.getTime() - bEnd.getTime();
  });

  // Dated trips first, soonest startDate ascending; dateless trips fall to the end.
  // A null startDate must NOT coerce to epoch (new Date(0) = 1970), which would sort a
  // dateless trip as the soonest "next" trip. Use Infinity so nulls sort after all dated.
  upcoming.sort((a, b) => {
    const aStart = a.startDate ? (a.startDate instanceof Date ? a.startDate : new Date(a.startDate)).getTime() : Infinity;
    const bStart = b.startDate ? (b.startDate instanceof Date ? b.startDate : new Date(b.startDate)).getTime() : Infinity;
    return aStart - bStart;
  });

  past.sort((a, b) => {
    const aEnd = a.endDate instanceof Date ? a.endDate : new Date(a.endDate ?? 0);
    const bEnd = b.endDate instanceof Date ? b.endDate : new Date(b.endDate ?? 0);
    return bEnd.getTime() - aEnd.getTime();
  });

  return { current, upcoming, past };
}
