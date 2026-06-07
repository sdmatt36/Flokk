import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let cursor: string | undefined;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const batch = await db.communitySpot.findMany({
      where: { shareToken: null },
      select: { id: true },
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const pick of batch) {
      try {
        await db.communitySpot.update({
          where: { id: pick.id },
          data: { shareToken: nanoid(12) },
        });
        updated++;
      } catch {
        // unique constraint collision on nanoid — retry once with new token
        try {
          await db.communitySpot.update({
            where: { id: pick.id },
            data: { shareToken: nanoid(12) },
          });
          updated++;
        } catch {
          skipped++;
        }
      }
    }
  }

  return NextResponse.json({ updated, skipped });
}
