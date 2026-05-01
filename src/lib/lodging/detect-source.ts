/**
 * detect-source.ts
 *
 * Detects the booking platform from email metadata extracted during hotel import.
 * Used by: email-inbound route (new bookings) + backfill script (existing bookings).
 *
 * Detection priority: contactEmail domain → subject keywords → body keywords.
 * Returns a normalized source key and a generic management URL for the platform.
 * The management URL is a platform landing page (requires user login); not a deep link.
 */

const DOMAIN_MAP: Array<{ pattern: string; source: string; manageUrl: string }> = [
  { pattern: "property.booking.com", source: "booking.com", manageUrl: "https://secure.booking.com/myreservations.html" },
  { pattern: "booking.com",          source: "booking.com", manageUrl: "https://secure.booking.com/myreservations.html" },
  { pattern: "airbnb.com",           source: "airbnb",      manageUrl: "https://www.airbnb.com/trips" },
  { pattern: "airbnb.co.",           source: "airbnb",      manageUrl: "https://www.airbnb.com/trips" },
  { pattern: "hotels.com",           source: "hotels.com",  manageUrl: "https://www.hotels.com/my-trips" },
  { pattern: "expedia.com",          source: "expedia",     manageUrl: "https://www.expedia.com/trips" },
  { pattern: "marriott.com",         source: "marriott",    manageUrl: "https://www.marriott.com/loyalty/myAccount/reservations.mi" },
  { pattern: "hilton.com",           source: "hilton",      manageUrl: "https://www.hilton.com/en/hilton-honors/" },
  { pattern: "hyatt.com",            source: "hyatt",       manageUrl: "https://world.hyatt.com/content/gp/en/my-account.html" },
  { pattern: "vrbo.com",             source: "vrbo",        manageUrl: "https://www.vrbo.com/traveler/trips" },
];

export function detectBookingSource(input: {
  contactEmail?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  vendorName?: string | null;
}): { source: string; managementUrl: string | null } {
  const haystack = [
    input.contactEmail,
    input.subject,
    input.bodyText,
    input.vendorName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const entry of DOMAIN_MAP) {
    if (haystack.includes(entry.pattern)) {
      return { source: entry.source, managementUrl: entry.manageUrl };
    }
  }

  return { source: "unknown", managementUrl: null };
}

const MANAGE_URL_DOMAINS = [
  "booking.com/myreservations",
  "secure.booking.com/myreservations",
  "secure.booking.com/confirmation",
  "airbnb.com/trips",
  "hotels.com/my-trips",
  "expedia.com/trips",
  "marriott.com/loyalty",
  "marriott.com/myaccount",
  "marriott.com/reservation",
  "hilton.com/en/hilton-honors",
  "hilton.com/en/account",
  "world.hyatt.com/content/gp/en/my-account",
  "world.hyatt.com/myhyatt",
  "vrbo.com/traveler",
];

/**
 * Returns true if the URL points to a personal booking-management page rather
 * than a canonical venue website. Gates SavedItem.websiteUrl propagation to
 * ItineraryItem.venueUrl per Discipline 4.5 — managementUrl is owner-only,
 * venueUrl is share-public, manage URLs must never propagate to venueUrl.
 */
export function isManageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lowered = url.toLowerCase();
  return MANAGE_URL_DOMAINS.some((domain) => lowered.includes(domain));
}

/** Display name for a bookingSource key */
export function bookingSourceLabel(source: string | null | undefined): string | null {
  if (!source || source === "unknown") return null;
  const labels: Record<string, string> = {
    "booking.com": "Booking.com",
    airbnb: "Airbnb",
    "hotels.com": "Hotels.com",
    expedia: "Expedia",
    marriott: "Marriott",
    hilton: "Hilton",
    hyatt: "Hyatt",
    vrbo: "VRBO",
    direct: "Direct",
  };
  return labels[source] ?? source;
}
