import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || !(await canEditTripContent(profileId, tripId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { postTripCaptureStarted?: boolean; postTripCaptureComplete?: boolean };

  // Per-activity rating uses a separate route and has no temporal guard — see Discipline 4.11.
  if (body.postTripCaptureComplete === true) {
    if (trip.endDate != null && new Date(trip.endDate) > new Date()) {
      return NextResponse.json(
        { error: "Trip has not ended", endDate: trip.endDate, message: "The post-trip survey can only be completed after the trip ends." },
        { status: 400 }
      );
    }
    if (trip.endDate == null) {
      console.warn(`[post-trip-status] post-trip survey accepted on trip with null endDate, tripId=${tripId}`);
    }
  }

  const data: Record<string, boolean> = {};
  if (body.postTripCaptureStarted !== undefined) data.postTripCaptureStarted = body.postTripCaptureStarted;
  if (body.postTripCaptureComplete !== undefined) data.postTripCaptureComplete = body.postTripCaptureComplete;

  const showSharePrompt = body.postTripCaptureComplete === true && !trip.isPublic;
  const updated = await db.trip.update({ where: { id: tripId }, data });
  return NextResponse.json({ trip: updated, showSharePrompt });
}
