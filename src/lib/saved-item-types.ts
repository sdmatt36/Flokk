// =============================================================================
// SavedItem source attribution — two-tier model
// sourceMethod: HOW the item entered the system (method of entry)
// sourcePlatform: WHERE the content originated (inferred from URL domain)
// =============================================================================

export const SAVED_ITEM_SOURCE_METHODS = [
  "EMAIL_FORWARD",      // arrived via CloudMailin inbound email
  "URL_PASTE",          // user submitted a URL in the save flow (includes share-sheet until native app ships)
  "IN_APP_SAVE",        // saved from within the app (recommendations, community, ratings)
  "SHARED_TRIP_IMPORT", // cloned from another user's public trip
] as const;

export type SavedItemSourceMethod = typeof SAVED_ITEM_SOURCE_METHODS[number];

// =============================================================================
// Status derivation
// =============================================================================

export function computeStatus(
  tripId: string | null | undefined,
  dayIndex: number | null | undefined,
  startTime: string | null | undefined
): "UNORGANIZED" | "TRIP_ASSIGNED" | "SCHEDULED" {
  if (!tripId) return "UNORGANIZED";
  if (dayIndex == null) return "TRIP_ASSIGNED";
  if (startTime) return "SCHEDULED";
  return "TRIP_ASSIGNED";
}

// =============================================================================
// Platform inference from URL domain
// sourcePlatform is a stable slug, not a display label
// =============================================================================

const DOMAIN_TO_PLATFORM: Record<string, string> = {
  "instagram.com":      "instagram",
  "www.instagram.com":  "instagram",
  "tiktok.com":         "tiktok",
  "www.tiktok.com":     "tiktok",
  "vm.tiktok.com":      "tiktok",
  "youtube.com":        "youtube",
  "www.youtube.com":    "youtube",
  "youtu.be":           "youtube",
  "maps.google.com":    "google_maps",
  "maps.app.goo.gl":    "google_maps",
  "goo.gl":             "google_maps",
  "airbnb.com":         "airbnb",
  "www.airbnb.com":     "airbnb",
  "airbnb.co.jp":       "airbnb",
  "tripadvisor.com":    "tripadvisor",
  "www.tripadvisor.com":"tripadvisor",
  "getyourguide.com":   "getyourguide",
  "www.getyourguide.com": "getyourguide",
  "viator.com":         "viator",
  "www.viator.com":     "viator",
  "klook.com":          "klook",
  "www.klook.com":      "klook",
  "booking.com":        "booking",
  "www.booking.com":    "booking",
  "hotels.com":         "hotels",
  "www.hotels.com":     "hotels",
  "expedia.com":        "expedia",
  "www.expedia.com":    "expedia",
  "yelp.com":           "yelp",
  "www.yelp.com":       "yelp",
  "tabelog.com":        "tabelog",
  "www.tabelog.com":    "tabelog",
  "gurunavi.com":       "gurunavi",
  "www.gurunavi.com":   "gurunavi",
  "hotpepper.jp":       "hotpepper",
  "www.hotpepper.jp":   "hotpepper",
  "jalan.net":          "jalan",
  "www.jalan.net":      "jalan",
  "share.google":       "google_maps",
  "google.com":         "google_maps",
  "flokk.app":          "direct",
  "flokktravel.com":    "direct",
  "example.com":        "direct",
};

/**
 * Infer a platform slug from a URL string.
 * Returns "direct" for null/empty input.
 * Strips www. and m. prefixes before registry lookup so both
 * "www.google.com/maps/..." and "google.com/maps/..." resolve identically.
 * Falls back to the bare (stripped) hostname for unregistered domains.
 */
export function inferPlatformFromUrl(url: string | null | undefined): string {
  if (!url) return "direct";
  try {
    const raw = new URL(url).hostname;
    const hostname = raw.replace(/^(www\.|m\.)/, "");
    return DOMAIN_TO_PLATFORM[raw] ?? DOMAIN_TO_PLATFORM[hostname] ?? "direct_website";
  } catch {
    return "direct";
  }
}
