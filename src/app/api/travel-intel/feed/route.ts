import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // No auth required — returns only PUBLIC trip saves

  const items = await db.savedItem.findMany({
    where: {
      tripId: { not: null },
      trip: { privacy: "PUBLIC" },
      rawTitle: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      mediaThumbnailUrl: true,
      placePhotoUrl: true,
      destinationCity: true,
      destinationCountry: true,
      categoryTags: true,
    },
    orderBy: { savedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(items);
}
