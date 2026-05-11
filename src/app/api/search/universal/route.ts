import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const scope = searchParams.get("scope") as "continent" | "country" | "city" | null;
  const scopeId = searchParams.get("scopeId") ?? "";
  const scopeName = searchParams.get("scopeName") ?? "";

  if (!q) {
    return NextResponse.json(
      { cities: [], countries: [], continents: [], picks: [], itineraries: [], tours: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Decide which result groups are relevant at this scope ──────────────────
  const wantCities = scope !== "city";
  const wantCountries = !scope || scope === "continent";
  const wantContinents = !scope;
  const wantItineraries = scope !== "continent"; // no clean continent filter for string-based Trip
  // picks and tours always searched

  // ── City where clause ──────────────────────────────────────────────────────
  const cityBase = {
    featured: true,
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const cityWhere = !wantCities ? null : scope === "country" && scopeId
    ? { ...cityBase, countryId: scopeId }
    : scope === "continent" && scopeId
    ? { ...cityBase, country: { continentId: scopeId } }
    : cityBase;

  // ── Country where clause ───────────────────────────────────────────────────
  const countryBase = {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const countryWhere = !wantCountries ? null : scope === "continent" && scopeId
    ? { ...countryBase, continentId: scopeId }
    : countryBase;

  // ── Continent where clause ─────────────────────────────────────────────────
  const continentWhere = !wantContinents ? null : {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
    ],
  };

  // ── Pick (CommunitySpot) where clause ──────────────────────────────────────
  const pickBase = {
    isPublic: true,
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { city: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const pickWhere = scope === "city" && scopeId
    ? { ...pickBase, cityId: scopeId }
    : scope === "country" && scopeId
    ? { ...pickBase, geoCity: { countryId: scopeId } }
    : scope === "continent" && scopeId
    ? { ...pickBase, geoCity: { country: { continentId: scopeId } } }
    : pickBase;

  // ── Itinerary (Trip) where clause ──────────────────────────────────────────
  const tripBase = {
    isPublic: true,
    shareToken: { not: null as null },
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { destinationCity: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const tripWhere = !wantItineraries ? null : scope === "city" && scopeName
    ? { ...tripBase, destinationCity: { contains: scopeName, mode: "insensitive" as const } }
    : scope === "country" && scopeName
    ? { ...tripBase, destinationCountry: { contains: scopeName, mode: "insensitive" as const } }
    : tripBase;

  // ── Tour (GeneratedTour) where clause ──────────────────────────────────────
  const tourBase = {
    isPublic: true,
    deletedAt: null as null,
    shareToken: { not: null as null },
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { destinationCity: { contains: q, mode: "insensitive" as const } },
    ],
  };
  const tourWhere = scope === "city" && scopeName
    ? { ...tourBase, destinationCity: { contains: scopeName, mode: "insensitive" as const } }
    : scope === "country" && scopeName
    ? { ...tourBase, destinationCountry: { contains: scopeName, mode: "insensitive" as const } }
    : scope === "continent" && scopeId
    ? { ...tourBase, city: { country: { continentId: scopeId } } }
    : tourBase;

  // ── Execute queries in parallel ────────────────────────────────────────────
  const [cities, countries, continents, picks, itineraries, tours] = await Promise.all([
    cityWhere
      ? db.city.findMany({
          where: cityWhere,
          orderBy: { priorityRank: "asc" },
          take: 5,
          select: {
            id: true, slug: true, name: true, photoUrl: true,
            country: { select: { name: true, continent: { select: { slug: true } } } },
          },
        })
      : Promise.resolve([]),
    countryWhere
      ? db.country.findMany({
          where: countryWhere,
          take: 5,
          select: {
            id: true, slug: true, name: true, photoUrl: true,
            continent: { select: { name: true, slug: true } },
          },
        })
      : Promise.resolve([]),
    continentWhere
      ? db.continent.findMany({
          where: continentWhere,
          take: 5,
          select: { id: true, slug: true, name: true },
        })
      : Promise.resolve([]),
    db.communitySpot.findMany({
      where: pickWhere,
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 5,
      select: {
        id: true, name: true, city: true, country: true,
        category: true, photoUrl: true, shareToken: true,
      },
    }),
    tripWhere
      ? db.trip.findMany({
          where: tripWhere,
          orderBy: { viewCount: "desc" },
          take: 5,
          select: {
            id: true, title: true, shareToken: true,
            destinationCity: true, heroImageUrl: true,
          },
        })
      : Promise.resolve([]),
    db.generatedTour.findMany({
      where: tourWhere,
      take: 5,
      select: {
        id: true, title: true, shareToken: true, destinationCity: true,
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
      cities: (cities as typeof cities).map((c) => ({
        id: c.id, slug: c.slug, name: c.name,
        countryName: c.country.name,
        continentSlug: c.country.continent.slug,
        photoUrl: c.photoUrl,
      })),
      countries: (countries as typeof countries).map((c) => ({
        id: c.id, slug: c.slug, name: c.name,
        continentName: c.continent.name,
        continentSlug: c.continent.slug,
        photoUrl: c.photoUrl,
      })),
      continents,
      picks: picks.map((p) => ({
        id: p.id, name: p.name, city: p.city, country: p.country,
        category: p.category, photoUrl: p.photoUrl, shareToken: p.shareToken,
      })),
      itineraries: (itineraries as typeof itineraries).map((t) => ({
        id: t.id, title: t.title, shareToken: t.shareToken,
        destinationCity: t.destinationCity, heroImageUrl: t.heroImageUrl,
      })),
      tours: tours.map((t) => ({
        id: t.id, title: t.title, shareToken: t.shareToken,
        destinationCity: t.destinationCity,
        photoUrl: t.stops[0]?.imageUrl ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
