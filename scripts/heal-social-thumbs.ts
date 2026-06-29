// Heal raw Instagram/TikTok CDN thumbnails (SavedItem.mediaThumbnailUrl) — relocate the SAME
// image to our durable storage while the CDN URL is still alive. No re-fetch-by-id exists for a
// social thumbnail, so this is best-effort: alive URL -> durable supabase URL; dead (403 / fetch
// fail) -> SKIP, leave the existing value (the client onError shows the placeholder). A
// non-durable URL is never written. Live rows only (deletedAt IS NULL). Default = dry run.
//
//   npx tsx scripts/heal-social-thumbs.ts            # dry run
//   npx tsx scripts/heal-social-thumbs.ts --apply    # write durable thumbnails

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const DURABLE = "supabase.co/storage";

async function main() {
  const { db } = await import("@/lib/db");
  const { toDurableImageUrl } = await import("@/lib/imageStore");

  const rows = await db.savedItem.findMany({
    where: {
      deletedAt: null,
      OR: [
        { mediaThumbnailUrl: { contains: "cdninstagram" } },
        { mediaThumbnailUrl: { contains: "tiktokcdn" } },
      ],
    },
    select: { id: true, mediaThumbnailUrl: true, placePhotoUrl: true },
  });

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}  |  IG/TikTok raw thumbnails (live): ${rows.length}\n`);

  let aliveCritical = 0, aliveCovered = 0, deadCritical = 0, deadCovered = 0, updated = 0;

  for (const r of rows) {
    const critical = r.placePhotoUrl == null;
    const durable = r.mediaThumbnailUrl ? await toDurableImageUrl(r.mediaThumbnailUrl) : null;
    const alive = !!durable && durable.includes(DURABLE);

    if (alive) {
      if (critical) aliveCritical++; else aliveCovered++;
      if (APPLY) {
        await db.savedItem.update({ where: { id: r.id }, data: { mediaThumbnailUrl: durable } });
        updated++;
      }
    } else {
      if (critical) deadCritical++; else deadCovered++;
    }
  }

  const aliveTotal = aliveCritical + aliveCovered;
  const deadTotal = deadCritical + deadCovered;
  console.log("Result (alive = durified / dead = skipped, left on raw):");
  console.log(`  display-critical (no placePhotoUrl): alive=${aliveCritical}  dead=${deadCritical}`);
  console.log(`  covered (has placePhotoUrl):         alive=${aliveCovered}  dead=${deadCovered}`);
  console.log(`  TOTAL: alive=${aliveTotal}  dead=${deadTotal}  of ${rows.length}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write durable thumbnails.");
    return;
  }

  console.log(`\nAPPLIED: updated=${updated}`);
  const left = await db.savedItem.count({
    where: {
      deletedAt: null,
      OR: [
        { mediaThumbnailUrl: { contains: "cdninstagram" } },
        { mediaThumbnailUrl: { contains: "tiktokcdn" } },
      ],
    },
  });
  const leftCritical = await db.savedItem.count({
    where: {
      deletedAt: null,
      placePhotoUrl: null,
      OR: [
        { mediaThumbnailUrl: { contains: "cdninstagram" } },
        { mediaThumbnailUrl: { contains: "tiktokcdn" } },
      ],
    },
  });
  console.log(`Re-check (raw IG/TikTok thumbnails remaining, live): total=${left}  display-critical=${leftCritical}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
