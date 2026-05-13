import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json([]);
  const programs = await db.loyaltyProgram.findMany({
    where: { familyProfileId: profileId },
    include: { familyMember: { select: { id: true, name: true } } },
  });
  return NextResponse.json(programs);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { programName, memberNumber, programType, familyMemberId } = body;
  if (!programName || memberNumber === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "No family profile" }, { status: 404 });
  }
  const program = await db.loyaltyProgram.create({
    data: {
      programName,
      memberNumber: memberNumber || "",
      programType: programType ?? "airline",
      familyProfileId: profileId,
      familyMemberId: familyMemberId ?? null,
    },
    include: { familyMember: { select: { id: true, name: true } } },
  });
  return NextResponse.json(program);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();
  const { memberNumber, familyMemberId } = body;
  const updated = await db.loyaltyProgram.update({
    where: { id },
    data: {
      ...(memberNumber !== undefined ? { memberNumber: memberNumber ?? "" } : {}),
      ...(familyMemberId !== undefined ? { familyMemberId: familyMemberId ?? null } : {}),
    },
    include: { familyMember: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.loyaltyProgram.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
