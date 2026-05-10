import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Normalizes all SavedItem.categoryTags from legacy/variant values to canonical slugs.
// Safe to run multiple times — skips rows where nothing changes.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;

  // Paginate to avoid memory pressure on large libraries
  while (true) {
    const batch = await db.savedItem.findMany({
      where: { categoryTags: { isEmpty: false }, deletedAt: null },
      select: { id: true, categoryTags: true },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;
    scanned += batch.length;

    for (const item of batch) {
      const normalized = normalizeAndDedupeCategoryTags(
        item.categoryTags.map(t => normalizeCategorySlug(t) ?? t)
      );

      const changed =
        normalized.length !== item.categoryTags.length ||
        normalized.some((t, i) => t !== item.categoryTags[i]);

      if (changed) {
        await db.savedItem.update({ where: { id: item.id }, data: { categoryTags: normalized } });
        updated++;
      }
    }
  }

  return NextResponse.json({ scanned, updated });
}
