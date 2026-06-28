// Renders a family's display label for collaborator invites (email subject/heading + the accept
// page). Family names are stored bare (e.g. "Greene" -> "Greene Family"), but a few rows already
// include the suffix, and appending unconditionally would produce "X Family Family". Idempotent:
// append " Family" ONLY when the trimmed name does not already end in "family" (case-insensitive).
// Null / empty / whitespace -> fallback.
export function inviterLabel(familyName: string | null): string {
  const name = familyName?.trim();
  if (!name) return "A Flokk family";
  return /family$/i.test(name) ? name : `${name} Family`;
}
