import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveShareToken } from "@/lib/share-token";
import { db } from "@/lib/db";
import { enrichSavedItem } from "@/lib/enrich-save";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const entity = await resolveShareToken(token);
  if (!entity) return NextResponse.json({ error: "Share link not found or expired" }, { status: 404 });

  let title: string | null = null;
  let city: string | null = null;
  let country: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let placePhotoUrl: string | null = null;
  let websiteUrl: string | null = null;
  let description: string | null = null;
  let tags: string[] = [];

  if (entity.entityType === "saved_item" && entity.savedItem) {
    const s = entity.savedItem;
    title = s.rawTitle;
    city = s.destinationCity;
    country = s.destinationCountry;
    lat = s.lat;
    lng = s.lng;
    placePhotoUrl = s.placePhotoUrl;
    websiteUrl = s.websiteUrl ?? s.sourceUrl ?? null;
    description = s.rawDescription;
    tags = s.categoryTags;
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    const it = entity.itineraryItem;
    // FLIGHT/TRAIN: no save CTA — should not reach here, but guard anyway
    if (it.type === "FLIGHT" || it.type === "TRAIN") {
      return NextResponse.json({ error: "Cannot save transit items" }, { status: 400 });
    }
    const ps = it.parallelSavedItem;
    title = ps?.rawTitle ?? it.title;
    lat = it.latitude;
    lng = it.longitude;
    placePhotoUrl = ps?.placePhotoUrl ?? null;
    websiteUrl = ps?.websiteUrl ?? it.venueUrl ?? null;
    description = ps?.rawDescription ?? it.notes ?? null;
    tags = ps?.categoryTags ?? [];
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    const a = entity.manualActivity;
    title = a.title;
    city = a.city;
    lat = a.lat;
    lng = a.lng;
    websiteUrl = a.website;
    description = a.notes;
  } else {
    return NextResponse.json({ error: "Use /api/tours/save-from-share-token for tours" }, { status: 400 });
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Could not determine title from shared item" }, { status: 400 });
  }

  // Dedup by title within this family
  const existing = await db.savedItem.findFirst({
    where: {
      familyProfileId: profileId,
      rawTitle: { equals: title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ saved: false, duplicate: true });
  }

  const created = await db.savedItem.create({
    data: {
      familyProfileId: profileId,
      rawTitle: title.trim(),
      rawDescription: description ?? null,
      destinationCity: city ?? null,
      destinationCountry: country ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      placePhotoUrl: placePhotoUrl ?? null,
      websiteUrl: websiteUrl ?? null,
      sourceMethod: "IN_APP_SAVE",
      sourcePlatform: "direct",
      status: "UNORGANIZED",
      extractionStatus: tags.length > 0 ? "ENRICHED" : "PENDING",
      categoryTags: normalizeAndDedupeCategoryTags(tags),
    },
  });

  if (tags.length === 0) {
    enrichSavedItem(created.id).catch(e => console.error("[from-share-token] enrichSavedItem failed:", e));
  }

  return NextResponse.json({ saved: true }, { status: 201 });
}
