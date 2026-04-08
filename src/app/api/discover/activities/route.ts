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
      SELECT * FROM (
        SELECT
          ma.id::text AS id,
          ma.title,
          'ACTIVITY' AS type,
          ma.city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          ma.website AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id::text AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          'manual' AS source,
          ma."createdAt"
        FROM "ManualActivity" ma
        JOIN "Trip" t ON t.id = ma."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true

        UNION ALL

        SELECT
          ii.id::text AS id,
          ii.title,
          ii.type,
          NULL::text AS city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          NULL::text AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id::text AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
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
      ) combined
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
      SELECT * FROM (
        SELECT
          ma.id::text AS id,
          ma.title,
          'ACTIVITY' AS type,
          ma.city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          ma.website AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id::text AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
          'manual' AS source,
          ma."createdAt"
        FROM "ManualActivity" ma
        JOIN "Trip" t ON t.id = ma."tripId"
        JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
        LEFT JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE t."endDate" IS NOT NULL
          AND t."endDate" < NOW()
          AND t."isPublic" = true

        UNION ALL

        SELECT
          ii.id::text AS id,
          ii.title,
          ii.type,
          NULL::text AS city,
          pr.rating,
          pr.notes AS "ratingNotes",
          pr."wouldReturn",
          NULL::text AS "websiteUrl",
          NULL::text AS "imageUrl",
          t.id::text AS "tripId",
          t."shareToken",
          fp."familyName",
          t."isAnonymous",
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
      ) combined
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
    source: r.source as "manual" | "itinerary",
  }));

  return NextResponse.json({
    activities,
    total: activities.length,
  });
}
