import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the INPUTS to bucketSaves (src/lib/saves-bucketing.ts).
//
// Both callers of bucketSaves — the web Saves screen (SavesScreen.tsx, which reads
// /api/saves + /api/trips) and the mobile feed (/api/saves/feed) — must derive the same
// trip set, saves set, and Tier-2 coords, or the tabs disagree. Importing these helpers
// from one place keeps them from drifting again. None of this changes bucketSaves itself.
// ─────────────────────────────────────────────────────────────────────────────

// ── Saves set ────────────────────────────────────────────────────────────────
// Flight saves live in ItineraryItem, not the Saves buckets. Both /api/saves and
// /api/saves/feed apply this exact exclusion. isEmpty:false / sourceUrl-not-null guards
// stop NULL propagation from silently dropping rows.
export const SAVES_FLIGHT_TAGS = [
  "flight", "airfare", "airline", "airflight", "flights", "Flight", "Airline", "Airfare",
];
export const savesFlightNot: Prisma.SavedItemWhereInput[] = [
  { AND: [{ categoryTags: { isEmpty: false } }, { categoryTags: { hasSome: SAVES_FLIGHT_TAGS } }] },
  { AND: [{ lat: null }, { rawTitle: { contains: "flight", mode: "insensitive" } }] },
  { AND: [{ lat: null }, { rawTitle: { contains: "airline", mode: "insensitive" } }] },
  { AND: [{ lat: null }, { rawTitle: { contains: "airfare", mode: "insensitive" } }] },
  { AND: [{ sourceUrl: { not: null } }, { sourceUrl: { contains: "/travel/flights", mode: "insensitive" } }] },
];

// ── Trip set ─────────────────────────────────────────────────────────────────
// Access predicate used by /api/trips (and so by the web screen) and by the feed:
// trips the profile is an accepted collaborator on, excluding Places Library libraries.
export function tripAccessWhere(profileId: string): Prisma.TripWhereInput {
  return {
    collaborators: { some: { familyProfileId: profileId, acceptedAt: { not: null } } },
    isPlacesLibrary: false,
  };
}

// Pure predicate the web screen applies to that set (SavesScreen.tsx) and the feed mirrors:
// drop Places Library and COMPLETED trips. Kept as a function so both sides share one rule.
export function tripIsBucketable(t: { isPlacesLibrary?: boolean | null; status?: string | null }): boolean {
  return !t.isPlacesLibrary && t.status !== "COMPLETED";
}

// ── Tier-2 coords ──────────────────────────────────────────────────────────────
// bucketSaves' third arg: { "<city>,<country>": {lat,lng} }. The web populates this from
// /api/trips/cities-geo; the feed previously passed {} (so its Tier-2 proximity matches
// never fired). Replicate the same geocode here so both produce identical coord keys.
type GeoTrip = { cities: string[]; countries: string[]; country: string | null };
const geoCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeCity(city: string, country: string | null): Promise<{ lat: number; lng: number } | null> {
  const key = `${city.toLowerCase()},${(country ?? "").toLowerCase()}`;
  if (geoCache.has(key)) return geoCache.get(key)!;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) { geoCache.set(key, null); return null; }
  const query = country ? `${city}, ${country}` : city;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`,
    );
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    const coords = loc ? { lat: loc.lat as number, lng: loc.lng as number } : null;
    geoCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

export async function geocodeTripCities(trips: GeoTrip[]): Promise<Record<string, { lat: number; lng: number }>> {
  const seen = new Set<string>();
  const pairs: Array<{ city: string; country: string | null }> = [];
  for (const t of trips) {
    const countries = t.countries?.length > 0 ? t.countries : (t.country ? [t.country] : []);
    const primary = countries[0] ?? null;
    for (const city of (t.cities ?? [])) {
      const key = `${city.toLowerCase()},${(primary ?? "").toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); pairs.push({ city, country: primary }); }
    }
  }
  const out: Record<string, { lat: number; lng: number }> = {};
  await Promise.all(
    pairs.map(async ({ city, country }) => {
      const coords = await geocodeCity(city, country);
      if (coords) out[`${city.toLowerCase()},${(country ?? "").toLowerCase()}`] = coords;
    }),
  );
  return out;
}
