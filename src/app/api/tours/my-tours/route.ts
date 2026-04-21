import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({});

  const tours = await db.generatedTour.findMany({
    where: { familyProfileId: profileId, deletedAt: null },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      createdAt: true,
      _count: { select: { stops: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped: Record<string, Array<{ id: string; title: string; createdAt: string; stopCount: number; destinationCountry: string | null }>> = {};
  for (const t of tours) {
    const city = t.destinationCity;
    if (!grouped[city]) grouped[city] = [];
    grouped[city].push({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      stopCount: t._count.stops,
      destinationCountry: t.destinationCountry,
    });
  }

  return NextResponse.json(grouped);
}
