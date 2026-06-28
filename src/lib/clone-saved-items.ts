import { normalizeAndDedupeCategoryTags } from "./category-tags";
import { computeStatus } from "./saved-item-types";

export type CloneItemInput = {
  familyProfileId: string;
  tripId: string | null;
  rawTitle: string;
  rawDescription?: string | null;
  lat?: number | null;
  lng?: number | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  cityId?: string | null;
  placePhotoUrl?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  categoryTags: string[];
  dayIndex?: number | null;
  startTime?: string | null;
};

type CloneItemOutput = {
  familyProfileId: string;
  tripId: string | null;
  rawTitle: string;
  rawDescription: string | null;
  lat: number | null;
  lng: number | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  cityId: string | null;
  placePhotoUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  categoryTags: string[];
  dayIndex: number | null;
  startTime: string | null;
  status: ReturnType<typeof computeStatus>;
  sourceMethod: "SHARED_TRIP_IMPORT";
  sourcePlatform: "direct";
  extractionStatus: "ENRICHED";
};

export function buildClonedItem(input: CloneItemInput): CloneItemOutput {
  // dayIndex=0 means "Day 1" in TripTabContent's 0-based system — treat as valid/assigned.
  const tripId = input.tripId ?? null;
  // Invariant: a dayIndex is only meaningful with a tripId. Never write "day N of no trip"
  // (the orphaned-day class) — if there is no trip, drop the dayIndex.
  const dayIndex = tripId ? (input.dayIndex ?? null) : null;
  const startTime = tripId ? (input.startTime ?? null) : null;
  return {
    familyProfileId: input.familyProfileId,
    tripId,
    rawTitle: input.rawTitle,
    rawDescription: input.rawDescription ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    destinationCity: input.destinationCity ?? null,
    destinationCountry: input.destinationCountry ?? null,
    cityId: input.cityId ?? null,
    placePhotoUrl: input.placePhotoUrl ?? null,
    websiteUrl: input.websiteUrl ?? null,
    sourceUrl: input.sourceUrl ?? null,
    categoryTags: normalizeAndDedupeCategoryTags(input.categoryTags),
    dayIndex,
    startTime,
    // Single source of truth for status — never hardcode. Derived from computeStatus so a clone
    // can never produce an inconsistent (status, tripId, dayIndex) triple: no tripId → UNORGANIZED;
    // tripId + no dayIndex → TRIP_ASSIGNED; tripId + dayIndex + startTime → SCHEDULED.
    status: computeStatus(tripId, dayIndex, startTime),
    sourceMethod: "SHARED_TRIP_IMPORT",
    sourcePlatform: "direct",
    extractionStatus: "ENRICHED",
  };
}

/** Add (startDate YYYY-MM-DD) + (dayIndex - 1) calendar days. Returns YYYY-MM-DD string. */
export function computeScheduledDate(startDate: string, dayIndex: number): string {
  const d = new Date(startDate + "T12:00:00");
  d.setDate(d.getDate() + (dayIndex - 1));
  return d.toISOString().substring(0, 10);
}
