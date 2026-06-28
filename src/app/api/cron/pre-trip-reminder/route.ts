import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLifecycleEmail, type LifecycleEmailType } from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Each reminder fires on EXACTLY one calendar day before departure (see calendarDaysUntil
// below). The previous {minDays,maxDays} float windows fired on the early edge of a 3-day
// span (combined with the once-per-trip EmailLog dedup), so "pre_trip_1" / "Tomorrow you
// leave" went out ~2-3 days early. Comparing whole UTC calendar days makes firing
// independent of the 01:00 UTC cron run time and the stored time-of-day.
const WINDOWS: { type: LifecycleEmailType; daysBefore: number }[] = [
  { type: "pre_trip_90", daysBefore: 90 },
  { type: "pre_trip_30", daysBefore: 30 },
  { type: "pre_trip_7",  daysBefore:  7 },
  { type: "pre_trip_1",  daysBefore:  1 },
];

// Whole-day difference between two instants in the UTC calendar frame (no per-trip timezone
// exists, so UTC date is the consistent frame). Both operands floored to UTC midnight, so the
// result is an exact integer count of calendar days.
function utcCalendarDaysBetween(from: Date, to: Date): number {
  const fromMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toMidnight = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toMidnight - fromMidnight) / 86_400_000);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const now = new Date();

  // Prefilter covering every target day (1–90) with a day of slack on each side so the exact
  // calendar-day check below never misses a trip near a boundary.
  const windowStart = new Date(now.getTime() - 1 * 86_400_000);
  const windowEnd   = new Date(now.getTime() + 92 * 86_400_000);

  const trips = await db.trip.findMany({
    where: {
      status: { in: ["PLANNING", "ACTIVE"] },
      startDate: { gte: windowStart, lte: windowEnd },
      isPlacesLibrary: false,
      familyProfileId: { not: null },
    },
    include: {
      familyProfile: {
        include: { user: { select: { email: true } } },
      },
    },
  });

  type WouldSend = {
    tripId: string;
    tripTitle: string;
    recipient: string;
    type: LifecycleEmailType;
    daysUntilStart: number;
  };

  const wouldSend: WouldSend[] = [];
  let sent = 0;
  let skipped = 0;

  for (const trip of trips) {
    const email = trip.familyProfile?.user?.email;
    if (!email) continue;

    // Whole UTC calendar days from today to the trip's start date. pre_trip_1 fires when this
    // is exactly 1 (the real day before), regardless of cron run time / stored time-of-day.
    const calendarDaysUntil = utcCalendarDaysBetween(now, new Date(trip.startDate!));

    for (const w of WINDOWS) {
      if (calendarDaysUntil !== w.daysBefore) continue;

      // EmailLog guard: only successful sends block retry
      const prior = await db.emailLog.findFirst({
        where: { recipient: email, type: w.type, tripId: trip.id, status: "sent" },
        select: { id: true },
      });
      if (prior) { skipped++; continue; }

      wouldSend.push({
        tripId: trip.id,
        tripTitle: trip.title,
        recipient: email,
        type: w.type,
        daysUntilStart: calendarDaysUntil,
      });

      if (!dryRun) {
        try {
          await sendLifecycleEmail(w.type, { to: email, tripId: trip.id });
          sent++;
        } catch (e) {
          console.error(`[pre-trip-reminder] send failed for ${trip.id} ${w.type}:`, e);
        }
        await new Promise(r => setTimeout(r, 250));
      }
    }
  }

  console.log(`[pre-trip-reminder] dryRun=${dryRun} trips=${trips.length} wouldSend=${wouldSend.length} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ dryRun, trips: trips.length, wouldSend, sent, skipped });
}
