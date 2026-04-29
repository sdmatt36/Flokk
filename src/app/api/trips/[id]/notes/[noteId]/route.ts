import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type TiptapDoc = { type: "doc"; content: unknown[] };

function isValidTiptapDoc(v: unknown): v is TiptapDoc {
  return typeof v === "object" && v !== null && (v as Record<string, unknown>).type === "doc";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await params;
  const body = await request.json() as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (body.content !== undefined) {
    if (!isValidTiptapDoc(body.content)) {
      return NextResponse.json({ error: "Invalid content shape" }, { status: 400 });
    }
    data.content = body.content as Prisma.InputJsonValue;
  }

  if (typeof body.checked === "boolean") data.checked = body.checked;
  if (body.dayIndex !== undefined) data.dayIndex = body.dayIndex === null ? null : Number(body.dayIndex);

  const updated = await db.tripNote.update({
    where: { id: noteId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await params;

  await db.tripNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true });
}
