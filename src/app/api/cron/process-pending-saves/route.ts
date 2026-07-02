import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrichSavedItem } from "@/lib/enrich-save";

export const dynamic = "force-dynamic";
// Each enrichSavedItem call can take 10–20 s (OG + geocode + Places + Claude).
// 10 items × 20 s = 200 s worst case; 300 s gives adequate headroom.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only process saves that are:
  //  - genuinely stuck PENDING (not manual_activity display mirrors)
  //  - older than 5 minutes (do not race the create-time attempt)
  //  - not yet at the 3-attempt cap
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);

  const items = await db.savedItem.findMany({
    where: {
      extractionStatus: "PENDING",
      sourceMethod: { not: "manual_activity" },
      savedAt: { lt: cutoff },
      enrichmentAttempts: { lt: 3 },
    },
    select: { id: true, enrichmentAttempts: true, rawTitle: true },
    take: 10,
    orderBy: { savedAt: "asc" },
  });

  console.log(`[process-pending-saves] ${items.length} eligible items`);

  // Idle guard: no genuine-PENDING backlog → make zero Places/enrichment calls this tick.
  if (items.length === 0) {
    return NextResponse.json({ enriched: 0, failed: 0, idle: true });
  }

  let enriched = 0;
  let failed = 0;

  for (const item of items) {
    const nextAttempt = (item.enrichmentAttempts ?? 0) + 1;

    // Increment before calling so an unhandled crash still counts as an attempt.
    await db.savedItem.update({
      where: { id: item.id },
      data: { enrichmentAttempts: { increment: 1 } },
    });

    try {
      // enrichSavedItem writes ENRICHED or FAILED internally on completion.
      await enrichSavedItem(item.id);
      enriched++;
      console.log(`[process-pending-saves] enriched "${item.rawTitle}" (attempt ${nextAttempt})`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[process-pending-saves] failed "${item.rawTitle}" (attempt ${nextAttempt}):`, msg);

      // If enrichSavedItem threw without writing a terminal status (unusual — it normally
      // catches internally), give up after 3 attempts so the item stops polluting PENDING.
      if (nextAttempt >= 3) {
        await db.savedItem.update({
          where: { id: item.id },
          data: { extractionStatus: "ENRICHMENT_FAILED" },
        });
        console.log(`[process-pending-saves] gave up on "${item.rawTitle}" after ${nextAttempt} attempts`);
      }
    }
  }

  return NextResponse.json({ processed: items.length, enriched, failed });
}
