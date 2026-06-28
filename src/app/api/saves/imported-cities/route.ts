import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getCityImageUrl } from "@/lib/city-image";

// Map Saves = maps_import only (Matt's decision). Kept in sync with the contents endpoint
// GET /api/saves/city/[citySlug] (scope=imports), which also filters maps_import only and
// buckets a save by cityId (when present) else the City whose name == destinationCity.
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

    // Map Saves only — maps_import. Mirrors the contents endpoint's source filter.
    const saves = await db.savedItem.findMany({
      where: {
        familyProfileId: profileId,
        deletedAt: null,
        sourceMethod: "maps_import",
      },
      select: {
        cityId: true,
        destinationCity: true,
        city: { select: { id: true, name: true, slug: true, heroPhotoUrl: true, photoUrl: true } },
      },
    });

    // Resolve each save to its BUCKET CITY using the SAME logic as the contents endpoint:
    // cityId when present (→ that City's name), else the raw destinationCity string. This is the
    // inverse of the contents filter `cityId == city.id OR (cityId null AND destinationCity == city.name)`,
    // so a save counts in exactly the wrapper whose contents include it. Key by City.id when known,
    // else by name so cityId-set and cityId-null saves for the same place merge into one bucket.
    const map = new Map<
      string,
      { cityName: string; citySlug: string | null; photoUrl: string | null; count: number }
    >();

    for (const s of saves) {
      const bucketName = s.city?.name ?? s.destinationCity;
      if (!bucketName) continue; // no cityId and no destinationCity — not bucketable
      const key = s.city?.id ?? `name:${bucketName}`;
      const entry = map.get(key);
      if (!entry) {
        map.set(key, {
          cityName: bucketName,
          citySlug: s.city?.slug ?? null,
          photoUrl: getCityImageUrl(s.city?.heroPhotoUrl, s.city?.photoUrl),
          count: 1,
        });
      } else {
        entry.count++;
        if (!entry.citySlug && s.city?.slug) entry.citySlug = s.city.slug;
        if (!entry.photoUrl && s.city) {
          const resolved = getCityImageUrl(s.city.heroPhotoUrl, s.city.photoUrl);
          if (resolved) entry.photoUrl = resolved;
        }
      }
    }

    // Batch-resolve City rows for name-only buckets (no save had a cityId) still missing slug/photo.
    const needsLookup = [...map.values()].filter((v) => !v.photoUrl || !v.citySlug);
    if (needsLookup.length > 0) {
      const names = needsLookup.map((v) => v.cityName);
      const cityRows = await db.city.findMany({
        where: { OR: names.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })) },
        select: { name: true, slug: true, heroPhotoUrl: true, photoUrl: true },
      });
      const byNameLower = new Map(cityRows.map((c) => [c.name.toLowerCase(), c]));
      for (const v of map.values()) {
        if (!v.photoUrl || !v.citySlug) {
          const row = byNameLower.get(v.cityName.toLowerCase());
          if (row) {
            if (!v.citySlug) v.citySlug = row.slug;
            if (!v.photoUrl) v.photoUrl = getCityImageUrl(row.heroPhotoUrl, row.photoUrl);
          }
        }
      }
    }

    // importCount == allCount now (Map Saves are maps_import only); both kept for response shape.
    const cities = [...map.values()]
      .map((v) => ({ cityName: v.cityName, citySlug: v.citySlug, photoUrl: v.photoUrl, importCount: v.count, allCount: v.count }))
      .sort((a, b) => b.importCount - a.importCount);

    return NextResponse.json({ cities });
  } catch (error) {
    console.error("[GET /api/saves/imported-cities]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
