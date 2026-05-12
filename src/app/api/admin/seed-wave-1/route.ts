import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { seedCity, WAVE1_CITY_SLUGS, type SeedCityResult } from "@/lib/seed-city-picks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perCity: SeedCityResult[] = [];
  let totalRequested = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  // Sequential to respect Sonnet rate limits and Places quota
  for (const slug of WAVE1_CITY_SLUGS) {
    console.log(`[seed-wave-1] Seeding ${slug}...`);
    const result = await seedCity(slug, 20);
    perCity.push(result);
    totalRequested += result.requested;
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    console.log(`[seed-wave-1] ${slug}: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`);
  }

  return NextResponse.json({
    totalRequested,
    totalInserted,
    totalSkipped,
    perCityBreakdown: Object.fromEntries(
      perCity.map((r) => [r.citySlug, {
        cityName: r.cityName,
        requested: r.requested,
        generated: r.generated,
        enriched: r.enriched,
        inserted: r.inserted,
        skipped: r.skipped,
        errors: r.errors,
      }])
    ),
  });
}
