import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type PlaceRow = {
  id: string;
  name: string;
  city: string | null;
  placeType: string | null;
  image: string | null;
  address: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating_count: number | bigint;
  avg_rating: number | null;
  sample_note: string | null;
};

type CityRow = {
  city: string;
  place_count: number | bigint;
};

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  if (!city || city.trim().length < 1) {
    return NextResponse.json({ error: "city param required" }, { status: 400 });
  }

  const cityPattern = `%${city.trim()}%`;

  // Build places query — conditionally include type filter
  const placesRaw = type
    ? await db.$queryRaw<PlaceRow[]>(Prisma.sql`
        SELECT
          ma.id,
          ma.title AS name,
          ma.city,
          ma.type AS "placeType",
          ma."imageUrl" AS image,
          ma.address,
          ma.website,
          ma.lat,
          ma.lng,
          COUNT(pr.id)::int AS rating_count,
          ROUND(AVG(pr.rating)::numeric, 1)::float AS avg_rating,
          MAX(pr.notes) AS sample_note
        FROM "ManualActivity" ma
        INNER JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        INNER JOIN "Trip" t ON ma."tripId" = t.id
        WHERE ma.city ILIKE ${cityPattern}
          AND ma.type = ${type}
          AND (t."isPlacesLibrary" = true OR t.privacy::text = 'PUBLIC')
        GROUP BY ma.id, ma.title, ma.city, ma.type, ma."imageUrl", ma.address, ma.website, ma.lat, ma.lng
        ORDER BY avg_rating DESC, rating_count DESC
        LIMIT ${limit}
      `)
    : await db.$queryRaw<PlaceRow[]>(Prisma.sql`
        SELECT
          ma.id,
          ma.title AS name,
          ma.city,
          ma.type AS "placeType",
          ma."imageUrl" AS image,
          ma.address,
          ma.website,
          ma.lat,
          ma.lng,
          COUNT(pr.id)::int AS rating_count,
          ROUND(AVG(pr.rating)::numeric, 1)::float AS avg_rating,
          MAX(pr.notes) AS sample_note
        FROM "ManualActivity" ma
        INNER JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        INNER JOIN "Trip" t ON ma."tripId" = t.id
        WHERE ma.city ILIKE ${cityPattern}
          AND (t."isPlacesLibrary" = true OR t.privacy::text = 'PUBLIC')
        GROUP BY ma.id, ma.title, ma.city, ma.type, ma."imageUrl", ma.address, ma.website, ma.lat, ma.lng
        ORDER BY avg_rating DESC, rating_count DESC
        LIMIT ${limit}
      `);

  // Top cities with rated places
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

  const places = placesRaw.map(r => ({
    id: r.id,
    name: r.name,
    city: r.city,
    placeType: r.placeType,
    image: r.image,
    address: r.address,
    website: r.website,
    lat: r.lat,
    lng: r.lng,
    ratingCount: Number(r.rating_count),
    avgRating: r.avg_rating,
    sampleNote: r.sample_note,
  }));

  const cities = citiesRaw.map(r => ({
    city: r.city,
    placeCount: Number(r.place_count),
  }));

  return NextResponse.json({ places, cities, total: places.length });
}
