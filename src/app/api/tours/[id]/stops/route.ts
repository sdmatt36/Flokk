import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// POST /api/tours/[id]/stops — add a user-defined custom stop
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: {
      familyProfileId: true,
      stops: {
        where: { deletedAt: null },
        select: { orderIndex: true },
        orderBy: { orderIndex: "desc" },
        take: 1,
      },
    },
  });
  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    name?: string;
    address?: string;
    durationMin?: number;
    why?: string;
    lat?: number;
    lng?: number;
    imageUrl?: string;
    websiteUrl?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const maxOrder = tour.stops[0]?.orderIndex ?? -1;

  const stop = await db.tourStop.create({
    data: {
      id: crypto.randomUUID(),
      tourId: id,
      orderIndex: maxOrder + 1,
      name: body.name.trim(),
      address: body.address?.trim() || null,
      durationMin: body.durationMin ?? 30,
      travelTimeMin: 0,
      why: body.why?.trim() || "Added manually",
      familyNote: null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      imageUrl: body.imageUrl ?? null,
      websiteUrl: body.websiteUrl ?? null,
    },
  });

  return NextResponse.json({
    id: stop.id,
    orderIndex: stop.orderIndex,
    name: stop.name,
    address: stop.address ?? "",
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    duration: stop.durationMin ?? 30,
    travelTime: 0,
    why: stop.why ?? "",
    familyNote: "",
    imageUrl: stop.imageUrl ?? null,
    websiteUrl: stop.websiteUrl ?? null,
  });
}

// PATCH /api/tours/[id]/stops/reorder — persist a new stop order
// Body: { order: Array<{ id: string; orderIndex: number }> }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { order?: Array<{ id: string; orderIndex: number }> };
  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json({ error: "order array is required" }, { status: 400 });
  }

  await db.$transaction(
    body.order.map(({ id: stopId, orderIndex }) =>
      db.tourStop.updateMany({
        where: { id: stopId, tourId: id },
        data: { orderIndex },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
