import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tourId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    include: { stops: { select: { savedItemId: true } } },
  });

  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // 1. Hard-delete ManualActivity rows created by this tour
  await db.manualActivity.deleteMany({
    where: { tourId },
  });

  // 2. Soft-delete SavedItems that were created by this tour save
  const savedItemIds = tour.stops
    .map(s => s.savedItemId)
    .filter((id): id is string => id !== null);

  if (savedItemIds.length > 0) {
    await db.savedItem.updateMany({
      where: { id: { in: savedItemIds } },
      data: { deletedAt: now },
    });
  }

  return NextResponse.json({ ok: true, removed: savedItemIds.length });
}
