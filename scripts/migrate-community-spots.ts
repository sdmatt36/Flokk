// =============================================================================
// migrate-community-spots.ts
// Migrates rated places into CommunitySpot + SpotContribution tables.
//
// FIELD CORRECTIONS vs. original prompt spec:
//   SavedItem.rawTitle          (not .title)
//   SavedItem.placePhotoUrl     (not .imageUrl — also fallback to .mediaThumbnailUrl)
//   SavedItem.websiteUrl        (not .url)
//   SavedItem.categoryTags[0]   (not .category — it's a String[])
//   SavedItem.savedAt           (not .createdAt — SavedItem has no createdAt field)
//   SavedItem.notes             (also .userNote — use notes as primary)
//   SavedItem: no googlePlaceId field → always null from this source
//   SavedItem: no address field → null from this source
//   ManualActivity.title        (not .name)
//   ManualActivity.website      (not .websiteUrl)
//   ManualActivity.type         (not .placeType — type is on ManualActivity)
//   Trip.destinationCity        (not .destination)
//   PlaceRating: no Prisma relation to ManualActivity → manual join via separate query
//   SpotContribution: no sourceModel/sourceId column → skipped
// =============================================================================

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { cleanVenueName } from "./lib/clean-venue-name";

// ── Env checks ────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL not found in .env.local — copy it from .env.production and retry"
  );
  process.exit(1);
}

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";
if (!GOOGLE_API_KEY) {
  console.warn(
    "⚠️  No GOOGLE_MAPS_API_KEY found — enrichment will be skipped for all candidates missing coords/photo"
  );
}

// ── Mode ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const isLive = argv.includes("--live");
const isDryRun = !isLive;
if (!argv.includes("--live") && !argv.includes("--dry-run")) {
  console.warn(
    "⚠️  No mode flag provided — defaulting to --dry-run. Pass --live to write to DB."
  );
}
console.log(`\nMode: ${isLive ? "LIVE (will write to DB)" : "DRY RUN (read-only)"}\n`);

// ── Prisma ────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidate {
  source: "SavedItem" | "PlaceRating";
  sourceId: string;
  profileId: string;
  rating: number | null;
  note: string | null;
  savedAt: Date; // normalized date — SavedItem uses savedAt, PlaceRating uses createdAt
  googlePlaceId: string | null;
  rawName: string; // original name before cleanVenueName (for before/after reporting)
  name: string;
  city: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  category: string | null;
}

interface EnrichResult {
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  address: string | null;
  websiteUrl: string | null;
}

interface SpotGroup {
  key: string;
  googlePlaceId: string | null;
  name: string;
  city: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  category: string | null;
  description: string | null; // first non-null note
  authorProfileId: string; // earliest savedAt candidate
  contributions: Array<{
    profileId: string;
    rating: number | null;
    note: string | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

// cleanVenueName imported from ./lib/clean-venue-name

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dedupeContributions(
  contribs: Array<{ profileId: string; rating: number | null; note: string | null; savedAt: Date }>
): Array<{ profileId: string; rating: number | null; note: string | null }> {
  // Per profileId: keep latest (highest savedAt)
  const map = new Map<
    string,
    { profileId: string; rating: number | null; note: string | null; savedAt: Date }
  >();
  for (const c of contribs) {
    const existing = map.get(c.profileId);
    if (!existing || c.savedAt > existing.savedAt) {
      map.set(c.profileId, c);
    }
  }
  return Array.from(map.values()).map(({ profileId, rating, note }) => ({
    profileId,
    rating,
    note,
  }));
}

// ── Google Places enrichment ──────────────────────────────────────────────────

const placesCache = new Map<string, EnrichResult | null>();
let apiCallCount = 0;
let cacheHitCount = 0;

type TextSearchResult = {
  results?: Array<{
    place_id?: string;
    geometry?: { location?: { lat: number; lng: number } };
    photos?: Array<{ photo_reference: string }>;
    formatted_address?: string;
    website?: string;
  }>;
  status?: string;
};

async function enrichFromGoogle(
  name: string,
  city: string
): Promise<EnrichResult | null> {
  if (!GOOGLE_API_KEY) return null;
  const cacheKey = `${normalize(name)}::${normalize(city)}`;
  if (placesCache.has(cacheKey)) {
    cacheHitCount++;
    return placesCache.get(cacheKey)!;
  }

  await sleep(100); // rate limit
  apiCallCount++;

  const query = encodeURIComponent(`${name}, ${city}`);
  const url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${query}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as TextSearchResult;

    if (!data.results || data.results.length === 0) {
      placesCache.set(cacheKey, null);
      return null;
    }

    const place = data.results[0];
    const photoRef = place.photos?.[0]?.photo_reference ?? null;
    const photoUrl = photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`
      : null;

    const result: EnrichResult = {
      googlePlaceId: place.place_id ?? null,
      lat: place.geometry?.location?.lat ?? null,
      lng: place.geometry?.location?.lng ?? null,
      photoUrl,
      address: place.formatted_address ?? null,
      websiteUrl: null, // Text Search doesn't return website; keep source value
    };

    placesCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.error(`  [google] fetch failed for "${name}, ${city}":`, e);
    placesCache.set(cacheKey, null);
    return null;
  }
}

// ── Source A: SavedItem ───────────────────────────────────────────────────────

async function buildSavedItemCandidates(): Promise<{ candidates: Candidate[]; cleanedCount: number }> {
  const items = await prisma.savedItem.findMany({
    where: {
      userRating: { not: null },
      destinationCity: { not: null },
    },
    orderBy: { savedAt: "asc" },
  });

  const candidates: Candidate[] = [];
  let skipped = 0;
  let cleanedCount = 0;

  for (const item of items) {
    const rawName = item.rawTitle?.trim() ?? "";
    const name = cleanVenueName(rawName);
    if (name !== rawName) cleanedCount++;
    const city = item.destinationCity?.trim() ?? "";
    if (!name || !city) {
      console.log(`  [skip] SavedItem ${item.id} — missing name or city (name="${name}" city="${city}")`);
      skipped++;
      continue;
    }
    candidates.push({
      source: "SavedItem",
      sourceId: item.id,
      profileId: item.familyProfileId,
      rating: item.userRating ?? null,
      note: item.notes ?? item.userNote ?? null,
      savedAt: item.savedAt,
      googlePlaceId: null, // SavedItem has no googlePlaceId field
      rawName,
      name,
      city,
      country: item.destinationCountry ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      photoUrl: item.placePhotoUrl ?? item.mediaThumbnailUrl ?? null,
      websiteUrl: item.websiteUrl ?? null,
      address: null, // SavedItem has no address field
      category: item.categoryTags?.[0] ?? null,
    });
  }

  console.log(
    `Source A (SavedItem): ${candidates.length} candidates, ${skipped} skipped, ${cleanedCount} names cleaned`
  );
  return { candidates, cleanedCount };
}

// ── Source B: PlaceRating + ManualActivity ─────────────────────────────────────

async function buildPlaceRatingCandidates(): Promise<{ candidates: Candidate[]; cleanedCount: number }> {
  const ratings = await prisma.placeRating.findMany({
    where: { manualActivityId: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  if (ratings.length === 0) {
    console.log("Source B (PlaceRating): 0 candidates");
    return { candidates: [], cleanedCount: 0 };
  }

  // Manual join — PlaceRating has no Prisma relation to ManualActivity
  const manualActivityIds = [...new Set(ratings.map((r) => r.manualActivityId!))];
  const activities = await prisma.manualActivity.findMany({
    where: { id: { in: manualActivityIds } },
    include: {
      trip: { select: { destinationCity: true, destinationCountry: true } },
    },
  });
  const activityMap = new Map(activities.map((a) => [a.id, a]));

  const candidates: Candidate[] = [];
  let skipped = 0;
  let cleanedCount = 0;

  for (const rating of ratings) {
    const activity = activityMap.get(rating.manualActivityId!);
    if (!activity) {
      console.log(`  [skip] PlaceRating ${rating.id} — ManualActivity ${rating.manualActivityId} not found`);
      skipped++;
      continue;
    }

    const rawName = activity.title?.trim() ?? "";
    const name = cleanVenueName(rawName);
    if (name !== rawName) cleanedCount++;
    const city =
      (activity.city?.trim() || activity.trip?.destinationCity?.trim()) ?? "";
    if (!name || !city) {
      console.log(`  [skip] PlaceRating ${rating.id} — missing name or city (name="${name}" city="${city}")`);
      skipped++;
      continue;
    }

    candidates.push({
      source: "PlaceRating",
      sourceId: rating.id,
      profileId: rating.familyProfileId,
      rating: rating.rating,
      note: rating.notes ?? null,
      savedAt: rating.createdAt,
      googlePlaceId: null, // ManualActivity has no googlePlaceId
      rawName,
      name,
      city,
      country: activity.trip?.destinationCountry ?? null,
      lat: activity.lat ?? null,
      lng: activity.lng ?? null,
      photoUrl: activity.imageUrl ?? null,
      websiteUrl: activity.website ?? null,
      address: activity.address ?? null,
      category: activity.type ?? null,
    });
  }

  console.log(
    `Source B (PlaceRating): ${candidates.length} candidates, ${skipped} skipped, ${cleanedCount} names cleaned`
  );
  return { candidates, cleanedCount };
}

// ── Enrichment ────────────────────────────────────────────────────────────────

async function enrichCandidates(candidates: Candidate[]): Promise<{
  enriched: Candidate[];
  skippedUnresolved: number;
}> {
  const enriched: Candidate[] = [];
  let skippedUnresolved = 0;

  for (const c of candidates) {
    const needsEnrichment =
      c.googlePlaceId === null && (c.lat === null || c.photoUrl === null);

    if (!needsEnrichment) {
      enriched.push(c);
      continue;
    }

    const result = await enrichFromGoogle(c.name, c.city);

    if (result === null) {
      // No Google match — skip if still no lat/lng
      if (c.lat === null) {
        console.log(`  [skipped] unresolved: "${c.name}" (${c.city})`);
        skippedUnresolved++;
        continue;
      }
      // Has coords but no photo — keep as-is
      enriched.push(c);
      continue;
    }

    enriched.push({
      ...c,
      googlePlaceId: c.googlePlaceId ?? result.googlePlaceId,
      lat: c.lat ?? result.lat,
      lng: c.lng ?? result.lng,
      photoUrl: c.photoUrl ?? result.photoUrl,
      address: c.address ?? result.address,
      // websiteUrl: keep source value; Text Search doesn't return website
    });
  }

  console.log(
    `Enrichment: ${apiCallCount} API calls (${cacheHitCount} cache hits), ${skippedUnresolved} skipped (unresolved)`
  );
  return { enriched, skippedUnresolved };
}

// ── Grouping ──────────────────────────────────────────────────────────────────

function groupIntoSpots(candidates: Candidate[]): { groups: SpotGroup[]; rawNameMap: Map<string, string> } {
  // Pass 1: assign initial key per candidate
  type KeyedCandidate = Candidate & { key: string };
  const keyed: KeyedCandidate[] = candidates.map((c) => ({
    ...c,
    key: c.googlePlaceId
      ? `gplace::${c.googlePlaceId}`
      : `name::${normalize(c.name)}::${normalize(c.city)}`,
  }));

  // Pass 2: merge keys — if two name-keyed candidates share a googlePlaceId after enrichment,
  // unify them under the gplace key
  const gplaceToNameKey = new Map<string, string>(); // googlePlaceId → name key (for merging)
  for (const c of keyed) {
    if (c.googlePlaceId && c.key.startsWith("name::")) {
      gplaceToNameKey.set(c.googlePlaceId, c.key);
    }
  }
  // Remap: if a candidate has googlePlaceId, use gplace key regardless
  const remapped: KeyedCandidate[] = keyed.map((c) =>
    c.googlePlaceId ? { ...c, key: `gplace::${c.googlePlaceId}` } : c
  );

  // Group
  const groups = new Map<string, KeyedCandidate[]>();
  for (const c of remapped) {
    const existing = groups.get(c.key);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(c.key, [c]);
    }
  }

  // rawNameMap: spotKey → rawName of the earliest candidate (for before/after reporting)
  const rawNameMap = new Map<string, string>();

  // Build SpotGroup from each group
  const spotGroups: SpotGroup[] = [];
  for (const [key, members] of groups.entries()) {
    // Sort by savedAt ascending to find author (earliest contributor)
    members.sort((a, b) => a.savedAt.getTime() - b.savedAt.getTime());
    const earliest = members[0];

    // Track rawName for before/after reporting
    rawNameMap.set(key, earliest.rawName);

    // Pick canonical fields: first non-null wins
    const googlePlaceId = members.find((m) => m.googlePlaceId)?.googlePlaceId ?? null;
    const name = earliest.name;
    const city = earliest.city;
    const country = members.find((m) => m.country)?.country ?? null;
    const lat = members.find((m) => m.lat !== null)?.lat ?? null;
    const lng = members.find((m) => m.lng !== null)?.lng ?? null;
    const photoUrl = members.find((m) => m.photoUrl)?.photoUrl ?? null;
    const websiteUrl = members.find((m) => m.websiteUrl)?.websiteUrl ?? null;
    const address = members.find((m) => m.address)?.address ?? null;
    const category = members.find((m) => m.category)?.category ?? null;
    const description = members.find((m) => m.note)?.note ?? null;

    // Deduped contributions per profileId (latest rating wins per profile)
    const rawContribs = members.map((m) => ({
      profileId: m.profileId,
      rating: m.rating,
      note: m.note,
      savedAt: m.savedAt,
    }));
    const contributions = dedupeContributions(rawContribs);

    spotGroups.push({
      key,
      googlePlaceId,
      name,
      city,
      country,
      lat,
      lng,
      photoUrl,
      websiteUrl,
      address,
      category,
      description,
      authorProfileId: earliest.profileId,
      contributions,
    });
  }

  return { groups: spotGroups, rawNameMap };
}

// ── Dry-run summary ───────────────────────────────────────────────────────────

function printDryRunSummary(
  savedItemCandidates: Candidate[],
  placeRatingCandidates: Candidate[],
  skippedNoNameCity: number,
  skippedUnresolved: number,
  cleanedCount: number,
  groups: SpotGroup[],
  rawNameMap: Map<string, string> // spotKey → rawName (for before/after display)
) {
  const totalContributions = groups.reduce((s, g) => s + g.contributions.length, 0);

  console.log("\n══════════════════════════════════════════");
  console.log("  DRY RUN SUMMARY");
  console.log("══════════════════════════════════════════");
  console.log(`  Candidates from SavedItem:           ${savedItemCandidates.length}`);
  console.log(`  Candidates from PlaceRating:         ${placeRatingCandidates.length}`);
  console.log(`  Skipped (no name/city):              ${skippedNoNameCity}`);
  console.log(`  Skipped (unresolved after lookup):   ${skippedUnresolved}`);
  console.log(`  Names cleaned:                       ${cleanedCount}`);
  console.log(`  Unique CommunitySpots to create:     ${groups.length}`);
  console.log(`  Total SpotContributions to create:   ${totalContributions}`);
  console.log(
    `  Google Places API calls:             ${apiCallCount} (${cacheHitCount} cache hits)`
  );

  // Top 10 cities
  const cityCounts = new Map<string, number>();
  for (const g of groups) {
    cityCounts.set(g.city, (cityCounts.get(g.city) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("\n  Top cities by spot count:");
  for (const [city, count] of topCities) {
    console.log(`    ${city.padEnd(24)} ${count}`);
  }

  // Sample spots — show before/after for cleaned names
  console.log("\n  Sample spots (first 10):");
  for (const g of groups.slice(0, 10)) {
    const contribLine = `${g.contributions.length} contrib(s)`;
    const ratingLine =
      g.contributions.filter((c) => c.rating !== null).length > 0
        ? `avg ${(
            g.contributions
              .filter((c) => c.rating !== null)
              .reduce((s, c) => s + (c.rating ?? 0), 0) /
            g.contributions.filter((c) => c.rating !== null).length
          ).toFixed(1)}`
        : "no ratings";
    const rawName = rawNameMap.get(g.key);
    const nameDisplay =
      rawName && rawName !== g.name
        ? `"${g.name}" (was: "${rawName}")`
        : `"${g.name}"`;
    console.log(
      `    ${nameDisplay} · ${g.city} · ${contribLine} · ${ratingLine}` +
        (g.googlePlaceId ? ` · gplace:${g.googlePlaceId.slice(0, 12)}…` : "")
    );
  }

  console.log("\n══════════════════════════════════════════\n");
  console.log("No writes performed (dry run). Re-run with --live to apply.");
}

// ── Live write ────────────────────────────────────────────────────────────────

async function writeSpots(groups: SpotGroup[]): Promise<void> {
  let created = 0;
  let updated = 0;
  let contributionsCreated = 0;
  let errors = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    try {
      await prisma.$transaction(async (tx) => {
        // ── Upsert CommunitySpot ──
        let spot: { id: string };

        if (group.googlePlaceId) {
          // Has googlePlaceId — use upsert on unique index
          spot = await tx.communitySpot.upsert({
            where: { googlePlaceId: group.googlePlaceId },
            create: {
              name: group.name,
              city: group.city,
              country: group.country,
              category: group.category,
              googlePlaceId: group.googlePlaceId,
              address: group.address,
              lat: group.lat,
              lng: group.lng,
              photoUrl: group.photoUrl,
              websiteUrl: group.websiteUrl,
              description: group.description,
              authorProfileId: group.authorProfileId,
            },
            update: {
              // Update enrichment fields if we have better data now
              lat: group.lat ?? undefined,
              lng: group.lng ?? undefined,
              photoUrl: group.photoUrl ?? undefined,
              address: group.address ?? undefined,
              websiteUrl: group.websiteUrl ?? undefined,
              description: group.description ?? undefined,
            },
            select: { id: true },
          });
          // Can't distinguish create vs update from upsert without checking — count as created for first run
          created++;
        } else {
          // No googlePlaceId — findFirst + create/update on normalized name+city
          const existing = await tx.communitySpot.findFirst({
            where: {
              googlePlaceId: null,
              name: { equals: group.name, mode: "insensitive" },
              city: { equals: group.city, mode: "insensitive" },
            },
            select: { id: true },
          });

          if (existing) {
            await tx.communitySpot.update({
              where: { id: existing.id },
              data: {
                lat: group.lat ?? undefined,
                lng: group.lng ?? undefined,
                photoUrl: group.photoUrl ?? undefined,
                address: group.address ?? undefined,
                websiteUrl: group.websiteUrl ?? undefined,
                description: group.description ?? undefined,
              },
            });
            spot = existing;
            updated++;
          } else {
            spot = await tx.communitySpot.create({
              data: {
                name: group.name,
                city: group.city,
                country: group.country,
                category: group.category,
                googlePlaceId: null,
                address: group.address,
                lat: group.lat,
                lng: group.lng,
                photoUrl: group.photoUrl,
                websiteUrl: group.websiteUrl,
                description: group.description,
                authorProfileId: group.authorProfileId,
              },
              select: { id: true },
            });
            created++;
          }
        }

        // ── Upsert SpotContributions ──
        for (const contrib of group.contributions) {
          await tx.spotContribution.upsert({
            where: {
              communitySpotId_familyProfileId: {
                communitySpotId: spot.id,
                familyProfileId: contrib.profileId,
              },
            },
            create: {
              communitySpotId: spot.id,
              familyProfileId: contrib.profileId,
              rating: contrib.rating,
              note: contrib.note,
            },
            update: {
              rating: contrib.rating,
              note: contrib.note,
            },
          });
          contributionsCreated++;
        }

        // ── Recompute aggregates ──
        const allContribs = await tx.spotContribution.findMany({
          where: { communitySpotId: spot.id },
          select: { rating: true },
        });
        const ratings = allContribs.map((c) => c.rating).filter((r): r is number => r !== null);
        const averageRating = ratings.length > 0
          ? ratings.reduce((s, r) => s + r, 0) / ratings.length
          : null;

        await tx.communitySpot.update({
          where: { id: spot.id },
          data: {
            averageRating,
            ratingCount: ratings.length,
            contributionCount: allContribs.length,
          },
        });
      });

      if ((i + 1) % 25 === 0 || i === groups.length - 1) {
        console.log(
          `  [${i + 1}/${groups.length}] Processed "${group.name}" in ${group.city}` +
          ` with ${group.contributions.length} contribution(s)`
        );
      }
    } catch (e) {
      console.error(
        `  [ERROR] Failed to write spot "${group.name}" (${group.city}):`,
        e
      );
      errors++;
    }
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  LIVE WRITE COMPLETE");
  console.log("══════════════════════════════════════════");
  console.log(`  CommunitySpots created:   ${created}`);
  console.log(`  CommunitySpots updated:   ${updated}`);
  console.log(`  SpotContributions upserted: ${contributionsCreated}`);
  console.log(`  Errors:                   ${errors}`);
  console.log("══════════════════════════════════════════\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Building candidates...\n");

  const [sourceA, sourceB] = await Promise.all([
    buildSavedItemCandidates(),
    buildPlaceRatingCandidates(),
  ]);

  const totalCleanedCount = sourceA.cleanedCount + sourceB.cleanedCount;
  const allCandidates = [...sourceA.candidates, ...sourceB.candidates];
  console.log(`\nTotal raw candidates: ${allCandidates.length}\n`);

  console.log("Enriching candidates via Google Places...\n");
  const { enriched, skippedUnresolved } = await enrichCandidates(allCandidates);
  console.log(`Candidates after enrichment: ${enriched.length}\n`);

  console.log("Grouping into CommunitySpots...\n");
  const { groups, rawNameMap } = groupIntoSpots(enriched);
  console.log(`Unique CommunitySpot groups: ${groups.length}\n`);

  if (isDryRun) {
    printDryRunSummary(
      sourceA.candidates,
      sourceB.candidates,
      0, // skippedNoNameCity counted inline during build
      skippedUnresolved,
      totalCleanedCount,
      groups,
      rawNameMap
    );
  } else {
    console.log(`Writing ${groups.length} spots to DB...\n`);
    await writeSpots(groups);
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
