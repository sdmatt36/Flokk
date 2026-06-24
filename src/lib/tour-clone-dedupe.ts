import { db } from "@/lib/db";

// Idempotency guard shared by BOTH tour accept routes (save-from-share-token, save-from-public-id)
// so the two cannot diverge. Returns the id of an existing non-deleted clone this family already
// made from the same source tour, or null. Mirrors the PLACE dedupe convention
// (src/app/api/saves/from-share-token/route.ts), keyed on source-tour provenance instead of title.
export async function findExistingTourClone(
  familyProfileId: string,
  sourceGeneratedTourId: string,
): Promise<string | null> {
  const existing = await db.generatedTour.findFirst({
    where: { familyProfileId, sourceGeneratedTourId, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return existing?.id ?? null;
}
