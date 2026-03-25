import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { heroImageUrl } = await req.json() as { heroImageUrl: string | null };

  const updated = await db.trip.update({
    where: { id },
    data: { heroImageUrl: heroImageUrl ?? null },
    select: { id: true, heroImageUrl: true },
  });

  return NextResponse.json({ trip: updated });
}
