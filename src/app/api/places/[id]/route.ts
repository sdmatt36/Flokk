import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const spot = await db.communitySpot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      category: true,
      photoUrl: true,
      websiteUrl: true,
      description: true,
      averageRating: true,
      ratingCount: true,
      contributions: {
        select: {
          rating: true,
          note: true,
          createdAt: true,
          family: {
            select: { familyName: true },
          },
        },
        where: { note: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!spot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ spot }, { headers: { "Cache-Control": "no-store" } });
}
