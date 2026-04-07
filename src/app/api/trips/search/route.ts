import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ trips: [] });
  }

  const trips = await db.trip.findMany({
    where: {
      shareToken: { not: null },
      status: { not: "PLANNING" },
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { destinationCity: { contains: q, mode: "insensitive" } },
        { destinationCountry: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      heroImageUrl: true,
      isAnonymous: true,
      _count: { select: { savedItems: true, placeRatings: true } },
      familyProfile: { select: { familyName: true, homeCity: true } },
    },
    orderBy: [{ isAnonymous: "asc" }, { updatedAt: "desc" }],
    take: 12,
  });

  return NextResponse.json({ trips });
}
