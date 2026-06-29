import { haversineKm, WITHIN_REACH_KM } from "@/lib/geo";

export const IMPORT_SOURCE_METHODS = new Set(["maps_import"]);

export type BucketSaveInput = {
  id: string;
  tripId: string | null;
  sourceMethod: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  lat: number | null;
  lng: number | null;
  suggestionTier?: "primary" | "secondary" | null;
};

export type BucketTrip = {
  id: string;
  title: string | null;
  destinationCity: string | null;
  cities: string[];
  country: string | null;
  countries: string[];
  startDate: Date | string | null;
  endDate: Date | string | null;
};

export type UpcomingBucket<T> = {
  tripId: string;
  tripName: string;
  destinationCity: string | null;
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  explicitSaves: T[];
  suggestedSaves: T[];
};

export type BucketResult<T> = {
  upcomingSections: UpcomingBucket<T>[];
  pastCityMap: Map<string, T[]>;
  unassigned: T[];
  imported: T[];
  suggestedTripMap: Map<string, Array<{ id: string; name: string }>>;
};

function toMs(d: Date | string | null): number {
  if (!d) return Infinity;
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function toIsoOrNull(d: Date | string | null): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

export function bucketSaves<T extends BucketSaveInput>(
  saves: T[],
  allTrips: BucketTrip[],
  tripCityCoords: Record<string, { lat: number; lng: number }>
): BucketResult<T> {
  const now = new Date();

  const upcomingTrips = allTrips
    .filter((t) => !t.endDate || toMs(t.endDate) >= now.getTime())
    .sort((a, b) => {
      const diff = toMs(a.startDate) - toMs(b.startDate);
      if (diff !== 0) return diff;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  const pastTrips = allTrips.filter((t) => t.endDate && toMs(t.endDate) < now.getTime());
  const pastTripIds = new Set(pastTrips.map((t) => t.id));

  const upcomingCityIndex = new Map<string, string[]>();
  const upcomingTripCities = new Map<string, string[]>();
  const upcomingTripCountries = new Map<string, string[]>();
  const upcomingTripPrimaryCountry = new Map<string, string>();
  const upcomingTripById = new Map(upcomingTrips.map((t) => [t.id, t]));

  for (const t of upcomingTrips) {
    const cityList = t.cities.length > 0 ? t.cities : (t.destinationCity ? [t.destinationCity] : []);
    const cityKeys = cityList.map((c) => c.trim().toLowerCase()).filter(Boolean);
    upcomingTripCities.set(t.id, cityKeys);
    for (const key of cityKeys) {
      const existing = upcomingCityIndex.get(key) ?? [];
      existing.push(t.id);
      upcomingCityIndex.set(key, existing);
    }
    const tripCountries = t.countries.length > 0 ? t.countries : (t.country ? [t.country] : []);
    const countryKeys = tripCountries.map((c) => c.trim().toLowerCase()).filter(Boolean);
    upcomingTripCountries.set(t.id, countryKeys);
    if (tripCountries.length > 0) upcomingTripPrimaryCountry.set(t.id, tripCountries[0]);
  }

  const upcomingSections: UpcomingBucket<T>[] = upcomingTrips.map((t) => ({
    tripId: t.id,
    tripName: t.title ?? "",
    destinationCity: t.destinationCity,
    cities: t.cities,
    startDate: toIsoOrNull(t.startDate),
    endDate: toIsoOrNull(t.endDate),
    explicitSaves: [],
    suggestedSaves: [],
  }));
  const upcomingTripIndex = new Map(upcomingSections.map((s) => [s.tripId, s]));

  const pastCityMap = new Map<string, T[]>();
  const unassigned: T[] = [];
  const imported: T[] = [];
  const suggestedTripMap = new Map<string, Array<{ id: string; name: string }>>();

  for (const save of saves) {
    const cityKey = (save.destinationCity ?? "").trim().toLowerCase();
    const countryKey = (save.destinationCountry ?? "").trim().toLowerCase();

    if (!save.tripId && IMPORT_SOURCE_METHODS.has(save.sourceMethod ?? "")) {
      imported.push(save);
      continue;
    }

    if (save.tripId && upcomingTripIndex.has(save.tripId)) {
      upcomingTripIndex.get(save.tripId)!.explicitSaves.push(save);
      continue;
    }

    if (save.tripId && pastTripIds.has(save.tripId)) {
      const city = save.destinationCity ?? "Unknown";
      const list = pastCityMap.get(city) ?? [];
      list.push(save);
      pastCityMap.set(city, list);
      continue;
    }

    if (!save.tripId) {
      const tier1: BucketTrip[] = [];
      const tier2: BucketTrip[] = [];
      const tier3: BucketTrip[] = [];

      // Tier 1: exact city match
      if (cityKey) {
        for (const tripId of (upcomingCityIndex.get(cityKey) ?? [])) {
          const t = upcomingTripById.get(tripId);
          if (t) tier1.push(t);
        }
      }

      // Tier 2: within 150km of a declared trip city
      if (save.lat != null && save.lng != null) {
        for (const t of upcomingTrips) {
          if (tier1.find((x) => x.id === t.id)) continue;
          const cities = upcomingTripCities.get(t.id) ?? [];
          if (cities.length === 0) continue;
          const primaryCountry = upcomingTripPrimaryCountry.get(t.id) ?? "";
          let withinReach = false;
          for (const city of cities) {
            const coordKey = `${city},${primaryCountry.toLowerCase()}`;
            const coords = tripCityCoords[coordKey];
            if (!coords) continue;
            if (haversineKm({ lat: save.lat!, lng: save.lng! }, coords) <= WITHIN_REACH_KM) {
              withinReach = true;
              break;
            }
          }
          if (withinReach) tier2.push(t);
        }
      }

      // Tier 3: country-scoped trips (no declared cities)
      if (countryKey) {
        for (const t of upcomingTrips) {
          if (tier1.find((x) => x.id === t.id) || tier2.find((x) => x.id === t.id)) continue;
          const cities = upcomingTripCities.get(t.id) ?? [];
          if (cities.length > 0) continue;
          const countries = upcomingTripCountries.get(t.id) ?? [];
          if (countries.includes(countryKey)) tier3.push(t);
        }
      }

      const allCandidates: Array<{ trip: BucketTrip; tier: 1 | 2 | 3 }> = [
        ...tier1.map((t) => ({ trip: t, tier: 1 as const })),
        ...tier2.map((t) => ({ trip: t, tier: 2 as const })),
        ...tier3.map((t) => ({ trip: t, tier: 3 as const })),
      ];

      if (allCandidates.length > 0) {
        // Record all candidates for the assign dropdown
        suggestedTripMap.set(
          save.id,
          allCandidates.map((c) => ({ id: c.trip.id, name: c.trip.title ?? "" }))
        );

        // Single-best-match: most specific tier wins; nearest start date on tie
        const best = allCandidates.reduce((a, b) => {
          if (a.tier !== b.tier) return a.tier < b.tier ? a : b;
          return toMs(a.trip.startDate) <= toMs(b.trip.startDate) ? a : b;
        });

        const tier: "primary" | "secondary" = best.tier === 1 ? "primary" : "secondary";
        upcomingTripIndex.get(best.trip.id)!.suggestedSaves.push(
          { ...save, suggestionTier: tier } as unknown as T
        );
        continue;
      }

    }

    // Unassigned = saves with NO location only (destinationCity null/empty, and cityId null —
    // no row in the dataset has a cityId without a destinationCity, so the city name is the
    // governing signal). Any save that HAS a city but didn't match an upcoming trip above is
    // located, so it belongs in the by-city located view (the Past tab groups located saves by
    // city) — whether or not a matching past trip exists, and including saves attached to a
    // Places-Library trip (excluded from allTrips, so it has no upcoming/past match here).
    // Only truly location-less saves fall through to Unassigned.
    if (cityKey) {
      const city = save.destinationCity!.trim();
      const list = pastCityMap.get(city) ?? [];
      list.push(save);
      pastCityMap.set(city, list);
      continue;
    }

    unassigned.push(save);
  }

  return { upcomingSections, pastCityMap, unassigned, imported, suggestedTripMap };
}
