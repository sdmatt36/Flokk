/**
 * backfill-tour-categorization.ts
 *
 * Backfill categoryTags on legacy tour-saved SavedItems with empty categoryTags.
 * These were created before Chat 39 commit ba61d88 (tour categorization forward path).
 *
 * Cost estimate: up to 13 Places Text Search + 13 Places Details = ~$0.22 max
 * (Edinburgh rows use "Scotland" as city — some may fail lookup, logged for manual review)
 *
 * Idempotency: rows with non-empty categoryTags are skipped automatically (WHERE clause).
 *              TourStop.placeTypes populated on prior run → cached branch, no Places re-fetch.
 *
 * Usage:
 *   npx tsx scripts/backfill-tour-categorization.ts           # live run
 *   npx tsx scripts/backfill-tour-categorization.ts --dry-run # Places API calls, no DB writes
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { mapPlaceTypesToCanonicalSlugs } from "../src/lib/categories";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";
const MAX_PLACES_FETCHES = 50;
const DRY_RUN = process.argv.includes("--dry-run");

interface AffectedRow {
  id: string;
  rawTitle: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  tourId: string;
  tourStopId: string | null;
  existingPlaceTypes: string[] | null;
}

async function fetchPlaceTypes(
  rawTitle: string,
  city: string | null,
  country: string | null
): Promise<string[]> {
  const queryParts = [rawTitle.trim(), city?.trim(), country?.trim()].filter(Boolean);
  const query = queryParts.join(" ");
  if (!query || !API_KEY) return [];

  try {
    const searchRes = await fetch(
      `${PLACES_TEXT_SEARCH}?query=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    const searchData = (await searchRes.json()) as { results?: Array<{ place_id: string }> };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return [];

    const detailsRes = await fetch(
      `${PLACES_DETAILS}?place_id=${placeId}&fields=name,types&key=${API_KEY}`
    );
    const detailsData = (await detailsRes.json()) as {
      result?: { name?: string; types?: string[] };
    };
    return detailsData.result?.types ?? [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(`=== Tour Categorization Backfill${DRY_RUN ? " (DRY RUN — no DB writes)" : ""} ===\n`);

  if (!API_KEY) {
    console.error("FATAL: GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  // Rows with empty categoryTags + ENRICHED + linked to a tour
  // JOIN TourStop to check for already-cached placeTypes from the forward path
  const rows = await db.$queryRaw<AffectedRow[]>`
    SELECT
      si.id,
      si."rawTitle",
      si."destinationCity",
      si."destinationCountry",
      si."tourId",
      ts.id              AS "tourStopId",
      ts."placeTypes"    AS "existingPlaceTypes"
    FROM "SavedItem" si
    LEFT JOIN "TourStop" ts ON ts."savedItemId" = si.id
    WHERE si."categoryTags" = '{}'
      AND si."extractionStatus" = 'ENRICHED'
      AND si."tourId" IS NOT NULL
    ORDER BY si.id ASC
  `;

  console.log(`Found ${rows.length} rows to process.\n`);

  let cachedCount = 0;
  let fetchedCount = 0;
  let updatedCount = 0;
  let manualReviewCount = 0;
  let placesErrorCount = 0;
  let placeFetchTotal = 0;
  const slugDistribution: Record<string, number> = {};
  const manualReviewRows: Array<{ id: string; rawTitle: string; placeTypes: string[] }> = [];

  for (const row of rows) {
    const city = row.destinationCity ?? "";
    const country = row.destinationCountry ?? "";
    console.log(`\n[${row.id}] "${row.rawTitle}" (${city || "?"}${country ? `, ${country}` : ""})`);
    console.log(`  tourId=${row.tourId} | tourStopId=${row.tourStopId ?? "none"}`);

    let placeTypes: string[] = row.existingPlaceTypes ?? [];
    let branch: "cached" | "fetched" | "error" = "cached";

    if (placeTypes.length > 0) {
      // Forward path already ran for this stop after ba61d88 — use stored types
      console.log(`  branch: cached — TourStop.placeTypes=${JSON.stringify(placeTypes)}`);
      cachedCount++;
    } else {
      // Need Places re-fetch (pre-ba61d88 stop, placeTypes never written)
      if (placeFetchTotal >= MAX_PLACES_FETCHES) {
        console.log(`  SKIP: hit hard cap of ${MAX_PLACES_FETCHES} Places fetches per run`);
        continue;
      }

      placeFetchTotal++;
      branch = "fetched";
      console.log(`  branch: re-fetch — Places query: "${row.rawTitle} ${city} ${country}".trim()`);

      try {
        placeTypes = await fetchPlaceTypes(row.rawTitle, city || null, country || null);
        console.log(`  Places types: ${JSON.stringify(placeTypes)}`);

        // Write placeTypes back to TourStop for idempotency on re-runs
        if (row.tourStopId && placeTypes.length > 0 && !DRY_RUN) {
          await db.tourStop.update({
            where: { id: row.tourStopId },
            data: { placeTypes },
          });
          console.log(`  TourStop.placeTypes written back (${row.tourStopId})`);
        } else if (row.tourStopId && placeTypes.length > 0 && DRY_RUN) {
          console.log(`  [dry-run] would write TourStop.placeTypes (${row.tourStopId})`);
        }

        fetchedCount++;
      } catch (err) {
        console.error(`  Places error: ${err instanceof Error ? err.message : err}`);
        placeTypes = [];
        branch = "error";
        placesErrorCount++;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    const canonicalSlugs = mapPlaceTypesToCanonicalSlugs(placeTypes);
    console.log(`  mapper: ${JSON.stringify(placeTypes)} → ${JSON.stringify(canonicalSlugs)}`);

    if (canonicalSlugs.length > 0) {
      if (DRY_RUN) {
        console.log(`  [dry-run] would set categoryTags=${JSON.stringify(canonicalSlugs)}`);
      } else {
        await db.savedItem.update({
          where: { id: row.id },
          data: { categoryTags: canonicalSlugs },
        });
        console.log(`  SavedItem.categoryTags updated → ${JSON.stringify(canonicalSlugs)}`);
      }
      updatedCount++;
      for (const s of canonicalSlugs) {
        slugDistribution[s] = (slugDistribution[s] ?? 0) + 1;
      }
    } else {
      console.log(`  manual-review: no mapping found — leaving categoryTags empty`);
      manualReviewCount++;
      manualReviewRows.push({ id: row.id, rawTitle: row.rawTitle, placeTypes });
    }

    void branch; // used in logs above, suppress lint
  }

  console.log("\n=== Summary ===");
  console.log(`Total rows:    ${rows.length}`);
  console.log(`Updated:       ${updatedCount}${DRY_RUN ? " (dry-run, not written)" : ""}`);
  console.log(`Manual-review: ${manualReviewCount} (categoryTags left empty)`);
  console.log(`Places errors: ${placesErrorCount}`);
  console.log(`Branches:      cached=${cachedCount}, fetched=${fetchedCount}`);
  console.log(`Places calls:  ${placeFetchTotal}/${MAX_PLACES_FETCHES} cap`);
  console.log(`Slug distribution: ${JSON.stringify(slugDistribution, null, 2)}`);

  if (manualReviewRows.length > 0) {
    console.log("\nManual-review rows (no mapping found):");
    for (const r of manualReviewRows) {
      console.log(`  ${r.id} | "${r.rawTitle}" | raw types: ${JSON.stringify(r.placeTypes)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
