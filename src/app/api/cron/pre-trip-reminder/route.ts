import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLifecycleEmail, type LifecycleEmailType } from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOWS: { type: LifecycleEmailType; minDays: number; maxDays: number }[] = [
  { type: "pre_trip_90", minDays: 87, maxDays: 93 },
  { type: "pre_trip_30", minDays: 27, maxDays: 33 },
  { type: "pre_trip_7",  minDays:  5, maxDays:  9 },
  { type: "pre_trip_1",  minDays:  0, maxDays:  3 },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const now = new Date();

  // One query covering the outermost window range (0–93 days out).
  const windowStart = new Date(now.getTime() + WINDOWS[3].minDays * 86_400_000);
  const windowEnd   = new Date(now.getTime() + WINDOWS[0].maxDays * 86_400_000);

  const trips = await db.trip.findMany({
    where: {
      status: { in: ["PLANNING", "ACTIVE"] },
      startDate: { gte: windowStart, lte: windowEnd },
      isAnonymous: false,
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

    const msUntilStart = new Date(trip.startDate!).getTime() - now.getTime();
    const daysUntilStart = msUntilStart / 86_400_000;

    for (const w of WINDOWS) {
      if (daysUntilStart < w.minDays || daysUntilStart > w.maxDays) continue;

      // EmailLog guard: one send per (recipient + type + tripId)
      const prior = await db.emailLog.findFirst({
        where: { recipient: email, type: w.type, tripId: trip.id },
        select: { id: true },
      });
      if (prior) { skipped++; continue; }

      wouldSend.push({
        tripId: trip.id,
        tripTitle: trip.title,
        recipient: email,
        type: w.type,
        daysUntilStart: Math.round(daysUntilStart),
      });

      if (!dryRun) {
        try {
          await sendLifecycleEmail(w.type, { to: email, tripId: trip.id });
          sent++;
        } catch (e) {
          console.error(`[pre-trip-reminder] send failed for ${trip.id} ${w.type}:`, e);
        }
      }
    }
  }

  console.log(`[pre-trip-reminder] dryRun=${dryRun} trips=${trips.length} wouldSend=${wouldSend.length} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ dryRun, trips: trips.length, wouldSend, sent, skipped });
}
