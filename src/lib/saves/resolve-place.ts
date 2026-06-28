// Shared synchronous Google Places pre-pass for POST /api/saves (URL branch).
//
// This is the SINGLE source of truth for the save-time place resolution decision:
//   - the social-platform / aggregator-OTA gate, and
//   - the field map that gets written onto the SavedItem.
//
// Both the route handler (src/app/api/saves/route.ts) and the trust harness
// (scripts/enrich-harness.ts) call this — so the harness can never again drift from
// production and report a false green (the Airbnb->Maryland junk-geocode class).
//
// PURE: this function performs the Places lookup but writes NOTHING. It returns the exact
// `update` map the caller should persist. Callers own the db.update.

import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { SOCIAL_PLATFORMS, isAggregatorUrl } from "@/lib/enrich-save";

// A Google Maps URL is never a usable business website — keep it out of websiteUrl.
export function isMapsUrl(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|(www\.)?google\.com\/maps)/i.test(url);
}

export type EnrichWithPlacesResult = Awaited<ReturnType<typeof enrichWithPlaces>>;

export type ResolvePlaceInput = {
  url: string;
  rawTitle: string | null;
  sourcePlatform: string;
  destinationCity?: string | null;
  // Current values on the row (so the same field guards as production apply). For a fresh
  // URL save these are all null/undefined; passing the just-created SavedItem is fine.
  existing?: {
    placePhotoUrl?: string | null;
    websiteUrl?: string | null;
    googlePlaceId?: string | null;
    destinationCountry?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
};

export type ResolvePlaceUpdate = {
  placePhotoUrl?: string;
  websiteUrl?: string;
  destinationCountry?: string;
  googlePlaceId?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export type ResolvePlaceResult = {
  isSocialSave: boolean;
  isAggregator: boolean;
  skipPrePass: boolean;
  // Whether enrichWithPlaces was actually called (gate passed).
  ran: boolean;
  enriched: EnrichWithPlacesResult | null;
  // The exact field map the caller should write. Empty object = write nothing.
  update: ResolvePlaceUpdate;
  // Convenience mirrors used by the route's response payload.
  urlEnrichedPhotoUrl: string | null;
  urlEnrichedWebsite: string | null;
};

/**
 * Decide and (when applicable) perform the synchronous Places pre-pass for a URL save.
 *
 * Gate (identical to production): run only when there is a scraped title, the save is NOT a
 * social-platform save AND NOT an aggregator/OTA URL, and the row is still missing a photo or
 * a placeId. Social/aggregator saves are deliberately left without coords here so that the
 * deferred enrichSavedItem pipeline can resolve them properly or flag needsPlaceConfirmation.
 */
export async function resolvePlaceForSave(input: ResolvePlaceInput): Promise<ResolvePlaceResult> {
  const { url, rawTitle, sourcePlatform, destinationCity } = input;
  const existing = input.existing ?? {};

  const isSocialSave = (SOCIAL_PLATFORMS as readonly string[]).includes(sourcePlatform);
  const isAggregator = isAggregatorUrl(url);
  const skipPrePass = isSocialSave || isAggregator;

  const update: ResolvePlaceUpdate = {};
  let urlEnrichedPhotoUrl: string | null = null;
  let urlEnrichedWebsite: string | null = null;

  const shouldRun = !!rawTitle && !skipPrePass && (!existing.placePhotoUrl || !existing.googlePlaceId);
  if (!shouldRun) {
    return { isSocialSave, isAggregator, skipPrePass, ran: false, enriched: null, update, urlEnrichedPhotoUrl, urlEnrichedWebsite };
  }

  const enriched = await enrichWithPlaces(rawTitle as string, destinationCity ?? "");
  if (enriched.imageUrl && !existing.placePhotoUrl) { update.placePhotoUrl = enriched.imageUrl; urlEnrichedPhotoUrl = enriched.imageUrl; }
  if (enriched.website && !existing.websiteUrl && !isMapsUrl(enriched.website)) { update.websiteUrl = enriched.website; urlEnrichedWebsite = enriched.website; }
  if (enriched.country && !existing.destinationCountry) { update.destinationCountry = enriched.country; }
  if (enriched.placeId) { update.googlePlaceId = enriched.placeId; }
  if (enriched.formattedAddress) { update.address = enriched.formattedAddress; }
  if (enriched.lat !== null && !existing.lat) { update.lat = enriched.lat; }
  if (enriched.lng !== null && !existing.lng) { update.lng = enriched.lng; }

  return { isSocialSave, isAggregator, skipPrePass, ran: true, enriched, update, urlEnrichedPhotoUrl, urlEnrichedWebsite };
}
