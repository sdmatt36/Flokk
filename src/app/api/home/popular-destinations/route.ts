import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";

export const dynamic = "force-dynamic";

type PopularDestination = {
  id: string;
  city: string;
  country: string;
  imageUrl: string;
  tripId: string | null;
  label: string;
  tripCount: number;
};

const FALLBACKS: Array<{ city: string; country: string }> = [
  { city: "Lisbon", country: "Portugal" },
  { city: "Kyoto", country: "Japan" },
  { city: "Barcelona", country: "Spain" },
  { city: "Bangkok", country: "Thailand" },
];

export async function GET() {
  const trips = await db.trip.findMany({
    where: {
      privacy: "PUBLIC",
      status: "COMPLETED",
      endDate: { lt: new Date() },
    },
    select: {
      id: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      heroImageUrl: true,
      isAnonymous: true,
      familyProfile: { select: { familyName: true } },
    },
    orderBy: { endDate: "desc" },
    take: 40,
  });

  // Deduplicate by city — keep most recent trip per city
  const seenCities = new Set<string>();
  const destinations: PopularDestination[] = [];

  for (const t of trips) {
    if (!t.destinationCity) continue;
    const cityKey = t.destinationCity.toLowerCase();
    if (seenCities.has(cityKey)) continue;
    seenCities.add(cityKey);

    const nights =
      t.startDate && t.endDate
        ? Math.round(
            (t.endDate.getTime() - t.startDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;
    const familyName = t.familyProfile?.familyName ?? null;
    const attribution =
      !t.isAnonymous && familyName ? `by ${familyName}` : "by Community";
    const label = nights ? `${nights} nights · ${attribution}` : attribution;

    destinations.push({
      id: t.id,
      city: t.destinationCity,
      country: t.destinationCountry ?? "",
      imageUrl: getTripCoverImage(t.destinationCity, t.destinationCountry, t.heroImageUrl),
      tripId: t.id,
      label,
      tripCount: 1,
    });

    if (destinations.length >= 8) break;
  }

  // Pad with curated fallbacks if fewer than 4 real results
  if (destinations.length < 4) {
    const existingCities = new Set(destinations.map((d) => d.city.toLowerCase()));
    for (const fb of FALLBACKS) {
      if (existingCities.has(fb.city.toLowerCase())) continue;
      destinations.push({
        id: `fallback-${fb.city}`,
        city: fb.city,
        country: fb.country,
        imageUrl: getTripCoverImage(fb.city, fb.country, null),
        tripId: null,
        label: "by Community",
        tripCount: 0,
      });
      if (destinations.length >= 4) break;
    }
  }

  return NextResponse.json({ destinations });
}
