import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; flightId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, flightId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const updated = await db.flight.update({
    where: { id: flightId },
    data: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; flightId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, flightId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.flight.delete({ where: { id: flightId } });

  return NextResponse.json({ success: true });
}
