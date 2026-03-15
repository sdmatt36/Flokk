import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DietaryReq } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { members: true } } },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = user.familyProfile.members.find((m) => m.id === id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  const updated = await db.familyMember.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name || null }),
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

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { members: true } } },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = user.familyProfile.members.find((m) => m.id === id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.familyMember.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
