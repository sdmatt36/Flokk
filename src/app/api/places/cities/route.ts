import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const revalidate = 300;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const citiesRaw = await db.communitySpot.groupBy({
    by: ["city"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  });

  return NextResponse.json({
    cities: citiesRaw.map(r => ({ city: r.city, placeCount: r._count.id })),
  });
}
