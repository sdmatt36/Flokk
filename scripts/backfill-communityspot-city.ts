import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Maps raw city strings from CommunitySpot.city to canonical city slugs.
// Handles neighborhoods (Shibuya → tokyo) and region descriptors (Ha Long Bay → ha-long).
// Extensible: add entries as new naming variants surface.
const CITY_ALIASES: Record<string, string> = {
  "ha long bay": "ha-long",
  "shibuya": "tokyo",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // ── Load all cities into lookup maps ────────────────────────────────────────
  const allCities = await db.city.findMany({ select: { id: true, slug: true, name: true } });

  // slug → id (exact slug match — primary path)
  const slugMap = new Map<string, string>();
  // normalized lowercase name → array of ids (may have multiple cities with same name in diff countries)
  const nameMap = new Map<string, string[]>();

  for (const city of allCities) {
    slugMap.set(city.slug, city.id);
    const norm = city.name.toLowerCase().trim();
    const existing = nameMap.get(norm) ?? [];
    existing.push(city.id);
    nameMap.set(norm, existing);
  }

  console.log(`City lookup maps loaded: ${slugMap.size} slugs, ${nameMap.size} unique names`);

  // ── Load unlinked CommunitySpots ─────────────────────────────────────────────
  const spots = await db.communitySpot.findMany({
    where: { cityId: null, NOT: { city: "" } },
    select: { id: true, city: true, name: true },
  });

  console.log(`Unlinked spots to process: ${spots.length}`);

  let linked = 0;
  let aliasLinked = 0;
  let unmatched = 0;
  let ambiguous = 0;
  const unmatchedSpots: Array<{ id: string; name: string; city: string }> = [];
  const ambiguousSpots: Array<{ id: string; name: string; city: string; candidates: string[] }> = [];
  const aliasLog: Array<{ city: string; resolvedSlug: string }> = [];

  for (const spot of spots) {
    const rawCity = spot.city.trim();
    let matchedId: string | null = null;
    let candidateSlugs: string[] = [];
    let wasAlias = false;

    // Pass 0 — alias map (neighborhood/region → canonical city slug)
    const aliasKey = rawCity.toLowerCase();
    if (CITY_ALIASES[aliasKey]) {
      const targetSlug = CITY_ALIASES[aliasKey];
      if (slugMap.has(targetSlug)) {
        matchedId = slugMap.get(targetSlug)!;
        wasAlias = true;
        aliasLog.push({ city: rawCity, resolvedSlug: targetSlug });
      }
    }

    // Pass 1 — slug of full city string
    const fullSlug = slugify(rawCity);
    if (slugMap.has(fullSlug)) {
      matchedId = slugMap.get(fullSlug)!;
    }

    // Pass 2 — lowercase name match (only if unambiguous)
    if (!matchedId) {
      const norm = rawCity.toLowerCase();
      const ids = nameMap.get(norm);
      if (ids && ids.length === 1) {
        matchedId = ids[0];
      } else if (ids && ids.length > 1) {
        candidateSlugs = ids.map(
          (id) => allCities.find((c) => c.id === id)?.slug ?? id
        );
      }
    }

    // Pass 3 — slug of first component before comma (e.g. "Tokyo, Japan" → "tokyo")
    if (!matchedId && candidateSlugs.length === 0) {
      const firstPart = rawCity.split(",")[0].trim();
      if (firstPart !== rawCity) {
        const partSlug = slugify(firstPart);
        if (slugMap.has(partSlug)) {
          matchedId = slugMap.get(partSlug)!;
        }
        // Also try nameMap on first part
        if (!matchedId) {
          const norm = firstPart.toLowerCase();
          const ids = nameMap.get(norm);
          if (ids && ids.length === 1) {
            matchedId = ids[0];
          } else if (ids && ids.length > 1) {
            candidateSlugs = ids.map(
              (id) => allCities.find((c) => c.id === id)?.slug ?? id
            );
          }
        }
      }
    }

    // Ambiguous: multiple name matches but no slug match resolved it
    if (!matchedId && candidateSlugs.length > 1) {
      ambiguousSpots.push({
        id: spot.id,
        name: spot.name,
        city: rawCity,
        candidates: candidateSlugs,
      });
      ambiguous++;
      continue;
    }

    if (!matchedId) {
      unmatchedSpots.push({ id: spot.id, name: spot.name, city: rawCity });
      unmatched++;
      continue;
    }

    await db.communitySpot.update({
      where: { id: spot.id },
      data: { cityId: matchedId },
    });
    if (wasAlias) {
      aliasLinked++;
    } else {
      linked++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n── Backfill complete ──────────────────────────────────────────");
  console.log(`  Total scanned:     ${spots.length}`);
  console.log(`  Newly linked:      ${linked}`);
  console.log(`  Alias linked:      ${aliasLinked}`);
  console.log(`  Unmatched:         ${unmatched}`);
  console.log(`  Ambiguous skipped: ${ambiguous}`);

  if (aliasLog.length > 0) {
    const aliasCounts = aliasLog.reduce<Record<string, number>>((acc, { resolvedSlug }) => {
      acc[resolvedSlug] = (acc[resolvedSlug] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`  Alias breakdown:   ${Object.entries(aliasCounts).map(([s, n]) => `${s}: ${n}`).join(", ")}`);
  }

  if (unmatchedSpots.length > 0) {
    console.log("\nUnmatched spots (first 30):");
    const unique = [...new Map(unmatchedSpots.map((s) => [s.city, s])).values()];
    unique.slice(0, 30).forEach((s) =>
      console.log(`  [${s.id}] "${s.name}" — city: "${s.city}"`)
    );
  }

  if (ambiguousSpots.length > 0) {
    console.log("\nAmbiguous spots (first 10):");
    ambiguousSpots.slice(0, 10).forEach((s) =>
      console.log(
        `  [${s.id}] "${s.name}" — city: "${s.city}" → candidates: ${s.candidates.join(", ")}`
      )
    );
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
