import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { memberId, field, value } = body;
  if (!memberId || !field) {
    return NextResponse.json({ error: "Missing memberId or field" }, { status: 400 });
  }

  // Verify the member belongs to the current user's family profile
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { members: { where: { id: memberId } } } } },
  });
  if (!user?.familyProfile || user.familyProfile.members.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // For date fields, convert string to Date or null
  const dateFields = ["passportIssueDate", "passportExpiryDate"];
  // For array fields (e.g. foodAllergies), use Prisma's { set: value } syntax
  const arrayFields = ["foodAllergies"];
  const data: Record<string, unknown> = {
    [field]: dateFields.includes(field)
      ? (value ? new Date(value) : null)
      : arrayFields.includes(field)
        ? { set: Array.isArray(value) ? value : [] }
        : value,
  };

  const updated = await db.familyMember.update({
    where: { id: memberId },
    data,
  });

  return NextResponse.json(updated);
}
