import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { sendTripMadePublicEvent } from "@/lib/loops";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Verify trip ownership
  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { tripType, budgetRange, title, privacy, isAnonymous, isPublic, startDate, endDate, postTripModalVisitCount } = body as { tripType?: string; budgetRange?: string; title?: string; privacy?: string; isAnonymous?: boolean; isPublic?: boolean; startDate?: string; endDate?: string; postTripModalVisitCount?: number };

  const data: Record<string, string | boolean | Date | null | number> = {};
  if (tripType !== undefined) data.tripType = tripType;
  if (budgetRange !== undefined) data.budgetRange = budgetRange;
  if (title !== undefined) data.title = title.trim() || trip.title;
  if (privacy !== undefined) data.privacy = privacy;
  if (isAnonymous !== undefined) data.isAnonymous = isAnonymous;
  if (isPublic !== undefined) data.isPublic = isPublic;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (postTripModalVisitCount !== undefined) data.postTripModalVisitCount = postTripModalVisitCount;

  const updated = await db.trip.update({ where: { id }, data });

  // Loops: fire trip_made_public when isPublic flips from false → true
  if (isPublic === true && !trip.isPublic) {
    try {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
      await sendTripMadePublicEvent(email, {
        tripDestination: updated.destinationCity ?? updated.title ?? "your destination",
      });
    } catch (e) { console.error("[loops] trip_made_public event error", e); }
  }

  return NextResponse.json({ trip: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.trip.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
