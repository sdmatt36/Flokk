import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export type DiscoverActivity = {
  title: string;
  type: string;
  city: string | null;
  rating: number;
  ratingNotes: string | null;
  wouldReturn: boolean | null;
  destinationCity: string | null;
  shareToken: string | null;
  familyName: string | null;
  isAnonymous: boolean;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const minRating = Math.max(1, Math.min(5, parseInt(req.nextUrl.searchParams.get("minRating") ?? "3")));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];

  if (q.length >= 2) {
    const like = `%${q}%`;
    rows = await db.$queryRaw<DiscoverActivity[]>(Prisma.sql`
      SELECT
        COALESCE(ii.title, ma.title) AS title,
        COALESCE(ii.type, 'ACTIVITY') AS type,
        COALESCE(ma.city, pr."destinationCity", t."destinationCity") AS city,
        pr.rating,
        pr.notes AS "ratingNotes",
        pr."wouldReturn",
        t."destinationCity",
        t."shareToken",
        fp."familyName",
        t."isAnonymous"
      FROM "PlaceRating" pr
      LEFT JOIN "ItineraryItem" ii ON ii.id = pr."itineraryItemId"
      LEFT JOIN "ManualActivity" ma ON ma.id = pr."manualActivityId"
      JOIN "Trip" t ON t.id = COALESCE(ii."tripId", ma."tripId")
      JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
      WHERE
        t."isPublic" = true
        AND pr.rating >= ${minRating}
        AND (
          LOWER(COALESCE(ii.title, ma.title, '')) LIKE LOWER(${like})
          OR LOWER(COALESCE(ma.city, pr."destinationCity", t."destinationCity", '')) LIKE LOWER(${like})
          OR LOWER(COALESCE(t."destinationCity", '')) LIKE LOWER(${like})
          OR LOWER(COALESCE(t."destinationCountry", '')) LIKE LOWER(${like})
        )
      ORDER BY pr.rating DESC, t."isAnonymous" ASC
    `);
  } else {
    rows = await db.$queryRaw<DiscoverActivity[]>(Prisma.sql`
      SELECT
        COALESCE(ii.title, ma.title) AS title,
        COALESCE(ii.type, 'ACTIVITY') AS type,
        COALESCE(ma.city, pr."destinationCity", t."destinationCity") AS city,
        pr.rating,
        pr.notes AS "ratingNotes",
        pr."wouldReturn",
        t."destinationCity",
        t."shareToken",
        fp."familyName",
        t."isAnonymous"
      FROM "PlaceRating" pr
      LEFT JOIN "ItineraryItem" ii ON ii.id = pr."itineraryItemId"
      LEFT JOIN "ManualActivity" ma ON ma.id = pr."manualActivityId"
      JOIN "Trip" t ON t.id = COALESCE(ii."tripId", ma."tripId")
      JOIN "FamilyProfile" fp ON fp.id = t."familyProfileId"
      WHERE
        t."isPublic" = true
        AND pr.rating >= ${minRating}
      ORDER BY pr.rating DESC, t."isAnonymous" ASC
      LIMIT 50
    `);
  }

  // Group by city
  const grouped: Record<string, DiscoverActivity[]> = {};
  for (const row of rows) {
    const city = (row.city as string | null) ?? row.destinationCity ?? "Unknown";
    if (!grouped[city]) grouped[city] = [];
    grouped[city].push({
      title: row.title,
      type: row.type,
      city,
      rating: Number(row.rating),
      ratingNotes: row.ratingNotes ?? null,
      wouldReturn: row.wouldReturn ?? null,
      destinationCity: row.destinationCity ?? null,
      shareToken: row.shareToken ?? null,
      familyName: row.familyName ?? null,
      isAnonymous: row.isAnonymous ?? true,
    });
  }

  return NextResponse.json({
    activities: rows.map((r) => ({
      title: r.title,
      type: r.type,
      city: (r.city as string | null) ?? r.destinationCity ?? "Unknown",
      rating: Number(r.rating),
      ratingNotes: r.ratingNotes ?? null,
      wouldReturn: r.wouldReturn ?? null,
      shareToken: r.shareToken ?? null,
      familyName: r.familyName ?? null,
      isAnonymous: r.isAnonymous ?? true,
    })),
    grouped,
    total: rows.length,
  });
}
