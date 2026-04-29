import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type TiptapDoc = { type: "doc"; content: unknown[] };

function isValidTiptapDoc(v: unknown): v is TiptapDoc {
  return typeof v === "object" && v !== null && (v as Record<string, unknown>).type === "doc";
}

function wrapLegacyString(content: unknown): TiptapDoc {
  if (typeof content === "string") {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: content.trim() ? [{ type: "text", text: content.trim() }] : [] }],
    };
  }
  if (isValidTiptapDoc(content)) return content;
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("dayIndex");

  const where: Record<string, unknown> = { tripId };
  if (dayParam === "null") {
    where.dayIndex = null;
  } else if (dayParam !== null) {
    const parsed = parseInt(dayParam, 10);
    if (!isNaN(parsed)) where.dayIndex = parsed;
  }

  const notes = await db.tripNote.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(notes);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const body = await request.json() as { content?: unknown; dayIndex?: number | null };

  if (body.content === undefined || body.content === null) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const content = wrapLegacyString(body.content);

  const note = await db.tripNote.create({
    data: {
      tripId,
      content: content as Prisma.InputJsonValue,
      dayIndex: typeof body.dayIndex === "number" ? body.dayIndex : null,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
