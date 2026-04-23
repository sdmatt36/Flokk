/**
 * Resolves a navigable URL for a saved item using a priority chain.
 *
 * Priority (highest intent first):
 *   1. websiteUrl              (user-edited canonical site — highest intent)
 *   2. sourceUrl               (inbound URL from the original save)
 *   3. communitySpotWebsiteUrl (shared enriched URL from Google Places)
 *   4. Google Maps coord search (lat+lng)
 *   5. Google Maps name+city search (text)
 *   6. null                    (truly unlinkable)
 *
 * Tiers 1–3 are user/community-supplied URLs and are passed through
 * stripTrackingParams before being returned. Tiers 4–5 are constructed by
 * us and need no stripping.
 *
 * Returns { url, label, isFallback } so the render layer can optionally
 * style fallbacks differently. Current policy: no visual distinction —
 * users care about destination, not provenance.
 *
 * `label` is reserved for future intelligence (e.g. "Book tickets" for
 * ticketed venues). Today it always returns "Link".
 */

/**
 * Tracking/analytics params to strip from URLs at render time.
 * Allowlist approach — only known-safe tracking params are removed.
 * Load-bearing params (id, q, category, tourism_id, etc) stay put.
 */
const TRACKING_PARAMS = new Set([
  "SEO_id", "seo_id",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "gclid", "msclkid",
  "_ga", "_gl",
  "ref", "referrer", "source",
]);

/**
 * Strip tracking params from a URL. Returns the cleaned URL, or the
 * original string if the URL isn't parseable (malformed URLs pass through
 * untouched rather than being dropped).
 */
export function stripTrackingParams(url: string): string {
  try {
    const u = new URL(url);
    const keep = new URLSearchParams();
    for (const [key, val] of u.searchParams) {
      if (!TRACKING_PARAMS.has(key)) keep.append(key, val);
    }
    u.search = keep.toString();
    return u.toString();
  } catch {
    return url;
  }
}

export interface SaveLinkInput {
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  communitySpotWebsiteUrl?: string | null;
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
    return { url: stripTrackingParams(save.websiteUrl.trim()), label: "Link", isFallback: false };
  }
  if (save.sourceUrl && save.sourceUrl.trim()) {
    return { url: stripTrackingParams(save.sourceUrl.trim()), label: "Link", isFallback: false };
  }
  if (save.communitySpotWebsiteUrl && save.communitySpotWebsiteUrl.trim()) {
    return { url: stripTrackingParams(save.communitySpotWebsiteUrl.trim()), label: "Link", isFallback: false };
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
