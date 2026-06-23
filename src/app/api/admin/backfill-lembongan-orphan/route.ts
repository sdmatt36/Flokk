import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { mintTripShareToken } from "@/lib/trip-share-token";

export const dynamic = "force-dynamic";

const FAMILY_PROFILE_ID = "cmomjfwfi";
const ORPHAN_ITEM_IDS: { id: string; dayIndex: number }[] = [
  { id: "cmq3p1re4000704ld88ufhqv5", dayIndex: 0 },
  { id: "cmq3p1rqv000804ld1c84k9hi", dayIndex: 3 },
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotency: skip if items already have a tripId
  const items = await db.itineraryItem.findMany({
    where: { id: { in: ORPHAN_ITEM_IDS.map((r) => r.id) } },
    select: { id: true, tripId: true, title: true },
  });

  const alreadyAttached = items.filter((i) => i.tripId !== null);
  if (alreadyAttached.length > 0) {
    return NextResponse.json({
      skipped: true,
      reason: "items already have tripId",
      items: alreadyAttached,
    });
  }

  const tripData = await buildTripFromExtraction({
    cities: ["Nusa Lembongan"],
    country: "Indonesia",
    startDate: "2026-06-13",
    endDate: "2026-06-16",
  });

  const tripShareToken = await mintTripShareToken();
  const result = await db.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        ...tripData,
        title: "Lembongan Jun '26",
        familyProfileId: FAMILY_PROFILE_ID,
        shareToken: tripShareToken,
      },
    });

    await tx.tripCollaborator.create({
      data: {
        tripId: trip.id,
        familyProfileId: FAMILY_PROFILE_ID,
        role: "OWNER",
        invitedById: FAMILY_PROFILE_ID,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });

    const updates = await Promise.all(
      ORPHAN_ITEM_IDS.map(({ id, dayIndex }) =>
        tx.itineraryItem.update({
          where: { id },
          data: { tripId: trip.id, dayIndex },
        })
      )
    );

    return { trip, updates };
  });

  console.log(`[backfill-lembongan-orphan] created trip "${result.trip.title}" id: ${result.trip.id}, attached ${result.updates.length} items`);

  return NextResponse.json({
    tripId: result.trip.id,
    tripTitle: result.trip.title,
    itemsAttached: result.updates.map((u) => ({ id: u.id, dayIndex: u.dayIndex, title: u.title })),
  });
}
