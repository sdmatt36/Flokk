import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all trips where user completed How Was It but status never got set to COMPLETED
  const trips = await db.trip.findMany({
    where: {
      postTripCaptureComplete: true,
      OR: [
        { status: { not: "COMPLETED" } },
        { shareToken: null },
      ],
    },
    select: { id: true, shareToken: true },
  });

  let updated = 0;
  for (const trip of trips) {
    await db.trip.update({
      where: { id: trip.id },
      data: {
        status: "COMPLETED",
        ...(trip.shareToken ? {} : { shareToken: nanoid(12) }),
      },
    });
    updated++;
  }

  console.log(`[backfill-public-trips] Updated ${updated} trips to COMPLETED`);

  return NextResponse.json({ updated });
}
