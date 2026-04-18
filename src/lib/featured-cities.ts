// Server-only. Called directly from /discover/spots page and via /api/places/featured-cities.
// Continent is computed from country — never stored on CommunitySpot.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getContinent } from "@/lib/continents";
import type { Continent } from "@/lib/continents";

export type FeaturedCity = {
  city: string;
  country: string | null;
  continent: Continent | null;
  spotCount: number;
  contributorCount: number;
  heroPhotoUrl: string | null;
  isFallback: boolean;
};

export type FeaturedCitiesResult = {
  cities: FeaturedCity[];
  mode: "trending" | "fallback";
};

type CityRankRow = {
  city: string;
  contributor_count: number | bigint;
  contribution_count: number | bigint;
};

type CityEnrichRow = {
  city: string;
  country: string | null;
  spot_count: number | bigint;
  hero_photo_url: string | null;
};

export async function getFeaturedCities(): Promise<FeaturedCitiesResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Step 1: 7-day trending — cities ranked by unique contributors in the last 7 days
  let rankRows = await db.$queryRaw<CityRankRow[]>(Prisma.sql`
    SELECT
      cs.city,
      COUNT(DISTINCT sc."familyProfileId")::int AS contributor_count,
      COUNT(sc.id)::int AS contribution_count
    FROM "CommunitySpot" cs
    INNER JOIN "SpotContribution" sc ON sc."communitySpotId" = cs.id
    WHERE sc."updatedAt" >= ${sevenDaysAgo}
    GROUP BY cs.city
    ORDER BY contributor_count DESC, contribution_count DESC
    LIMIT 12
  `);

  let mode: "trending" | "fallback" = "trending";

  // Step 2: fallback to all-time if no recent activity
  if (rankRows.length === 0) {
    mode = "fallback";
    rankRows = await db.$queryRaw<CityRankRow[]>(Prisma.sql`
      SELECT
        cs.city,
        COUNT(DISTINCT sc."familyProfileId")::int AS contributor_count,
        COUNT(sc.id)::int AS contribution_count
      FROM "CommunitySpot" cs
      INNER JOIN "SpotContribution" sc ON sc."communitySpotId" = cs.id
      GROUP BY cs.city
      ORDER BY contributor_count DESC, contribution_count DESC
      LIMIT 12
    `);
  }

  if (rankRows.length === 0) {
    return { cities: [], mode };
  }

  const cityNames = rankRows.map(r => r.city);
  const cityList = Prisma.join(cityNames);

  // Step 3: batch enrich — country (most common), spotCount, heroPhotoUrl — single query
  const enrichRows = await db.$queryRaw<CityEnrichRow[]>(Prisma.sql`
    WITH city_countries AS (
      SELECT city, country, COUNT(*) AS cnt
      FROM "CommunitySpot"
      WHERE city IN (${cityList}) AND country IS NOT NULL
      GROUP BY city, country
    ),
    top_country AS (
      SELECT DISTINCT ON (city) city, country
      FROM city_countries
      ORDER BY city, cnt DESC
    ),
    spot_counts AS (
      SELECT city, COUNT(*)::int AS spot_count
      FROM "CommunitySpot"
      WHERE city IN (${cityList})
      GROUP BY city
    ),
    hero_photos AS (
      SELECT DISTINCT ON (city) city, "photoUrl"
      FROM "CommunitySpot"
      WHERE city IN (${cityList}) AND "photoUrl" IS NOT NULL
      ORDER BY city, "averageRating" DESC NULLS LAST, "contributionCount" DESC
    )
    SELECT
      sc.city,
      tc.country,
      sc.spot_count,
      hp."photoUrl" AS hero_photo_url
    FROM spot_counts sc
    LEFT JOIN top_country tc ON tc.city = sc.city
    LEFT JOIN hero_photos hp ON hp.city = sc.city
  `);

  const enrichMap = new Map<string, CityEnrichRow>(enrichRows.map(r => [r.city, r]));

  const cities: FeaturedCity[] = rankRows.map(r => {
    const enrich = enrichMap.get(r.city);
    const country = enrich?.country ?? null;
    return {
      city: r.city,
      country,
      continent: getContinent(country),
      spotCount: Number(enrich?.spot_count ?? 0),
      contributorCount: Number(r.contributor_count),
      heroPhotoUrl: enrich?.hero_photo_url ?? null,
      isFallback: mode === "fallback",
    };
  });

  return { cities, mode };
}
