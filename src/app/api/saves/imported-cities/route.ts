import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const IMPORT_SOURCE_METHODS = new Set(["maps_import"]);

async function resolveProfileId(userId: string): Promise<string | null> {
  const profile = await db.familyProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

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
      { slug: string | null; photoUrl: string | null; importCount: number; allCount: number }
    >();

    for (const s of saves) {
      const name = s.destinationCity!;
      const isImport = IMPORT_SOURCE_METHODS.has(s.sourceMethod ?? "");
      const entry = map.get(name);
      if (!entry) {
        map.set(name, {
          slug: s.city?.slug ?? null,
          photoUrl: s.city?.heroPhotoUrl ?? s.city?.photoUrl ?? null,
          importCount: isImport ? 1 : 0,
          allCount: 1,
        });
      } else {
        if (isImport) entry.importCount++;
        entry.allCount++;
        // Prefer a city photo once we encounter the City relation
        if (!entry.photoUrl && (s.city?.heroPhotoUrl || s.city?.photoUrl)) {
          entry.photoUrl = s.city?.heroPhotoUrl ?? s.city?.photoUrl ?? null;
        }
        if (!entry.slug && s.city?.slug) {
          entry.slug = s.city.slug;
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
