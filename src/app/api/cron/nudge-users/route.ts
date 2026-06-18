import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCOUNT_AGE_DAYS = 21;
const INACTIVITY_DAYS  = 21;
const RESEND_DAYS      = 60;

// Strip the plus-label from the local part so sdmatt36+test@gmail.com
// normalizes to the same base address as sdmatt36@gmail.com.
function normalizeEmail(email: string): string {
  const at = email.indexOf("@");
  if (at === -1) return email.toLowerCase();
  return (email.slice(0, at).replace(/\+.*$/, "") + email.slice(at)).toLowerCase();
}

const SUPPRESSION_BASE = new Set(
  [
    "matt@camdenjackson.com",
    "sdmatt36@gmail.com",
    "matt@strongerconsulting.com",
  ].map(normalizeEmail)
);

function isSuppressed(email: string | null | undefined): boolean {
  if (!email || !email.trim()) return true;
  if (email.toLowerCase().endsWith(".seed")) return true;
  return SUPPRESSION_BASE.has(normalizeEmail(email));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const now = new Date();
  const accountAgeCutoff = new Date(now.getTime() - ACCOUNT_AGE_DAYS * 86_400_000);
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_DAYS  * 86_400_000);
  const resendCutoff     = new Date(now.getTime() - RESEND_DAYS       * 86_400_000);

  // Activity computation:
  //   last save  = MAX(SavedItem.savedAt)  WHERE SavedItem.familyProfileId = profile.id AND deletedAt IS NULL
  //   last trip  = MAX(Trip.updatedAt)     WHERE Trip.familyProfileId = profile.id AND isAnonymous=false AND isPlacesLibrary=false
  //   last activity = MAX(last save, last trip)
  // Join path: User.id → FamilyProfile.userId → FamilyProfile.id → savedItems / trips
  const profiles = await db.familyProfile.findMany({
    where: {
      user: {
        createdAt:       { lt: accountAgeCutoff },
        marketingOptOut: false,
      },
    },
    include: {
      user: { select: { email: true, createdAt: true } },
      savedItems: {
        where:   { deletedAt: null },
        orderBy: { savedAt: "desc" },
        take:    1,
        select:  { savedAt: true },
      },
      trips: {
        where:   { isAnonymous: false, isPlacesLibrary: false },
        orderBy: { updatedAt: "desc" },
        take:    1,
        select:  { updatedAt: true },
      },
      _count: {
        select: {
          savedItems: { where: { deletedAt: null } },
          trips:      { where: { isAnonymous: false, isPlacesLibrary: false } },
        },
      },
    },
  });

  type LapsedEntry         = { profileId: string; recipient: string; lastActivityDaysAgo: number };
  type NeverActivatedEntry = { profileId: string; recipient: string; accountAgeDays: number };

  const lapsedWouldSend:         LapsedEntry[]         = [];
  const neverActivatedWouldSend: NeverActivatedEntry[]  = [];
  let lapsedSent         = 0;
  let neverActivatedSent = 0;
  let skipped            = 0;

  for (const profile of profiles) {
    const email = profile.user?.email as string | null | undefined;

    if (isSuppressed(email)) { skipped++; continue; }

    const hasAnyActivity = profile._count.savedItems > 0 || profile._count.trips > 0;

    if (!hasAnyActivity) {
      // ── never_activated branch ────────────────────────────────────────────
      const prior = await db.emailLog.findFirst({
        where: { recipient: email!, type: "onboarding_nudge", status: "sent", createdAt: { gte: resendCutoff } },
        select: { id: true },
      });
      if (prior) { skipped++; continue; }

      const accountAgeDays = Math.round(
        (now.getTime() - new Date(profile.user.createdAt).getTime()) / 86_400_000
      );
      neverActivatedWouldSend.push({ profileId: profile.id, recipient: email!, accountAgeDays });

      if (!dryRun) {
        try {
          await sendLifecycleEmail("onboarding_nudge", { to: email! });
          neverActivatedSent++;
        } catch (e) {
          console.error(`[nudge-users] onboarding_nudge failed for ${profile.id}:`, e);
        }
        await new Promise(r => setTimeout(r, 250));
      }
    } else {
      // ── lapsed branch ─────────────────────────────────────────────────────
      const lastSave     = profile.savedItems[0]?.savedAt  ?? new Date(0);
      const lastTrip     = profile.trips[0]?.updatedAt     ?? new Date(0);
      const lastActivity = new Date(Math.max(lastSave.getTime(), lastTrip.getTime()));

      if (lastActivity >= inactivityCutoff) { skipped++; continue; }

      const prior = await db.emailLog.findFirst({
        where: { recipient: email!, type: "inactivity", status: "sent", createdAt: { gte: resendCutoff } },
        select: { id: true },
      });
      if (prior) { skipped++; continue; }

      const lastActivityDaysAgo = Math.round(
        (now.getTime() - lastActivity.getTime()) / 86_400_000
      );
      lapsedWouldSend.push({ profileId: profile.id, recipient: email!, lastActivityDaysAgo });

      if (!dryRun) {
        try {
          await sendLifecycleEmail("inactivity", { to: email! });
          lapsedSent++;
        } catch (e) {
          console.error(`[nudge-users] inactivity failed for ${profile.id}:`, e);
        }
        await new Promise(r => setTimeout(r, 250));
      }
    }
  }

  console.log(
    `[nudge-users] dryRun=${dryRun} profiles=${profiles.length}` +
    ` lapsed.wouldSend=${lapsedWouldSend.length} lapsed.sent=${lapsedSent}` +
    ` neverActivated.wouldSend=${neverActivatedWouldSend.length} neverActivated.sent=${neverActivatedSent}` +
    ` skipped=${skipped}`
  );

  return NextResponse.json({
    dryRun,
    profiles:       profiles.length,
    lapsed:         { wouldSend: lapsedWouldSend,         count: lapsedWouldSend.length,         sent: lapsedSent         },
    neverActivated: { wouldSend: neverActivatedWouldSend, count: neverActivatedWouldSend.length, sent: neverActivatedSent },
    skipped,
  });
}
