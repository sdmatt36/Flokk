import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { findPlaceByNameCity } from "@/lib/google-places";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const spot = await db.communitySpot.findUnique({
    where: { id },
    select: { id: true, name: true, city: true, photoUrl: true, websiteUrl: true },
  });
  if (!spot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await findPlaceByNameCity(spot.name, spot.city);
  if (!result) {
    return NextResponse.json({ error: "No Google Places result found" }, { status: 422 });
  }

  const data: Record<string, string | null> = {};
  if (result.photoUrl && result.photoUrl !== spot.photoUrl) {
    data.photoUrl = result.photoUrl;
  }
  if (result.websiteUrl && !spot.websiteUrl) {
    data.websiteUrl = result.websiteUrl;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ spot, message: "No new data to apply" });
  }

  const updateData: Record<string, string | boolean | null> = { ...data };
  // Clear needsUrlReview if we just resolved a website URL for a spot that had none
  if (data.websiteUrl) {
    updateData.needsUrlReview = false;
  }

  const updated = await db.communitySpot.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ spot: updated });
}
