import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { isSaveableBooking } from "../src/lib/booking-saved-item";

type Action =
  | { kind: "skip_not_saveable"; docId: string; label: string; contentType: string | null }
  | { kind: "skip_already_linked"; docId: string; label: string; savedItemId: string }
  | { kind: "link_strict"; docId: string; label: string; vendorName: string; savedItemId: string; drift: { oldTitle: string; newTitle: string } | null }
  | { kind: "link_fallback_with_migration"; docId: string; label: string; vendorName: string; orphanSavedItemId: string; orphanTitle: string; orphanHasRating: boolean; orphanHasNote: boolean }
  | { kind: "create_fresh"; docId: string; label: string; vendorName: string }
  | { kind: "create_fresh_with_orphan_migration"; docId: string; label: string; vendorName: string; orphanSavedItemId: string; orphanTitle: string; orphanHasRating: boolean; orphanHasNote: boolean }
  | { kind: "link_duplicate_booking"; docId: string; label: string; vendorName: string; sharedKey: string };

const SKIP_VENDOR_NAMES = new Set([
  "booking.com", "expedia", "airbnb", "viator", "getyourguide", "agoda",
]);

const ARTICLES = new Set(["the", "a", "an"]);

/**
 * Normalizes a vendor name for matching:
 * 1. Strip unicode diacritics (Hótel -> Hotel)
 * 2. Lowercase + trim
 * 3. Remove punctuation except internal spaces
 * 4. Remove leading articles (the, a, an)
 * 5. Remove trailing tokens that match destination city (Naha, Dubai, etc.)
 * 6. Collapse whitespace
 */
function normalizeName(raw: string | null | undefined, city: string | null): string {
  if (!raw) return "";
  let s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.toLowerCase().trim();
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);
  while (tokens.length > 1 && ARTICLES.has(tokens[0])) tokens.shift();
  const cityNormalized = (city ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (cityNormalized) {
    while (tokens.length > 1 && tokens[tokens.length - 1] === cityNormalized) tokens.pop();
  }
  return tokens.join(" ");
}

/** NFD-normalize a city string for use in dedupe keys */
function normalizeCity(city: string | null): string {
  if (!city) return "";
  return city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const STOP_TOKENS = new Set([
  "the", "a", "an", "of", "and", "at", "in", "on", "to", "for",
  "hotel", "hotels", "inn", "resort", "resorts", "suites",
  "tour", "tours", "trip", "experience",
]);

function firstSignificantWord(normalized: string): string | null {
  const words = normalized.split(" ").filter(w => w.length >= 3);
  for (const w of words) {
    if (!STOP_TOKENS.has(w)) return w;
  }
  return null;
}

function significantWordMatch(a: string, b: string): boolean {
  const aWord = firstSignificantWord(a);
  const bWord = firstSignificantWord(b);
  if (!aWord || !bWord) return false;
  return a.includes(bWord) || b.includes(aWord);
}

/**
 * Register a key in the unified planning map.
 * All keys that will ever be used as sharedKey must be registered here.
 * - dedupeKey (vendor|city|checkIn) for full-match dedup
 * - cityOnlyKey + "|<null-checkin>" for null-checkIn dedup
 * Values during planning: real savedItemId (for strict/fallback) or "PLANNED_"+docId (for create).
 * During live execution, "PLANNED_"+docId → actual ID is resolved via liveIds map.
 */
function registerPlanned(
  map: Map<string, string>,
  vendorNorm: string,
  cityNorm: string,
  checkIn: string | null,
  value: string,
) {
  const dedupeKey = `${vendorNorm}|${cityNorm}|${checkIn ?? ""}`;
  const cityOnlyNullKey = `${vendorNorm}|${cityNorm}|<null-checkin>`;
  map.set(dedupeKey, value);
  map.set(cityOnlyNullKey, value);
}

async function runMain() {
  const LIVE = process.argv.includes("--live");
  console.log(LIVE ? "=== LIVE MODE: mutations will be applied ===" : "=== DRY RUN: no mutations ===");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const docs = await db.tripDocument.findMany({
    where: { type: "booking" },
    select: { id: true, tripId: true, label: true, content: true, savedItemId: true },
  });

  const actions: Action[] = [];

  // Unified map: all sharedKey shapes -> "PLANNED_"+docId or actual savedItemId.
  // Keys: both dedupeKey (vendor|city|checkIn) AND cityOnlyKey|<null-checkin> are stored
  // so link_duplicate_booking sharedKey always resolves with one map.get().
  const plannedSavedItems = new Map<string, string>();

  for (const doc of docs) {
    let parsed: any = null;
    try { parsed = doc.content ? JSON.parse(doc.content) : null; } catch {}
    const contentType = parsed?.type ?? null;
    const vendorName = parsed?.vendorName ?? doc.label ?? "";
    const city = parsed?.city ?? null;
    const confCode = parsed?.confirmationCode ?? null;
    const checkIn = parsed?.checkIn ?? null;

    // Aggregator skip-list check
    const vendorLower = vendorName.trim().toLowerCase();
    if (SKIP_VENDOR_NAMES.has(vendorLower)) {
      actions.push({ kind: "skip_not_saveable", docId: doc.id, label: doc.label, contentType: "aggregator_skip" });
      continue;
    }

    if (!isSaveableBooking(contentType, doc.label)) {
      actions.push({ kind: "skip_not_saveable", docId: doc.id, label: doc.label, contentType });
      continue;
    }
    if (doc.savedItemId) {
      actions.push({ kind: "skip_already_linked", docId: doc.id, label: doc.label, savedItemId: doc.savedItemId });
      continue;
    }

    const trip = await db.trip.findUnique({ where: { id: doc.tripId }, select: { familyProfileId: true } });
    if (!trip) {
      actions.push({ kind: "create_fresh", docId: doc.id, label: doc.label, vendorName: vendorName + " [ORPHAN TRIP]" });
      continue;
    }

    const vendorNorm = normalizeName(vendorName, city);
    const cityNorm = normalizeCity(city);
    const dedupeKey = `${vendorNorm}|${cityNorm}|${checkIn ?? ""}`;
    const cityOnlyNullKey = `${vendorNorm}|${cityNorm}|<null-checkin>`;

    // Full key hit: same vendor + city + checkIn
    if (plannedSavedItems.has(dedupeKey)) {
      actions.push({ kind: "link_duplicate_booking", docId: doc.id, label: doc.label, vendorName, sharedKey: dedupeKey });
      continue;
    }
    // City-only hit: same vendor + city, null checkIn
    if (checkIn === null && plannedSavedItems.has(cityOnlyNullKey)) {
      actions.push({ kind: "link_duplicate_booking", docId: doc.id, label: doc.label, vendorName, sharedKey: cityOnlyNullKey });
      continue;
    }

    // Normalized match against all SavedItems for this profile
    const vendorNormalized = normalizeName(vendorName, city);
    const candidates = await db.savedItem.findMany({
      where: { familyProfileId: trip.familyProfileId },
      select: { id: true, rawTitle: true, destinationCity: true },
    });
    const strict = candidates.find(c => {
      const candidateNormalized = normalizeName(c.rawTitle, c.destinationCity ?? city);
      return candidateNormalized && candidateNormalized === vendorNormalized;
    }) ?? null;

    if (strict) {
      const drift = strict.rawTitle && normalizeName(strict.rawTitle, strict.destinationCity ?? city) !== vendorNormalized
        ? { oldTitle: strict.rawTitle, newTitle: vendorName }
        : null;
      actions.push({ kind: "link_strict", docId: doc.id, label: doc.label, vendorName, savedItemId: strict.id, drift });
      registerPlanned(plannedSavedItems, vendorNorm, cityNorm, checkIn, strict.id);
      continue;
    }

    // Fallback: city + confirmation code via ItineraryItem
    let fallbackOrphan: { id: string; rawTitle: string; hasRating: boolean; hasNote: boolean } | null = null;
    if (city && confCode) {
      const itiItems = await db.itineraryItem.findMany({
        where: { tripId: doc.tripId, confirmationCode: confCode },
        select: { id: true },
      });
      if (itiItems.length > 0) {
        const cityMatches = await db.savedItem.findMany({
          where: {
            familyProfileId: trip.familyProfileId,
            destinationCity: { equals: city, mode: "insensitive" },
            sourceMethod: "URL_PASTE",
          },
          select: { id: true, rawTitle: true, destinationCity: true, userRating: true, userNote: true, notes: true },
        });
        if (cityMatches.length === 1) {
          const m = cityMatches[0];
          if (m.destinationCity) {
            const orphanNorm = normalizeName(m.rawTitle, m.destinationCity);
            const vNorm = normalizeName(vendorName, city);
            if (significantWordMatch(vNorm, orphanNorm)) {
              fallbackOrphan = {
                id: m.id,
                rawTitle: m.rawTitle ?? "",
                hasRating: m.userRating != null,
                hasNote: (m.userNote != null) || (m.notes != null),
              };
            }
          }
        }
      }
    }

    if (fallbackOrphan) {
      actions.push({
        kind: "link_fallback_with_migration",
        docId: doc.id, label: doc.label, vendorName,
        orphanSavedItemId: fallbackOrphan.id,
        orphanTitle: fallbackOrphan.rawTitle,
        orphanHasRating: fallbackOrphan.hasRating,
        orphanHasNote: fallbackOrphan.hasNote,
      });
      registerPlanned(plannedSavedItems, vendorNorm, cityNorm, checkIn, fallbackOrphan.id);
      continue;
    }

    // Check for URL_PASTE orphan with significant-word overlap that has meaningful data.
    let createOrphan: { id: string; rawTitle: string; hasRating: boolean; hasNote: boolean } | null = null;
    if (city) {
      const urlPasteOrphans = await db.savedItem.findMany({
        where: {
          familyProfileId: trip.familyProfileId,
          sourceMethod: "URL_PASTE",
          destinationCity: { equals: city, mode: "insensitive" },
        },
        select: { id: true, rawTitle: true, destinationCity: true, userRating: true, userNote: true, notes: true },
      });
      const vNorm = normalizeName(vendorName, city);
      for (const o of urlPasteOrphans) {
        if (!o.destinationCity) continue;
        const orphanNorm = normalizeName(o.rawTitle, o.destinationCity);
        if (!significantWordMatch(vNorm, orphanNorm)) continue;
        const hasRating = o.userRating != null;
        const hasNote = (o.userNote != null) || (o.notes != null);
        if (!hasRating && !hasNote) continue;
        createOrphan = { id: o.id, rawTitle: o.rawTitle ?? "", hasRating, hasNote };
        break;
      }
    }

    if (createOrphan) {
      actions.push({
        kind: "create_fresh_with_orphan_migration",
        docId: doc.id, label: doc.label, vendorName,
        orphanSavedItemId: createOrphan.id,
        orphanTitle: createOrphan.rawTitle,
        orphanHasRating: createOrphan.hasRating,
        orphanHasNote: createOrphan.hasNote,
      });
      registerPlanned(plannedSavedItems, vendorNorm, cityNorm, checkIn, "PLANNED_" + doc.id);
    } else {
      actions.push({ kind: "create_fresh", docId: doc.id, label: doc.label, vendorName });
      registerPlanned(plannedSavedItems, vendorNorm, cityNorm, checkIn, "PLANNED_" + doc.id);
    }
  }

  // ===== DRY-RUN REPORT =====
  const counts: Record<string, number> = {};
  for (const a of actions) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  console.log("=== PLAN SUMMARY ===");
  console.log(JSON.stringify(counts, null, 2));

  console.log("\n=== skip_not_saveable (no action) ===");
  for (const a of actions.filter(x => x.kind === "skip_not_saveable") as any[]) {
    const tag = a.contentType === "aggregator_skip" ? "AGGREGATOR" : `type: ${a.contentType}`;
    console.log(`  - ${a.label} (${tag})`);
  }

  console.log("\n=== skip_already_linked (no action) ===");
  for (const a of actions.filter(x => x.kind === "skip_already_linked")) {
    console.log(`  - ${(a as any).label} -> ${(a as any).savedItemId}`);
  }

  console.log("\n=== link_strict (link + optional drift overwrite) ===");
  for (const a of actions.filter(x => x.kind === "link_strict") as any[]) {
    const driftNote = a.drift ? `  DRIFT: "${a.drift.oldTitle}" -> "${a.drift.newTitle}"` : "  (no drift)";
    console.log(`  - ${a.label} -> savedItem ${a.savedItemId}\n${driftNote}`);
  }

  console.log("\n=== link_fallback_with_migration (migrate rating/note, delete orphan, create new) ===");
  for (const a of actions.filter(x => x.kind === "link_fallback_with_migration") as any[]) {
    console.log(`  - ${a.label}`);
    console.log(`    orphan: "${a.orphanTitle}" (${a.orphanSavedItemId})`);
    console.log(`    rating: ${a.orphanHasRating ? "YES" : "no"}, note: ${a.orphanHasNote ? "YES" : "no"}`);
  }

  console.log("\n=== link_duplicate_booking (reuse SavedItem from earlier doc in this run) ===");
  for (const a of actions.filter(x => x.kind === "link_duplicate_booking") as any[]) {
    console.log(`  - ${a.label} (shared key: ${a.sharedKey})`);
  }

  console.log("\n=== create_fresh_with_orphan_migration (create new, migrate rating/note from URL_PASTE, delete orphan) ===");
  for (const a of actions.filter(x => x.kind === "create_fresh_with_orphan_migration") as any[]) {
    console.log(`  - ${a.label}`);
    console.log(`    orphan: "${a.orphanTitle}" (${a.orphanSavedItemId})`);
    console.log(`    rating: ${a.orphanHasRating ? "YES" : "no"}, note: ${a.orphanHasNote ? "YES" : "no"}`);
  }

  console.log("\n=== create_fresh (new SavedItem, no existing data) ===");
  for (const a of actions.filter(x => x.kind === "create_fresh") as any[]) {
    console.log(`  - ${a.label} in ${a.vendorName}`);
  }

  console.log(`\n=== TOTAL: ${actions.length} TripDocuments analyzed ===`);

  if (!LIVE) {
    await pool.end();
    return;
  }

  // ===== LIVE EXECUTION =====
  console.log("\n\n=== EXECUTING LIVE ===\n");

  const { createBookingSavedItem } = await import("../src/lib/booking-saved-item");

  // Maps "PLANNED_"+planDocId -> actual savedItemId created during this run.
  // Used to resolve dedupeKey lookups for link_duplicate_booking that follow a create_fresh.
  const liveIds = new Map<string, string>();

  function resolveSharedKey(sharedKey: string): string | null {
    const v = plannedSavedItems.get(sharedKey);
    if (!v) return null;
    if (v.startsWith("PLANNED_")) return liveIds.get(v) ?? null;
    return v;
  }

  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ action: Action; error: string }> = [];

  for (const a of actions) {
    try {
      if (a.kind === "skip_not_saveable" || a.kind === "skip_already_linked") {
        continue;
      }

      if (a.kind === "link_strict") {
        if (a.drift) {
          await db.savedItem.update({
            where: { id: a.savedItemId },
            data: { rawTitle: a.drift.newTitle },
          });
          console.log(`[strict+drift] TripDocument ${a.docId} -> savedItem ${a.savedItemId} (title: "${a.drift.oldTitle}" -> "${a.drift.newTitle}")`);
        }
        await db.tripDocument.update({
          where: { id: a.docId },
          data: { savedItemId: a.savedItemId },
        });
        if (!a.drift) console.log(`[strict] TripDocument ${a.docId} -> savedItem ${a.savedItemId}`);
        succeeded++;
        continue;
      }

      if (a.kind === "link_fallback_with_migration") {
        // Not produced by current plan, but handle for completeness.
        console.log(`[fallback_migrate] No plan entries expected — skipping ${a.docId}.`);
        continue;
      }

      if (a.kind === "link_duplicate_booking") {
        const resolvedId = resolveSharedKey(a.sharedKey);
        if (!resolvedId) {
          throw new Error(`link_duplicate_booking: could not resolve savedItemId for key "${a.sharedKey}"`);
        }
        await db.tripDocument.update({
          where: { id: a.docId },
          data: { savedItemId: resolvedId },
        });
        console.log(`[duplicate] TripDocument ${a.docId} -> reuses savedItem ${resolvedId} (key: ${a.sharedKey})`);
        succeeded++;
        continue;
      }

      if (a.kind === "create_fresh" || a.kind === "create_fresh_with_orphan_migration") {
        // Re-fetch to guard against already-linked race
        const freshDoc = await db.tripDocument.findUnique({
          where: { id: a.docId },
          select: { id: true, tripId: true, label: true, content: true, savedItemId: true },
        });
        if (!freshDoc || freshDoc.savedItemId) {
          console.log(`[skip] TripDocument ${a.docId} already linked or missing — skipping`);
          continue;
        }
        let parsed: any = null;
        try { parsed = freshDoc.content ? JSON.parse(freshDoc.content) : null; } catch {}
        const vendorName = parsed?.vendorName ?? freshDoc.label ?? "";
        const city = parsed?.city ?? null;
        const country = parsed?.country ?? null;
        const checkIn = parsed?.checkIn ?? null;
        const checkOut = parsed?.checkOut ?? null;
        const address = parsed?.address ?? null;
        const contentType = (parsed?.type ?? "hotel") as string;
        const websiteUrl = (parsed?.websiteUrl ?? parsed?.bookingUrl ?? null) as string | null;

        const trip = await db.trip.findUnique({
          where: { id: freshDoc.tripId },
          select: { familyProfileId: true },
        });
        if (!trip) throw new Error(`trip not found for doc ${freshDoc.id}`);

        let seedRating: number | null = null;
        let seedUserNote: string | null = null;
        let seedNotes: string | null = null;
        let seedCategoryTags: string[] = [];
        let seedPlacePhotoUrl: string | null = null;
        let seedMediaThumbnailUrl: string | null = null;

        if (a.kind === "create_fresh_with_orphan_migration") {
          const orphan = await db.savedItem.findUnique({
            where: { id: a.orphanSavedItemId },
            select: {
              id: true, rawTitle: true, userRating: true, userNote: true, notes: true,
              categoryTags: true, destinationCity: true, destinationCountry: true,
              websiteUrl: true, sourceUrl: true,
              placePhotoUrl: true, mediaThumbnailUrl: true,
            },
          });
          if (!orphan) throw new Error(`orphan ${a.orphanSavedItemId} not found`);
          // Log full pre-delete state for recovery
          console.log(`[orphan_pre_delete] ${JSON.stringify(orphan)}`);
          seedRating = orphan.userRating;
          seedUserNote = orphan.userNote;
          seedNotes = orphan.notes;
          seedCategoryTags = orphan.categoryTags ?? [];
          seedPlacePhotoUrl = orphan.placePhotoUrl;
          seedMediaThumbnailUrl = orphan.mediaThumbnailUrl;
        }

        const newSavedItemId = await createBookingSavedItem(db, {
          familyProfileId: trip.familyProfileId,
          tripId: freshDoc.tripId,
          vendorName,
          city,
          country,
          address,
          checkIn,
          checkOut,
          extractedType: contentType,
          websiteUrl,
        });

        if (a.kind === "create_fresh_with_orphan_migration") {
          await db.savedItem.update({
            where: { id: newSavedItemId },
            data: {
              ...(seedRating != null ? { userRating: seedRating } : {}),
              ...(seedUserNote != null ? { userNote: seedUserNote } : {}),
              ...(seedNotes != null ? { notes: seedNotes } : {}),
              ...(seedCategoryTags.length ? { categoryTags: { set: seedCategoryTags } } : {}),
              ...(seedPlacePhotoUrl ? { placePhotoUrl: seedPlacePhotoUrl } : {}),
              ...(seedMediaThumbnailUrl ? { mediaThumbnailUrl: seedMediaThumbnailUrl } : {}),
            },
          });
        }

        await db.tripDocument.update({
          where: { id: freshDoc.id },
          data: { savedItemId: newSavedItemId },
        });

        if (a.kind === "create_fresh_with_orphan_migration") {
          const orphanId = a.orphanSavedItemId;

          // Re-point PlaceRating rows from orphan to new SavedItem so rating data survives
          const repointed = await db.placeRating.updateMany({
            where: { savedItemId: orphanId },
            data: { savedItemId: newSavedItemId },
          });
          if (repointed.count > 0) {
            console.log(`[placerating_repoint] ${repointed.count} PlaceRating row(s) moved from orphan ${orphanId} to new savedItem ${newSavedItemId}`);
          }

          // Carry communitySpotId forward if new SavedItem has none
          const orphanAfterRating = await db.savedItem.findUnique({
            where: { id: orphanId },
            select: { communitySpotId: true },
          });
          const newCurrent = await db.savedItem.findUnique({
            where: { id: newSavedItemId },
            select: { communitySpotId: true },
          });
          if (orphanAfterRating?.communitySpotId && !newCurrent?.communitySpotId) {
            await db.savedItem.update({
              where: { id: newSavedItemId },
              data: { communitySpotId: orphanAfterRating.communitySpotId },
            });
            console.log(`[communityspot_migrate] moved communitySpot ${orphanAfterRating.communitySpotId} from orphan to new savedItem`);
          }

          await db.savedItem.delete({ where: { id: orphanId } });
          console.log(`[create+migrate] TripDocument ${freshDoc.id} -> NEW savedItem ${newSavedItemId}, orphan ${orphanId} deleted (with all references handled)`);
        } else {
          console.log(`[create] TripDocument ${freshDoc.id} -> NEW savedItem ${newSavedItemId}`);
        }

        // Record actual ID so subsequent link_duplicate_booking can resolve it
        liveIds.set("PLANNED_" + a.docId, newSavedItemId);
        // Also update plannedSavedItems entries that point to this PLANNED_ value
        for (const [k, v] of plannedSavedItems) {
          if (v === "PLANNED_" + a.docId) {
            plannedSavedItems.set(k, newSavedItemId);
          }
        }

        succeeded++;
        continue;
      }
    } catch (err: any) {
      failed++;
      failures.push({ action: a, error: String(err?.message ?? err) });
      console.error(`[FAIL] ${a.kind} on doc ${(a as any).docId}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n=== EXECUTION COMPLETE ===`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log(`\nFailures detail:`);
    console.log(JSON.stringify(failures, null, 2));
  }

  await pool.end();
  return;
}

async function runCleanupOrphans() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  console.log("=== ORPHAN CLEANUP MODE ===");

  const hiltonOrphan = await db.savedItem.findFirst({
    where: { id: "cmo533wfw002tlrrq3eybqf38" },
    include: { tripDocuments: true, ratings: true },
  });

  if (!hiltonOrphan) {
    console.log("Hilton orphan not found (already cleaned up?). Nothing to do.");
    await pool.end();
    return;
  }

  if (hiltonOrphan.tripDocuments.length > 0) {
    console.log(`[SAFETY] Hilton orphan has ${hiltonOrphan.tripDocuments.length} TripDocument references. Aborting — this is NOT an orphan.`);
    await pool.end();
    return;
  }

  const hiltonDoc = await db.tripDocument.findFirst({
    where: { id: "cmnqwdno1001i04k30rl3mk8x" },
    select: { savedItemId: true, label: true },
  });

  if (!hiltonDoc?.savedItemId) {
    console.log("[ABORT] Hilton TripDocument has no savedItemId. Arc 2 may not have run for Hilton.");
    await pool.end();
    return;
  }

  console.log(`Hilton orphan: ${hiltonOrphan.id}, ratings: ${hiltonOrphan.ratings.length}, target: ${hiltonDoc.savedItemId}`);

  const repointed = await db.placeRating.updateMany({
    where: { savedItemId: hiltonOrphan.id },
    data: { savedItemId: hiltonDoc.savedItemId },
  });
  console.log(`[placerating_repoint] ${repointed.count} PlaceRating row(s) moved`);

  const newCurrent = await db.savedItem.findUnique({
    where: { id: hiltonDoc.savedItemId },
    select: { communitySpotId: true, placePhotoUrl: true, mediaThumbnailUrl: true },
  });

  const imageUpdate: Record<string, string> = {};
  if (hiltonOrphan.placePhotoUrl && !newCurrent?.placePhotoUrl) {
    imageUpdate.placePhotoUrl = hiltonOrphan.placePhotoUrl;
    console.log(`[image_migrate] placePhotoUrl carried forward`);
  }
  if (hiltonOrphan.mediaThumbnailUrl && !newCurrent?.mediaThumbnailUrl) {
    imageUpdate.mediaThumbnailUrl = hiltonOrphan.mediaThumbnailUrl;
    console.log(`[image_migrate] mediaThumbnailUrl carried forward`);
  }
  if (hiltonOrphan.communitySpotId && !newCurrent?.communitySpotId) {
    imageUpdate.communitySpotId = hiltonOrphan.communitySpotId;
    console.log(`[communityspot_migrate] ${hiltonOrphan.communitySpotId} moved to ${hiltonDoc.savedItemId}`);
  }
  if (Object.keys(imageUpdate).length > 0) {
    await db.savedItem.update({
      where: { id: hiltonDoc.savedItemId },
      data: imageUpdate,
    });
  }

  await db.savedItem.delete({ where: { id: hiltonOrphan.id } });
  console.log(`[orphan_delete] ${hiltonOrphan.id} deleted`);

  await pool.end();
}

async function main() {
  if (process.argv.includes("--cleanup-orphans")) {
    await runCleanupOrphans();
    return;
  }
  await runMain();
}
main().catch((e) => { console.error(e); process.exit(1); });
