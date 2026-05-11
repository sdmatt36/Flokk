import { normalizeCategorySlug } from "./categories";

/**
 * Client-side: does the tag array contain the given canonical category slug?
 * Handles pre-normalized tags and any legacy unnormalized values.
 */
export function matchesCategory(tags: string[], slug: string): boolean {
  return tags.some(t => t === slug || normalizeCategorySlug(t) === slug);
}

/**
 * Server-side Prisma WHERE fragment for category filtering.
 * SavedItem uses a categoryTags string array; CommunitySpot uses a scalar category field.
 */
export function buildCategoryFilter(
  slug: string | null,
  entityType: "SavedItem" | "CommunitySpot"
): Record<string, unknown> {
  if (!slug) return {};
  if (entityType === "SavedItem") {
    return { categoryTags: { has: slug } };
  }
  return { category: slug };
}
