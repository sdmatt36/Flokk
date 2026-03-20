import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; tipId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, tipId } = await params;
  const user = await db.user.findUnique({ where: { clerkId: userId }, include: { familyProfile: true } });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.tripTip.delete({ where: { id: tipId } });
  return NextResponse.json({ success: true });
}
