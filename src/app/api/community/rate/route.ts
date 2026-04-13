import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ ratings: [] });

  const ratings = await db.placeRating.findMany({
    where: { familyProfileId: profileId },
    select: { id: true, placeName: true, rating: true, destinationCity: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ratings });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json() as {
    placeName: string;
    destinationCity?: string;
    rating: number;
    notes?: string;
    savedItemId?: string;
  };

  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }
  if (!body.placeName?.trim()) {
    return NextResponse.json({ error: "placeName is required" }, { status: 400 });
  }

  // Server-side guard: only allow rating places the user has saved
  const matchingSave = await db.savedItem.findFirst({
    where: {
      familyProfileId: profileId,
      rawTitle: { contains: body.placeName.trim(), mode: "insensitive" },
      ...(body.destinationCity?.trim()
        ? { destinationCity: { contains: body.destinationCity.trim(), mode: "insensitive" } }
        : {}),
    },
    select: { id: true },
  });
  if (!matchingSave) {
    return NextResponse.json(
      { error: "You can only rate places you have saved" },
      { status: 403 }
    );
  }

  const newRating = await db.placeRating.create({
    data: {
      familyProfileId: profileId,
      tripId: null,
      placeName: body.placeName.trim(),
      placeType: "activity",
      destinationCity: body.destinationCity?.trim() ?? "",
      rating: body.rating,
      notes: body.notes ?? null,
      savedItemId: body.savedItemId ?? null,
    },
  });

  return NextResponse.json({ success: true, rating: newRating });
}
