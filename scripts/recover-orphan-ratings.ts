// =============================================================================
// recover-orphan-ratings.ts
// Recovers orphaned PlaceRating rows (both FKs null) onto SavedItem.userRating,
// then hard-deletes the orphans.
//
// FIELD CORRECTIONS vs. prompt spec:
//   SavedItem.sourceType — required enum field (no default); using SourceType.IN_APP for new rows
//   SavedItem has both .notes and .userNote — using .notes per prompt spec
//   PlaceRating already has savedItemId String? column (noted for future FK fix, not used here)
//   PlaceRating.notes — notes field (nullable), not userNote
//
// USAGE:
//   npx tsx scripts/recover-orphan-ratings.ts --dry-run   (default, safe)
//   npx tsx scripts/recover-orphan-ratings.ts --live       (writes to DB)
// =============================================================================

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient, SourceType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizePlaceName as cleanVenueName } from "../src/lib/google-places";

// ── Env ───────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in .env.local — cannot proceed.");
  process.exit(1);
}

// ── Mode ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const isLive = argv.includes("--live");
if (!argv.includes("--live") && !argv.includes("--dry-run")) {
  console.warn(
    "\n⚠️  WARNING: No mode flag provided — defaulting to --dry-run. Pass --live to write to DB.\n"
  );
}
console.log(`\nMode: ${isLive ? "LIVE (will write to DB)" : "DRY RUN (read-only)"}\n`);

// ── Prisma ────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrphanRating {
  id: string;
  familyProfileId: string;
  familyName: string | null;
  placeName: string;
  rating: number;
  notes: string | null;
  createdAt: Date;
  tripId: string | null;
}

interface SavedItemRecord {
  id: string;
  familyProfileId: string;
  rawTitle: string | null;
  userRating: number | null;
  notes: string | null;
}

type ActionKind = "UPDATE" | "OVERWRITE" | "CREATE" | "DISCARD";

interface RecoveryAction {
  kind: ActionKind;
  orphan: OrphanRating;
  savedItemId?: string;       // for UPDATE/OVERWRITE
  savedItemTitle?: string;    // for UPDATE/OVERWRITE display
  existingRating?: number;    // for OVERWRITE display
  existingNotes?: string | null; // pre-loaded so no findUnique needed inside transaction
}

interface FamilyPlan {
  familyProfileId: string;
  familyName: string;
  orphans: OrphanRating[];
  keepers: OrphanRating[];          // after dedup (one per fuzzyKey)
  duplicateIds: string[];           // ids to delete (losers of dedup)
  dupeSummary: string[];            // human-readable dedup log lines
  actions: RecoveryAction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fuzzyKey(name: string): string {
  if (!name) return "";
  const cleaned = cleanVenueName(name);
  // Unicode decompose, strip combining marks (diacritics)
  const decomposed = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return decomposed.toLowerCase().trim().replace(/\s+/g, " ");
}

function truncate(s: string | null, len: number): string {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── Load all orphaned PlaceRatings across ALL families ────────────────────

  type RawOrphan = {
    id: string;
    familyProfileId: string;
    tripId: string | null;
    placeName: string;
    rating: number;
    notes: string | null;
    createdAt: Date;
    familyProfile: { id: string; familyName: string | null };
  };

  const rawOrphans = await prisma.placeRating.findMany({
    where: { itineraryItemId: null, manualActivityId: null },
    include: { familyProfile: { select: { id: true, familyName: true } } },
    orderBy: [{ familyProfileId: "asc" }, { createdAt: "asc" }],
  }) as RawOrphan[];

  const orphans: OrphanRating[] = rawOrphans.map((r) => ({
    id: r.id,
    familyProfileId: r.familyProfileId,
    familyName: r.familyProfile.familyName,
    placeName: r.placeName,
    rating: r.rating,
    notes: r.notes,
    createdAt: r.createdAt,
    tripId: r.tripId,
  }));

  if (orphans.length === 0) {
    console.log("No orphaned PlaceRating rows found. Nothing to do.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // ── Group by family ───────────────────────────────────────────────────────

  const byFamily = new Map<string, OrphanRating[]>();
  for (const o of orphans) {
    if (!byFamily.has(o.familyProfileId)) byFamily.set(o.familyProfileId, []);
    byFamily.get(o.familyProfileId)!.push(o);
  }

  // ── Build plan for each family ────────────────────────────────────────────

  const familyPlans: FamilyPlan[] = [];

  for (const [familyProfileId, familyOrphans] of byFamily) {
    const familyName = familyOrphans[0].familyName ?? familyProfileId;
    const dupeSummary: string[] = [];
    const duplicateIds: string[] = [];

    // PHASE A — DEDUPLICATE within family by fuzzyKey(placeName)
    const groupsByKey = new Map<string, OrphanRating[]>();
    for (const o of familyOrphans) {
      const key = fuzzyKey(o.placeName);
      if (!groupsByKey.has(key)) groupsByKey.set(key, []);
      groupsByKey.get(key)!.push(o);
    }

    const keepers: OrphanRating[] = [];
    for (const [, group] of groupsByKey) {
      if (group.length === 1) {
        keepers.push(group[0]);
        continue;
      }
      // Keep: prefer row with notes; tiebreak by most recent createdAt
      const sorted = [...group].sort((a, b) => {
        const aNotes = a.notes ? 1 : 0;
        const bNotes = b.notes ? 1 : 0;
        if (bNotes !== aNotes) return bNotes - aNotes; // notes first
        return b.createdAt.getTime() - a.createdAt.getTime(); // most recent first
      });
      const keeper = sorted[0];
      const losers = sorted.slice(1);
      keepers.push(keeper);
      for (const l of losers) duplicateIds.push(l.id);
      const cleanedName = cleanVenueName(group[0].placeName);
      dupeSummary.push(
        `  DEDUP: '${cleanedName}' — ${group.length} rows, keeping ${keeper.id}` +
          (keeper.notes ? ` (has note)` : ` (most recent)`) +
          `, deleting ${losers.length} other${losers.length > 1 ? "s" : ""}`
      );
    }

    // PHASE B — LOAD CANDIDATE SAVEDITEMS for this family
    const savedItems = await prisma.savedItem.findMany({
      where: { familyProfileId },
      select: { id: true, familyProfileId: true, rawTitle: true, userRating: true, notes: true },
    }) as SavedItemRecord[];

    const savedItemByKey = new Map<string, SavedItemRecord>();
    for (const si of savedItems) {
      if (si.rawTitle) {
        savedItemByKey.set(fuzzyKey(si.rawTitle), si);
      }
    }

    // PHASE C — MATCH keepers to SavedItems
    const actions: RecoveryAction[] = [];
    for (const keeper of keepers) {
      const key = fuzzyKey(keeper.placeName);
      const match = savedItemByKey.get(key);

      if (match) {
        if (match.userRating === null) {
          actions.push({ kind: "UPDATE", orphan: keeper, savedItemId: match.id, savedItemTitle: match.rawTitle ?? undefined, existingNotes: match.notes });
        } else if (match.userRating === keeper.rating) {
          // Already correct — still delete the orphan, no update needed
          actions.push({ kind: "UPDATE", orphan: keeper, savedItemId: match.id, savedItemTitle: match.rawTitle ?? undefined, existingNotes: match.notes });
        } else {
          // Differs — orphan is more recent user intent
          actions.push({ kind: "OVERWRITE", orphan: keeper, savedItemId: match.id, savedItemTitle: match.rawTitle ?? undefined, existingRating: match.userRating, existingNotes: match.notes });
        }
      } else if (keeper.notes !== null) {
        actions.push({ kind: "CREATE", orphan: keeper });
      } else {
        actions.push({ kind: "DISCARD", orphan: keeper });
      }
    }

    familyPlans.push({ familyProfileId, familyName, orphans: familyOrphans, keepers, duplicateIds, dupeSummary, actions });
  }

  // ── REPORT ────────────────────────────────────────────────────────────────

  const totalOrphans = orphans.length;
  const totalFamilies = familyPlans.length;
  let totalUpdates = 0;
  let totalCreates = 0;
  let totalDeletes = 0;

  console.log("═══════════════════════════════════════════════");
  console.log("  ORPHAN PLACERATING RECOVERY —", isLive ? "LIVE" : "DRY RUN");
  console.log("═══════════════════════════════════════════════\n");
  console.log(`Total orphan PlaceRatings found: ${totalOrphans}`);
  console.log(`Unique families affected: ${totalFamilies}\n`);

  for (const plan of familyPlans) {
    const updates = plan.actions.filter(a => a.kind === "UPDATE" || a.kind === "OVERWRITE");
    const creates = plan.actions.filter(a => a.kind === "CREATE");
    const discards = plan.actions.filter(a => a.kind === "DISCARD");
    const deleteCount = plan.duplicateIds.length + plan.keepers.length; // dupes + all keepers (cleaned up after recovery)

    totalUpdates += updates.length;
    totalCreates += creates.length;
    totalDeletes += deleteCount;

    console.log(`── Family: ${plan.familyName} (${plan.familyProfileId}) ──`);
    console.log(`Orphans: ${plan.orphans.length}`);

    if (plan.dupeSummary.length > 0) {
      console.log(`Duplicates to delete: ${plan.duplicateIds.length}`);
      for (const line of plan.dupeSummary) console.log(line);
    } else {
      console.log(`Duplicates to delete: 0`);
    }

    if (updates.length > 0) {
      console.log(`Matched to existing SavedItem (will UPDATE userRating):`);
      for (const a of updates) {
        const overwriteTag = a.kind === "OVERWRITE" ? ` [OVERWRITE: was ${a.existingRating}★]` : "";
        const alreadyTag = (a.kind === "UPDATE" && a.savedItemId) ? "" : "";
        console.log(
          `  '${cleanVenueName(a.orphan.placeName)}' (${a.orphan.rating}★)` +
            ` → '${a.savedItemTitle ?? "?"}' (${a.savedItemId})${overwriteTag}${alreadyTag}`
        );
      }
    } else {
      console.log(`Matched to existing SavedItem (will UPDATE userRating): 0`);
    }

    if (creates.length > 0) {
      console.log(`Unmatched with notes (will CREATE new SavedItem):`);
      for (const a of creates) {
        console.log(
          `  '${cleanVenueName(a.orphan.placeName)}' (${a.orphan.rating}★) — '${truncate(a.orphan.notes, 40)}'`
        );
      }
    } else {
      console.log(`Unmatched with notes (will CREATE new SavedItem): 0`);
    }

    if (discards.length > 0) {
      console.log(`Unmatched without notes (will DISCARD):`);
      for (const a of discards) {
        console.log(`  '${cleanVenueName(a.orphan.placeName)}' (${a.orphan.rating}★)`);
      }
    } else {
      console.log(`Unmatched without notes (will DISCARD): 0`);
    }

    console.log();
  }

  console.log(`── Totals across all families ──`);
  console.log(`SavedItems to UPDATE: ${totalUpdates}`);
  console.log(`SavedItems to CREATE: ${totalCreates}`);
  console.log(`Orphans to DELETE (total, including dupes and discards): ${totalDeletes}`);

  if (!isLive) {
    console.log(`\nRe-run with --live to apply.`);
    console.log("═══════════════════════════════════════════════");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // ── LIVE MODE — execute per-family transactions ───────────────────────────

  console.log("\n═══════════════════════════════════════════════");
  console.log("  APPLYING CHANGES");
  console.log("═══════════════════════════════════════════════\n");

  let liveUpdated = 0;
  let liveCreated = 0;
  let liveDeleted = 0;
  const errors: string[] = [];

  for (const plan of familyPlans) {
    try {
      await prisma.$transaction(async (tx) => {
        // existingNotes pre-loaded in Phase C — no findUnique inside transaction needed

        for (const a of plan.actions) {
          if ((a.kind === "UPDATE" || a.kind === "OVERWRITE") && a.savedItemId) {
            await tx.savedItem.update({
              where: { id: a.savedItemId },
              data: {
                userRating: a.orphan.rating,
                // COALESCE: only write orphan.notes if savedItem.notes is currently null
                notes: a.existingNotes ?? a.orphan.notes ?? undefined,
              },
            });
            liveUpdated++;
          }
        }

        // CREATE new SavedItems for unmatched orphans with notes
        for (const a of plan.actions) {
          if (a.kind === "CREATE") {
            await tx.savedItem.create({
              data: {
                familyProfileId: plan.familyProfileId,
                sourceType: SourceType.IN_APP,
                rawTitle: cleanVenueName(a.orphan.placeName),
                userRating: a.orphan.rating,
                notes: a.orphan.notes,
                savedAt: a.orphan.createdAt,
                // All other fields: nullable or have schema defaults
              },
            });
            liveCreated++;
          }
        }

        // DELETE all orphans (keepers after recovery + duplicates + discards)
        const allOrphanIds = plan.orphans.map((o) => o.id);
        await tx.placeRating.deleteMany({
          where: { id: { in: allOrphanIds } },
        });
        liveDeleted += allOrphanIds.length;
      }, { timeout: 30000 });

      console.log(
        `[${plan.familyName}] Updated ${plan.actions.filter(a => a.kind === "UPDATE" || a.kind === "OVERWRITE").length} SavedItems,` +
          ` created ${plan.actions.filter(a => a.kind === "CREATE").length},` +
          ` deleted ${plan.orphans.length} orphans.`
      );
    } catch (err) {
      const msg = `[${plan.familyName}] TRANSACTION FAILED: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  FINAL SUMMARY");
  console.log("═══════════════════════════════════════════════");
  console.log(`SavedItems updated: ${liveUpdated}`);
  console.log(`SavedItems created: ${liveCreated}`);
  console.log(`Orphan PlaceRatings deleted: ${liveDeleted}`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.error(`  ${e}`);
  } else {
    console.log(`\nNo errors. All families processed successfully.`);
  }
  console.log("═══════════════════════════════════════════════");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
