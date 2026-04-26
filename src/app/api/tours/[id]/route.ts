import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    include: { stops: { orderBy: { orderIndex: "asc" } } },
  });

  if (!tour || tour.deletedAt || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formatStop = (s: typeof tour.stops[number]) => ({
    id: s.id,
    orderIndex: s.orderIndex,
    name: s.name,
    address: s.address ?? "",
    lat: s.lat ?? 0,
    lng: s.lng ?? 0,
    duration: s.durationMin ?? 0,
    travelTime: s.travelTimeMin ?? 0,
    why: s.why ?? "",
    familyNote: s.familyNote ?? "",
    imageUrl: s.imageUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
    ticketRequired: s.ticketRequired ?? null,
  });

  const activeStops = tour.stops.filter(s => !s.deletedAt);
  const deletedStops = tour.stops.filter(s => s.deletedAt).reverse();

  return NextResponse.json({
    tourId: tour.id,
    originalTargetStops: tour.originalTargetStops,
    title: tour.title,
    destinationCity: tour.destinationCity,
    destinationCountry: tour.destinationCountry,
    prompt: tour.prompt,
    durationLabel: tour.durationLabel,
    transport: tour.transport,
    generatedAt: tour.createdAt.toISOString(),
    stops: activeStops.map(formatStop),
    removedStops: deletedStops.map(formatStop),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: {
      familyProfileId: true,
      stops: { select: { savedItemId: true } },
    },
  });

  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // Collect SavedItem IDs linked to this tour's stops
  const savedItemIds = tour.stops
    .map(s => s.savedItemId)
    .filter((id): id is string => id !== null);

  await db.$transaction([
    // Soft-delete the tour
    db.generatedTour.update({
      where: { id },
      data: { deletedAt: now, deletedBy: userId },
    }),
    // Soft-delete linked SavedItems (tour-created saves)
    ...(savedItemIds.length > 0
      ? [db.savedItem.updateMany({ where: { id: { in: savedItemIds } }, data: { deletedAt: now } })]
      : []),
    // Hard-delete linked ManualActivities (auto-created, no need to preserve)
    db.manualActivity.deleteMany({ where: { tourId: id } }),
  ]);

  return NextResponse.json({ ok: true });
}
