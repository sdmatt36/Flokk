import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const revalidate = 300;

type CityRow = {
  city: string;
  place_count: number | bigint;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const citiesRaw = await db.$queryRaw<CityRow[]>(Prisma.sql`
    SELECT ma.city, COUNT(DISTINCT ma.id)::int AS place_count
    FROM "ManualActivity" ma
    INNER JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
    INNER JOIN "Trip" t ON ma."tripId" = t.id
    WHERE ma.city IS NOT NULL
      AND (t."isPlacesLibrary" = true OR t.privacy::text = 'PUBLIC')
    GROUP BY ma.city
    ORDER BY place_count DESC
    LIMIT 20
  `);

  const cities = citiesRaw.map(r => ({
    city: r.city,
    placeCount: Number(r.place_count),
  }));

  return NextResponse.json({ cities });
}
