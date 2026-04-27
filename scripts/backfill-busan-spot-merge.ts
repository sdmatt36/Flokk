// scripts/backfill-busan-spot-merge.ts
// Phase 2 of Chat 39 city attribution fix.
//
// During the Korea trip (Mar 29–Apr 6 2026, destinationCity="Seoul"), rating Busan-leg
// ManualActivity items triggered writeThroughCommunitySpot with city="Seoul" (fallback
// from trip.destinationCity). The (name, city) dedup key failed to match existing Busan
// rows, creating 7 duplicate Seoul-tagged CommunitySpot rows for Busan landmarks.
//
// For each wrong-Seoul / correct-Busan pair:
//   1. SpotContribution rows: if the Busan row already has a contribution from the same
//      family (conflict), delete the Seoul duplicate. Otherwise reassign it.
//   2. SavedItem.communitySpotId redirected to the correct Busan CommunitySpot.
//   3. Busan CommunitySpot aggregates recomputed from surviving contributions.
//   4. Wrong Seoul CommunitySpot row deleted.
//
// Each pair is processed in an atomic transaction. Script is idempotent —
// pairs where the wrong row no longer exists are skipped silently.
//
// Usage:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/backfill-busan-spot-merge.ts --dry-run
//   npx tsx --tsconfig tsconfig.scripts.json scripts/backfill-busan-spot-merge.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MERGE_PAIRS: Array<{ wrongId: string; correctId: string; name: string }> = [
  {
    wrongId: "cmo531cwl0016lrrqx1crcykv",
    correctId: "cmo45nu5c000yzx8nohpy2mbz",
    name: "Lotte Giants Baseball Game",
  },
  {
    wrongId: "cmo531gfq0019lrrqqj7qg93h",
    correctId: "cmo45nwbm0012zx8nuir7emlz",
    name: "Haeundae Traditional Market",
  },
  {
    wrongId: "cmo531oql001elrrq0o0u8f5p",
    correctId: "cmo45o4ve001izx8nbiictv8r",
    name: "Cloud Mipo",
  },
  {
    wrongId: "cmo531sj7001hlrrq57jqa4jy",
    correctId: "cmo45o69u001kzx8n0fuzcfdr",
    name: "Sam Ryan's South Korea",
  },
  {
    wrongId: "cmo5327ya001plrrqv7665nl4",
    correctId: "cmo45ods2001yzx8nd93gzzze",
    name: "Gamcheon Culture Village",
  },
  {
    wrongId: "cmo532awh001slrrq92vx149k",
    correctId: "cmo45obnp001uzx8ndxjiplvs",
    name: "Busan X The Sky",
  },
  {
    wrongId: "cmo532drz001vlrrqul3vpj1c",
    correctId: "cmo45ofwp0022zx8n9skt3ov6",
    name: "Haeundae Beach",
  },
];

async function recomputeAggregates(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  spotId: string
): Promise<void> {
  const contributions = await tx.spotContribution.findMany({
    where: { communitySpotId: spotId },
    select: { rating: true },
  });
  const ratingCount = contributions.filter((c) => c.rating != null).length;
  const contributionCount = contributions.length;
  const averageRating =
    ratingCount > 0
      ? contributions
          .filter((c) => c.rating != null)
          .reduce((sum, c) => sum + (c.rating as number), 0) / ratingCount
      : null;
  await tx.communitySpot.update({
    where: { id: spotId },
    data: { averageRating, ratingCount, contributionCount },
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "DRY RUN — no writes" : "LIVE RUN — writes will be committed");
  console.log(`Processing ${MERGE_PAIRS.length} pairs.\n`);

  let skipped = 0;
  let aborted = 0;
  let merged = 0;

  for (const pair of MERGE_PAIRS) {
    console.log(`=== ${pair.name} ===`);
    console.log(`  wrong (Seoul): ${pair.wrongId}`);
    console.log(`  correct (Busan): ${pair.correctId}`);

    const [wrong, correct] = await Promise.all([
      prisma.communitySpot.findUnique({ where: { id: pair.wrongId } }),
      prisma.communitySpot.findUnique({ where: { id: pair.correctId } }),
    ]);

    if (!wrong) {
      console.log("  SKIP: wrong row no longer exists (already cleaned up)\n");
      skipped++;
      continue;
    }
    if (!correct) {
      console.log("  ABORT: correct Busan row missing — manual review required\n");
      aborted++;
      continue;
    }
    if (wrong.city !== "Seoul") {
      console.log(`  SKIP: wrong row city is now "${wrong.city}" (already fixed?)\n`);
      skipped++;
      continue;
    }
    if (correct.city !== "Busan") {
      console.log(`  ABORT: correct row city is "${correct.city}", expected "Busan" — manual review\n`);
      aborted++;
      continue;
    }

    // Analyse each SpotContribution on the wrong row
    const wrongContribs = await prisma.spotContribution.findMany({
      where: { communitySpotId: pair.wrongId },
      select: { id: true, familyProfileId: true, rating: true, note: true },
    });

    const savedCount = await prisma.savedItem.count({ where: { communitySpotId: pair.wrongId } });

    let deleteCount = 0;
    let reassignCount = 0;

    for (const contrib of wrongContribs) {
      const busonAlreadyHas = await prisma.spotContribution.findFirst({
        where: { communitySpotId: pair.correctId, familyProfileId: contrib.familyProfileId },
        select: { id: true },
      });
      if (busonAlreadyHas) {
        deleteCount++;
        console.log(`  contrib ${contrib.id}: CONFLICT (Busan already has family ${contrib.familyProfileId}) → delete wrong`);
      } else {
        reassignCount++;
        console.log(`  contrib ${contrib.id}: no conflict → reassign to Busan`);
      }
    }
    console.log(`  ${savedCount} SavedItem row(s) to redirect`);

    if (dryRun) {
      console.log("  (dry-run — skipping writes)\n");
      continue;
    }

    // Live: atomic transaction per pair
    await prisma.$transaction(async (tx) => {
      for (const contrib of wrongContribs) {
        const busanAlreadyHas = await tx.spotContribution.findFirst({
          where: { communitySpotId: pair.correctId, familyProfileId: contrib.familyProfileId },
          select: { id: true },
        });
        if (busanAlreadyHas) {
          await tx.spotContribution.delete({ where: { id: contrib.id } });
        } else {
          await tx.spotContribution.update({
            where: { id: contrib.id },
            data: { communitySpotId: pair.correctId },
          });
        }
      }

      // Redirect SavedItem foreign keys
      await tx.savedItem.updateMany({
        where: { communitySpotId: pair.wrongId },
        data: { communitySpotId: pair.correctId },
      });

      // Recompute Busan spot aggregates from surviving contributions
      await recomputeAggregates(tx as Parameters<typeof recomputeAggregates>[0], pair.correctId);

      // Delete the wrong Seoul stub
      await tx.communitySpot.delete({ where: { id: pair.wrongId } });
    });

    merged++;
    console.log("  merged + deleted\n");
  }

  console.log("─".repeat(40));
  console.log(`Done. merged=${merged} skipped=${skipped} aborted=${aborted}`);

  if (aborted > 0) {
    console.error(`\n${aborted} pair(s) aborted — manual review required.`);
    process.exit(1);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
