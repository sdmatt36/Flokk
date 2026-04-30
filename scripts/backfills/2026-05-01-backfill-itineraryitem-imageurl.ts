/**
 * Backfill ItineraryItem.imageUrl from parallel SavedItem.placePhotoUrl.
 *
 * One-time historical equivalent of the write-time resolution mandated by
 * Discipline 4.18 (Pre-Resolved Field Principle). New rows from this commit
 * forward will get imageUrl at write time via the email-inbound webhook
 * (separate prompt). This script handles the existing corpus.
 *
 * Match key: tripId + fuzzy title match (case-insensitive substring both
 * directions). For LODGING items, strips "Check-in: " / "Check-out: " prefix
 * before matching against SavedItem.rawTitle.
 *
 * URL normalization: any sister.placePhotoUrl that points at
 * maps.googleapis.com/maps/api/place/photo (the redirect URL with an embedded
 * API key) is fetched with redirect: 'follow' to extract the final
 * lh3.googleusercontent.com URL. Resolves the key-exposure surface
 * surfaced in Chat 43 audit.
 *
 * Idempotent: skips ItineraryItems that already have a non-null imageUrl,
 * skips sisters whose placePhotoUrl is null. Safe to re-run.
 *
 * EXECUTION NOTE (Chat 43, 2026-05-01): Supabase direct connection unreachable
 * from localhost (same constraint as prior backfills). Script was written for
 * documentation and future runs in a connected environment. Actual backfill
 * applied via Supabase MCP execute_sql with a bulk VALUES UPDATE.
 *
 * Results: 37 rows written (35 LODGING + 2 ACTIVITY).
 * Hotel Metropolitan Edmont Tokyo: redirect returned HTTP 400 (stale
 * photo_reference) — 2 rows remain null, flagged for Places API fallback.
 * Hotel Metropolitan SavedItem.placePhotoUrl nulled to remove API key exposure.
 * 40 other SavedItem rows with stale maps.googleapis.com URLs remain —
 * separate cleanup pass needed (not all are backfill targets; none are
 * currently serving content).
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/backfills/2026-05-01-backfill-itineraryitem-imageurl.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillStats {
  scanned: number;
  alreadyPopulated: number;
  noSister: number;
  sisterNoPhoto: number;
  redirectsResolved: number;
  redirectFailures: number;
  written: number;
  errors: Array<{ itineraryId: string; reason: string }>;
}

const stats: BackfillStats = {
  scanned: 0,
  alreadyPopulated: 0,
  noSister: 0,
  sisterNoPhoto: 0,
  redirectsResolved: 0,
  redirectFailures: 0,
  written: 0,
  errors: [],
};

const DRY_RUN = process.argv.includes('--dry-run');

function isMapsApiRedirect(url: string): boolean {
  return url.includes('maps.googleapis.com/maps/api/place/photo');
}

async function resolveMapsRedirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      return null;
    }
    const finalUrl = res.url;
    if (finalUrl && finalUrl !== url && finalUrl.includes('googleusercontent.com')) {
      return finalUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function findSisterSavedItem(
  tripId: string | null,
  itineraryTitle: string,
  scheduledDate: string | null,
): Promise<{ id: string; placePhotoUrl: string | null } | null> {
  if (!tripId) return null;

  const candidates = await prisma.savedItem.findMany({
    where: {
      tripId,
      OR: [
        { rawTitle: { equals: itineraryTitle, mode: 'insensitive' } },
        { rawTitle: { contains: itineraryTitle, mode: 'insensitive' } },
      ],
      deletedAt: null,
    },
    select: {
      id: true,
      rawTitle: true,
      placePhotoUrl: true,
      extractedCheckin: true,
    },
  });

  if (candidates.length === 0) {
    const allForTrip = await prisma.savedItem.findMany({
      where: { tripId, deletedAt: null, rawTitle: { not: null } },
      select: {
        id: true,
        rawTitle: true,
        placePhotoUrl: true,
        extractedCheckin: true,
      },
    });
    const reverseMatches = allForTrip.filter(
      (s) =>
        s.rawTitle &&
        itineraryTitle.toLowerCase().includes(s.rawTitle.toLowerCase()),
    );
    if (reverseMatches.length === 0) return null;
    if (reverseMatches.length === 1) return reverseMatches[0];
    candidates.push(...reverseMatches);
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (scheduledDate) {
    const dateMatch = candidates.find(
      (c) => c.extractedCheckin && c.extractedCheckin.startsWith(scheduledDate),
    );
    if (dateMatch) return dateMatch;
  }

  const withPhoto = candidates.find((c) => c.placePhotoUrl);
  return withPhoto || candidates[0];
}

async function main() {
  console.log(
    `\n=== ItineraryItem.imageUrl backfill ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`,
  );

  const stripPrefix = (title: string): string =>
    title
      .replace(/^Check-in:\s*/i, '')
      .replace(/^Check-out:\s*/i, '')
      .trim();

  const items = await prisma.itineraryItem.findMany({
    where: {
      type: { in: ['LODGING', 'ACTIVITY'] },
    },
    select: {
      id: true,
      tripId: true,
      type: true,
      title: true,
      scheduledDate: true,
      imageUrl: true,
    },
  });

  for (const item of items) {
    stats.scanned++;

    if (item.imageUrl) {
      stats.alreadyPopulated++;
      continue;
    }

    const matchTitle = stripPrefix(item.title);
    const sister = await findSisterSavedItem(
      item.tripId,
      matchTitle,
      item.scheduledDate,
    );

    if (!sister) {
      stats.noSister++;
      continue;
    }

    if (!sister.placePhotoUrl) {
      stats.sisterNoPhoto++;
      continue;
    }

    let resolvedUrl = sister.placePhotoUrl;

    if (isMapsApiRedirect(resolvedUrl)) {
      const followed = await resolveMapsRedirect(resolvedUrl);
      if (followed) {
        resolvedUrl = followed;
        stats.redirectsResolved++;
        if (!DRY_RUN) {
          await prisma.savedItem.update({
            where: { id: sister.id },
            data: { placePhotoUrl: followed },
          });
        }
      } else {
        stats.redirectFailures++;
        stats.errors.push({
          itineraryId: item.id,
          reason: `Maps API redirect failed (HTTP 400 — stale photo_reference). SavedItem.placePhotoUrl nulled to remove key exposure.`,
        });
        if (!DRY_RUN) {
          await prisma.savedItem.update({
            where: { id: sister.id },
            data: { placePhotoUrl: null },
          });
        }
        continue;
      }
    }

    if (!DRY_RUN) {
      try {
        await prisma.itineraryItem.update({
          where: { id: item.id },
          data: { imageUrl: resolvedUrl },
        });
        stats.written++;
      } catch (err) {
        stats.errors.push({
          itineraryId: item.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      stats.written++;
    }
  }

  console.log('Scanned:', stats.scanned);
  console.log('Already populated (skipped):', stats.alreadyPopulated);
  console.log('No sister SavedItem found:', stats.noSister);
  console.log('Sister had no placePhotoUrl:', stats.sisterNoPhoto);
  console.log('Maps API redirects resolved:', stats.redirectsResolved);
  console.log('Maps API redirects failed:', stats.redirectFailures);
  console.log(`Written ${DRY_RUN ? '(would write)' : ''}:`, stats.written);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach((e) => {
      console.log(`  ${e.itineraryId}: ${e.reason}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ...and ${stats.errors.length - 10} more`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
