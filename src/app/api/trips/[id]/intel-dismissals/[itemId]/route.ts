import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// DELETE /api/trips/[id]/intel-dismissals/[itemId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { familyProfileId: true } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.tripIntelDismissal.deleteMany({ where: { tripId, itemId } });

  return NextResponse.json({ restored: true });
}
