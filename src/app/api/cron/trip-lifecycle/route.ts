import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTripCompletedEvent } from "@/lib/loops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find trips whose endDate has passed and are still in PLANNING or ACTIVE status
  const tripsToComplete = await db.trip.findMany({
    where: {
      endDate: { lt: new Date(now.getTime() - 9 * 60 * 60 * 1000) },
      status: { in: ["PLANNING", "ACTIVE"] },
    },
    include: {
      familyProfile: {
        include: {
          user: {
            select: { email: true },
          },
        },
      },
    },
  });

  console.log(`[trip-lifecycle] Found ${tripsToComplete.length} trips to complete`);

  let completed = 0;
  let emailed = 0;

  for (const trip of tripsToComplete) {
    try {
      await db.trip.update({
        where: { id: trip.id },
        data: { status: "COMPLETED" },
      });
      completed++;

      const userEmail = trip.familyProfile?.user?.email;
      if (userEmail) {
        await sendTripCompletedEvent(userEmail, {
          tripDestination: trip.destinationCity ?? "your destination",
          tripTitle: trip.title ?? `${trip.destinationCity ?? "Your"} trip`,
        });
        emailed++;
      }

      console.log(`[trip-lifecycle] Completed trip: ${trip.id} — ${trip.title}`);
    } catch (err) {
      console.error(`[trip-lifecycle] Failed for trip ${trip.id}:`, err);
    }
  }

  return NextResponse.json({
    processed: tripsToComplete.length,
    completed,
    emailed,
  });
}
