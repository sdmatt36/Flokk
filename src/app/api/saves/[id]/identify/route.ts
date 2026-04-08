import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({ where: { id } });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (typeof body.rawTitle === "string") updateData.rawTitle = body.rawTitle;
  if (typeof body.lat === "number") updateData.lat = body.lat;
  if (typeof body.lng === "number") updateData.lng = body.lng;
  if (typeof body.needsPlaceConfirmation === "boolean") updateData.needsPlaceConfirmation = body.needsPlaceConfirmation;
  // Build photo URL server-side so the API key is never exposed to the client
  if (typeof body.photoReference === "string" && body.photoReference) {
    updateData.placePhotoUrl =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${body.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  } else if (body.photoReference === null) {
    updateData.placePhotoUrl = null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.savedItem.update({ where: { id }, data: updateData });
  return NextResponse.json({ savedItem: updated });
}
