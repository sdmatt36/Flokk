/**
 * cleanVenueName — shared venue name cleaner for migration scripts.
 *
 * Strips:
 *   - " | Tabelog" suffix and anything after it
 *   - " - City/Category" Tabelog-style suffix (e.g. " - Hase/Cafe")
 *   - Trailing Japanese parenthetical location+category (e.g. "(北鎌倉/寿司)")
 *   - Excess whitespace
 */
export function cleanVenueName(raw: string): string {
  if (!raw) return raw;
  let name = raw;

  // Strip " | Tabelog" suffix and anything after it
  name = name.replace(/\s*\|\s*Tabelog.*$/i, "");

  // Strip " - City/Category" Tabelog-style suffix (e.g. " - Hase/Cafe", " - Kamakura/Creative")
  // Pattern: space-dash-space, then word(s), slash, word(s), until end or next pipe
  name = name.replace(/\s+-\s+[^|]+\/[^|]+$/i, "");

  // Strip trailing parenthetical location+category for Japanese listings
  // e.g. "野菜すし処 ちらしや (北鎌倉/寿司)" → "野菜すし処 ちらしや"
  // Pattern: space, open-paren, content with slash, close-paren, end
  name = name.replace(/\s*\([^)]*\/[^)]*\)\s*$/u, "");

  // Collapse whitespace and trim
  name = name.replace(/\s+/g, " ").trim();

  return name;
}
