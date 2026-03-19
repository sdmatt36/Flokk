import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;
  const keyInfo = await db.tripKeyInfo.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(keyInfo);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;
  const body = await request.json();
  if (!body.label?.trim() || !body.value?.trim()) {
    return NextResponse.json({ error: "Label and value required" }, { status: 400 });
  }
  const item = await db.tripKeyInfo.create({
    data: {
      tripId,
      label: body.label.trim(),
      value: body.value.trim(),
    },
  });
  return NextResponse.json(item, { status: 201 });
}
