import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { DietaryReq } from "@prisma/client";

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

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: { members: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = profile.members.find((m) => m.id === id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Support either a combined `name` field or separate `firstName` + `lastName`
  let resolvedName: string | null | undefined = undefined;
  if (body.firstName !== undefined || body.lastName !== undefined) {
    resolvedName = `${body.firstName || ""} ${body.lastName || ""}`.trim() || null;
  } else if (body.name !== undefined) {
    resolvedName = body.name || null;
  }

  const updated = await db.familyMember.update({
    where: { id },
    data: {
      ...(resolvedName !== undefined && { name: resolvedName }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
      ...(body.dietaryRequirements !== undefined && {
        dietaryRequirements: { set: body.dietaryRequirements as DietaryReq[] },
      }),
      ...(body.mobilityNotes !== undefined && { mobilityNotes: body.mobilityNotes || null }),
    },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: { members: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = profile.members.find((m) => m.id === id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.familyMember.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
