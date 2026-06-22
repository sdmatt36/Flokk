// Single source of truth for tour-stop travel times. Previously this helper and the
// transport->Mapbox-profile map were byte-identical copies in
// src/app/api/tours/[id]/stops/route.ts and src/lib/tour-stop-insertion.ts; both now
// import from here. Generate/Regenerate also use this to measure legs instead of
// persisting the AI model's guessed travelTime.

type Coord = { lat: number; lng: number };

// Mapbox Directions profile for a tour's transport mode. Walking tours use the walking
// profile; everything else (Driving, Metro / Transit, etc.) uses driving.
export function transportToMapboxProfile(transport: string): "walking" | "driving" {
  return transport === "Walking" ? "walking" : "driving";
}

// Measured travel time in minutes between two points for the given transport mode.
// Returns null on missing token or any failure — callers must treat null as "unknown"
// and never let it throw.
export async function getTravelTimeMin(
  from: Coord,
  to: Coord,
  transport: string
): Promise<number | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const profile = transportToMapboxProfile(transport);
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?access_token=${token}&overview=false`
    );
    const data = await res.json() as { routes?: Array<{ duration: number }> };
    const secs = data.routes?.[0]?.duration;
    return secs != null ? Math.round(secs / 60) : null;
  } catch {
    return null;
  }
}

// Measure every adjacent leg (stop[i] -> stop[i+1]) in FINAL order, in parallel, and
// return one travelTimeMin per stop: the leg to the NEXT stop, with the last stop = 0
// (the existing last-stop convention). A stop with missing coords, or whose next stop
// has missing coords, or whose Mapbox lookup fails, gets null. Never throws — used on
// the generation hot path where a timing failure must not abort the tour.
export async function measureAdjacentLegs(
  stops: Array<{ lat: number | null; lng: number | null }>,
  transport: string
): Promise<Array<number | null>> {
  if (stops.length === 0) return [];

  const legs = await Promise.all(
    stops.map(async (stop, i) => {
      if (i === stops.length - 1) return 0; // last stop: no onward leg
      const next = stops[i + 1];
      if (stop.lat == null || stop.lng == null || next.lat == null || next.lng == null) {
        return null;
      }
      return getTravelTimeMin(
        { lat: stop.lat, lng: stop.lng },
        { lat: next.lat, lng: next.lng },
        transport
      );
    })
  );

  return legs;
}

// Walking-leg budget in minutes, scaled by the youngest child's age. Single source of
// truth — previously duplicated in generate, regenerate, and tours/[id] GET.
export function maxWalkMinutes(youngestChildAge: number | null): number {
  if (youngestChildAge === null) return 15;
  if (youngestChildAge < 5) return 6;
  if (youngestChildAge <= 10) return 10;
  return 15;
}

// Count consecutive legs whose MEASURED travel time exceeds the walking budget. `legs` is
// the per-stop onward-leg array from measureAdjacentLegs (entry i = stop i -> i+1; the
// last entry is the no-onward-leg 0), or any equivalent stored travelTimeMin list. A null
// (unmeasured) leg is not counted as a violation. The last entry is excluded — it is the
// terminal stop with no onward leg.
export function countMeasuredWalkViolations(
  legs: Array<number | null>,
  thresholdMin: number
): number {
  let count = 0;
  for (let i = 0; i < legs.length - 1; i++) {
    const leg = legs[i];
    if (leg != null && leg > thresholdMin) count++;
  }
  return count;
}
