import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set isPublic = true on all COMPLETED trips that have a shareToken but are not yet public
  const result = await db.trip.updateMany({
    where: {
      status: "COMPLETED",
      shareToken: { not: null },
      isPublic: false,
    },
    data: { isPublic: true },
  });

  console.log(`[backfill-public-trips] Updated ${result.count} trips to isPublic: true`);

  return NextResponse.json({ updated: result.count });
}
