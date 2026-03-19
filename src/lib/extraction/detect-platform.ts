export type Platform =
  | "booking_com"
  | "airbnb"
  | "google_maps_short"
  | "google_maps"
  | "getyourguide"
  | "viator"
  | "tripadvisor"
  | "expedia"
  | "hotels_com"
  | "instagram"
  | "tiktok"
  | "unknown";

export function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (/maps\.app\.goo\.gl/.test(lower)) return "google_maps_short";
  if (/maps\.google\.com|google\.com\/maps/.test(lower)) return "google_maps";
  if (/booking\.com/.test(lower)) return "booking_com";
  if (/airbnb\.com/.test(lower)) return "airbnb";
  if (/getyourguide\.com/.test(lower)) return "getyourguide";
  if (/viator\.com/.test(lower)) return "viator";
  if (/tripadvisor\.com/.test(lower)) return "tripadvisor";
  if (/expedia\.com/.test(lower)) return "expedia";
  if (/hotels\.com/.test(lower)) return "hotels_com";
  if (/instagram\.com/.test(lower)) return "instagram";
  if (/tiktok\.com/.test(lower)) return "tiktok";
  return "unknown";
}
