import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export const dynamic = "force-dynamic";

// Known booking platform names that should never appear as activity titles
const PLATFORM_NAMES = [
  "getyourguide",
  "viator",
  "klook",
  "airbnb",
  "booking.com",
  "expedia",
  "tripadvisor",
];

function isPlatformName(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return PLATFORM_NAMES.some(p => lower === p || lower.startsWith(p + " "));
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const activities = await db.itineraryItem.findMany({
    where: { type: "ACTIVITY" },
    select: { id: true, title: true, notes: true },
  });

  let updated = 0;
  let flagged = 0;

  for (const item of activities) {
    if (!isPlatformName(item.title)) continue;

    // If notes field has a better title candidate, use it
    if (item.notes && item.notes.length > 3 && !isPlatformName(item.notes)) {
      await db.itineraryItem.update({
        where: { id: item.id },
        data: { title: item.notes, needsVerification: true },
      });
      updated++;
    } else {
      // No better title available — flag for user correction
      await db.itineraryItem.update({
        where: { id: item.id },
        data: { needsVerification: true },
      });
      flagged++;
    }
  }

  console.log(`[fix-activity-titles] updated: ${updated}, flagged: ${flagged}`);
  return NextResponse.json({ updated, flagged, total: activities.length });
}
