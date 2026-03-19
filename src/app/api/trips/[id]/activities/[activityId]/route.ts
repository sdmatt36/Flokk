import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, activityId } = await params;
  const body = await request.json();

  // Recalculate dayIndex if date is being updated
  if (body.date) {
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
    if (trip?.startDate) {
      const rawStart = new Date(trip.startDate);
      const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
      const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
      const [dy, dm, dd] = body.date.split("-").map(Number);
      const dep = new Date(dy, dm - 1, dd);
      body.dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const updated = await db.manualActivity.update({
    where: { id: activityId },
    data: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId } = await params;

  await db.manualActivity.delete({ where: { id: activityId } });

  return NextResponse.json({ success: true });
}
