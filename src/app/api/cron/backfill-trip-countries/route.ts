import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await db.trip.findMany({
    where: {
      country: null,
      countries: { isEmpty: true },
      isPlacesLibrary: false,
    },
    select: {
      id: true,
      destinationCity: true,
      destinationCountry: true,
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  console.log(`[backfill-trip-countries] Processing ${trips.length} trips`);

  let updated = 0;
  let skipped = 0;

  for (const trip of trips) {
    let country: string | null = null;

    // Path 1: destinationCountry already set — just sync it to country/countries
    if (trip.destinationCountry) {
      country = trip.destinationCountry;
    }

    // Path 2: City table lookup by destinationCity
    if (!country && trip.destinationCity) {
      const cityRow = await db.city.findFirst({
        where: { name: { contains: trip.destinationCity, mode: "insensitive" } },
        select: { country: { select: { name: true } } },
      });
      if (cityRow?.country?.name) country = cityRow.country.name;
    }

    // Path 3: dominant country from the trip's SavedItems
    if (!country) {
      const saves = await db.savedItem.findMany({
        where: { tripId: trip.id, destinationCountry: { not: null }, deletedAt: null },
        select: { destinationCountry: true },
      });
      if (saves.length > 0) {
        const counts = new Map<string, number>();
        for (const s of saves) {
          const c = s.destinationCountry!;
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        country = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
    }

    if (country) {
      await db.trip.update({
        where: { id: trip.id },
        data: { country, countries: { set: [country] } },
      });
      updated++;
      console.log(`[backfill-trip-countries] trip ${trip.id} (${trip.destinationCity ?? "?"}): ${country}`);
    } else {
      skipped++;
    }
  }

  const remaining = await db.trip.count({
    where: { country: null, countries: { isEmpty: true }, isPlacesLibrary: false },
  });

  return NextResponse.json({ processed: trips.length, updated, skipped, remaining });
}
