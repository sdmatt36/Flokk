import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; keyInfoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { keyInfoId } = await params;
  await db.tripKeyInfo.delete({ where: { id: keyInfoId } });
  return NextResponse.json({ success: true });
}
