/**
 * Resolves a navigable URL for a saved item using a priority chain.
 *
 * Priority:
 *   1. websiteUrl   (enriched official site)
 *   2. sourceUrl    (inbound save URL)
 *   3. Google Maps coord search (lat+lng)
 *   4. Google Maps name+city search (text)
 *   5. null         (truly unlinkable)
 *
 * Returns { url, label, isFallback } so the render layer can optionally
 * style fallbacks differently. Current policy: no visual distinction —
 * users care about destination, not provenance.
 *
 * `label` is reserved for future intelligence (e.g. "Book tickets" for
 * ticketed venues). Today it always returns "Link".
 */
export interface SaveLinkInput {
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  rawTitle?: string | null;
  destinationCity?: string | null;
}

export interface SaveLinkResult {
  url: string;
  label: string;
  isFallback: boolean;
}

export function resolveSaveLink(save: SaveLinkInput): SaveLinkResult | null {
  if (save.websiteUrl && save.websiteUrl.trim()) {
    return { url: save.websiteUrl.trim(), label: "Link", isFallback: false };
  }
  if (save.sourceUrl && save.sourceUrl.trim()) {
    return { url: save.sourceUrl.trim(), label: "Link", isFallback: false };
  }
  if (typeof save.lat === "number" && typeof save.lng === "number") {
    const url = `https://www.google.com/maps/search/?api=1&query=${save.lat},${save.lng}`;
    return { url, label: "Link", isFallback: true };
  }
  if (save.rawTitle && save.destinationCity) {
    const query = encodeURIComponent(`${save.rawTitle} ${save.destinationCity}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    return { url, label: "Link", isFallback: true };
  }
  return null;
}
