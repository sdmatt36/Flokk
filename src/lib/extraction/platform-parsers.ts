import type { Platform } from "./detect-platform";

export interface PlatformData {
  title?: string;
  checkin?: string;
  checkout?: string;
  category?: string;
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseBookingCom(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    // /hotel/jp/some-hotel-name.en-gb.html
    const match = parsed.pathname.match(/\/hotel\/[^/]+\/([^.]+)/);
    const title = match ? slugToTitle(match[1]) : undefined;
    const checkin =
      parsed.searchParams.get("checkin") ??
      parsed.searchParams.get("check_in") ??
      undefined;
    const checkout =
      parsed.searchParams.get("checkout") ??
      parsed.searchParams.get("check_out") ??
      undefined;
    return { title, checkin, checkout, category: "Lodging" };
  } catch {
    return { category: "Lodging" };
  }
}

export function parseAirbnb(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    const checkin =
      parsed.searchParams.get("check_in") ??
      parsed.searchParams.get("checkin") ??
      undefined;
    const checkout =
      parsed.searchParams.get("check_out") ??
      parsed.searchParams.get("checkout") ??
      undefined;
    return { checkin, checkout, category: "Lodging" };
  } catch {
    return { category: "Lodging" };
  }
}

export function parseGoogleMaps(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q");
    if (q) return { title: q.replace(/\+/g, " "), category: "Activities" };
    const placeMatch = parsed.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      const title = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");
      return { title, category: "Activities" };
    }
  } catch {}
  return { category: "Activities" };
}

export function parseGetYourGuide(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    // Segment ending in -tNNNNN is the activity slug
    const activitySlug = segments.find((s) => /-t\d+\/?$/.test(s));
    if (activitySlug) {
      const title = slugToTitle(activitySlug.replace(/-t\d+$/, ""));
      return { title, category: "Activities" };
    }
    if (segments.length >= 2) {
      return {
        title: slugToTitle(segments[segments.length - 1].replace(/-t\d+$/, "")),
        category: "Activities",
      };
    }
  } catch {}
  return { category: "Activities" };
}

export function parseViator(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    // /tours/Destination/Activity-Name/d963-29065P8
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 3) {
      const titleSlug = segments[2];
      return { title: slugToTitle(titleSlug), category: "Activities" };
    }
  } catch {}
  return { category: "Activities" };
}

export function parseTripAdvisor(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    // Attraction_Review: extract name before "-Okinawa" or end
    const attrMatch = parsed.pathname.match(/Reviews-([^-]+(?:_[^-]+)*)-[A-Z]/);
    if (attrMatch) {
      return { title: attrMatch[1].replace(/_/g, " "), category: "Activities" };
    }
    const restMatch = parsed.pathname.match(/Restaurant_Review.*?-Reviews-([^-]+)/);
    if (restMatch) {
      return { title: restMatch[1].replace(/_/g, " "), category: "Food" };
    }
    const hotelMatch = parsed.pathname.match(/Hotel_Review.*?-Reviews-([^-]+)/);
    if (hotelMatch) {
      return { title: hotelMatch[1].replace(/_/g, " "), category: "Lodging" };
    }
  } catch {}
  return { category: "Activities" };
}

export function parseExpedia(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    const checkin =
      parsed.searchParams.get("chkin") ??
      parsed.searchParams.get("startDate") ??
      undefined;
    const checkout =
      parsed.searchParams.get("chkout") ??
      parsed.searchParams.get("endDate") ??
      undefined;
    // /Hotel-Name.h1234567.Hotel-Information
    const match = parsed.pathname.match(/\/([^.]+)\.h\d+/);
    const title = match ? slugToTitle(match[1]) : undefined;
    return { title, checkin, checkout, category: "Lodging" };
  } catch {
    return { category: "Lodging" };
  }
}

export function parseHotelsCom(url: string): PlatformData {
  try {
    const parsed = new URL(url);
    const checkin = parsed.searchParams.get("chkin") ?? undefined;
    const checkout = parsed.searchParams.get("chkout") ?? undefined;
    // /ho123456/hotel-name-city-country/ — skip the hoNNNNN segment
    const segments = parsed.pathname.split("/").filter(Boolean);
    const titleSegment = segments.find(
      (s) => !/^ho\d+$/.test(s) && !s.includes("hotel-information")
    );
    const title = titleSegment ? slugToTitle(titleSegment) : undefined;
    return { title, checkin, checkout, category: "Lodging" };
  } catch {
    return { category: "Lodging" };
  }
}

export function parsePlatform(platform: Platform, url: string): PlatformData {
  switch (platform) {
    case "booking_com":    return parseBookingCom(url);
    case "airbnb":         return parseAirbnb(url);
    case "google_maps":    return parseGoogleMaps(url);
    case "getyourguide":   return parseGetYourGuide(url);
    case "viator":         return parseViator(url);
    case "tripadvisor":    return parseTripAdvisor(url);
    case "expedia":        return parseExpedia(url);
    case "hotels_com":     return parseHotelsCom(url);
    default:               return {};
  }
}
