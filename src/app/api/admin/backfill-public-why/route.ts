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

  // force=true: overwrite all stops on all shared tours (used to remediate verbatim-copy leaks).
  // Default: only process stops where publicWhy is null.
  const force = new URL(req.url).searchParams.get("force") === "true";

  const tours = await db.generatedTour.findMany({
    where: {
      shareToken: { not: null },
      deletedAt: null,
      ...(force ? {} : { stops: { some: { publicWhy: null, deletedAt: null } } }),
    },
    select: {
      id: true,
      destinationCity: true,
      stops: {
        where: force ? { deletedAt: null } : { publicWhy: null, deletedAt: null },
        select: { id: true, name: true, address: true, placeTypes: true, durationMin: true },
      },
    },
  });

  // In force mode, also null publicFamilyNote — private data, no neutral replacement.
  if (force) {
    for (const tour of tours) {
      await db.tourStop.updateMany({
        where: { tourId: tour.id, deletedAt: null },
        data: { publicFamilyNote: null },
      });
    }
  }

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
    force,
  });
}
