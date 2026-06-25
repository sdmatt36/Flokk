import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Partial update of a TripKeyInfo. Mirrors the documents PATCH auth + response
// shape: Clerk-gated, operate by record id, return the updated row. Only provided
// fields are touched; label/value cannot be blanked.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; keyInfoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { keyInfoId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });
  const record = await db.tripKeyInfo.findUnique({
    where: { id: keyInfoId },
    select: { tripId: true },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditTripContent(profileId, record.tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { label?: string; value?: string };

  if (body.label !== undefined && !body.label.trim()) {
    return NextResponse.json({ error: "Label required" }, { status: 400 });
  }
  if (body.value !== undefined && !body.value.trim()) {
    return NextResponse.json({ error: "Value required" }, { status: 400 });
  }

  const updated = await db.tripKeyInfo.update({
    where: { id: keyInfoId },
    data: {
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.value !== undefined ? { value: body.value.trim() } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; keyInfoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { keyInfoId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });
  const record = await db.tripKeyInfo.findUnique({
    where: { id: keyInfoId },
    select: { tripId: true },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditTripContent(profileId, record.tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.tripKeyInfo.delete({ where: { id: keyInfoId } });
  return NextResponse.json({ success: true });
}
