import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { Prisma } from "@prisma/client";
import { canEditTripContent } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const { tripId } = await req.json() as { tripId?: string };
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Null out the hash so the next GET forces a fresh generation
  await db.trip.update({
    where: { id: tripId },
    data: {
      cachedRecommendationsContextHash: null,
      cachedRecommendations: Prisma.DbNull,
      cachedRecommendationsGeneratedAt: null,
    },
  });

  console.log(`[recommendations/regenerate] cache cleared tripId=${tripId}`);
  return NextResponse.json({ ok: true });
}
