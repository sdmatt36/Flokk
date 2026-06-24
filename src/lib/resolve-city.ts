import { db } from "@/lib/db";

// Single source of truth for resolving a free-text destination string (e.g. "Tokyo, Japan",
// "tokyo", "Shibuya") to a canonical City row + country name. Used at write time by every
// tour-creation path AND by the cityId backfill, so the two never diverge.
//
// MATCH-ONLY — never creates a City. Returns { null, null } when nothing matches.

// Neighborhoods / region descriptors → canonical city slug. Mirrors the alias map in
// scripts/backfill-communityspot-city.ts; extend as new variants surface.
const CITY_ALIASES: Record<string, string> = {
  "ha long bay": "ha-long",
  "shibuya": "tokyo",
};

export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type CityMatch = { id: string; country: { name: string } };

async function cityBySlug(slug: string): Promise<CityMatch | null> {
  if (!slug) return null;
  return db.city.findUnique({
    where: { slug },
    select: { id: true, country: { select: { name: true } } },
  });
}

// Case-insensitive name match, accepted only when unambiguous (exactly one City). Multiple
// cities share a name across countries, so an ambiguous match is treated as no match.
async function cityByNameUnambiguous(name: string): Promise<CityMatch | null> {
  if (!name) return null;
  const matches = await db.city.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, country: { select: { name: true } } },
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function resolveCityAndCountry(
  destinationCity: string | null,
): Promise<{ cityId: string | null; destinationCountry: string | null }> {
  const NONE = { cityId: null, destinationCountry: null };
  const raw = destinationCity?.trim();
  if (!raw) return NONE;

  // Pass 0 — alias map (neighborhood/region → canonical city slug)
  const alias = CITY_ALIASES[raw.toLowerCase()];
  if (alias) {
    const c = await cityBySlug(alias);
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
  }

  // Pass 1 — slug of the full string
  let c = await cityBySlug(slugifyCity(raw));
  if (c) return { cityId: c.id, destinationCountry: c.country.name };

  // Pass 2 — unambiguous name match on the full string
  c = await cityByNameUnambiguous(raw);
  if (c) return { cityId: c.id, destinationCountry: c.country.name };

  // Pass 3 — strip a trailing ", <Country>" suffix: take the first comma part, slug then name
  const firstPart = raw.split(",")[0].trim();
  if (firstPart && firstPart !== raw) {
    c = await cityBySlug(slugifyCity(firstPart));
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
    c = await cityByNameUnambiguous(firstPart);
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
  }

  return NONE;
}
