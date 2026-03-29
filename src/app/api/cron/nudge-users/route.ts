import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { sendTransactional } from "@/lib/loops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

  const profiles = await db.familyProfile.findMany({
    where: {
      createdAt: { lt: cutoff },
      nudgeSentAt: null,
      savedItems: { none: {} },
    },
    include: { user: true },
  });

  console.log(`[nudge-users] found ${profiles.length} inactive profiles to nudge`);

  let nudged = 0;
  for (const profile of profiles) {
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(profile.user.clerkId);
      const firstName = clerkUser.firstName ?? "";
      const email = profile.user.email;

      await sendTransactional(email, "cmn5lny7g0t3v0ivuxp2nbz6h", { firstName });
      await db.familyProfile.update({
        where: { id: profile.id },
        data: { nudgeSentAt: new Date() },
      });
      console.log("[nudge-users] nudge sent to", email);
      nudged++;
    } catch (e) {
      console.error("[nudge-users] failed for profile", profile.id, e);
    }
  }

  return NextResponse.json({ nudged, total: profiles.length });
}
