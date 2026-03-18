import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({ where: { id } });
  if (!item || item.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { notes } = body;
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await db.savedItem.update({ where: { id }, data: { notes } });
  return NextResponse.json({ savedItem: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await db.savedItem.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!item || item.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.savedItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
