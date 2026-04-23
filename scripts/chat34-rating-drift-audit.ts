/**
 * chat34-rating-drift-audit.ts
 *
 * READ-ONLY. Finds all SavedItems where userRating IS set but zero PlaceRating rows
 * exist for that savedItemId. These are "drifted" items — rated by the user but
 * invisible to Community Picks (which aggregates via PlaceRating INNER JOIN).
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/chat34-rating-drift-audit.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  // Find all SavedItems that have a userRating but no associated PlaceRating rows
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
      savedAt: true,
    },
    orderBy: [{ familyProfileId: "asc" }, { destinationCity: "asc" }],
  });

  console.log(`\n=== RATING DRIFT AUDIT ===`);
  console.log(`SavedItems with userRating set but NO PlaceRating rows: ${drifted.length}\n`);

  if (drifted.length === 0) {
    console.log("No drift found. All rated items have PlaceRating rows.");
    return;
  }

  // Group by familyProfileId for readability
  const byProfile = new Map<string, typeof drifted>();
  for (const item of drifted) {
    const group = byProfile.get(item.familyProfileId) ?? [];
    group.push(item);
    byProfile.set(item.familyProfileId, group);
  }

  for (const [profileId, items] of byProfile) {
    console.log(`Profile: ${profileId} — ${items.length} drifted item(s)`);
    for (const item of items) {
      const tags = item.categoryTags.join(", ") || "(none)";
      const coords = item.lat != null && item.lng != null ? `${item.lat.toFixed(4)},${item.lng.toFixed(4)}` : "no coords";
      const cs = item.communitySpotId ? `cs:${item.communitySpotId}` : "no communitySpot";
      console.log(
        `  [${item.id}] "${item.rawTitle ?? "(no title)"}"` +
        ` — ${item.destinationCity ?? "?"}, ${item.destinationCountry ?? "?"}` +
        ` — rating:${item.userRating} — ${coords} — ${cs} — tags:[${tags}]`
      );
    }
    console.log("");
  }

  console.log(`Total drifted: ${drifted.length}`);
  console.log(`Profiles affected: ${byProfile.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
