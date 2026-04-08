import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ tripsTaken: 0, placesSaved: 0, countriesVisited: 0, avgTripLength: null });
  }

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: {
      trips: { where: { status: "COMPLETED" } },
      savedItems: { select: { id: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ tripsTaken: 0, placesSaved: 0, countriesVisited: 0, avgTripLength: null });
  }

  const completed = profile.trips;
  const tripsTaken = completed.length;
  const placesSaved = profile.savedItems.length;

  const countries = new Set(
    completed.filter((t) => t.destinationCountry).map((t) => t.destinationCountry!)
  );
  const countriesVisited = countries.size;

  const withDates = completed.filter((t) => t.startDate && t.endDate);
  const avgTripLength =
    withDates.length > 0
      ? withDates.reduce((sum, t) => {
          const days =
            (new Date(t.endDate!).getTime() - new Date(t.startDate!).getTime()) /
            (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / withDates.length
      : null;

  return NextResponse.json({
    tripsTaken,
    placesSaved,
    countriesVisited,
    avgTripLength: avgTripLength !== null ? Math.round(avgTripLength * 10) / 10 : null,
    tier: profile.tier,
    points: profile.points,
    trips: completed.map((t) => ({
      destinationCity: t.destinationCity,
      destinationCountry: t.destinationCountry,
      status: t.status,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
    })),
  });
}
