import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripCoverImage } from "@/lib/destination-images";

export const dynamic = "force-dynamic";

// Mirror of the "Popular with Flokk families" query in (app)/home/page.tsx.
// Auth required so the viewer's own trips are excluded.

const POPULAR_FALLBACKS = [
  { city: "Lisbon", country: "Portugal" },
  { city: "Kyoto", country: "Japan" },
  { city: "Barcelona", country: "Spain" },
  { city: "Bangkok", country: "Thailand" },
];

export type PopularCard = {
  id: string;
  city: string;
  country: string | null;
  imageUrl: string;
  tripId: string | null;
  shareToken: string | null;
  label: string;
};

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const raw = await db.trip.findMany({
    where: {
      privacy: "PUBLIC",
      status: "COMPLETED",
      endDate: { lt: new Date() },
      familyProfileId: { not: profileId },
      shareToken: { not: null },
    },
    select: {
      id: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      heroImageUrl: true,
      shareToken: true,
    },
    orderBy: { endDate: "desc" },
    take: 40,
  });

  // Deduplicate by city, most recent trip per city wins
  const seenCities = new Set<string>();
  const uniquePool: PopularCard[] = [];

  for (const t of raw) {
    if (!t.destinationCity) continue;
    const cityKey = t.destinationCity.toLowerCase();
    if (seenCities.has(cityKey)) continue;
    seenCities.add(cityKey);
    const nights =
      t.startDate && t.endDate
        ? Math.round((t.endDate.getTime() - t.startDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const label =
      nights === null ? "Anonymous Flokker"
      : nights < 1 ? "Day trip"
      : `${nights} night${nights === 1 ? "" : "s"} · Anonymous Flokker`;
    uniquePool.push({
      id: t.id,
      city: t.destinationCity,
      country: t.destinationCountry ?? null,
      imageUrl: getTripCoverImage(t.destinationCity, t.destinationCountry, t.heroImageUrl),
      tripId: t.id,
      shareToken: t.shareToken ?? null,
      label,
    });
  }

  // Fisher-Yates shuffle — matches home/page.tsx Discipline 4.11
  const shuffled = [...uniquePool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cards = shuffled.slice(0, 4);

  // Pad with curated fallbacks if fewer than 4 real results
  if (cards.length < 4) {
    const existingCities = new Set(cards.map((c) => c.city.toLowerCase()));
    for (const fb of POPULAR_FALLBACKS) {
      if (existingCities.has(fb.city.toLowerCase())) continue;
      cards.push({
        id: `fallback-${fb.city}`,
        city: fb.city,
        country: fb.country,
        imageUrl: getTripCoverImage(fb.city, fb.country, null),
        tripId: null,
        shareToken: null,
        label: "Anonymous Flokker",
      });
      if (cards.length >= 4) break;
    }
  }

  return NextResponse.json({ cards });
}
