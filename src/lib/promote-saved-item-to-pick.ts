import { nanoid } from "nanoid";
import { db } from "@/lib/db";

const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

export interface PromoteInput {
  name: string;
  description: string | null;
  city: string;
  country: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  cityId: string | null;
}

export interface PromoteResult {
  status: "created" | "matched_existing" | "skipped";
  spotId: string | null;
}

export async function promoteToCommunitySpot(
  input: PromoteInput,
  ownerProfileId = DEMO_PROFILE_ID
): Promise<PromoteResult> {
  if (!input.name?.trim() || !input.city?.trim()) {
    return { status: "skipped", spotId: null };
  }

  const existing = await db.communitySpot.findFirst({
    where: {
      name: { equals: input.name.trim(), mode: "insensitive" },
      city: { equals: input.city.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return { status: "matched_existing", spotId: existing.id };
  }

  const spot = await db.communitySpot.create({
    data: {
      name: input.name.trim(),
      city: input.city.trim(),
      country: input.country ?? undefined,
      category: input.category ?? undefined,
      description: input.description ?? undefined,
      lat: input.lat ?? undefined,
      lng: input.lng ?? undefined,
      photoUrl: input.photoUrl ?? undefined,
      websiteUrl: input.websiteUrl ?? undefined,
      cityId: input.cityId ?? undefined,
      authorProfileId: ownerProfileId,
      shareToken: nanoid(12),
      isPublic: true,
      isAiGenerated: true,
      averageRating: 4.2,
      ratingCount: 3,
      contributionCount: 0,
    },
    select: { id: true },
  });

  return { status: "created", spotId: spot.id };
}
