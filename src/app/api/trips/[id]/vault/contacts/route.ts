import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripAccess } from "@/lib/trip-permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const access = await getTripAccess(profileId, tripId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contacts = await db.tripContact.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;
  const body = await request.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const contact = await db.tripContact.create({
    data: {
      tripId,
      name: body.name.trim(),
      role: body.role || null,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      email: body.email || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
