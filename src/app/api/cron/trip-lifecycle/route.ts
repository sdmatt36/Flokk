import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";
import { utcCalendarDaysBetween } from "@/lib/cron-dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const now = new Date();

  // PLANNING → ACTIVE
  const activatedResult = await db.trip.updateMany({
    where: {
      status: "PLANNING",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    data: { status: "ACTIVE" },
  });
  console.log(`[trip-lifecycle] PLANNING → ACTIVE: ${activatedResult.count} trips`);

  // PLANNING/ACTIVE → COMPLETED (9-hour buffer after endDate)
  const tripsToComplete = await db.trip.findMany({
    where: {
      endDate: { lt: new Date(now.getTime() - 9 * 60 * 60 * 1000) },
      status: { in: ["PLANNING", "ACTIVE"] },
    },
    include: {
      familyProfile: {
        include: { user: { select: { email: true } } },
      },
    },
  });

  console.log(`[trip-lifecycle] Found ${tripsToComplete.length} trips to complete`);

  let completed = 0;
  for (const trip of tripsToComplete) {
    try {
      await db.trip.update({
        where: { id: trip.id },
        data: { status: "COMPLETED" },
      });
      completed++;
      console.log(`[trip-lifecycle] Completed trip: ${trip.id} — ${trip.title}`);
    } catch (err) {
      console.error(`[trip-lifecycle] Failed for trip ${trip.id}:`, err);
    }
  }

  // post_trip_rating: fire the day AFTER endDate, measured in whole UTC calendar days (same
  // frame as the pre-trip reminders) so the send cannot drift by a day with the stored
  // time-of-day or the cron run hour. A 1–3 calendar-day window absorbs a missed cron run; the
  // once-per-trip EmailLog dedup prevents repeats. The DB query is a coarse prefilter (5 days of
  // slack); the exact day count is enforced in JS below.
  const ratingPrefilterStart = new Date(now.getTime() - 6 * 86_400_000);
  const ratingPrefilterEnd   = new Date(now.getTime());

  const ratingTrips = await db.trip.findMany({
    where: {
      status: "COMPLETED",
      endDate: { gte: ratingPrefilterStart, lte: ratingPrefilterEnd },
      isPlacesLibrary: false,
      familyProfileId: { not: null },
    },
    include: {
      familyProfile: {
        include: { user: { select: { email: true } } },
      },
    },
  });

  type WouldSend = { tripId: string; tripTitle: string; recipient: string };
  const wouldSend: WouldSend[] = [];
  let ratingsSent = 0;

  for (const trip of ratingTrips) {
    const email = trip.familyProfile?.user?.email;
    if (!email) continue;

    // Day after endDate, with a 2-day catch-up for missed runs. Whole UTC calendar days, so a
    // trip that ended yesterday is exactly 1 regardless of endDate's stored time-of-day.
    if (!trip.endDate) continue;
    const daysSinceEnd = utcCalendarDaysBetween(new Date(trip.endDate), now);
    if (daysSinceEnd < 1 || daysSinceEnd > 3) continue;

    const prior = await db.emailLog.findFirst({
      where: { recipient: email, type: "post_trip_rating", tripId: trip.id, status: "sent" },
      select: { id: true },
    });
    if (prior) continue;

    wouldSend.push({ tripId: trip.id, tripTitle: trip.title, recipient: email });

    if (!dryRun) {
      try {
        await sendLifecycleEmail("post_trip_rating", { to: email, tripId: trip.id });
        ratingsSent++;
      } catch (e) {
        console.error(`[trip-lifecycle] post_trip_rating failed for ${trip.id}:`, e);
      }
      await new Promise(r => setTimeout(r, 250));
    }
  }

  console.log(`[trip-lifecycle] post_trip_rating dryRun=${dryRun} candidates=${ratingTrips.length} wouldSend=${wouldSend.length} sent=${ratingsSent}`);
  return NextResponse.json({
    processed: tripsToComplete.length,
    completed,
    postTripRating: { dryRun, wouldSend, sent: ratingsSent },
  });
}
