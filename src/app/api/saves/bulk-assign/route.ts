import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// Bulk-assign N unassigned saves to one trip. Mirrors the canonical single assigner
// (PATCH /api/saves/[id] with { tripId }): each save gets tripId + status TRIP_ASSIGNED,
// and dayIndex defaults to null (lands in the trip's Saves bucket, unscheduled — never as
// a day item). The updateMany is scoped to the caller's family profile so a caller can
// never touch saves they don't own.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.tripId !== "string" || !Array.isArray(body.savedItemIds) || body.savedItemIds.length === 0) {
    return NextResponse.json({ error: "savedItemIds (non-empty array) and tripId are required" }, { status: 400 });
  }

  const ids: string[] = body.savedItemIds.filter((id: unknown) => typeof id === "string");
  if (ids.length === 0) {
    return NextResponse.json({ error: "savedItemIds must contain strings" }, { status: 400 });
  }
  const tripId: string = body.tripId;
  const dayIndex: number | null = typeof body.dayIndex === "number" ? body.dayIndex : null;

  // The trip must belong to the caller's profile and not be completed (mirrors auto-attach
  // + the mobile picker: assign only to PLANNING/ACTIVE trips).
  const trip = await db.trip.findFirst({
    where: { id: tripId, familyProfileId: profileId, isPlacesLibrary: false },
    select: { id: true, status: true },
  });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.status === "COMPLETED") {
    return NextResponse.json({ error: "Can't assign saves to a completed trip." }, { status: 400 });
  }

  // Resolve which of the requested ids the caller actually owns (and that are live), so the
  // response can report the ids that truly changed (updateMany only returns a count).
  const owned = await db.savedItem.findMany({
    where: { id: { in: ids }, familyProfileId: profileId, deletedAt: null },
    select: { id: true },
  });
  const ownedIds = owned.map((o) => o.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ count: 0, ids: [] });
  }

  const result = await db.savedItem.updateMany({
    // Profile-scoped: never assigns saves the caller doesn't own.
    where: { id: { in: ownedIds }, familyProfileId: profileId, deletedAt: null },
    data: { tripId, status: "TRIP_ASSIGNED", dayIndex },
  });

  return NextResponse.json({ count: result.count, ids: ownedIds });
}
