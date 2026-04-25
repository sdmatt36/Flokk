import { haversineKm } from "@/lib/geo";

type Coord = { id: string; lat: number; lng: number };

// Order a set of stops via nearest-neighbor starting from the westernmost stop.
// Picking a directional anchor avoids the "arbitrary start in the middle" problem.
// Returns stops in optimized order.
export function optimizeRouteOrder<T extends Coord>(stops: T[]): T[] {
  if (stops.length <= 2) return [...stops];

  const anchor = stops.reduce((min, s) => (s.lng < min.lng ? s : min), stops[0]);

  const remaining = stops.filter(s => s.id !== anchor.id);
  const ordered: T[] = [anchor];

  let current = anchor;
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = haversineKm(current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining[nearestIdx];
    ordered.push(current);
    remaining.splice(nearestIdx, 1);
  }

  return ordered;
}

// Find the cheapest insertion slot for a new stop in an existing ordered route.
// Returns the index where the new stop should be inserted (0 to existing.length).
export function findBestInsertionIndex<T extends Coord>(
  existing: T[],
  newStop: Coord
): number {
  if (existing.length === 0) return 0;
  if (existing.length === 1) return 1;

  // Default: append at end
  let bestIdx = existing.length;
  let bestCost = haversineKm(existing[existing.length - 1], newStop);

  for (let i = 0; i < existing.length; i++) {
    let cost: number;
    if (i === 0) {
      cost = haversineKm(newStop, existing[0]);
    } else {
      const prev = existing[i - 1];
      const next = existing[i];
      cost =
        haversineKm(prev, newStop) +
        haversineKm(newStop, next) -
        haversineKm(prev, next);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestIdx = i;
    }
  }

  return bestIdx;
}
