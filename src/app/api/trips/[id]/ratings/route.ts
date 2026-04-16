import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { sendRatingsCompleteEvent } from "@/lib/loops";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = await db.placeRating.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ratings });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    itineraryItemId?: string;
    manualActivityId?: string;
    placeName: string;
    placeType: string;
    rating: number;
    notes?: string;
    wouldReturn?: boolean;
    kidsRating?: number;
  };

  const rating = await db.placeRating.create({
    data: {
      familyProfileId: profileId,
      tripId,
      itineraryItemId: body.itineraryItemId ?? null,
      manualActivityId: body.manualActivityId ?? null,
      placeName: body.placeName,
      placeType: body.placeType,
      destinationCity: trip.destinationCity ?? null,
      rating: body.rating,
      notes: body.notes ?? null,
      wouldReturn: body.wouldReturn ?? null,
      kidsRating: body.kidsRating ?? null,
    },
  });

  try {
    const totalActivities = await db.manualActivity.count({ where: { tripId } });
    const ratedActivities = await db.placeRating.count({ where: { tripId, manualActivityId: { not: null } } });
    if (totalActivities > 0 && ratedActivities >= totalActivities) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
      await sendRatingsCompleteEvent(email, {
        tripDestination: trip.destinationCity ?? trip.title ?? "your destination",
      });
    }
  } catch (e) { console.error("[loops] ratings_complete check error", e); }

  return NextResponse.json({ success: true, rating });
}
