export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let cleaned = input.trim();
  // Strip trailing punctuation that breaks links
  cleaned = cleaned.replace(/[.,;:!?)\]]+$/, "");
  // Strip leading punctuation that breaks links
  cleaned = cleaned.replace(/^[\s,;:!?(\[]+/, "");
  if (!cleaned) return null;
  // Require http(s):// scheme
  if (!/^https?:\/\//i.test(cleaned)) return null;
  // Validate URL parses
  try {
    const u = new URL(cleaned);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return null;
    return u.toString();
  } catch {
    return null;
  }
}
