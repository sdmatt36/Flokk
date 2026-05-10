import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

// DELETE /api/trips/[id]/lodging/[itemId]
// Cancels a lodging booking: deletes both check-in + check-out ItineraryItems,
// the linked TripDocument (Vault entry), and decrements budgetSpent.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await db.itineraryItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, totalCost: true, type: true },
  });

  if (!item || item.type !== "LODGING") {
    return NextResponse.json({ error: "Not a lodging item" }, { status: 400 });
  }

  const propertyName = item.title.replace(/^check-(?:in|out):\s*/i, "").trim();

  // Find companion (check-out if we got the check-in, or vice versa)
  const companion = await db.itineraryItem.findFirst({
    where: {
      tripId,
      id: { not: itemId },
      type: "LODGING",
      title: { contains: propertyName, mode: "insensitive" },
    },
    select: { id: true, title: true, totalCost: true },
  });

  // Cost lives on check-in only (check-out is excluded from budgetSpent by convention)
  const isCheckOut = /^check-out:/i.test(item.title);
  const checkInCost = isCheckOut ? (companion?.totalCost ?? 0) : (item.totalCost ?? 0);

  // Vault TripDocument for this booking
  const tripDoc = await db.tripDocument.findFirst({
    where: {
      tripId,
      type: "booking",
      label: { equals: propertyName, mode: "insensitive" },
    },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.itineraryItem.delete({ where: { id: itemId } });
    if (companion) await tx.itineraryItem.delete({ where: { id: companion.id } });
    if (tripDoc) await tx.tripDocument.delete({ where: { id: tripDoc.id } });
    if (checkInCost > 0) {
      await tx.trip.update({
        where: { id: tripId },
        data: { budgetSpent: { decrement: checkInCost } },
      });
    }
  });

  return NextResponse.json({
    success: true,
    deletedItems: [itemId, companion?.id].filter(Boolean),
  });
}
