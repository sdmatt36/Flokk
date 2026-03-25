import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getVenueImage } from "@/lib/destination-images";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load all saved items missing placePhotoUrl that have a rawTitle
  const items = await db.savedItem.findMany({
    where: { placePhotoUrl: null, rawTitle: { not: null } },
    select: { id: true, rawTitle: true },
  });

  // Find venue map matches
  const matches = items.flatMap((item) => {
    const url = getVenueImage(item.rawTitle!);
    return url ? [{ id: item.id, url }] : [];
  });

  if (matches.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  // Update all matched items
  await Promise.all(
    matches.map(({ id, url }) =>
      db.savedItem.update({
        where: { id },
        data: { placePhotoUrl: url },
      })
    )
  );

  return NextResponse.json({ updated: matches.length });
}
