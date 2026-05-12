import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promoteToCommunitySpot } from "@/lib/promote-saved-item-to-pick";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const savedItems = await db.savedItem.findMany({
      where: {
        deletedAt: null,
        rawTitle: { not: null },
        destinationCity: { not: null },
        trip: {
          isFlokkerExample: true,
          familyProfileId: DEMO_PROFILE_ID,
        },
      },
      select: {
        id: true,
        rawTitle: true,
        rawDescription: true,
        destinationCity: true,
        destinationCountry: true,
        categoryTags: true,
        lat: true,
        lng: true,
        placePhotoUrl: true,
        websiteUrl: true,
        trip: {
          select: {
            destinationCity: true,
          },
        },
      },
      orderBy: [{ trip: { destinationCity: "asc" } }],
    });

    // Resolve cityId per city name (cached to avoid N+1)
    const cityIdCache = new Map<string, string | null>();
    async function getCityId(cityName: string): Promise<string | null> {
      if (cityIdCache.has(cityName)) return cityIdCache.get(cityName)!;
      const city = await db.city.findFirst({
        where: { name: { equals: cityName, mode: "insensitive" } },
        select: { id: true },
      });
      const id = city?.id ?? null;
      cityIdCache.set(cityName, id);
      return id;
    }

    let created = 0;
    let matched = 0;
    let skipped = 0;
    let errors = 0;
    const perCity: Record<string, { created: number; matched: number }> = {};

    for (const si of savedItems) {
      const cityName = si.destinationCity!;
      if (!perCity[cityName]) perCity[cityName] = { created: 0, matched: 0 };

      try {
        const cityId = await getCityId(cityName);
        const result = await promoteToCommunitySpot({
          name: si.rawTitle!,
          description: si.rawDescription,
          city: cityName,
          country: si.destinationCountry,
          category: si.categoryTags?.[0] ?? null,
          lat: si.lat,
          lng: si.lng,
          photoUrl: si.placePhotoUrl,
          websiteUrl: si.websiteUrl,
          cityId,
        });

        if (result.status === "created") {
          created++;
          perCity[cityName].created++;
        } else if (result.status === "matched_existing") {
          matched++;
          perCity[cityName].matched++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
        console.error(`[backfill-picks] ${si.rawTitle} (${cityName}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      status: "success",
      total: savedItems.length,
      created,
      matched,
      skipped,
      errors,
      perCity,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[backfill-itinerary-picks] fatal:", message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
