import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getFamilyProfile(userId: string) {
  const user = await db.user.findFirst({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  return user?.familyProfile ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fp = await getFamilyProfile(userId);
  if (!fp) return NextResponse.json({ senderEmails: [] });

  return NextResponse.json({ senderEmails: fp.senderEmails ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fp = await getFamilyProfile(userId);
  if (!fp) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { action, email } = await req.json() as { action: "add" | "remove"; email: string };
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const normalized = email.trim().toLowerCase();
  const current = fp.senderEmails ?? [];

  let updated: string[];
  if (action === "add") {
    if (current.includes(normalized)) return NextResponse.json({ senderEmails: current });
    updated = [...current, normalized];
  } else {
    updated = current.filter((e) => e !== normalized);
  }

  const result = await db.familyProfile.update({
    where: { id: fp.id },
    data: { senderEmails: updated },
    select: { senderEmails: true },
  });

  return NextResponse.json({ senderEmails: result.senderEmails });
}
