import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getCityImageUrl } from "@/lib/city-image";

const IMPORT_SOURCE_METHODS = new Set(["maps_import"]);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ cities: [] });
    }

    // Fetch all non-deleted saves with a destinationCity — both import and all sources
    const saves = await db.savedItem.findMany({
      where: {
        familyProfileId: profileId,
        deletedAt: null,
        destinationCity: { not: null },
      },
      select: {
        destinationCity: true,
        sourceMethod: true,
        city: { select: { slug: true, heroPhotoUrl: true, photoUrl: true } },
      },
    });

    // Group by destinationCity tracking both importCount and allCount
    const map = new Map<
      string,
      { citySlug: string | null; photoUrl: string | null; importCount: number; allCount: number }
    >();

    for (const s of saves) {
      const name = s.destinationCity!;
      const isImport = IMPORT_SOURCE_METHODS.has(s.sourceMethod ?? "");
      const entry = map.get(name);
      if (!entry) {
        map.set(name, {
          citySlug: s.city?.slug ?? null,
          photoUrl: getCityImageUrl(s.city?.heroPhotoUrl, s.city?.photoUrl),
          importCount: isImport ? 1 : 0,
          allCount: 1,
        });
      } else {
        if (isImport) entry.importCount++;
        entry.allCount++;
        if (!entry.photoUrl && s.city) {
          const resolved = getCityImageUrl(s.city.heroPhotoUrl, s.city.photoUrl);
          if (resolved) entry.photoUrl = resolved;
        }
        if (!entry.citySlug && s.city?.slug) {
          entry.citySlug = s.city.slug;
        }
      }
    }

    // Batch-resolve City rows for entries still missing photo or slug (common for maps imports
    // where SavedItem.cityId is null, so the city relation returns nothing above).
    const needsLookup = [...map.entries()].filter(([, v]) => !v.photoUrl || !v.citySlug);
    if (needsLookup.length > 0) {
      const names = needsLookup.map(([name]) => name);
      const cityRows = await db.city.findMany({
        where: { OR: names.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })) },
        select: { name: true, slug: true, heroPhotoUrl: true, photoUrl: true },
      });
      const byNameLower = new Map(cityRows.map((c) => [c.name.toLowerCase(), c]));
      for (const [name, entry] of map.entries()) {
        if (!entry.photoUrl || !entry.citySlug) {
          const row = byNameLower.get(name.toLowerCase());
          if (row) {
            if (!entry.citySlug) entry.citySlug = row.slug;
            if (!entry.photoUrl) entry.photoUrl = getCityImageUrl(row.heroPhotoUrl, row.photoUrl);
          }
        }
      }
    }

    // Return only cities that have at least one import, sorted by importCount desc
    const cities = [...map.entries()]
      .filter(([, v]) => v.importCount > 0)
      .map(([cityName, v]) => ({ cityName, ...v }))
      .sort((a, b) => b.importCount - a.importCount);

    return NextResponse.json({ cities });
  } catch (error) {
    console.error("[GET /api/saves/imported-cities]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
