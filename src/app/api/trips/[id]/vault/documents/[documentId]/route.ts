import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { documentId } = await params;
  const body = await req.json() as { content?: string; label?: string };
  const updated = await db.tripDocument.update({
    where: { id: documentId },
    data: {
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, documentId } = await params;

  // If this is a booking document, also delete the linked ItineraryItem(s) by confirmationCode
  const doc = await db.tripDocument.findUnique({ where: { id: documentId } });
  if (doc?.type === "booking" && doc.content) {
    try {
      const parsed = JSON.parse(doc.content) as Record<string, unknown>;
      const confCode = parsed.confirmationCode as string | null | undefined;
      if (confCode) {
        await db.itineraryItem.deleteMany({ where: { tripId, confirmationCode: confCode } });
      }
    } catch { /* ignore malformed content */ }
  }

  await db.tripDocument.delete({ where: { id: documentId } });
  return NextResponse.json({ success: true });
}
