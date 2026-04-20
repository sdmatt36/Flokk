import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// GET /api/itinerary/unassigned — returns ItineraryItems with tripId = null for this profile
export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const items = await db.itineraryItem.findMany({
    where: { familyProfileId: profileId, tripId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, title: true, scheduledDate: true,
      address: true, confirmationCode: true, totalCost: true, currency: true,
      fromCity: true, toCity: true, createdAt: true,
    },
  });

  return NextResponse.json(items);
}

// PATCH /api/itinerary/unassigned — assign an item to a trip
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const { itemId, tripId } = await req.json() as { itemId: string; tripId: string };
  if (!itemId || !tripId) return NextResponse.json({ error: "itemId and tripId required" }, { status: 400 });

  // Verify the trip belongs to this profile
  const trip = await db.trip.findFirst({ where: { id: tripId, familyProfileId: profileId } });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  // Verify the item belongs to this profile and is unassigned
  const item = await db.itineraryItem.findFirst({ where: { id: itemId, familyProfileId: profileId, tripId: null } });
  if (!item) return NextResponse.json({ error: "Item not found or already assigned" }, { status: 404 });

  const updated = await db.itineraryItem.update({
    where: { id: itemId },
    data: { tripId },
  });

  return NextResponse.json({ item: updated });
}

// DELETE /api/itinerary/unassigned — delete an unassigned itinerary item
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const { itemId } = await req.json() as { itemId: string };
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  // Verify ownership before deletion
  const item = await db.itineraryItem.findFirst({
    where: { id: itemId, familyProfileId: profileId, tripId: null },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await db.itineraryItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
