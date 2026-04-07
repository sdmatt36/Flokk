import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { familyProfile: { select: { id: true } } },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const body = await request.json() as {
    title?: string;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    placePhotoUrl?: string | null;
    websiteUrl?: string | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // Dedup by title within this family's saves
  const existing = await db.savedItem.findFirst({
    where: {
      familyProfileId: user.familyProfile.id,
      rawTitle: { equals: body.title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ saved: false, duplicate: true });
  }

  await db.savedItem.create({
    data: {
      familyProfileId: user.familyProfile.id,
      tripId: null,
      rawTitle: body.title.trim(),
      destinationCity: body.city ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      placePhotoUrl: body.placePhotoUrl ?? null,
      websiteUrl: body.websiteUrl ?? null,
      sourceType: "IN_APP",
      status: "UNORGANIZED",
      extractionStatus: "ENRICHED",
      categoryTags: [],
    },
  });

  return NextResponse.json({ saved: true }, { status: 201 });
}
