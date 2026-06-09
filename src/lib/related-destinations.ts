import { db } from "@/lib/db";
import { getCityImageUrl } from "@/lib/city-image";

export type RelatedDestination =
  | { kind: "city"; slug: string; name: string; country: string; heroUrl: string | null; tags: string[] }
  | { kind: "country"; slug: string; name: string; country: string; heroUrl: string | null; tags: string[] };

export async function getRelatedDestinations({
  currentCountry,
  currentCity,
  excludeTripId,
  limit = 4,
}: {
  currentCountry: string | null;
  currentCity: string | null;
  excludeTripId: string;
  limit?: number;
}): Promise<RelatedDestination[]> {
  const lowerCurrentCity = currentCity?.toLowerCase().trim() ?? null;
  const lowerCurrentCountry = currentCountry?.toLowerCase().trim() ?? null;

  // Fetch all example trips (excluding current)
  const exampleTrips = await db.trip.findMany({
    where: {
      isFlokkerExample: true,
      isPublic: true,
      shareToken: { not: null },
      id: { not: excludeTripId },
    },
    select: {
      destinationCity: true,
      destinationCountry: true,
      viewCount: true,
      heroImageUrl: true,
    },
    orderBy: { viewCount: "desc" },
  });

  // Exclude trips whose city matches the current city
  const filtered = exampleTrips.filter(
    (t) =>
      !lowerCurrentCity ||
      (t.destinationCity?.toLowerCase().trim() ?? "") !== lowerCurrentCity,
  );

  // Build OR conditions for case-insensitive city name lookup
  const cityNames = [
    ...new Set(
      filtered.map((t) => t.destinationCity).filter((n): n is string => !!n),
    ),
  ];
  if (cityNames.length === 0) return [];

  const cities = await db.city.findMany({
    where: {
      OR: cityNames.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
    },
    select: {
      slug: true,
      name: true,
      heroPhotoUrl: true,
      photoUrl: true,
      tags: true,
      country: {
        select: {
          slug: true,
          name: true,
          continentId: true,
          photoUrl: true,
        },
      },
    },
  });

  // Build lookup: lowercase name → City row
  const cityByName = new Map<string, (typeof cities)[0]>();
  for (const city of cities) {
    cityByName.set(city.name.toLowerCase().trim(), city);
  }

  // Resolve current country's continentId
  let currentContinentId: string | null = null;
  if (currentCountry) {
    const country = await db.country.findFirst({
      where: { name: { equals: currentCountry, mode: "insensitive" } },
      select: { continentId: true },
    });
    currentContinentId = country?.continentId ?? null;
  }

  // Collapse trips per city slug, keep highest viewCount
  type CityEntry = {
    slug: string;
    name: string;
    country: string;
    countrySlug: string;
    countryPhotoUrl: string | null;
    continentId: string;
    heroUrl: string | null;
    tags: string[];
    viewCount: number;
  };
  const cityMap = new Map<string, CityEntry>();

  for (const trip of filtered) {
    if (!trip.destinationCity) continue;
    const cityRow = cityByName.get(trip.destinationCity.toLowerCase().trim());
    if (!cityRow) continue; // skip the ~2 non-matching cities

    const { slug } = cityRow;
    if (!cityMap.has(slug)) {
      cityMap.set(slug, {
        slug,
        name: cityRow.name,
        country: cityRow.country.name,
        countrySlug: cityRow.country.slug,
        countryPhotoUrl: cityRow.country.photoUrl ?? null,
        continentId: cityRow.country.continentId,
        heroUrl: getCityImageUrl(cityRow.heroPhotoUrl, cityRow.photoUrl) || trip.heroImageUrl?.trim() || null,
        tags: (cityRow.tags as string[]).slice(0, 2),
        viewCount: trip.viewCount ?? 0,
      });
    } else {
      // Higher viewCount wins for heroUrl
      const existing = cityMap.get(slug)!;
      if ((trip.viewCount ?? 0) > existing.viewCount) {
        existing.heroUrl = getCityImageUrl(cityRow.heroPhotoUrl, cityRow.photoUrl) || trip.heroImageUrl?.trim() || null;
        existing.viewCount = trip.viewCount ?? 0;
      }
    }
  }

  const allCities = Array.from(cityMap.values());

  // Tier 1: same country
  const tier1 = allCities
    .filter(
      (c) =>
        lowerCurrentCountry && c.country.toLowerCase() === lowerCurrentCountry,
    )
    .sort((a, b) => b.viewCount - a.viewCount);

  // Tier 2: same continent, different country
  const tier1Slugs = new Set(tier1.map((c) => c.slug));
  const tier2 = allCities
    .filter(
      (c) =>
        !tier1Slugs.has(c.slug) &&
        currentContinentId &&
        c.continentId === currentContinentId,
    )
    .sort((a, b) => b.viewCount - a.viewCount);

  // Tier 3: global
  const tier1And2Slugs = new Set([
    ...tier1.map((c) => c.slug),
    ...tier2.map((c) => c.slug),
  ]);
  const tier3 = allCities
    .filter((c) => !tier1And2Slugs.has(c.slug))
    .sort((a, b) => b.viewCount - a.viewCount);

  const orderedCities = [...tier1, ...tier2, ...tier3];

  // Country card: append if current country has 2+ example cities and we have room
  const currentCountryCities = allCities.filter(
    (c) =>
      lowerCurrentCountry && c.country.toLowerCase() === lowerCurrentCountry,
  );
  const cityResults: RelatedDestination[] = orderedCities
    .slice(0, limit)
    .map((c) => ({
      kind: "city" as const,
      slug: c.slug,
      name: c.name,
      country: c.country,
      heroUrl: c.heroUrl,
      tags: c.tags,
    }));

  if (
    currentCountryCities.length >= 2 &&
    cityResults.length < limit &&
    currentCountryCities[0]
  ) {
    const first = currentCountryCities[0];
    cityResults.push({
      kind: "country" as const,
      slug: first.countrySlug,
      name: first.country,
      country: first.country,
      heroUrl: first.countryPhotoUrl ?? first.heroUrl,
      tags: [],
    });
  }

  return cityResults;
}
