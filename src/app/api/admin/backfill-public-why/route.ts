import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePublicWhyForStops } from "@/lib/generate-public-why";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Accept either Clerk session auth or CRON_SECRET Bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const bearerValid = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!bearerValid) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tours = await db.generatedTour.findMany({
    where: {
      shareToken: { not: null },
      deletedAt: null,
      stops: { some: { publicWhy: null, deletedAt: null } },
    },
    select: {
      id: true,
      destinationCity: true,
      stops: {
        where: { publicWhy: null, deletedAt: null },
        select: { id: true, name: true, address: true, placeTypes: true, durationMin: true },
      },
    },
  });

  let totalGenerated = 0;
  let totalFailed = 0;

  for (const tour of tours) {
    if (tour.stops.length === 0) continue;
    const { generated, failed } = await generatePublicWhyForStops(tour.stops, tour.destinationCity);
    totalGenerated += generated;
    totalFailed += failed;
  }

  return NextResponse.json({
    toursProcessed: tours.length,
    generated: totalGenerated,
    failed: totalFailed,
  });
}
