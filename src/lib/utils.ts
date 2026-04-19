import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a hotel (or venue) name to title case.
 * - If the string already has mixed case (e.g. "The St. Regis Osaka"), preserve it.
 * - All-caps (e.g. "HOME HOTEL HAVNEKONTORET") or all-lower → convert to title case.
 * - Minor words (and, or, the, of, …) stay lowercase unless they are the first word.
 * - Accented characters are preserved as-is (Reykjavík stays Reykjavík).
 * - Returns "" for null/undefined/empty input.
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str || typeof str !== "string") return "";

  const trimmed = str.trim();
  if (trimmed.length === 0) return "";

  // Already mixed case — preserve it unchanged
  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  if (hasLower && hasUpper) return trimmed;

  const minorWords = new Set(["and", "or", "the", "of", "at", "by", "for", "in", "on", "to", "a", "an"]);

  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (word.length === 0) return word;
      if (idx > 0 && minorWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
