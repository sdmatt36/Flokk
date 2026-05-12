import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  void userId; // available for future per-user result scoping

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const scope = searchParams.get("scope") as "continent" | "country" | "city" | null;
  const scopeId = searchParams.get("scopeId") ?? "";
  const scopeName = searchParams.get("scopeName") ?? "";
  const includeFallback = searchParams.get("includeFallback") === "true";

  if (!q) {
    return NextResponse.json(
      { cities: [], countries: [], continents: [], picks: [], itineraries: [], tours: [], fallback: null },
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

  // ── Shared selects ─────────────────────────────────────────────────────────
  const citySelect = {
    id: true, slug: true, name: true, photoUrl: true,
    country: { select: { name: true, continent: { select: { slug: true } } } },
  } as const;

  const countrySelect = {
    id: true, slug: true, name: true, photoUrl: true,
    continent: { select: { name: true, slug: true } },
  } as const;

  const pickSelect = {
    id: true, name: true, city: true, country: true,
    category: true, photoUrl: true, shareToken: true,
  } as const;

  const itinSelect = {
    id: true, title: true, shareToken: true,
    destinationCity: true, heroImageUrl: true,
  } as const;

  const tourSelect = {
    id: true, title: true, shareToken: true, destinationCity: true,
    stops: {
      where: { deletedAt: null },
      orderBy: { orderIndex: "asc" as const },
      take: 1,
      select: { imageUrl: true },
    },
  } as const;

  // ── Execute queries in parallel ────────────────────────────────────────────
  const [cities, countries, continents, picks, itineraries, tours] = await Promise.all([
    cityWhere
      ? db.city.findMany({ where: cityWhere, orderBy: { priorityRank: "asc" }, take: 5, select: citySelect })
      : Promise.resolve([]),
    countryWhere
      ? db.country.findMany({ where: countryWhere, take: 5, select: countrySelect })
      : Promise.resolve([]),
    continentWhere
      ? db.continent.findMany({ where: continentWhere, take: 5, select: { id: true, slug: true, name: true } })
      : Promise.resolve([]),
    db.communitySpot.findMany({
      where: pickWhere,
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 5,
      select: pickSelect,
    }),
    tripWhere
      ? db.trip.findMany({ where: tripWhere, orderBy: { viewCount: "desc" }, take: 5, select: itinSelect })
      : Promise.resolve([]),
    db.generatedTour.findMany({ where: tourWhere, take: 5, select: tourSelect }),
  ]);

  // ── Optional global fallback (deduped against scoped results) ──────────────
  const wantFallback = includeFallback && !!scope && !!scopeId;
  let fallback: null | {
    cities: typeof cities;
    countries: typeof countries;
    picks: typeof picks;
    itineraries: typeof itineraries;
    tours: typeof tours;
  } = null;

  if (wantFallback) {
    const exCityIds = (cities as { id: string }[]).map((c) => c.id);
    const exCountryIds = (countries as { id: string }[]).map((c) => c.id);
    const exPickIds = picks.map((p) => p.id);
    const exItinIds = (itineraries as { id: string }[]).map((t) => t.id);
    const exTourIds = tours.map((t) => t.id);

    const [fbCities, fbCountries, fbPicks, fbItins, fbTours] = await Promise.all([
      db.city.findMany({
        where: exCityIds.length > 0 ? { ...cityBase, id: { notIn: exCityIds } } : cityBase,
        orderBy: { priorityRank: "asc" },
        take: 5,
        select: citySelect,
      }),
      db.country.findMany({
        where: exCountryIds.length > 0 ? { ...countryBase, id: { notIn: exCountryIds } } : countryBase,
        take: 5,
        select: countrySelect,
      }),
      db.communitySpot.findMany({
        where: exPickIds.length > 0 ? { ...pickBase, id: { notIn: exPickIds } } : pickBase,
        orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
        take: 5,
        select: pickSelect,
      }),
      db.trip.findMany({
        where: exItinIds.length > 0 ? { ...tripBase, id: { notIn: exItinIds } } : tripBase,
        orderBy: { viewCount: "desc" },
        take: 5,
        select: itinSelect,
      }),
      db.generatedTour.findMany({
        where: exTourIds.length > 0 ? { ...tourBase, id: { notIn: exTourIds } } : tourBase,
        take: 5,
        select: tourSelect,
      }),
    ]);

    fallback = {
      cities: fbCities,
      countries: fbCountries,
      picks: fbPicks,
      itineraries: fbItins,
      tours: fbTours,
    };
  }

  // ── Shape and return ───────────────────────────────────────────────────────
  function shapeCities(arr: typeof cities) {
    return (arr as typeof cities).map((c) => ({
      id: c.id, slug: c.slug, name: c.name,
      countryName: c.country.name,
      continentSlug: c.country.continent.slug,
      photoUrl: c.photoUrl,
    }));
  }
  function shapeCountries(arr: typeof countries) {
    return (arr as typeof countries).map((c) => ({
      id: c.id, slug: c.slug, name: c.name,
      continentName: c.continent.name,
      continentSlug: c.continent.slug,
      photoUrl: c.photoUrl,
    }));
  }
  function shapePicks(arr: typeof picks) {
    return arr.map((p) => ({
      id: p.id, name: p.name, city: p.city, country: p.country,
      category: p.category, photoUrl: p.photoUrl, shareToken: p.shareToken,
    }));
  }
  function shapeItins(arr: typeof itineraries) {
    return (arr as typeof itineraries).map((t) => ({
      id: t.id, title: t.title, shareToken: t.shareToken,
      destinationCity: t.destinationCity, heroImageUrl: t.heroImageUrl,
    }));
  }
  function shapeTours(arr: typeof tours) {
    return arr.map((t) => ({
      id: t.id, title: t.title, shareToken: t.shareToken,
      destinationCity: t.destinationCity,
      photoUrl: t.stops[0]?.imageUrl ?? null,
    }));
  }

  return NextResponse.json(
    {
      cities: shapeCities(cities),
      countries: shapeCountries(countries),
      continents,
      picks: shapePicks(picks),
      itineraries: shapeItins(itineraries),
      tours: shapeTours(tours),
      fallback: fallback
        ? {
            cities: shapeCities(fallback.cities),
            countries: shapeCountries(fallback.countries),
            continents: [],
            picks: shapePicks(fallback.picks),
            itineraries: shapeItins(fallback.itineraries),
            tours: shapeTours(fallback.tours),
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
