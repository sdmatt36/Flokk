import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/trips/[id]/itinerary/[itemId]
// Updates dayIndex (and optionally other fields) on an ItineraryItem.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { dayIndex, sortOrder } = body;

  const updated = await db.itineraryItem.update({
    where: { id: itemId },
    data: {
      ...(dayIndex !== undefined ? { dayIndex: dayIndex as number } : {}),
      ...(sortOrder !== undefined ? { sortOrder: sortOrder as number } : {}),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch item to check cost before deleting (for budget decrement)
  const item = await db.itineraryItem.findUnique({
    where: { id: itemId },
    select: { totalCost: true, type: true, title: true },
  });

  await db.itineraryItem.delete({ where: { id: itemId } });

  // Decrement budgetSpent — skip LODGING check-out to avoid double-counting (cost stored on check-in too)
  const isLodgingCheckout = item?.type === "LODGING" && /^check-out:/i.test(item.title ?? "");
  if (item?.totalCost && item.totalCost > 0 && !isLodgingCheckout) {
    await db.trip.update({
      where: { id: tripId },
      data: { budgetSpent: { decrement: item.totalCost } },
    });
  }

  return NextResponse.json({ success: true });
}
