/**
 * Normalizes and deduplicates a categoryTags array.
 * Canonical form: lowercase, trimmed, non-empty, unique, insertion order preserved.
 * Use at every write site for SavedItem.categoryTags so the DB can never accept
 * dupes or mixed casing.
 */
export function normalizeAndDedupeCategoryTags(
  tags: string[] | null | undefined
): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const normalized = raw.toLowerCase().trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
