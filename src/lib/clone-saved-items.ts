import { normalizeAndDedupeCategoryTags } from "./category-tags";

export type CloneItemInput = {
  familyProfileId: string;
  tripId: string;
  rawTitle: string;
  rawDescription?: string | null;
  lat?: number | null;
  lng?: number | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  placePhotoUrl?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  categoryTags: string[];
  dayIndex?: number | null;
};

type CloneItemOutput = {
  familyProfileId: string;
  tripId: string;
  rawTitle: string;
  rawDescription: string | null;
  lat: number | null;
  lng: number | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  placePhotoUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  categoryTags: string[];
  dayIndex: number | null;
  status: "TRIP_ASSIGNED" | "UNORGANIZED";
  sourceMethod: "SHARED_TRIP_IMPORT";
  sourcePlatform: "direct";
  extractionStatus: "ENRICHED";
};

export function buildClonedItem(input: CloneItemInput): CloneItemOutput {
  // dayIndex=0 means "Day 1" in TripTabContent's 0-based system — treat as valid/assigned
  const dayIndex = input.dayIndex != null ? input.dayIndex : null;
  return {
    familyProfileId: input.familyProfileId,
    tripId: input.tripId,
    rawTitle: input.rawTitle,
    rawDescription: input.rawDescription ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    destinationCity: input.destinationCity ?? null,
    destinationCountry: input.destinationCountry ?? null,
    placePhotoUrl: input.placePhotoUrl ?? null,
    websiteUrl: input.websiteUrl ?? null,
    sourceUrl: input.sourceUrl ?? null,
    categoryTags: normalizeAndDedupeCategoryTags(input.categoryTags),
    dayIndex,
    status: dayIndex != null ? "TRIP_ASSIGNED" : "UNORGANIZED",
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
