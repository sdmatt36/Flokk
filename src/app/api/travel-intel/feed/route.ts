import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
