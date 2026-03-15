import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DietaryReq, MemberRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { members: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ members: user.familyProfile.members });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, role, birthDate, dietaryRequirements } = body;

  if (!role || !["ADULT", "CHILD"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const member = await db.familyMember.create({
    data: {
      familyProfileId: user.familyProfile.id,
      name: name || null,
      role: role as MemberRole,
      birthDate: birthDate ? new Date(birthDate) : null,
      dietaryRequirements: dietaryRequirements
        ? { set: dietaryRequirements as DietaryReq[] }
        : { set: [] },
    },
  });

  return NextResponse.json({ member });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { members: true } } },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json();
  const { members } = body as {
    members: { id: string; name: string; birthDate: string | null }[];
  };
  if (!Array.isArray(members)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const ownedIds = new Set(user.familyProfile.members.map((m) => m.id));
  for (const m of members) {
    if (!ownedIds.has(m.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Promise.all(
    members.map((m) =>
      db.familyMember.update({
        where: { id: m.id },
        data: {
          name: m.name.trim() || null,
          birthDate: m.birthDate ? new Date(m.birthDate) : null,
        },
      })
    )
  );

  return NextResponse.json({ success: true });
}
