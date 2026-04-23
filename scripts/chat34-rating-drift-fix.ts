/**
 * chat34-rating-drift-fix.ts
 *
 * Creates a PlaceRating row for every SavedItem that has userRating set but
 * no existing PlaceRating. This makes drifted items visible to Community Picks.
 *
 * The PlaceRating row mirrors what "How Was It" would have written:
 *   - rating     = savedItem.userRating
 *   - placeName  = savedItem.rawTitle
 *   - placeType  = derived from categoryTags (first tag, or "place")
 *   - destinationCity = savedItem.destinationCity
 *   - lat / lng  = savedItem.lat / lng
 *   - savedItemId = savedItem.id
 *   - familyProfileId = savedItem.familyProfileId
 *   - tripId     = savedItem.tripId
 *
 * Run dry-run (default, no writes):
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/chat34-rating-drift-fix.ts
 *
 * Run live:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/chat34-rating-drift-fix.ts --live
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const isLive = process.argv.includes("--live");

const TRANSIT_TAGS = new Set(["train", "flight", "bus", "transit", "car_rental", "rental"]);

function derivePlaceType(categoryTags: string[]): string {
  if (!categoryTags || categoryTags.length === 0) return "place";
  const tag = categoryTags[0].toLowerCase();
  if (tag.includes("lodging") || tag.includes("hotel")) return "lodging";
  if (tag.includes("food") || tag.includes("restaurant")) return "restaurant";
  if (tag.includes("activity") || tag.includes("tour") || tag.includes("attraction")) return "activity";
  return tag;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const drifted = await db.savedItem.findMany({
    where: {
      userRating: { not: null },
      ratings: { none: {} },
    },
    select: {
      id: true,
      familyProfileId: true,
      tripId: true,
      rawTitle: true,
      destinationCity: true,
      destinationCountry: true,
      userRating: true,
      lat: true,
      lng: true,
      categoryTags: true,
      communitySpotId: true,
    },
    orderBy: [{ familyProfileId: "asc" }, { destinationCity: "asc" }],
  });

  console.log(`\n=== RATING DRIFT FIX — ${isLive ? "LIVE" : "DRY RUN"} ===`);
  console.log(`Drifted items to fix: ${drifted.length}\n`);

  if (drifted.length === 0) {
    console.log("Nothing to fix.");
    return;
  }

  let created = 0;
  let errors = 0;
  let skipped = 0;

  for (const item of drifted) {
    const tagsLower = (item.categoryTags ?? []).map(t => t.toLowerCase());
    const isTransit = tagsLower.some(t => TRANSIT_TAGS.has(t));
    if (isTransit) {
      console.log(`[skip transit] ${item.rawTitle} (tags: ${JSON.stringify(item.categoryTags)})`);
      skipped++;
      continue;
    }

    const placeType = derivePlaceType(item.categoryTags);
    const placeName = item.rawTitle ?? item.destinationCity ?? "Unknown";

    console.log(
      `[${isLive ? "LIVE" : "DRY"}] CreatePlaceRating` +
      ` savedItemId=${item.id}` +
      ` profile=${item.familyProfileId}` +
      ` name="${placeName}"` +
      ` type=${placeType}` +
      ` rating=${item.userRating}` +
      ` city=${item.destinationCity ?? "?"}`
    );

    if (isLive) {
      try {
        await db.placeRating.create({
          data: {
            familyProfileId: item.familyProfileId,
            tripId: item.tripId ?? null,
            savedItemId: item.id,
            placeName,
            placeType,
            destinationCity: item.destinationCity ?? null,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            rating: item.userRating!,
          },
        });
        created++;
        console.log(`  → Created OK`);
      } catch (e) {
        errors++;
        console.error(`  → ERROR: ${e}`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Mode: ${isLive ? "LIVE" : "DRY RUN"}`);
  console.log(`Total drifted: ${drifted.length}`);
  console.log(`Skipped (transit): ${skipped}`);
  if (isLive) {
    console.log(`Created: ${created}`);
    console.log(`Errors:  ${errors}`);
  } else {
    console.log(`(Dry run — no rows written. Pass --live to execute.)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
