// Chat 27 Prompt 5 — retroactively link/create SavedItems for existing ratings.
//
// Rules:
//   - Pass 1: Every SpotContribution row: ensure SavedItem exists for that family+spot.
//   - Pass 2: Every PlaceRating row whose savedItemId is null AND rating >= 1:
//     create CommunitySpot + SpotContribution + SavedItem. Skip check-in events
//     and semicolon-composite multi-stop items. URL resolved via Google Places
//     OUTSIDE $transaction with 300ms inter-call delay.
//   - Idempotent. Re-runnable. Dry-run outputs summary counts only.
//
// Usage:
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfill-saves-from-ratings.ts
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfill-saves-from-ratings.ts --live

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ensureSavedItemForRating } from "../src/lib/ensure-saved-item-for-rating";
import { normalizePlaceName, resolvePlaceUrl, deservesUrl } from "../src/lib/google-places";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const LIVE = process.argv.includes("--live");

/**
 * Filter out PlaceRating rows that are not clean single-place records.
 */
function shouldSkipForBackfill(placeName: string, city: string | null): { skip: boolean; reason: string | null } {
  if (!placeName?.trim()) return { skip: true, reason: "empty name" };
  if (!city?.trim()) return { skip: true, reason: "empty city" };

  const name = placeName.trim();

  // Check-in events — booking records, not place ratings worth backfilling.
  // NOTE: normalizePlaceName strips "Check-in:" prefix, so these reach the community layer
  // correctly when processed through writeThroughCommunitySpot. In the backfill however,
  // we still skip pure check-in events since they describe the booking, not the venue as a place.
  if (/^check[-\s]?in\s*[:\-]\s*/i.test(name)) return { skip: true, reason: "check-in event" };

  // Composite items — semicolons indicate multi-stop days
  if (name.includes(";")) return { skip: true, reason: "composite (semicolon)" };

  // Multi-stop composites: comma-separated AND a connective
  const hasComma = /\w\s*,\s*\w/.test(name);
  const hasConnective = /\s+(?:and|&|\+|plus)\s+/i.test(name);
  if (hasComma && hasConnective) {
    return { skip: true, reason: "composite (comma + connective)" };
  }

  // Explicit tour/trip language as standalone signal
  if (/\b(?:half day trip|day trip|walking tour|guided tour|tour bundle)\b/i.test(name)) {
    return { skip: true, reason: "tour/trip bundle" };
  }

  return { skip: false, reason: null };
}

async function main() {
  console.log(`[backfill] Mode: ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log(`[backfill] Started: ${new Date().toISOString()}`);

  // ── Pass 1: every SpotContribution → ensure linked SavedItem ──────────────

  const contributions = await db.spotContribution.findMany({
    include: { spot: true },
  });
  console.log(`\n[backfill] Pass 1 — SpotContribution rows: ${contributions.length}`);

  let pass1Created = 0;
  let pass1Linked = 0;
  let pass1NoOp = 0;
  let pass1Skipped = 0;

  for (const c of contributions) {
    const spot = c.spot;
    if (!spot || !spot.city) {
      pass1Skipped += 1;
      continue;
    }

    const existing = await db.savedItem.findFirst({
      where: {
        familyProfileId: c.familyProfileId,
        OR: [
          { communitySpotId: spot.id },
          {
            communitySpotId: null,
            rawTitle: { equals: spot.name, mode: "insensitive" },
            destinationCity: { equals: spot.city, mode: "insensitive" },
          },
        ],
      },
      select: { id: true, communitySpotId: true },
    });

    if (existing && existing.communitySpotId === spot.id) {
      pass1NoOp += 1;
      continue;
    }

    const willCreate = !existing;
    const willLink = !!existing && existing.communitySpotId !== spot.id;

    if (!LIVE) {
      if (willCreate) pass1Created += 1;
      else if (willLink) pass1Linked += 1;
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        await ensureSavedItemForRating(tx, {
          familyProfileId: c.familyProfileId,
          communitySpotId: spot.id,
          placeName: spot.name,
          city: spot.city,
          country: spot.country ?? null,
          lat: spot.lat ?? null,
          lng: spot.lng ?? null,
          photoUrl: spot.photoUrl ?? null,
          websiteUrl: spot.websiteUrl ?? null,
          category: spot.category ?? null,
          googlePlaceId: spot.googlePlaceId ?? null,
          rating: c.rating ?? null,
          note: c.note ?? null,
        });
      });
      if (willCreate) pass1Created += 1;
      else if (willLink) pass1Linked += 1;
    } catch (e) {
      console.error(`[backfill] Pass 1 ERROR for contribution ${c.id} (spotId=${spot.id}):`, e);
    }
  }

  console.log(`[backfill] Pass 1 results:`);
  console.log(`  SavedItems to create:        ${pass1Created}`);
  console.log(`  Existing SavedItems to link: ${pass1Linked}`);
  console.log(`  Already-linked (no-op):      ${pass1NoOp}`);
  console.log(`  Skipped (no city on spot):   ${pass1Skipped}`);

  // ── Pass 2: orphan PlaceRating rows → CommunitySpot + SpotContribution + SavedItem ──

  const orphanPlaceRatings = await db.placeRating.findMany({
    where: {
      savedItemId: null,
      rating: { gte: 1 },
    },
    select: {
      id: true,
      placeName: true,
      destinationCity: true,
      familyProfileId: true,
      rating: true,
      notes: true,
      lat: true,
      lng: true,
      manualActivityId: true,
      itineraryItemId: true,
      tripId: true,
    },
  });
  console.log(`\n[backfill] Pass 2 — orphan PlaceRating rows: ${orphanPlaceRatings.length}`);

  let pass2Skipped = 0;
  let pass2SpotCreated = 0;
  let pass2SpotMatched = 0;
  let pass2ContributionCreated = 0;
  let pass2SavedItemCreated = 0;
  let pass2SavedItemLinked = 0;
  let pass2Errors = 0;
  let resolveCount = 0;
  let resolveResolved = 0;

  const skipList: { name: string; city: string | null; reason: string }[] = [];

  for (const pr of orphanPlaceRatings) {
    const skipCheck = shouldSkipForBackfill(pr.placeName, pr.destinationCity);
    if (skipCheck.skip) {
      pass2Skipped += 1;
      skipList.push({ name: pr.placeName, city: pr.destinationCity, reason: skipCheck.reason ?? "unknown" });
      continue;
    }

    const cleanedName = normalizePlaceName(pr.placeName);
    const city = pr.destinationCity!;

    if (!LIVE) {
      // Dry-run: query without writing
      const existingSpot = await db.communitySpot.findFirst({
        where: {
          name: { equals: cleanedName, mode: "insensitive" },
          city: { equals: city, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existingSpot) pass2SpotMatched += 1;
      else pass2SpotCreated += 1;

      const spotIdForCheck = existingSpot?.id;
      if (spotIdForCheck) {
        const existingContribution = await db.spotContribution.findFirst({
          where: { communitySpotId: spotIdForCheck, familyProfileId: pr.familyProfileId },
          select: { id: true },
        });
        if (!existingContribution) pass2ContributionCreated += 1;
      } else {
        pass2ContributionCreated += 1;
      }

      const existingSave = await db.savedItem.findFirst({
        where: {
          familyProfileId: pr.familyProfileId,
          OR: [
            ...(spotIdForCheck ? [{ communitySpotId: spotIdForCheck }] : []),
            {
              communitySpotId: null,
              rawTitle: { equals: cleanedName, mode: "insensitive" },
              destinationCity: { equals: city, mode: "insensitive" },
            },
          ],
        },
        select: { id: true },
      });
      if (existingSave) pass2SavedItemLinked += 1;
      else pass2SavedItemCreated += 1;
      continue;
    }

    // LIVE: pre-resolve URL outside $transaction
    let resolvedUrl: string | null = null;
    let needsUrlReview = false;

    // Check if spot already exists before deciding whether to call Places
    const existingSpotPre = await db.communitySpot.findFirst({
      where: {
        name: { equals: cleanedName, mode: "insensitive" },
        city: { equals: city, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!existingSpotPre && deservesUrl(cleanedName)) {
      try {
        resolvedUrl = await resolvePlaceUrl(cleanedName, city);
      } catch {
        resolvedUrl = null;
      }
      if (!resolvedUrl) needsUrlReview = true;
      resolveCount += 1;
      if (resolveResolved) resolveResolved += resolvedUrl ? 1 : 0;
      if (resolvedUrl) resolveResolved += 1;
      if (resolveCount % 10 === 0) {
        console.log(`  [places] resolved ${resolveCount} (${resolveResolved} with URLs)`);
      }
      // 300ms delay between Places calls
      await new Promise((r) => setTimeout(r, 300));
    }

    try {
      await db.$transaction(async (tx) => {
        // Find or create CommunitySpot
        let spot = await tx.communitySpot.findFirst({
          where: {
            name: { equals: cleanedName, mode: "insensitive" },
            city: { equals: city, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (!spot) {
          spot = await tx.communitySpot.create({
            data: {
              name: cleanedName,
              city,
              country: null,
              lat: pr.lat ?? null,
              lng: pr.lng ?? null,
              photoUrl: null,
              websiteUrl: resolvedUrl,
              needsUrlReview,
              category: null,
              authorProfileId: pr.familyProfileId,
            },
            select: { id: true },
          });
          pass2SpotCreated += 1;
        } else {
          pass2SpotMatched += 1;
        }

        // Upsert SpotContribution
        const existingContribution = await tx.spotContribution.findUnique({
          where: {
            communitySpotId_familyProfileId: {
              communitySpotId: spot.id,
              familyProfileId: pr.familyProfileId,
            },
          },
          select: { id: true },
        });
        if (!existingContribution) pass2ContributionCreated += 1;

        await tx.spotContribution.upsert({
          where: {
            communitySpotId_familyProfileId: {
              communitySpotId: spot.id,
              familyProfileId: pr.familyProfileId,
            },
          },
          create: {
            communitySpotId: spot.id,
            familyProfileId: pr.familyProfileId,
            rating: pr.rating,
            note: pr.notes ?? null,
          },
          update: {
            rating: pr.rating,
            note: pr.notes ?? null,
          },
        });

        // Recompute aggregates
        const contributions = await tx.spotContribution.findMany({
          where: { communitySpotId: spot.id },
          select: { rating: true },
        });
        const ratedContribs = contributions.filter((c) => c.rating != null);
        const ratingCount = ratedContribs.length;
        const contributionCount = contributions.length;
        const averageRating = ratingCount > 0
          ? ratedContribs.reduce((sum, c) => sum + (c.rating as number), 0) / ratingCount
          : null;
        await tx.communitySpot.update({
          where: { id: spot.id },
          data: { averageRating, ratingCount, contributionCount },
        });

        // Check state before ensure for accurate count tracking
        const preExisting = await tx.savedItem.findFirst({
          where: {
            familyProfileId: pr.familyProfileId,
            OR: [
              { communitySpotId: spot.id },
              {
                communitySpotId: null,
                rawTitle: { equals: cleanedName, mode: "insensitive" },
                destinationCity: { equals: city, mode: "insensitive" },
              },
            ],
          },
          select: { id: true },
        });

        await ensureSavedItemForRating(tx, {
          familyProfileId: pr.familyProfileId,
          communitySpotId: spot.id,
          placeName: cleanedName,
          city,
          country: null,
          lat: pr.lat ?? null,
          lng: pr.lng ?? null,
          photoUrl: null,
          websiteUrl: null,
          category: null,
          googlePlaceId: null,
          rating: pr.rating,
          note: pr.notes ?? null,
        });

        if (preExisting) pass2SavedItemLinked += 1;
        else pass2SavedItemCreated += 1;

        // Link PlaceRating.savedItemId
        const savedItem = await tx.savedItem.findFirst({
          where: { familyProfileId: pr.familyProfileId, communitySpotId: spot.id },
          select: { id: true },
        });
        if (savedItem) {
          await tx.placeRating.update({
            where: { id: pr.id },
            data: { savedItemId: savedItem.id },
          });
        }
      }, { timeout: 15000 });
    } catch (e) {
      pass2Errors += 1;
      console.error(`[backfill] Pass 2 ERROR on PlaceRating ${pr.id} (${pr.placeName} / ${pr.destinationCity}):`, e);
    }
  }

  console.log(`[backfill] Pass 2 results:`);
  console.log(`  Skipped (low-quality names):     ${pass2Skipped}`);
  console.log(`  CommunitySpots created:          ${pass2SpotCreated}`);
  console.log(`  CommunitySpots matched existing: ${pass2SpotMatched}`);
  console.log(`  SpotContributions created:       ${pass2ContributionCreated}`);
  console.log(`  SavedItems created:              ${pass2SavedItemCreated}`);
  console.log(`  SavedItems linked (pre-existing): ${pass2SavedItemLinked}`);
  console.log(`  Errors:                          ${pass2Errors}`);
  if (LIVE) {
    console.log(`  Places URL resolutions attempted:  ${resolveCount}`);
    console.log(`  Places URL resolutions successful: ${resolveResolved}`);
    console.log(`  Flagged needsUrlReview:            ${resolveCount - resolveResolved}`);
  }

  if (skipList.length > 0) {
    console.log(`\n[backfill] Pass 2 skip list (${skipList.length} rows):`);
    skipList.forEach(s => console.log(`    - ${s.name} / ${s.city ?? "?"} — ${s.reason}`));
  }

  console.log(`\n[backfill] Finished: ${new Date().toISOString()}`);
  await db.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("[backfill] FATAL:", e);
  await db.$disconnect();
  await pool.end();
  process.exit(1);
});
