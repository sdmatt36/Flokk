// Extracts the most likely venue name from AI-generated verbose titles.
// AI itinerary extraction often produces titles like:
//   "Gion District Vegetarian Sushi Restaurant (Katsukura)"
//   "Nishiki Market (Vegetarian Food Stalls)"
//   "Maruyama Park (Maruyama Koen)"
// The real venue name is usually in the parenthetical, not the prefix.

const GENERIC_CATEGORY_WORDS = new Set([
  "restaurant", "cafe", "café", "coffee", "shop", "store",
  "park", "garden", "temple", "shrine", "museum", "market",
  "district", "neighbourhood", "neighborhood", "area", "quarter",
  "tour", "walking", "walk", "morning", "afternoon", "evening",
  "day", "experience", "class", "cooking", "culinary", "studio",
  "vegetarian", "vegan", "halal", "kosher", "gluten",
  "trip", "visit", "exploration", "adventure",
]);

function extractParenthetical(title: string): string | null {
  const match = title.match(/\(([^)]+)\)/);
  if (!match) return null;
  const inner = match[1].trim();
  // Skip parentheticals that are themselves descriptive ("Vegetarian Focus", "Vegetarian Food Stalls")
  // Heuristic: if >60% of the inner words are in GENERIC_CATEGORY_WORDS, it's descriptive not a venue name
  const words = inner.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;
  const genericCount = words.filter(w => GENERIC_CATEGORY_WORDS.has(w)).length;
  if (genericCount / words.length > 0.6) return null;
  // Skip "or similar" phrases
  if (/\bor\s+similar\b/i.test(inner)) {
    // Take the first segment before "or similar"
    const before = inner.split(/\s+or\s+similar/i)[0].trim();
    return before.length > 2 ? before : null;
  }
  return inner;
}

function stripGenericPrefixWords(title: string): string {
  // Strip leading generic words until we hit something that might be a real name
  const words = title.split(/\s+/);
  let startIdx = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (!GENERIC_CATEGORY_WORDS.has(w)) break;
    startIdx = i + 1;
  }
  const stripped = words.slice(startIdx).join(" ").trim();
  return stripped.length >= 3 ? stripped : title;
}

export function extractSearchableTitle(rawTitle: string): string[] {
  // Returns an ordered list of candidate search queries, best-guess first.
  // Caller should try each in order until one returns a valid Places match.
  if (!rawTitle) return [];
  const candidates: string[] = [];

  // Candidate 1: title with parenthetical removed (e.g. "Nishiki Market" from "Nishiki Market (Vegetarian Food Stalls)")
  const withoutParen = rawTitle.replace(/\([^)]*\)/g, "").trim().replace(/\s+/g, " ");
  if (withoutParen && withoutParen !== rawTitle && !candidates.includes(withoutParen)) {
    candidates.push(withoutParen);
  }

  // Candidate 2: parenthetical venue name if present (fallback for noisy prefixes like "Gion District Vegetarian Sushi Restaurant (Katsukura)")
  const paren = extractParenthetical(rawTitle);
  if (paren && !candidates.includes(paren)) candidates.push(paren);

  // Candidate 3: generic-prefix stripped version
  const stripped = stripGenericPrefixWords(withoutParen || rawTitle);
  if (stripped && !candidates.includes(stripped)) {
    candidates.push(stripped);
  }

  // Candidate 4: the raw title as-is (original behavior)
  if (!candidates.includes(rawTitle)) {
    candidates.push(rawTitle);
  }

  return candidates;
}
