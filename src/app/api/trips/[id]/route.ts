import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { sendTripMadePublicEvent } from "@/lib/loops";
import { canEditTripContent, canManageCollaborators } from "@/lib/trip-permissions";

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

  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || !(await canEditTripContent(profileId, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { tripType, budgetRange, title, privacy, isAnonymous, isPublic, startDate, endDate, postTripModalVisitCount, cities, countries } = body as { tripType?: string; budgetRange?: string; title?: string; privacy?: string; isAnonymous?: boolean; isPublic?: boolean; startDate?: string; endDate?: string; postTripModalVisitCount?: number; cities?: string[]; countries?: string[] };

  const data: Record<string, string | boolean | Date | null | number | string[]> = {};
  if (tripType !== undefined) data.tripType = tripType;
  if (budgetRange !== undefined) data.budgetRange = budgetRange;
  if (title !== undefined) data.title = title.trim() || trip.title;
  if (privacy !== undefined) data.privacy = privacy;
  if (isAnonymous !== undefined) data.isAnonymous = isAnonymous;
  if (isPublic !== undefined) data.isPublic = isPublic;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (postTripModalVisitCount !== undefined) data.postTripModalVisitCount = postTripModalVisitCount;
  if (Array.isArray(cities)) data.cities = cities;
  if (Array.isArray(countries)) data.countries = countries;

  const updated = await db.trip.update({ where: { id }, data });

  // When startDate changes, recompute dayIndex for all ItineraryItems that have a scheduledDate.
  // scheduledDate (the actual booking calendar date) is ground truth; dayIndex is always derived
  // from it, not the other way around. Using a single UPDATE avoids N+1 and is atomic.
  if (startDate !== undefined && startDate) {
    try {
      const recalcCount = await db.$executeRaw`
        UPDATE "ItineraryItem" ii
        SET "dayIndex" = (ii."scheduledDate"::date - DATE_TRUNC('day', t."startDate" + interval '12 hours')::date)
        FROM "Trip" t
        WHERE ii."tripId" = t.id
          AND ii."tripId" = ${id}
          AND ii."scheduledDate" IS NOT NULL
      `;
      console.log(`[trip-patch] recalculated dayIndex for ${recalcCount} ItineraryItems on trip ${id}`);
    } catch (e) {
      console.error("[trip-patch] dayIndex recalculation error:", e);
    }
  }

  // Recompute trip status after date change
  if (startDate !== undefined || endDate !== undefined) {
    const finalEndDate = updated.endDate;
    if (finalEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newStatus = finalEndDate < today ? "COMPLETED" : "PLANNING";
      await db.trip.update({ where: { id }, data: { status: newStatus } });
    }
  }

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

  if (!(await canManageCollaborators(profileId, id, 'DELETE_TRIP'))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    // Null out non-cascading nullable FKs before deleting the trip
    await tx.savedItem.updateMany({ where: { tripId: id }, data: { tripId: null } });
    await tx.recommendationScore.updateMany({ where: { tripId: id }, data: { tripId: null } });
    await tx.question.updateMany({ where: { tripId: id }, data: { tripId: null } });
    await tx.placeRating.updateMany({ where: { tripId: id }, data: { tripId: null } });
    // DB cascade handles: ItineraryItem (SetNull), and all Cascade-configured models
    await tx.trip.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
