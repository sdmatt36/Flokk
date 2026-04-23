import type { PrismaClient } from "@prisma/client";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

/**
 * Whether a booking extraction should co-create a SavedItem.
 * Hotels and restaurants always yes. Activities always yes.
 * Car_rental yes only when the label matches a driver-service keyword
 * (Daytrip, SmartRyde, etc. get mis-classified as car_rental by the prompt).
 * Trains, flights, unknowns: no.
 */
const SAVEABLE_TYPES = new Set(["hotel", "activity", "restaurant"]);
const DRIVER_KEYWORDS = /driver|transfer|chauffeur|shuttle/i;

export function isSaveableBooking(
  extractedType: string | null | undefined,
  label: string | null | undefined,
): boolean {
  if (!extractedType) return false;
  const t = extractedType.toLowerCase();
  if (SAVEABLE_TYPES.has(t)) return true;
  if (t === "car_rental" && label && DRIVER_KEYWORDS.test(label)) return true;
  return false;
}

/**
 * Creates a SavedItem that mirrors a booking's place identity.
 * Returns the new SavedItem.id for the caller to store on TripDocument.savedItemId.
 * Does not call Google Places enrichment — that's the cron's job.
 */
export async function createBookingSavedItem(
  db: PrismaClient,
  params: {
    familyProfileId: string;
    tripId: string;
    vendorName: string;
    city: string | null;
    country: string | null;
    address: string | null;
    checkIn: string | null;
    checkOut: string | null;
    extractedType: string;
    websiteUrl: string | null;
  },
): Promise<string> {
  const categoryTags =
    params.extractedType === "hotel"
      ? ["lodging"]
      : params.extractedType === "restaurant"
      ? ["food_and_drink"]
      : ["activity"];

  const created = await db.savedItem.create({
    data: {
      familyProfileId: params.familyProfileId,
      tripId: params.tripId,
      sourceMethod: "EMAIL_FORWARD",
      sourcePlatform: "direct",
      rawTitle: params.vendorName,
      destinationCity: params.city,
      destinationCountry: params.country,
      categoryTags: normalizeAndDedupeCategoryTags(categoryTags),
      status: "TRIP_ASSIGNED",
      extractionStatus: "ENRICHED",
      websiteUrl: params.websiteUrl ?? null,
      extractedCheckin: params.checkIn,
      extractedCheckout: params.checkOut,
    },
  });
  return created.id;
}
