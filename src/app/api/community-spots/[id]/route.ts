import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { isAdmin } from "@/lib/admin";
import { normalizeCategorySlug } from "@/lib/categories";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const spot = await db.communitySpot.findUnique({
    where: { id },
    include: { author: { select: { familyName: true } } },
  });
  if (!spot || !spot.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    spot: {
      id: spot.id,
      name: spot.name,
      city: spot.city,
      country: spot.country ?? null,
      photoUrl: spot.photoUrl ?? null,
      category: spot.category ?? null,
      description: spot.description ?? null,
      averageRating: spot.averageRating ?? null,
      ratingCount: spot.ratingCount,
      websiteUrl: spot.websiteUrl ?? null,
      lat: spot.lat ?? null,
      lng: spot.lng ?? null,
      shareToken: spot.shareToken ?? null,
      contributorName: spot.author?.familyName ?? null,
    },
  });
}

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = ["name", "city", "category", "description", "photoUrl", "websiteUrl"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.communitySpot.findUnique({
    where: { id },
    select: { id: true, websiteUrl: true, needsUrlReview: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorize: admin OR contributor
  const admin = await isAdmin(userId);
  if (!admin) {
    const profileId = await resolveProfileId(userId);
    if (!profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const contrib = await db.spotContribution.findUnique({
      where: {
        communitySpotId_familyProfileId: {
          communitySpotId: id,
          familyProfileId: profileId,
        },
      },
      select: { id: true },
    });
    if (!contrib) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build update data — only keys actually present in body
  const data: Record<string, string | boolean | null> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const v = (body as Record<EditableField, unknown>)[field];
    if (typeof v !== "string" && v !== null) continue;
    const cleaned = typeof v === "string" ? v.trim() : null;
    const rawValue = cleaned === "" ? null : cleaned;
    data[field] = field === "category" ? (normalizeCategorySlug(rawValue) ?? rawValue) : rawValue;
  }

  // Auto-clear needsUrlReview when websiteUrl transitions from empty → non-empty
  const hadNoUrl = !existing.websiteUrl || existing.websiteUrl.trim() === "";
  const newUrl = data.websiteUrl;
  if (existing.needsUrlReview && hadNoUrl && typeof newUrl === "string" && newUrl.length > 0) {
    data.needsUrlReview = false;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const updated = await db.communitySpot.update({
    where: { id },
    data,
  });

  return NextResponse.json({ spot: updated });
}
