import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const category = type && type !== "all" ? type : undefined;

  const spots = await db.communitySpot.findMany({
    where: {
      averageRating: { gte: 3 },
      category: { notIn: ["train", "flight", "airline", "transport", "transit"] },
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(category ? { category } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [
      { averageRating: "desc" },
      { contributionCount: "desc" },
    ],
    take: 50,
    include: {
      contributions: {
        take: 1,
        where: { note: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { note: true },
      },
    },
  });

  // Resolve admin + contributor membership for canEdit/canDelete
  const admin = await isAdmin(userId);
  const profileId = admin ? null : await resolveProfileId(userId);

  // Batch-fetch contributions for this viewer across all returned spots
  const spotIds = spots.map(s => s.id);
  const viewerContribs = profileId
    ? await db.spotContribution.findMany({
        where: {
          communitySpotId: { in: spotIds },
          familyProfileId: profileId,
        },
        select: { communitySpotId: true },
      })
    : [];
  const contribSet = new Set(viewerContribs.map(c => c.communitySpotId));

  const places = spots.map(spot => {
    const isContributor = contribSet.has(spot.id);
    const canEdit = admin || isContributor;
    // canDelete: admin always; contributor only if they're the sole contributor
    const canDelete = admin || (isContributor && spot.contributionCount === 1);
    return {
      id: spot.id,
      name: spot.name,
      city: spot.city,
      placeType: spot.category ?? "other",
      category: spot.category ?? null,
      description: spot.description ?? null,
      image: spot.photoUrl ?? null,
      photoUrl: spot.photoUrl ?? null,
      address: null,
      website: spot.websiteUrl ?? null,
      websiteUrl: spot.websiteUrl ?? null,
      lat: spot.lat,
      lng: spot.lng,
      ratingCount: spot.ratingCount,
      avgRating: spot.averageRating ?? 0,
      sampleNote: spot.contributions[0]?.note ?? null,
      canEdit,
      canDelete,
    };
  });

  // Aggregate distinct cities from this filtered result set
  const cityMap = new Map<string, number>();
  for (const spot of spots) {
    if (spot.city) cityMap.set(spot.city, (cityMap.get(spot.city) ?? 0) + 1);
  }
  const cities = Array.from(cityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cityName, placeCount]) => ({ city: cityName, placeCount }));

  return NextResponse.json({ places, cities, total: places.length });
}
