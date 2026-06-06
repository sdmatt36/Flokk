import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { generatePublicWhyForStops, generateNeutralSubtitle } from "@/lib/generate-public-why";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tourId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch only public-safe fields. Private fields (why, familyNote, subtitle)
  // are never read here — they must not become input to any public field.
  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      id: true,
      familyProfileId: true,
      title: true,
      durationLabel: true,
      transport: true,
      destinationCity: true,
      isPublic: true,
      deletedAt: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, address: true, placeTypes: true, durationMin: true },
      },
    },
  });

  if (!tour || tour.deletedAt || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Generate neutral public-safe copy from place attributes only.
  // generatePublicWhyForStops writes publicWhy to each stop directly.
  const [, publicSubtitle] = await Promise.all([
    generatePublicWhyForStops(tour.stops, tour.destinationCity),
    generateNeutralSubtitle(
      tour.title,
      tour.durationLabel,
      tour.transport,
      tour.destinationCity,
      tour.stops.length,
    ),
  ]);

  // Null out publicFamilyNote — private field, no neutral replacement.
  // The share page renders nothing when it is null.
  await db.tourStop.updateMany({
    where: { tourId: tour.id, deletedAt: null },
    data: { publicFamilyNote: null },
  });

  await db.generatedTour.update({
    where: { id: tourId },
    data: {
      isPublic: true,
      publicTitle: tour.title,
      publicSubtitle,
    },
  });

  console.log(`[tour-publish] tourId=${tourId} published stops=${tour.stops.length}`);

  // Re-fetch stops to include freshly written publicWhy values in the response.
  const updatedStops = await db.tourStop.findMany({
    where: { tourId: tour.id, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true, publicWhy: true, publicFamilyNote: true },
  });

  return NextResponse.json({
    tourId,
    isPublic: true,
    publicTitle: tour.title,
    publicSubtitle,
    stops: updatedStops,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tourId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: { familyProfileId: true, deletedAt: true },
  });

  if (!tour || tour.deletedAt || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.generatedTour.update({
    where: { id: tourId },
    data: { isPublic: false },
  });

  console.log(`[tour-publish] tourId=${tourId} unpublished`);

  return NextResponse.json({ tourId, isPublic: false });
}
