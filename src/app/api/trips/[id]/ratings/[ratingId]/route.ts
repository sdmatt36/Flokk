import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; ratingId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, ratingId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const existing = await db.placeRating.findUnique({ where: { id: ratingId } });
  if (!existing || existing.familyProfileId !== profileId || existing.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { rating: number; notes?: string; wouldReturn?: boolean };

  const updated = await db.placeRating.update({
    where: { id: ratingId },
    data: {
      rating: body.rating,
      notes: body.notes ?? null,
      wouldReturn: body.wouldReturn ?? null,
    },
  });

  return NextResponse.json({ success: true, rating: updated });
}
