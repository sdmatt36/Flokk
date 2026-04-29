import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripCoverImage } from "@/lib/destination-images";
import { canViewTrip } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

// GET /api/trips/[id]/tours
// Returns all GeneratedTours that have active (non-deleted) SavedItems on this trip.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find distinct tourIds on this trip with non-deleted SavedItems
  const linkedSaves = await db.savedItem.findMany({
    where: { tripId, tourId: { not: null }, deletedAt: null },
    select: { tourId: true, dayIndex: true },
  });

  const tourIdSet = [...new Set(linkedSaves.map(s => s.tourId as string))];
  if (tourIdSet.length === 0) return NextResponse.json({ tours: [] });

  // For each tourId, find the max dayIndex (which day the tour stops are on)
  const dayByTour: Record<string, number[]> = {};
  for (const s of linkedSaves) {
    if (!s.tourId) continue;
    if (!dayByTour[s.tourId]) dayByTour[s.tourId] = [];
    if (s.dayIndex != null) dayByTour[s.tourId].push(s.dayIndex);
  }

  const tours = await db.generatedTour.findMany({
    where: { id: { in: tourIdSet }, deletedAt: null },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      prompt: true,
      transport: true,
      durationLabel: true,
      createdAt: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { imageUrl: true, savedItem: { select: { placePhotoUrl: true } } },
      },
      _count: { select: { stops: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = tours.map(t => {
    const stopPhoto = t.stops[0]?.imageUrl ?? t.stops[0]?.savedItem?.placePhotoUrl ?? null;
    const coverImage = stopPhoto ?? getTripCoverImage(t.destinationCity, t.destinationCountry);
    const days = dayByTour[t.id] ?? [];
    const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
    return {
      id: t.id,
      title: t.title,
      destinationCity: t.destinationCity,
      destinationCountry: t.destinationCountry,
      prompt: t.prompt,
      transport: t.transport,
      durationLabel: t.durationLabel,
      createdAt: t.createdAt.toISOString(),
      stopCount: t._count.stops,
      coverImage,
      days: uniqueDays,
    };
  });

  return NextResponse.json({ tours: result });
}
