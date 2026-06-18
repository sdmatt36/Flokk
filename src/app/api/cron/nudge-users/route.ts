import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INACTIVITY_DAYS = 21;
const ACCOUNT_AGE_DAYS = 21;
const RESEND_DAYS = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const now = new Date();
  const accountAgeCutoff  = new Date(now.getTime() - ACCOUNT_AGE_DAYS  * 86_400_000);
  const inactivityCutoff  = new Date(now.getTime() - INACTIVITY_DAYS   * 86_400_000);
  const resendCutoff      = new Date(now.getTime() - RESEND_DAYS        * 86_400_000);

  // Fetch profiles whose user account is old enough and has not opted out.
  // Include most-recent save and trip so we can compute last-activity in JS.
  const profiles = await db.familyProfile.findMany({
    where: {
      user: {
        createdAt: { lt: accountAgeCutoff },
        marketingOptOut: false,
      },
    },
    include: {
      user: { select: { email: true, createdAt: true } },
      savedItems: { orderBy: { savedAt: "desc" }, take: 1, select: { savedAt: true } },
      trips: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
    },
  });

  type WouldSend = { profileId: string; recipient: string; lastActivityDaysAgo: number };
  const wouldSend: WouldSend[] = [];
  let sent = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const email = profile.user?.email;
    if (!email) continue;

    const lastSave  = profile.savedItems[0]?.savedAt ?? new Date(0);
    const lastTrip  = profile.trips[0]?.updatedAt     ?? new Date(0);
    const lastActivity = new Date(Math.max(lastSave.getTime(), lastTrip.getTime()));

    if (lastActivity >= inactivityCutoff) { skipped++; continue; }

    // No inactivity email in the last RESEND_DAYS
    const prior = await db.emailLog.findFirst({
      where: { recipient: email, type: "inactivity", createdAt: { gte: resendCutoff } },
      select: { id: true },
    });
    if (prior) { skipped++; continue; }

    const lastActivityDaysAgo = Math.round((now.getTime() - lastActivity.getTime()) / 86_400_000);
    wouldSend.push({ profileId: profile.id, recipient: email, lastActivityDaysAgo });

    if (!dryRun) {
      try {
        await sendLifecycleEmail("inactivity", { to: email });
        sent++;
      } catch (e) {
        console.error(`[nudge-users] inactivity email failed for ${profile.id}:`, e);
      }
    }
  }

  console.log(`[nudge-users] dryRun=${dryRun} profiles=${profiles.length} wouldSend=${wouldSend.length} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ dryRun, profiles: profiles.length, wouldSend, count: wouldSend.length, sent, skipped });
}
