import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getFamily(userId: string) {
  const user = await db.user.findUnique({ where: { clerkId: userId }, include: { familyProfile: true } });
  return user?.familyProfile ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const family = await getFamily(userId);
  if (!family) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== family.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = await db.placeRating.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ratings });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const family = await getFamily(userId);
  if (!family) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== family.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    itineraryItemId?: string;
    placeName: string;
    placeType: string;
    rating: number;
    notes?: string;
    wouldReturn?: boolean;
    kidsRating?: number;
  };

  const rating = await db.placeRating.create({
    data: {
      familyProfileId: family.id,
      tripId,
      itineraryItemId: body.itineraryItemId ?? null,
      placeName: body.placeName,
      placeType: body.placeType,
      destinationCity: trip.destinationCity ?? null,
      rating: body.rating,
      notes: body.notes ?? null,
      wouldReturn: body.wouldReturn ?? null,
      kidsRating: body.kidsRating ?? null,
    },
  });

  return NextResponse.json({ success: true, rating });
}
