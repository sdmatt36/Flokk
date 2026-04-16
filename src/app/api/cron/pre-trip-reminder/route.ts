import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPreTripReminderEvent } from "@/lib/loops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 7-day window: startDate is between 6.5 and 7.5 days from now
  const sevenDayStart = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
  const sevenDayEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);

  // 1-day window: startDate is between 0.5 and 1.5 days from now
  const oneDayStart = new Date(now.getTime() + 0.5 * 24 * 60 * 60 * 1000);
  const oneDayEnd = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000);

  const include = {
    familyProfile: {
      include: {
        user: { select: { email: true } },
      },
    },
  } as const;

  const [sevenDayTrips, oneDayTrips] = await Promise.all([
    db.trip.findMany({
      where: {
        status: { in: ["PLANNING", "ACTIVE"] },
        startDate: { gte: sevenDayStart, lte: sevenDayEnd },
      },
      include,
    }),
    db.trip.findMany({
      where: {
        status: { in: ["PLANNING", "ACTIVE"] },
        startDate: { gte: oneDayStart, lte: oneDayEnd },
      },
      include,
    }),
  ]);

  // Merge and deduplicate by trip id (in case a trip falls in both windows)
  const seen = new Set<string>();
  const trips = [...sevenDayTrips, ...oneDayTrips].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  console.log(`[pre-trip-reminder] Found ${trips.length} trips (7-day: ${sevenDayTrips.length}, 1-day: ${oneDayTrips.length})`);

  let emailed = 0;

  for (const trip of trips) {
    try {
      const userEmail = trip.familyProfile?.user?.email;
      if (!userEmail) continue;

      const startTime = trip.startDate!.getTime();
      const daysAway = startTime >= sevenDayStart.getTime() && startTime <= sevenDayEnd.getTime() ? 7 : 1;

      await sendPreTripReminderEvent(userEmail, {
        tripDestination: trip.destinationCity ?? trip.title ?? "your destination",
        daysAway,
      });
      emailed++;

      console.log(`[pre-trip-reminder] Reminded trip: ${trip.id} — ${trip.title} (${daysAway} days away)`);
    } catch (err) {
      console.error(`[pre-trip-reminder] Failed for trip ${trip.id}:`, err);
    }
  }

  return NextResponse.json({ processed: trips.length, emailed });
}
