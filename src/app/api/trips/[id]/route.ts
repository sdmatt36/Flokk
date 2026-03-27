import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Verify trip ownership
  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { tripType, budgetRange, title, privacy, isAnonymous } = body as { tripType?: string; budgetRange?: string; title?: string; privacy?: string; isAnonymous?: boolean };

  const data: Record<string, string | boolean | null> = {};
  if (tripType !== undefined) data.tripType = tripType;
  if (budgetRange !== undefined) data.budgetRange = budgetRange;
  if (title !== undefined) data.title = title.trim() || trip.title;
  if (privacy !== undefined) data.privacy = privacy;
  if (isAnonymous !== undefined) data.isAnonymous = isAnonymous;

  const updated = await db.trip.update({ where: { id }, data });

  return NextResponse.json({ trip: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.trip.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
