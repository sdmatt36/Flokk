import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export type DiscoverActivity = {
  id: string;
  title: string;
  type: string | null;
  city: string | null;
  rating: number | null;
  ratingNotes: string | null;
  wouldReturn: boolean | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  tripId: string;
  shareToken: string | null;
  familyName: string | null;
  isAnonymous: boolean;
  visitorCount: number;
  source: "manual" | "itinerary";
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const minRatingParam = req.nextUrl.searchParams.get("minRating");
  const minRating = minRatingParam ? Math.max(1, Math.min(5, parseInt(minRatingParam))) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];

  if (q.length >= 2) {
    const like = `%${q}%`;
    rows = await db.$queryRaw(Prisma.sql`
      WITH raw_activities AS (
        SELECT
          ma.id,
          ma.title,
          COALESCE(ma.type, 'ACTIVITY') AS type,
          ma.city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          ma.website AS "websiteUrl",
          ma."imageUrl",
          t.id AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          fp.id AS "profileId",
          'manual' AS source,
          ma."createdAt"
        FROM "ManualActivity" ma
        JOIN "Trip" t ON t.id = ma."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true
          AND (pr.rating IS NULL OR pr.rating >= 3)

        UNION ALL

        SELECT
          ii.id,
          ii.title,
          COALESCE(ii.type, 'ACTIVITY') AS type,
          NULL::text AS city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          NULL::text AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          fp.id AS "profileId",
          'itinerary' AS source,
          ii."createdAt"
        FROM "ItineraryItem" ii
        JOIN "Trip" t ON t.id = ii."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."itineraryItemId" = ii.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true
          AND ii.type NOT IN ('FLIGHT', 'TRAIN', 'LODGING', 'TRANSIT')
          AND (pr.rating IS NULL OR pr.rating >= 3)
      ),
      aggregated AS (
        SELECT
          MIN(id) AS id,
          title,
          MAX(type) AS type,
          MAX(city) AS city,
          ROUND(AVG(rating)) AS rating,
          MAX("ratingNotes") AS "ratingNotes",
          MAX("wouldReturn"::int)::boolean AS "wouldReturn",
          MAX("websiteUrl") AS "websiteUrl",
          MAX("imageUrl") AS "imageUrl",
          MIN("tripId") AS "tripId",
          MIN("shareToken") AS "shareToken",
          CASE
            WHEN COUNT(DISTINCT "profileId") = 1 THEN MAX("familyName")
            ELSE NULL
          END AS "familyName",
          CASE
            WHEN COUNT(DISTINCT "profileId") = 1 THEN MAX("isAnonymous"::int)::boolean
            ELSE true
          END AS "isAnonymous",
          COUNT(DISTINCT "profileId") AS "visitorCount",
          MAX(source) AS source,
          MAX("createdAt") AS "createdAt"
        FROM raw_activities
        GROUP BY LOWER(TRIM(title)), LOWER(TRIM(COALESCE(city, '')))
      )
      SELECT * FROM aggregated
      WHERE (
        LOWER(COALESCE(title, '')) LIKE LOWER(${like})
        OR LOWER(COALESCE(city, '')) LIKE LOWER(${like})
      )
      ${minRating !== null ? Prisma.sql`AND rating >= ${minRating}` : Prisma.sql``}
      ORDER BY "createdAt" DESC, rating DESC NULLS LAST
      LIMIT 200
    `);
  } else {
    rows = await db.$queryRaw(Prisma.sql`
      WITH raw_activities AS (
        SELECT
          ma.id,
          ma.title,
          COALESCE(ma.type, 'ACTIVITY') AS type,
          ma.city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          ma.website AS "websiteUrl",
          ma."imageUrl",
          t.id AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          fp.id AS "profileId",
          'manual' AS source,
          ma."createdAt"
        FROM "ManualActivity" ma
        JOIN "Trip" t ON t.id = ma."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true
          AND (pr.rating IS NULL OR pr.rating >= 3)

        UNION ALL

        SELECT
          ii.id,
          ii.title,
          COALESCE(ii.type, 'ACTIVITY') AS type,
          NULL::text AS city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          NULL::text AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          fp.id AS "profileId",
          'itinerary' AS source,
          ii."createdAt"
        FROM "ItineraryItem" ii
        JOIN "Trip" t ON t.id = ii."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."itineraryItemId" = ii.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true
          AND ii.type NOT IN ('FLIGHT', 'TRAIN', 'LODGING', 'TRANSIT')
          AND (pr.rating IS NULL OR pr.rating >= 3)
      ),
      aggregated AS (
        SELECT
          MIN(id) AS id,
          title,
          MAX(type) AS type,
          MAX(city) AS city,
          ROUND(AVG(rating)) AS rating,
          MAX("ratingNotes") AS "ratingNotes",
          MAX("wouldReturn"::int)::boolean AS "wouldReturn",
          MAX("websiteUrl") AS "websiteUrl",
          MAX("imageUrl") AS "imageUrl",
          MIN("tripId") AS "tripId",
          MIN("shareToken") AS "shareToken",
          CASE
            WHEN COUNT(DISTINCT "profileId") = 1 THEN MAX("familyName")
            ELSE NULL
          END AS "familyName",
          CASE
            WHEN COUNT(DISTINCT "profileId") = 1 THEN MAX("isAnonymous"::int)::boolean
            ELSE true
          END AS "isAnonymous",
          COUNT(DISTINCT "profileId") AS "visitorCount",
          MAX(source) AS source,
          MAX("createdAt") AS "createdAt"
        FROM raw_activities
        GROUP BY LOWER(TRIM(title)), LOWER(TRIM(COALESCE(city, '')))
      )
      SELECT * FROM aggregated
      ${minRating !== null ? Prisma.sql`WHERE rating >= ${minRating}` : Prisma.sql``}
      ORDER BY "createdAt" DESC, rating DESC NULLS LAST
      LIMIT 200
    `);
  }

  const activities: DiscoverActivity[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type ?? null,
    city: r.city ?? null,
    rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
    ratingNotes: r.ratingNotes ?? null,
    wouldReturn: r.wouldReturn ?? null,
    websiteUrl: r.websiteUrl ?? null,
    imageUrl: r.imageUrl ?? null,
    tripId: r.tripId,
    shareToken: r.shareToken ?? null,
    familyName: r.familyName ?? null,
    isAnonymous: r.isAnonymous ?? true,
    visitorCount: Number(r.visitorCount ?? 1),
    source: r.source as "manual" | "itinerary",
  }));

  return NextResponse.json({
    activities,
    total: activities.length,
  });
}
