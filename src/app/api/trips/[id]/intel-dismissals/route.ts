import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

// POST /api/trips/[id]/intel-dismissals
// Body: { itemId: string }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { itemId?: string };
  const { itemId } = body;
  if (!itemId || typeof itemId !== "string") {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  await db.tripIntelDismissal.upsert({
    where: { tripId_itemId: { tripId, itemId } },
    create: { id: `${tripId}_${itemId}`, tripId, itemId },
    update: {},
  });

  return NextResponse.json({ dismissed: true });
}
