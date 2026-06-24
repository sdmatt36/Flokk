import { db } from "@/lib/db";

// Single source of truth for resolving a free-text destination string (e.g. "Tokyo, Japan",
// "tokyo", "Shibuya") to a canonical City row + country name. Used at write time by every
// tour-creation path AND by the cityId backfill, so the two never diverge.
//
// MATCH-ONLY — never creates a City or Country. Returns { null, null } when nothing matches.

// Neighborhoods / region descriptors → canonical city slug. Mirrors the alias map in
// scripts/backfill-communityspot-city.ts; extend as new variants surface.
const CITY_ALIASES: Record<string, string> = {
  "ha long bay": "ha-long",
  "shibuya": "tokyo",
};

// Curated region/landmark → country aliases, ONLY for strings that resolve to no City and no
// Country row at all (genuine landmarks/islands). Intentionally tiny and hand-maintained — NOT
// a general gazetteer. Keys are normalized (lowercased) input strings (full or first-comma-part);
// values are Country names re-resolved through the Country table at match time so they stay
// canonical. Anything that IS a real Country (e.g. Scotland, Ireland) is left to Pass 5's generic
// Country-name match — it must NOT be aliased here, so those keep their own country.
const COUNTRY_ALIASES: Record<string, string> = {
  "mt. fuji": "Japan",
  "mount fuji": "Japan",
  "fuji": "Japan",
  "ko samui": "Thailand",
  "koh samui": "Thailand",
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

// Case-insensitive Country-name match → canonical Country.name (or null).
async function countryByName(name: string): Promise<string | null> {
  if (!name) return null;
  const row = await db.country.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { name: true },
  });
  return row?.name ?? null;
}

export async function resolveCityAndCountry(
  destinationCity: string | null,
): Promise<{ cityId: string | null; destinationCountry: string | null }> {
  const NONE = { cityId: null, destinationCountry: null };
  const raw = destinationCity?.trim();
  if (!raw) return NONE;

  const firstPart = raw.split(",")[0].trim();

  // ── City passes (the only paths that set a cityId) ────────────────────────────

  // Pass 0 — city alias map (neighborhood/region → canonical city slug)
  const cityAlias = CITY_ALIASES[raw.toLowerCase()];
  if (cityAlias) {
    const c = await cityBySlug(cityAlias);
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
  }

  // Pass 1 — slug of the full string
  let c = await cityBySlug(slugifyCity(raw));
  if (c) return { cityId: c.id, destinationCountry: c.country.name };

  // Pass 2 — unambiguous name match on the full string
  c = await cityByNameUnambiguous(raw);
  if (c) return { cityId: c.id, destinationCountry: c.country.name };

  // Pass 3 — strip a trailing ", <Country>" suffix: take the first comma part, slug then name
  if (firstPart && firstPart !== raw) {
    c = await cityBySlug(slugifyCity(firstPart));
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
    c = await cityByNameUnambiguous(firstPart);
    if (c) return { cityId: c.id, destinationCountry: c.country.name };
  }

  // ── Country fallback (cityId stays null; sets destinationCountry only) ─────────

  // Pass 4 — curated alias map FIRST (so intentional overrides win even when the token also
  // exists as a Country row, e.g. "Scotland" → United Kingdom). Try full string then first part.
  const aliasTarget =
    COUNTRY_ALIASES[raw.toLowerCase()] ?? COUNTRY_ALIASES[firstPart.toLowerCase()];
  if (aliasTarget) {
    const country = await countryByName(aliasTarget);
    if (country) return { cityId: null, destinationCountry: country };
  }

  // Pass 5 — generic Country-name match: full string, then first comma part.
  let country = await countryByName(raw);
  if (!country && firstPart && firstPart !== raw) country = await countryByName(firstPart);
  if (country) return { cityId: null, destinationCountry: country };

  return NONE;
}
