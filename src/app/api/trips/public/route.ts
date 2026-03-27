import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
  const city = req.nextUrl.searchParams.get("city");

  const trips = await db.trip.findMany({
    where: {
      privacy: "PUBLIC",
      status: "COMPLETED",
      ...(city ? { destinationCity: { contains: city, mode: "insensitive" } } : {}),
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
      _count: { select: { savedItems: true } },
      familyProfile: { select: { familyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(trips);
}
