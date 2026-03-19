import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { interestKeys: true } } },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    include: { trip: { select: { id: true, title: true } } },
  });
  if (!item || item.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interestKeys = (user.familyProfile as { interestKeys?: { key: string }[] }).interestKeys?.map((k: { key: string }) => k.key) ?? [];

  return NextResponse.json({ item, interestKeys });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({ where: { id } });
  if (!item || item.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (typeof body.notes === "string") updateData.notes = body.notes;
  if (typeof body.dayIndex === "number") updateData.dayIndex = body.dayIndex;
  if (typeof body.tripId === "string") {
    updateData.tripId = body.tripId;
    updateData.status = "TRIP_ASSIGNED";
  }
  if (Array.isArray(body.categoryTags)) updateData.categoryTags = body.categoryTags;
  if (typeof body.isBooked === "boolean") {
    updateData.isBooked = body.isBooked;
    if (body.isBooked) updateData.bookedAt = new Date();
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await db.savedItem.update({ where: { id }, data: updateData });
  return NextResponse.json({ savedItem: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!item || item.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.savedItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
