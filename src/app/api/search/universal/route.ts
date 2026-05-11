import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json(
      { cities: [], countries: [], continents: [], picks: [], itineraries: [], tours: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const [cities, countries, continents, picks, itineraries, tours] = await Promise.all([
    db.city.findMany({
      where: {
        featured: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { priorityRank: "asc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        name: true,
        photoUrl: true,
        country: { select: { name: true, continent: { select: { slug: true } } } },
      },
    }),
    db.country.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        slug: true,
        name: true,
        photoUrl: true,
        continent: { select: { name: true, slug: true } },
      },
    }),
    db.continent.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, slug: true, name: true },
    }),
    db.communitySpot.findMany({
      where: {
        isPublic: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        category: true,
        photoUrl: true,
        shareToken: true,
      },
    }),
    db.trip.findMany({
      where: {
        isPublic: true,
        shareToken: { not: null },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { destinationCity: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { viewCount: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        shareToken: true,
        destinationCity: true,
        heroImageUrl: true,
      },
    }),
    db.generatedTour.findMany({
      where: {
        isPublic: true,
        deletedAt: null,
        shareToken: { not: null },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { destinationCity: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        shareToken: true,
        destinationCity: true,
        stops: {
          where: { deletedAt: null },
          orderBy: { orderIndex: "asc" },
          take: 1,
          select: { imageUrl: true },
        },
      },
    }),
  ]);

  return NextResponse.json(
    {
      cities: cities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        countryName: c.country.name,
        continentSlug: c.country.continent.slug,
        photoUrl: c.photoUrl,
      })),
      countries: countries.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        continentName: c.continent.name,
        continentSlug: c.continent.slug,
        photoUrl: c.photoUrl,
      })),
      continents,
      picks: picks.map((p) => ({
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        category: p.category,
        photoUrl: p.photoUrl,
        shareToken: p.shareToken,
      })),
      itineraries: itineraries.map((t) => ({
        id: t.id,
        title: t.title,
        shareToken: t.shareToken,
        destinationCity: t.destinationCity,
        heroImageUrl: t.heroImageUrl,
      })),
      tours: tours.map((t) => ({
        id: t.id,
        title: t.title,
        shareToken: t.shareToken,
        destinationCity: t.destinationCity,
        photoUrl: t.stops[0]?.imageUrl ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
