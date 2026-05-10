export type LodgingType =
  | "hotel"
  | "vacation_rental"
  | "bnb"
  | "cruise_ship"
  | "campsite"
  | "motel"
  | "resort"
  | "other";

export const LODGING_TYPE_LABELS: Record<LodgingType, string> = {
  hotel: "Hotel",
  vacation_rental: "Vacation Rental",
  bnb: "B&B",
  cruise_ship: "Cruise Ship",
  campsite: "Campsite",
  motel: "Motel",
  resort: "Resort",
  other: "Other",
};

export const LODGING_TYPE_OPTIONS = Object.entries(LODGING_TYPE_LABELS) as [LodgingType, string][];

/** Infer from a booking platform URL. Most reliable signal — 100% accurate for known platforms. */
export function inferLodgingTypeFromUrl(url: string): LodgingType | null {
  const lower = url.toLowerCase();
  if (/airbnb\.|vrbo\.|homeaway\.|vacasa\.|hvmi\.com|sonder\.com|plum\.guide/.test(lower))
    return "vacation_rental";
  if (/hipcamp\.|koa\.com|reserveamerica\.|recreation\.gov|pitchup\.com/.test(lower))
    return "campsite";
  if (/carnival\.|royalcaribbean\.|ncl\.com|msccruises\.|princess\.com|celebrity.*cruise|viking.*cruise|cunard\.|hollandamerica\.|norwegian\.*cruise/.test(lower))
    return "cruise_ship";
  return null;
}

/**
 * Infer from the bookingSource string already stored on ItineraryItem.
 * Called after email parsing — source is derived from the sender domain.
 */
export function inferLodgingTypeFromBookingSource(
  bookingSource: string | null | undefined
): LodgingType | null {
  if (!bookingSource) return null;
  const src = bookingSource.toLowerCase();
  if (src === "airbnb" || src === "vrbo" || src === "homeaway") return "vacation_rental";
  if (
    src === "booking.com" ||
    src === "hotels.com" ||
    src === "expedia" ||
    src === "marriott" ||
    src === "hilton" ||
    src === "hyatt" ||
    src === "ihg" ||
    src === "wyndham" ||
    src === "bestwestern" ||
    src === "radisson" ||
    src === "accor" ||
    src === "direct"
  )
    return "hotel";
  return null;
}

/**
 * Infer from free text: property name, email subject, or Claude-extracted vendorName.
 * Lower confidence than URL/bookingSource — used as fallback.
 */
export function inferLodgingTypeFromText(text: string): LodgingType | null {
  const lower = text.toLowerCase();
  if (/\bcruise\b|\bcruises\b|\bcruise ship\b|\bcruise line\b/.test(lower)) return "cruise_ship";
  if (/\bcampsite\b|\bcampground\b|\bcamping\b|\bglamping\b/.test(lower)) return "campsite";
  if (/\bvacation rental\b|\bholiday rental\b/.test(lower)) return "vacation_rental";
  if (/\bairbnb\b|\bvrbo\b/.test(lower)) return "vacation_rental";
  if (/\bvilla\b|\bcabin\b|\bcottage\b|\bchalet\b|\bcondos?\b/.test(lower)) return "vacation_rental";
  if (/\bbed and breakfast\b|\bb&b\b|\bbnb\b|\bguesthouse\b|\bguest house\b/.test(lower)) return "bnb";
  if (/\bresort\b/.test(lower)) return "resort";
  if (/\bmotel\b|\bmotor inn\b|\bmotor lodge\b/.test(lower)) return "motel";
  if (/\bhostel\b|\bryokan\b|\binn\b|\bhotel\b/.test(lower)) return "hotel";
  return null;
}

/**
 * Cascade: URL → bookingSource → text. Returns first non-null hit.
 */
export function inferLodgingType(opts: {
  url?: string | null;
  bookingSource?: string | null;
  name?: string | null;
}): LodgingType | null {
  return (
    (opts.url ? inferLodgingTypeFromUrl(opts.url) : null) ??
    inferLodgingTypeFromBookingSource(opts.bookingSource) ??
    (opts.name ? inferLodgingTypeFromText(opts.name) : null)
  );
}
