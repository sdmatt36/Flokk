/**
 * Resolves a navigable URL for a saved item using a priority chain.
 *
 * Priority (highest intent first):
 *   1. websiteUrl / sourceUrl / affiliateUrl  (user/source-supplied URLs)
 *   2. communitySpotWebsiteUrl (shared enriched URL — skipped when hostname is
 *      google.com, www.google.com, or maps.google.com; sites.google.com and
 *      other google-hosted real venue pages are passed through)
 *   3. googlePlaceId → Google Maps place URL
 *   4. mapsUrl                (Google Maps deep link stored at enrichment time)
 *   5. Google Maps name+city search (text fallback)
 *   6. Google Maps coord search (lat+lng fallback)
 *   7. null                    (truly unlinkable)
 *
 * Tiers 1–2 are user/community-supplied URLs and are passed through
 * stripTrackingParams before being returned. Tiers 5–6 are constructed by
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
  affiliateUrl?: string | null;
  communitySpotWebsiteUrl?: string | null;
  googlePlaceId?: string | null;
  mapsUrl?: string | null;
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
  if (save.affiliateUrl && save.affiliateUrl.trim()) {
    return { url: stripTrackingParams(save.affiliateUrl.trim()), label: "Link", isFallback: false };
  }
  if (save.communitySpotWebsiteUrl && save.communitySpotWebsiteUrl.trim()) {
    try {
      const host = new URL(save.communitySpotWebsiteUrl.trim()).hostname.toLowerCase();
      // Block bare google.com and Maps CID links — enrichment artifacts, not venue websites.
      // Allow sites.google.com and other google-hosted real venue pages.
      const isGoogleJunk = host === "google.com" || host === "www.google.com" || host === "maps.google.com";
      if (!isGoogleJunk) {
        return { url: stripTrackingParams(save.communitySpotWebsiteUrl.trim()), label: "Link", isFallback: false };
      }
    } catch {
      // malformed URL — fall through
    }
  }
  if (save.googlePlaceId && save.googlePlaceId.trim()) {
    const url = `https://www.google.com/maps/place/?q=place_id:${save.googlePlaceId.trim()}`;
    return { url, label: "Link", isFallback: false };
  }
  if (save.mapsUrl && save.mapsUrl.trim()) {
    return { url: stripTrackingParams(save.mapsUrl.trim()), label: "Link", isFallback: false };
  }
  if (save.rawTitle && save.destinationCity) {
    const query = encodeURIComponent(`${save.rawTitle}, ${save.destinationCity}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    return { url, label: "Link", isFallback: true };
  }
  if (typeof save.lat === "number" && typeof save.lng === "number") {
    const url = `https://www.google.com/maps/search/?api=1&query=${save.lat},${save.lng}`;
    return { url, label: "Link", isFallback: true };
  }
  return null;
}
