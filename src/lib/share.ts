export interface ShareablePlace {
  name: string;
  city: string | null;
  sourceTripId?: string | null;
  sourceShareToken?: string | null;
  spotId?: string | null;
}

export interface ShareResult {
  ok: boolean;
  method: "spot-url" | "trip-url" | "none";
  url?: string;
  error?: string;
}

/**
 * Resolve a share action for a place.
 *
 * Priority:
 *   1. Spot page — guarded by SPOT_PAGES_ENABLED flag (flip when /s/[spotId] ships)
 *   2. Originating trip share URL — uses sourceShareToken if present, else /trips/[id]
 *   3. Not shareable
 *
 * Copies resolved URL to clipboard and returns result.
 * Callers surface the toast.
 */
const SPOT_PAGES_ENABLED = false;

export async function sharePlace(place: ShareablePlace): Promise<ShareResult> {
  // Horizon 2: spot page
  if (SPOT_PAGES_ENABLED && place.spotId) {
    const url = `https://flokktravel.com/s/${place.spotId}`;
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, method: "spot-url", url };
    } catch {
      return { ok: false, method: "spot-url", error: "Clipboard write failed" };
    }
  }

  // Horizon 1: originating trip
  if (place.sourceTripId) {
    const url = place.sourceShareToken
      ? `https://flokktravel.com/share/${place.sourceShareToken}`
      : `https://flokktravel.com/trips/${place.sourceTripId}`;

    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, method: "trip-url", url };
    } catch {
      return { ok: false, method: "trip-url", error: "Clipboard write failed" };
    }
  }

  return { ok: false, method: "none", error: "Nothing to share yet for this place" };
}
