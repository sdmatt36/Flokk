import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export interface UserSpotRating {
  spotId: string;
  spotName: string;
  spotCity: string | null;
  rating: number | null;
  note: string | null;
}

/**
 * GET /api/community/user-ratings
 * Returns all SpotContributions for the calling user, keyed for quick lookup.
 * Response: { ratings: UserSpotRating[] }
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ ratings: [] });

  const contributions = await db.spotContribution.findMany({
    where: { familyProfileId: profileId },
    include: {
      spot: {
        select: { id: true, name: true, city: true },
      },
    },
  });

  const ratings: UserSpotRating[] = contributions.map((c) => ({
    spotId: c.spot.id,
    spotName: c.spot.name,
    spotCity: c.spot.city,
    rating: c.rating,
    note: c.note,
  }));

  return NextResponse.json({ ratings });
}
