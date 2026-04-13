import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json() as { rating: number; notes?: string };

  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const savedItem = await db.savedItem.findFirst({
    where: { id, familyProfileId: profileId },
  });
  if (!savedItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newRating = await db.placeRating.create({
    data: {
      familyProfileId: profileId,
      tripId: null,
      placeName: savedItem.rawTitle ?? "Unknown",
      placeType: savedItem.categoryTags[0] ?? "activity",
      destinationCity: savedItem.destinationCity ?? "",
      rating: body.rating,
      notes: body.notes ?? null,
    },
  });

  await db.savedItem.update({
    where: { id },
    data: { userRating: body.rating },
  });

  return NextResponse.json({ success: true, rating: newRating });
}
