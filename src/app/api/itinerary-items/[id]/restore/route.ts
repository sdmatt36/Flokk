import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { logExtraction } from "@/lib/extraction-log";

export const dynamic = "force-dynamic";

// PATCH /api/itinerary-items/[id]/restore
// Restores a soft-deleted (cancelled) itinerary item back to active status.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  // Verify item exists and belongs to this profile
  const item = await db.itineraryItem.findFirst({
    where: { id: itemId, familyProfileId: profileId },
    select: { id: true, cancelledAt: true, tripId: true, familyProfileId: true },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!item.cancelledAt) return NextResponse.json({ error: "Item is not cancelled" }, { status: 400 });

  const restored = await db.itineraryItem.update({
    where: { id: itemId },
    data: {
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      status: "BOOKED",
    },
  });

  // Log the restoration
  await logExtraction({
    senderEmail: `system+restore@flokktravel.com`,
    subject: `Manual restore of item ${itemId}`,
    resolutionPath: "profile_member",
    familyProfileId: profileId,
    matchedTripId: item.tripId ?? undefined,
    outcome: "cancellation_restored",
  });

  return NextResponse.json({ ok: true, item: { id: restored.id, status: restored.status } });
}
