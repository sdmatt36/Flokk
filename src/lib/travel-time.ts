// Single source of truth for tour-stop travel times. Previously this helper and the
// transport->Mapbox-profile map were byte-identical copies in
// src/app/api/tours/[id]/stops/route.ts and src/lib/tour-stop-insertion.ts; both now
// import from here. Generate/Regenerate also use this to measure legs instead of
// persisting the AI model's guessed travelTime.

import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

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

// ── Hard walking-leg cap ────────────────────────────────────────────────────────
// No AI-generated WALKING tour ships with a measured leg over this many minutes between
// consecutive stops. Deterministic, code-enforced — additive to the soft family-threshold
// warning (maxWalkMinutes / countMeasuredWalkViolations), which is left intact.
export const MAX_WALK_LEG_MIN = 20;

// Straight-line proxy used for the DROP DECISION only (no per-iteration Mapbox calls):
// ~1.6 km is roughly a 20-minute walk. The authoritative cap stays the MEASURED
// MAX_WALK_LEG_MIN — the kept set is re-measured with Mapbox once after dropping.
const MAX_WALK_LEG_KM = 1.6;

type WalkCapStop = { id: string; lat: number | null; lng: number | null };
type CoordStop = { id: string; lat: number; lng: number };

function countLegBreaches(seq: CoordStop[]): number {
  let n = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    if (haversineKm(seq[i], seq[i + 1]) > MAX_WALK_LEG_KM) n++;
  }
  return n;
}

// Greedy nearest-neighbor ordering anchored on the first stop.
function nearestNeighborOrder(seq: CoordStop[]): CoordStop[] {
  if (seq.length <= 2) return [...seq];
  const remaining = [...seq];
  const ordered: CoordStop[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const cur = ordered[ordered.length - 1];
    let best = 0;
    let bestD = haversineKm(cur, remaining[0]);
    for (let j = 1; j < remaining.length; j++) {
      const d = haversineKm(cur, remaining[j]);
      if (d < bestD) { bestD = d; best = j; }
    }
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}

// The two globally-closest stops (min pairwise haversine), in input order.
function twoClosest(seq: CoordStop[]): CoordStop[] {
  let bi = 0;
  let bj = 1;
  let bd = Infinity;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      const d = haversineKm(seq[i], seq[j]);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
  }
  return [seq[bi], seq[bj]];
}

// Enforce the hard cap on a Walking tour's stops. Drop decisions use the resolved lat/lng
// + haversine: while any consecutive leg would exceed the cap, drop the farthest geographic
// outlier among the stops touching a breaching leg, re-order the rest nearest-neighbor from
// the first kept stop, and recheck. Floor: never below 2 stops — keep the 2 closest. Persists
// by soft-deleting dropped rows, renumbering kept orderIndex contiguously from 0, then
// re-measuring the kept set ONCE and writing the real travelTimeMin (last stop 0). Never
// throws — a failure leaves the tour exactly as the prior measure pass left it.
//
// Returns null (a true no-op: no DB writes, no Mapbox calls) when transport !== "Walking",
// fewer than 2 coord-bearing stops, or the stops already comply — so the common compliant
// case costs only a haversine scan. Returns { droppedIds } when it changed the tour.
//
// protectedEndId (optional): an explicit user end-anchor that must never be dropped and stays
// last. Only body stops are pruned; the single leg into the protected end may exceed the cap
// (labeled downstream via per-leg travelTime), never deleted.
export async function enforceWalkLegCap(
  tourId: string,
  transport: string,
  stops: WalkCapStop[],
  protectedEndId?: string,
): Promise<{ droppedIds: string[] } | null> {
  if (transport !== "Walking") return null;
  try {
    const coordStops: CoordStop[] = stops.filter(
      (s): s is CoordStop => s.lat != null && s.lng != null,
    );
    const coordlessStops = stops.filter((s) => s.lat == null || s.lng == null);
    if (coordStops.length < 2) return null;

    // An explicit user end-anchor (resolved inputEndPoint / extracted free-text end, the stop
    // pinEndLast targets) is NEVER pruned and always kept last. The single leg INTO it may exceed
    // the cap — that is the one labeled long leg to the finish the user chose, surfaced to the
    // client via the persisted per-leg travelTime (the mobile caveat flags any incoming leg > cap).
    // Only body (discovery) stops are eligible to drop; this exemption also keeps the end outside
    // the future walking-cluster constraint (#2). With no end-anchor, the original path runs.
    const protectedEnd = protectedEndId
      ? coordStops.find((s) => s.id === protectedEndId)
      : undefined;

    let working: CoordStop[];

    if (!protectedEnd) {
      if (countLegBreaches(coordStops) === 0) return null; // already compliant — no-op

      working = [...coordStops];
      while (working.length > 2 && countLegBreaches(working) > 0) {
        // Candidates: the endpoints of every breaching leg.
        const candidateIdx = new Set<number>();
        for (let i = 0; i < working.length - 1; i++) {
          if (haversineKm(working[i], working[i + 1]) > MAX_WALK_LEG_KM) {
            candidateIdx.add(i);
            candidateIdx.add(i + 1);
          }
        }
        // Drop the farthest geographic outlier (max distance to the current centroid).
        const cLat = working.reduce((s, x) => s + x.lat, 0) / working.length;
        const cLng = working.reduce((s, x) => s + x.lng, 0) / working.length;
        let worst = -1;
        let worstD = -1;
        for (const idx of candidateIdx) {
          const d = haversineKm(working[idx], { lat: cLat, lng: cLng });
          if (d > worstD) { worstD = d; worst = idx; }
        }
        working.splice(worst, 1);
        working = nearestNeighborOrder(working);
      }
      // Floor: if a breach survives (only possible at exactly 2 stops), keep the 2 closest.
      if (countLegBreaches(working) > 0) {
        working = twoClosest(coordStops);
      }
    } else {
      // Protected-end path: prune only among the body stops (everything except the protected
      // end), considering ONLY body-internal legs. The leg into the protected end is exempt, so
      // a far user-chosen finish is labeled (long leg) rather than deleted. The end is appended
      // last and is never a drop candidate; the loop naturally stops at one body stop (>= 2 total).
      let body = nearestNeighborOrder(coordStops.filter((s) => s.id !== protectedEnd.id));
      while (body.length > 1 && countLegBreaches(body) > 0) {
        const candidateIdx = new Set<number>();
        for (let i = 0; i < body.length - 1; i++) {
          if (haversineKm(body[i], body[i + 1]) > MAX_WALK_LEG_KM) {
            candidateIdx.add(i);
            candidateIdx.add(i + 1);
          }
        }
        const cLat = body.reduce((s, x) => s + x.lat, 0) / body.length;
        const cLng = body.reduce((s, x) => s + x.lng, 0) / body.length;
        let worst = -1;
        let worstD = -1;
        for (const idx of candidateIdx) {
          const d = haversineKm(body[idx], { lat: cLat, lng: cLng });
          if (d > worstD) { worstD = d; worst = idx; }
        }
        body.splice(worst, 1);
        body = nearestNeighborOrder(body);
      }
      working = [...body, protectedEnd]; // protected end always last
    }

    const keptIds = new Set(working.map((s) => s.id));
    const droppedIds = coordStops.filter((s) => !keptIds.has(s.id)).map((s) => s.id);
    if (droppedIds.length === 0) return null; // nothing actually dropped

    // Persist. Soft-delete dropped rows so the live tour (deletedAt IS NULL) excludes them.
    await db.tourStop.updateMany({
      where: { id: { in: droppedIds } },
      data: { deletedAt: new Date() },
    });
    // Kept set = reordered coord-bearing stops, then any coordless stops appended.
    const finalKept: WalkCapStop[] = [...working, ...coordlessStops];
    await Promise.all(
      finalKept.map((s, i) => db.tourStop.update({ where: { id: s.id }, data: { orderIndex: i } })),
    );
    // Re-measure the kept set ONCE and write the real travelTimeMin (last stop 0).
    const legs = await measureAdjacentLegs(
      finalKept.map((s) => ({ lat: s.lat, lng: s.lng })),
      transport,
    );
    await Promise.all(
      finalKept.map((s, i) => db.tourStop.update({ where: { id: s.id }, data: { travelTimeMin: legs[i] } })),
    );

    console.log(`[walk-cap] tourId=${tourId} dropped=${droppedIds.length} kept=${finalKept.length} (cap=${MAX_WALK_LEG_MIN}min/~${MAX_WALK_LEG_KM}km)`);
    return { droppedIds };
  } catch (e) {
    console.error("[walk-cap] enforcement failed:", e);
    return null;
  }
}
