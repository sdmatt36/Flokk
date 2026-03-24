import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) return NextResponse.json([]);

  const items = await db.savedItem.findMany({
    where: {
      destinationCity: { contains: city, mode: "insensitive" },
      trip: { privacy: "PUBLIC" },
      rawTitle: { not: null },
      extractionStatus: "ENRICHED",
    },
    select: {
      id: true,
      rawTitle: true,
      rawDescription: true,
      mediaThumbnailUrl: true,
      placePhotoUrl: true,
      categoryTags: true,
      sourceUrl: true,
      lat: true,
      lng: true,
    },
    orderBy: { savedAt: "desc" },
    take: 8,
  });

  return NextResponse.json(items);
}
