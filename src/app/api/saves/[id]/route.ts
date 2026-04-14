import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    include: { trip: { select: { id: true, title: true } } },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item, interestKeys: item.interestKeys ?? [] });
}

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
  if (typeof body.notes === "string") updateData.notes = body.notes;
  if (typeof body.userRating === "number") updateData.userRating = body.userRating;
  if (Array.isArray(body.categoryTags)) updateData.categoryTags = body.categoryTags;
  if (typeof body.tripId === "string") {
    updateData.tripId = body.tripId;
    updateData.status = "TRIP_ASSIGNED";
  } else if (body.tripId === null) {
    updateData.tripId = null;
    updateData.status = "SAVED";
  }
  if (typeof body.websiteUrl === "string" || body.websiteUrl === null) updateData.websiteUrl = body.websiteUrl ?? null;
  if (typeof body.dayIndex === "number" || body.dayIndex === null) updateData.dayIndex = body.dayIndex;
  if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
  if (typeof body.startTime === "string" || body.startTime === null) updateData.startTime = body.startTime ?? null;
  if (typeof body.extractedCheckin === "string" || body.extractedCheckin === null) updateData.extractedCheckin = body.extractedCheckin ?? null;
  if (typeof body.extractedCheckout === "string" || body.extractedCheckout === null) updateData.extractedCheckout = body.extractedCheckout ?? null;
  if (typeof body.isBooked === "boolean") {
    updateData.isBooked = body.isBooked;
    if (body.isBooked) updateData.bookedAt = new Date();
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    console.log("[PATCH /api/saves] updateData:", JSON.stringify(updateData));
    const updated = await db.savedItem.update({ where: { id }, data: updateData });
    return NextResponse.json({ savedItem: updated });
  } catch (e) {
    const err = e as Error;
    console.error("[PATCH /api/saves] Prisma error:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!item || item.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.savedItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
