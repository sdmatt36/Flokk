import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Partial update of a TripContact. Mirrors the documents PATCH auth + response
// shape: Clerk-gated, operate by record id, return the updated row. Only provided
// fields are touched; omitted fields are left untouched. An empty string on a
// nullable field is an explicit clear (-> null); name cannot be blanked.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contactId } = await params;
  const body = await req.json() as {
    name?: string; role?: string; phone?: string; whatsapp?: string; email?: string; notes?: string;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const updated = await db.tripContact.update({
    where: { id: contactId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.role !== undefined ? { role: body.role || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp || null } : {}),
      ...(body.email !== undefined ? { email: body.email || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contactId } = await params;
  await db.tripContact.delete({ where: { id: contactId } });
  return NextResponse.json({ success: true });
}
