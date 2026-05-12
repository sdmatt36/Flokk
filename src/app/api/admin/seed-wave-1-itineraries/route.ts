import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { seedWave15Trips } from "@/lib/seed-wave15-trips";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await seedWave15Trips();

  const created = results.filter((r) => !r.skipped && r.errors.length === 0);
  const skipped = results.filter((r) => r.skipped);
  const errored = results.filter((r) => r.errors.length > 0);

  return NextResponse.json({
    totalCities: results.length,
    created: created.length,
    skipped: skipped.length,
    errored: errored.length,
    perCity: Object.fromEntries(
      results.map((r) => [
        r.citySlug,
        {
          tripTitle: r.tripTitle,
          tripId: r.tripId,
          totalDays: r.totalDays,
          picksReferenced: r.picksReferenced,
          skipped: r.skipped,
          skipReason: r.skipReason,
          errors: r.errors,
        },
      ])
    ),
  });
}
