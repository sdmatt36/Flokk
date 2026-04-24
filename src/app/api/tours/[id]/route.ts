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

  return NextResponse.json({
    id: tour.id,
    title: tour.title,
    destinationCity: tour.destinationCity,
    destinationCountry: tour.destinationCountry,
    prompt: tour.prompt,
    durationLabel: tour.durationLabel,
    transport: tour.transport,
    generatedAt: tour.createdAt.toISOString(),
    stops: tour.stops.map(s => ({
      name: s.name,
      address: s.address ?? "",
      lat: s.lat ?? 0,
      lng: s.lng ?? 0,
      duration: s.durationMin ?? 0,
      travelTime: s.travelTimeMin ?? 0,
      why: s.why ?? "",
      familyNote: s.familyNote ?? "",
      imageUrl: s.imageUrl ?? null,
    })),
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
    select: { familyProfileId: true },
  });

  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.generatedTour.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: userId },
  });

  return NextResponse.json({ ok: true });
}
