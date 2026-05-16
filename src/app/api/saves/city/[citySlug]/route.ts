import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

const IMPORT_SOURCE_METHODS = ["maps_import"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ citySlug: string }> }
) {
  try {
    const { citySlug } = await params;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") ?? "imports";
    // token param means public share request — no auth required
    const token = searchParams.get("token");

    let profileId: string | null = null;

    if (token) {
      const share = await db.cityShare.findUnique({
        where: { token },
        select: { ownerProfileId: true, citySlug: true, scope: true },
      });
      if (!share || share.citySlug !== citySlug) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      profileId = share.ownerProfileId;
      // Override scope from the share record
      const effectiveScope = share.scope;
      return fetchSaves(citySlug, profileId, effectiveScope);
    }

    // Authenticated path
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ saves: [] });
    }

    return fetchSaves(citySlug, profileId, scope);
  } catch (error) {
    console.error("[GET /api/saves/city/[citySlug]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchSaves(citySlug: string, profileId: string, scope: string) {
  // Resolve city
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, name: true, heroPhotoUrl: true, photoUrl: true },
  });

  const cityFilter =
    city
      ? { OR: [{ cityId: city.id }, { AND: [{ cityId: null }, { destinationCity: city.name }] }] }
      : { destinationCity: citySlug }; // fallback: slug as name string

  const sourceFilter =
    scope === "imports"
      ? { sourceMethod: { in: IMPORT_SOURCE_METHODS } }
      : {};

  const saves = await db.savedItem.findMany({
    where: {
      familyProfileId: profileId,
      deletedAt: null,
      ...cityFilter,
      ...sourceFilter,
    },
    orderBy: { savedAt: "desc" },
    select: {
      id: true,
      rawTitle: true,
      placePhotoUrl: true,
      mediaThumbnailUrl: true,
      destinationCity: true,
      destinationCountry: true,
      categoryTags: true,
      sourceMethod: true,
      sourcePlatform: true,
      websiteUrl: true,
      mapsUrl: true,
      sourceUrl: true,
      lat: true,
      lng: true,
      userRating: true,
      savedAt: true,
      tripId: true,
      dayIndex: true,
      needsPlaceConfirmation: true,
      communitySpotId: true,
      isBooked: true,
      trip: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    city: city
      ? { name: city.name, slug: citySlug, photoUrl: city.heroPhotoUrl ?? city.photoUrl ?? null }
      : { name: citySlug, slug: citySlug, photoUrl: null },
    saves,
    scope,
  });
}
