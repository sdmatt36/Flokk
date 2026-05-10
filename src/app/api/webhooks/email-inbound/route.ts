import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { writeFlightFromEmail, WriteFlightLeg } from "@/lib/flights/extract-and-write";
import { findAllRelatedTrips, type TripRecord } from "@/lib/flights/find-related-trips";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { resolveCanonicalUrl } from "@/lib/url-resolver";
import { enrichSavedItem } from "@/lib/enrich-save";
import { findMatchingTrip } from "@/lib/find-matching-trip";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { toTitleCase } from "@/lib/utils";
import { resolveProfileByEmail } from "@/lib/profile-access";
import { logExtraction } from "@/lib/extraction-log";
import { extractOperatorPlan, looksLikeOperatorPlan } from "@/lib/operator-plan-extractor";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { inferPlatformFromUrl } from "@/lib/saved-item-types";
import { isSaveableBooking, createBookingSavedItem } from "@/lib/booking-saved-item";
import { detectBookingSource, isManageUrl } from "@/lib/lodging/detect-source";
import { inferLodgingType } from "@/lib/infer-lodging-type";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildSaveConfirmationEmail(
  title: string,
  city: string | null,
  matchedTrip: { id: string; title: string } | null | undefined,
  savedItemId: string
): string {
  const cityLine = city
    ? `<p style="margin:0 0 8px;font-size:14px;color:#4A5568;">${city}</p>`
    : "";
  const tripLine = matchedTrip
    ? `<p style="margin:0 0 16px;font-size:14px;color:#4A5568;">Saved to your <strong>${matchedTrip.title}</strong> trip.</p>`
    : "";
  const button = matchedTrip
    ? `<a href="https://www.flokktravel.com/trips/${matchedTrip.id}?tab=saved"
         style="display:inline-block;background:#C4664A;color:#ffffff;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">
        View in ${matchedTrip.title} &rarr;
      </a>`
    : `<a href="https://www.flokktravel.com/saves?open=${savedItemId}"
         style="display:inline-block;background:#C4664A;color:#ffffff;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">
        View your saves &rarr;
      </a>`;
  return `
    <div style="font-family:'Inter',sans-serif;background:#ffffff;padding:40px 32px;max-width:560px;margin:0 auto;">
      <h1 style="font-family:'Playfair Display',Georgia,serif;color:#1B3A5C;font-size:24px;margin:0 0 8px;">Saved to Flokk</h1>
      <h2 style="font-family:'Inter',sans-serif;color:#0A1628;font-size:18px;font-weight:600;margin:0 0 4px;">${title}</h2>
      ${cityLine}
      ${tripLine}
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
      ${button}
      <p style="margin:32px 0 0;font-size:13px;color:#4A5568;">Matt and Jen<br/>Co-Founders, Flokk</p>
      <p style="margin:8px 0 0;font-size:12px;color:#A0AEC0;">Flokk &middot; trips@flokktravel.com</p>
    </div>
  `.trim();
}


async function getCountryForCity(city: string): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!key || !city.trim()) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${key}`
    );
    const data = await res.json() as { results?: { address_components: { long_name: string; types: string[] }[] }[] };
    const components = data.results?.[0]?.address_components ?? [];
    const country = components.find(c => c.types.includes("country"));
    return country?.long_name ?? null;
  } catch {
    return null;
  }
}

async function geoMatchTrips(
  familyProfileId: string,
  city: string | null,
  country: string | null
): Promise<{ id: string; title: string } | null> {
  if (!city && !country) return null;
  const today = new Date();
  const lc = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
  try {
    const trips = await db.trip.findMany({
      where: {
        familyProfileId,
        status: { not: "COMPLETED" },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      select: { id: true, title: true, destinationCity: true, destinationCountry: true, startDate: true },
    });
    const sc = lc(city);
    const sco = lc(country);
    const matches = trips.filter(t => {
      const tc = lc(t.destinationCity);
      const tco = lc(t.destinationCountry);
      const tt = lc(t.title);
      if (sc && tc && (tc.includes(sc) || sc.includes(tc))) return true;
      if (sc && tt.includes(sc)) return true;
      if (sco && tco && (tco.includes(sco) || sco.includes(tco))) return true;
      if (sco && tt.includes(sco)) return true;
      return false;
    });
    if (matches.length === 0) {
      console.log("[enrich] No trip match for destinationCity:", city, "country:", country);
      return null;
    }
    matches.sort((a, b) => {
      const da = a.startDate ? Math.abs(a.startDate.getTime() - today.getTime()) : Infinity;
      const db2 = b.startDate ? Math.abs(b.startDate.getTime() - today.getTime()) : Infinity;
      return da - db2;
    });
    console.log("[enrich] Trip matched:", matches[0].id, matches[0].title);
    return { id: matches[0].id, title: matches[0].title };
  } catch (e) {
    console.error("[geoMatchTrips] query failed:", e);
    return null;
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Guest name resolution ─────────────────────────────────────────────────────
// Airline booking format: "LASTNAME FIRSTNAMEMIDDLE MR/MS/MSTR"
// e.g. "GREENE JODYCOUGHLIN MS"  → match member with firstName "Jody" → "Jody Greene"
//      "GREENE BEAUJACKSON MSTR" → match member with firstName "Beau" → "Beau Greene"

type KnownMember = { name: string | null };

function resolveGuestName(raw: string, knownMembers: KnownMember[]): string {
  // 1. Strip trailing title
  const stripped = raw.replace(/\b(MR|MRS|MS|DR|MISS|MSTR)\.?\s*$/gi, "").trim();

  // 2. Split into [LASTNAME, FIRSTNAMEMIDDLE]
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return raw;

  const rawLastName  = parts[0];                          // e.g. "GREENE"
  const rawFirstComp = parts.slice(1).join("") || "";     // e.g. "JODYCOUGHLIN"
  const prefix4      = rawFirstComp.slice(0, 4).toLowerCase(); // e.g. "jody"

  // 3. Try to match a known family member by first-name prefix
  if (prefix4) {
    for (const member of knownMembers) {
      if (!member.name) continue;
      // member.name is stored as "Jody Greene" — first token is the first name
      const memberFirst = member.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (memberFirst && memberFirst.startsWith(prefix4)) {
        return member.name; // return the clean profile name directly
      }
    }
  }

  // 4. Fallback: title-case the parts and reorder to FirstName LastName
  const tc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (parts.length === 1) return tc(rawLastName);
  const lastName  = tc(rawLastName);
  const firstName = tc(rawFirstComp);
  return `${firstName} ${lastName}`;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocodePlace(query: string): Promise<{ lat: number; lng: number; placeId?: string } | null> {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) return null;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=en&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } }; place_id?: string }> };
    const first = data.results?.[0];
    if (!first) return null;
    const { lat, lng } = first.geometry.location;
    console.log(`[email-inbound] geocoded "${query}" → lat: ${lat}, lng: ${lng}`);
    return { lat, lng, placeId: first.place_id };
  } catch {
    return null;
  }
}

// ── Cost parsing ──────────────────────────────────────────────────────────────

function parseCost(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim()
    .replace(/\b(KRW|USD|GBP|JPY|EUR|AUD)\b/gi, "")
    .replace(/[£$€¥]/g, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

function detectCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw);
  if (/\bKRW\b/i.test(s)) return "KRW";
  if (/\bGBP\b/i.test(s) || s.includes("£")) return "GBP";
  if (/\bEUR\b/i.test(s) || s.includes("€")) return "EUR";
  if (/\bJPY\b/i.test(s) || s.includes("¥")) return "JPY";
  if (/\bAUD\b/i.test(s)) return "AUD";
  if (/\bUSD\b/i.test(s) || s.includes("$")) return "USD";
  return null;
}

// ── Trip matching helpers ──────────────────────────────────────────────────────

function tripMatchesDestination(
  trip: { title: string; destinationCity?: string | null; destinationCountry?: string | null },
  keywords: string[]
): boolean {
  const haystack = [trip.title, trip.destinationCity, trip.destinationCountry]
    .filter(Boolean).join(" ").toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase();
    // Full phrase match — always allow (e.g. "San Diego" matching "San Diego")
    if (k.includes(" ")) return haystack.includes(k);
    // Single token — require word boundary match to prevent "San" hitting "Busan"
    const regex = new RegExp(`(?<![a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i");
    return regex.test(haystack);
  });
}

// Maps IATA codes and full airport names to canonical city/country strings.
// Used to normalize Claude-extracted toCity/fromCity values before trip matching
// (Claude often returns "CMB" or "Colombo Bandaranaike" instead of "Colombo").
const AIRPORT_TO_CITY: Record<string, { city: string; country: string }> = {
  cmb: { city: "Colombo", country: "Sri Lanka" },
  "colombo bandaranaike": { city: "Colombo", country: "Sri Lanka" },
  bkk: { city: "Bangkok", country: "Thailand" },
  dmk: { city: "Bangkok", country: "Thailand" },
  "bangkok suvarnabhumi": { city: "Bangkok", country: "Thailand" },
  sin: { city: "Singapore", country: "Singapore" },
  "singapore changi": { city: "Singapore", country: "Singapore" },
  hnd: { city: "Tokyo", country: "Japan" },
  nrt: { city: "Tokyo", country: "Japan" },
  "tokyo haneda": { city: "Tokyo", country: "Japan" },
  "tokyo narita": { city: "Tokyo", country: "Japan" },
  lhr: { city: "London", country: "United Kingdom" },
  "london heathrow": { city: "London", country: "United Kingdom" },
  cai: { city: "Cairo", country: "Egypt" },
  cairo: { city: "Cairo", country: "Egypt" },
  lxr: { city: "Luxor", country: "Egypt" },
  luxor: { city: "Luxor", country: "Egypt" },
  ath: { city: "Athens", country: "Greece" },
  athens: { city: "Athens", country: "Greece" },
  pus: { city: "Busan", country: "South Korea" },
  icn: { city: "Seoul", country: "South Korea" },
  gmp: { city: "Seoul", country: "South Korea" },
  incheon: { city: "Seoul", country: "South Korea" },
  oka: { city: "Okinawa", country: "Japan" },
  kix: { city: "Osaka", country: "Japan" },
  "osaka kansai": { city: "Osaka", country: "Japan" },
  cdg: { city: "Paris", country: "France" },
  "paris charles de gaulle": { city: "Paris", country: "France" },
  fco: { city: "Rome", country: "Italy" },
  bcn: { city: "Barcelona", country: "Spain" },
  dxb: { city: "Dubai", country: "United Arab Emirates" },
  auh: { city: "Abu Dhabi", country: "United Arab Emirates" },
};

// Converts a raw location string (airport code, airport name, or city) into
// matchable keywords. If it maps to a known airport, returns the canonical
// city and country instead of splitting the raw string.
function normalizeLocationToKeywords(raw: string): string[] {
  const key = raw.trim().toLowerCase();
  const mapped = AIRPORT_TO_CITY[key];
  if (mapped) return [mapped.city, mapped.country];
  // Full phrase only — no single-word splitting.
  // Splitting "United Kingdom" into ["United", "Kingdom"] causes false positives
  // where "United" matches "United States" in an unrelated trip's country.
  return [raw.trim()];
}

// Home airports — when a flight departs AND arrives at one of these, it is
// a round trip originating from home. In that case destination keyword matching
// is unreliable (final toAirport is the home airport, not the destination), so
// P0 match uses departure date overlap instead.
const HOME_AIRPORTS = new Set(["NRT", "HND", "LHR", "LGW", "YVR", "JFK", "LAX"]);

// ── Vault flight field resolution ────────────────────────────────────────────
// When Claude fails to extract airports/times on a re-forward, fill in missing
// fields from a prior vault TripDocument for the same trip+confirmationCode.
// Called before creating the outbound FLIGHT ItineraryItem so geocoding and the
// card title are correct even when the current extraction is incomplete.

type FlightFields = {
  fromAirport: string | null;
  toAirport: string | null;
  fromCity: string | null;
  toCity: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
};

async function resolveFlightFieldsFromVault(
  tripId: string | null,
  confirmationCode: string | null,
  extracted: Record<string, unknown>
): Promise<FlightFields> {
  const result: FlightFields = {
    fromAirport: (extracted.fromAirport as string | null) ?? null,
    toAirport: (extracted.toAirport as string | null) ?? null,
    fromCity: (extracted.fromCity as string | null) ?? null,
    toCity: (extracted.toCity as string | null) ?? null,
    departureTime: (extracted.departureTime as string | null) ?? null,
    arrivalTime: (extracted.arrivalTime as string | null) ?? null,
  };

  // All key fields present — no vault lookup needed
  if (result.fromAirport && result.toAirport && result.departureTime) return result;
  // No confirmation code or no trip — can't match vault docs
  if (!confirmationCode || !tripId) return result;

  const priorDocs = await db.tripDocument.findMany({
    where: { tripId, type: "booking" },
    select: { content: true },
  });

  for (const doc of priorDocs) {
    let b: Record<string, unknown> = {};
    try { b = JSON.parse(doc.content ?? "{}"); } catch { continue; }
    if ((b.confirmationCode as string | null) !== confirmationCode) continue;
    if ((b.type as string | null)?.toLowerCase() !== "flight") continue;

    const df = (b.fromAirport as string | null)?.trim() || null;
    const dt = (b.toAirport as string | null)?.trim() || null;
    const dep = (b.departureTime as string | null)?.trim() || null;
    const arr = (b.arrivalTime as string | null)?.trim() || null;
    const dfc = (b.fromCity as string | null)?.trim() || null;
    const dtc = (b.toCity as string | null)?.trim() || null;

    if (!result.fromAirport && df) result.fromAirport = df;
    if (!result.toAirport && dt) result.toAirport = dt;
    if (!result.departureTime && dep) result.departureTime = dep;
    if (!result.arrivalTime && arr) result.arrivalTime = arr;
    if (!result.fromCity && dfc) result.fromCity = dfc;
    if (!result.toCity && dtc) result.toCity = dtc;

    if (result.fromAirport && result.toAirport) break;
  }

  return result;
}

// ── dayIndex helper ──────────────────────────────────────────────────────────

async function getDayIndex(tripId: string | null, dateStr: string): Promise<number | null> {
  if (!tripId) return null;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true, endDate: true } });
  if (!trip?.startDate) return null;
  const rawStart = new Date(trip.startDate);
  const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
  const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
  const [y, m, d] = dateStr.split("-").map(Number);
  const idx = Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const duration = trip.endDate
    ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  if (idx < 0 || idx > duration) return 0;
  return idx;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const logCtx: {
    senderEmail: string;
    subject: string | null;
    resolutionPath: "profile_member" | "direct_user" | "delegate" | "none";
    familyProfileId: string | null;
    extractedType: string | null;
    matchedTripId: string | null;
    autoCreatedTripId: string | null;
    itineraryItemIds: string[];
    tripDocumentId: string | null;
    confidenceScore: number | null;
    rawEmailSize: number | null;
  } = {
    senderEmail: "",
    subject: null,
    resolutionPath: "none",
    familyProfileId: null,
    extractedType: null,
    matchedTripId: null,
    autoCreatedTripId: null,
    itineraryItemIds: [],
    tripDocumentId: null,
    confidenceScore: null,
    rawEmailSize: null,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await req.json() as Record<string, any>;

    // Normalise CloudMailin JSON (Normalized) or plain JSON
    let from: string, subject: string, html: string, text: string, to: string;

    if (payload.envelope?.from) {
      from    = String(payload.envelope.from ?? "");
      to      = String(payload.envelope.to ?? "");
      subject = String(payload.headers?.subject ?? payload.headers?.Subject ?? "");
      html    = String(payload.html  ?? "");
      text    = String(payload.plain ?? "");
    } else {
      from    = String(payload.from    ?? "");
      to      = String(payload.to      ?? "");
      subject = String(payload.subject ?? "");
      html    = String(payload.html    ?? "");
      text    = String(payload.text    ?? "");
    }

    logCtx.subject = subject || null;
    logCtx.rawEmailSize = (text || html || "").length;
    console.log('[email-inbound] body length:', (text || html || '').length);
    console.log("[email-inbound] from:", from, "| to:", to, "| subject:", subject);

    // ── GYG pre-extraction — pull activity name from subject before Claude runs ─
    const isGetYourGuide = from.toLowerCase().includes("getyourguide.com") || subject.toLowerCase().includes("getyourguide");
    let gygActivityHint: string | null = null;
    if (isGetYourGuide) {
      const patterns = [
        /booking for\s+(?:[^:]+:\s+)?(.+?)(?:\s+is confirmed|\s*[-|]|\s*\(ref|$)/i,
        /booking confirmation:\s+(.+?)(?:\s*\(ref|$)/i,
        /getyourguide booking:\s+(.+?)(?:\s*\(ref|$)/i,
        /confirmed:\s+(.+?)(?:\s*\(ref|$)/i,
      ];
      for (const p of patterns) {
        const m = subject.match(p);
        if (m?.[1]?.trim() && !m[1].toLowerCase().includes("getyourguide")) {
          gygActivityHint = m[1].trim();
          console.log("[email-inbound] GYG activity name extracted from subject:", gygActivityHint);
          break;
        }
      }
    }

    if (!from || !subject) {
      console.warn("[email-inbound] missing from or subject — dropping");
      await logExtraction({ senderEmail: from || "", subject: subject || null, resolutionPath: "none", outcome: "dropped", errorMessage: "missing from or subject" });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const senderEmailMatch = from.match(/<(.+?)>/);
    const senderEmail = senderEmailMatch?.[1]?.trim() ?? from.trim();
    logCtx.senderEmail = senderEmail;

    const { familyProfile, path: pathTaken } = await resolveProfileByEmail(senderEmail);
    logCtx.resolutionPath = pathTaken;
    logCtx.familyProfileId = familyProfile?.id ?? null;

    if (!familyProfile) {
      console.log("[email-inbound] no profile for sender", senderEmail, "- dropping");
      await logExtraction({ ...logCtx, outcome: "dropped", errorMessage: "no profile for sender" });
      return NextResponse.json({ received: true });
    }

    console.log(
      "[email-inbound] resolved sender",
      senderEmail,
      "-> profile",
      familyProfile.id,
      "via",
      pathTaken
    );

    let trips = familyProfile.trips;
    if (trips.length === 0) {
      trips = await db.trip.findMany({ where: { familyProfileId: familyProfile.id } });
    }

    // Members are already included in the profile fetch above — no second query needed
    const knownMembers = familyProfile.members ?? [];
    console.log("[email-inbound] known members:", knownMembers.map((m) => m.name));

    // ── Claude extraction ──────────────────────────────────────────────────────
    const emailContent = text
      ? text.substring(0, 8000)
      : html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 8000);

    console.log("[email-inbound] calling Claude, content length:", emailContent.length);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `${isGetYourGuide && gygActivityHint ? `CRITICAL: This is a GetYourGuide booking. The activity name is "${gygActivityHint}". Use this exact string as the activityName field. Do NOT use "GetYourGuide" as the activityName or title. Put "GetYourGuide" in the vendorName field only.\n\n` : ""}Extract booking information from this confirmation email. Return ONLY valid JSON with no markdown.

Email subject: ${subject}
Email content: ${emailContent}

Return this exact JSON structure:
{
  "type": "hotel" | "flight" | "activity" | "restaurant" | "car_rental" | "train" | "unknown",
  "vendorName": "string or null — for hotel bookings, this is the SPECIFIC PROPERTY name (e.g., 'Home Hotel Havnekontoret'), NOT the parent brand or chain (e.g., not 'Strawberry Hotels'). The brand may appear in the email header or footer for marketing purposes; ignore it. Look in the booking confirmation block for the specific property. Common hotel brands to watch for: Marriott, Hilton, Hyatt, Strawberry, Accor, IHG, Four Seasons, Ritz-Carlton, Scandic, Radisson, Best Western, Nobis, SLH. If the email is from one of these brands, the actual property name will be in the confirmation details (e.g., 'W Barcelona', 'Le Meridien Kuala Lumpur', 'Home Hotel Havnekontoret'). For flights, activities, and other types, use the airline or tour operator or vendor name as normal.",
  "activityName": "string or null — for activity/tour bookings only: the specific tour or experience name, never the platform name (GetYourGuide, Viator, Klook)",
  "confirmationCode": "string or null",
  "checkIn": "YYYY-MM-DD or null",
  "checkOut": "YYYY-MM-DD or null",
  "departureDate": "YYYY-MM-DD or null",
  "departureTime": "HH:MM 24-hour format or null",
  "arrivalDate": "YYYY-MM-DD or null",
  "arrivalTime": "HH:MM 24-hour format or null",
  "flightNumber": "string or null",
  "fromAirport": "IATA code or null",
  "toAirport": "IATA code or null",
  "airline": "string or null",
  "fromCity": "string or null",
  "toCity": "string or null",
  "returnDepartureDate": "YYYY-MM-DD or null",
  "returnDepartureTime": "HH:MM 24-hour format or null",
  "returnArrivalDate": "YYYY-MM-DD or null",
  "returnArrivalTime": "HH:MM 24-hour format or null",
  "returnFromAirport": "IATA code or null",
  "returnToAirport": "IATA code or null",
  "address": "string or null",
  "city": "string or null",
  "country": "string or null",
  "totalCost": "number or null",
  "currency": "string or null",
  "contactPhone": "string or null",
  "contactEmail": "string or null",
  "guestNames": ["string"] or [],
  "rooms": [{ "confirmationCode": "string", "guests": ["string"], "cost": number }] or null,
  "legs": [{ "from": "IATA", "to": "IATA", "fromCity": "string", "toCity": "string", "departure": "YYYY-MM-DDTHH:MM", "arrival": "YYYY-MM-DDTHH:MM", "flightNumber": "string (e.g. UL895)", "airline": "string or null" }] or [],
  "outboundDestination": "string or null — the furthest non-home city in the itinerary (the actual trip destination, not the return airport)",
  "outboundDestinationAirport": "IATA code or null — airport code for outboundDestination",
  "bookingUrl": "string or null — the URL in the email to view or manage the booking. Look for phrases like 'View booking', 'Manage reservation', 'Booking details', or any vendor link that lets the user return to the booking on the vendor's site. If no such URL is present, return null.",
  "confidence": "0.0 to 1.0"
}

Field notes:
- guestNames: Extract ALL passenger/guest/traveler names as an array. For activity/tour bookings (GetYourGuide, Viator, Klook), look under "Travelers", "Guests", "Participants" sections and include every name listed. For flights, include all passenger names on the booking, not just the primary contact. For hotels, include all guests listed. Return [] only if no names are found anywhere in the email.
- rooms: For HOTEL bookings ONLY. If the confirmation email contains MULTIPLE rooms with distinct confirmation numbers (common when families book 2+ rooms at the same property for the same dates), return each room as a separate object in this array. Each room object has: confirmationCode (the room-specific code), guests (the guest names on that room), cost (the price for that room in the booking currency). If the booking is a single room, return null — NOT an empty array. If the top-level confirmationCode matches one of the rooms (or the email only contains one room), treat that as a single-room booking and return rooms: null. Example: a Strawberry Hotels email with booking numbers 28686792 (2 adults, 13576 NOK), 28687367 (1 adult + 1 child, 13828 NOK), 28688208 (1 adult + 1 child, 13828 NOK) — return rooms as a 3-element array. Top-level confirmationCode should be the FIRST room's code (28686792), totalCost should be the sum (41232), guestNames should be the union of all room guests.
- legs: For flights ONLY. Extract EVERY individual flight segment as a separate leg object, INCLUDING intermediate stops like layovers or stopovers. A Tokyo→Singapore→Colombo itinerary has 2 legs: TYO→SIN and SIN→CMB. A Seattle→Keflavík→Bergen itinerary has 2 legs: SEA→KEF and KEF→BGO. NEVER consolidate segments — if the email mentions a ticketed segment, it MUST appear in legs. Always populate this array for flights even if only one segment. Include arrival datetime per leg when visible in the email. For EACH leg, populate flightNumber with that segment's flight number (e.g. "UL895" for leg 1, "UL3335" for leg 2) — NOT the same number on every leg. If the leg's specific flight number is not visible, use null. Populate airline per leg (carrier operating that segment); use null if unknown.
- outboundDestination / outboundDestinationAirport: For round-trip flights that depart from and return to a home airport (NRT, HND, LHR, LGW), identify the furthest destination city/airport — NOT the return airport. Example: NRT→SIN→CMB→LHR→NRT has outboundDestination="Colombo" and outboundDestinationAirport="CMB". For one-way or simple round trips, this is just toCity/toAirport.
- fromAirport/toAirport/fromCity/toCity: Keep these for backward compatibility. fromAirport = first leg departure, toAirport = outboundDestinationAirport (NOT the return leg airport), fromCity = first leg departure city, toCity = outboundDestination city.
- AIRPORT CODE EXTRACTION RULES: Use ONLY IATA codes that appear verbatim in the email body (e.g. "HND", "NRT", "LHR"). NEVER infer or guess an IATA code from a city name alone. If the email says "TOKYO INTL HANEDA" or "HANEDA" → HND. If the email says "TOKYO INTL NARITA" or "NARITA" → NRT. If the email says only "Tokyo" with no airport qualifier, leave fromAirport/toAirport as "" (empty string) — do NOT emit "TYO" or any other code. The same rule applies to every leg.from and leg.to field. If you cannot find the IATA code verbatim in the email, return "".`,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      console.error("[email-inbound] unexpected Claude response type");
      await logExtraction({ ...logCtx, outcome: "error", errorMessage: "unexpected Claude response type" });
      return NextResponse.json({ received: true, status: "claude_error" });
    }

    let extracted: Record<string, unknown>;
    try {
      const clean = content.text.replace(/```json|```/g, "").trim();
      extracted = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      console.error("[email-inbound] JSON parse failed:", content.text);
      await logExtraction({ ...logCtx, outcome: "error", errorMessage: "JSON parse failed" });
      return NextResponse.json({ received: true, status: "parse_error" });
    }

    logCtx.extractedType = (extracted?.type as string | null) ?? null;
    logCtx.confidenceScore = (extracted?.confidence as number | null) ?? null;

    if (!extracted || (extracted.confidence as number) < 0.5) {
      console.log("[email-inbound] low confidence:", extracted?.confidence);
      const urlMatch = (text || html || '').match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        const rawUrl = urlMatch[0].replace(/[.,;!?)]+$/, '');
        console.log('[trips-save] URL detected:', rawUrl);
        const savedItem = await db.savedItem.create({
          data: {
            familyProfileId: familyProfile.id,
            sourceMethod: "EMAIL_FORWARD",
            sourcePlatform: inferPlatformFromUrl(rawUrl),
            sourceUrl: rawUrl,
            rawTitle: rawUrl,
            categoryTags: normalizeAndDedupeCategoryTags([]),
            status: 'UNORGANIZED',
            extractionStatus: 'PENDING',
            tripId: null,
            destinationCity: null,
          },
        });
        console.log('[trips-save] SavedItem created:', savedItem.id);
        try {
          const pageRes = await fetch(rawUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
            redirect: 'follow'
          })
          const finalUrl = pageRes.url
          console.log('[trips-save] final URL after redirect:', finalUrl)

          let pageTitle: string | null = null

          // Try extracting place name from Google Maps URL
          // Format: /maps/place/Place+Name/@coords or /maps/place/Place+Name/data=...
          const mapsMatch = finalUrl.match(/\/maps\/place\/([^/@?]+)/)
          if (mapsMatch?.[1]) {
            pageTitle = decodeURIComponent(mapsMatch[1].replace(/\+/g, ' ')).trim()
            console.log('[trips-save] extracted from Maps URL:', pageTitle)
          }

          // Fallback: try <title> tag from HTML
          if (!pageTitle) {
            const html = await pageRes.text()
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            if (titleMatch?.[1]) {
              pageTitle = titleMatch[1]
                .replace(/\s*[-|].*$/, '') // strip " - Google Maps" suffix
                .trim()
                .slice(0, 200)
              console.log('[trips-save] extracted from title tag:', pageTitle)
            }
          }

          if (pageTitle) {
            await db.savedItem.update({
              where: { id: savedItem.id },
              data: { rawTitle: pageTitle }
            })
          }
        } catch (e) {
          console.log('[trips-save] title extraction failed:', e)
        }
        let urlSaveCity: string | null = null;
        try {
          const enriched = await enrichWithPlaces(rawUrl, '');
          const placesUpdate: { placePhotoUrl?: string; websiteUrl?: string; destinationCity?: string } = {};
          if (enriched.imageUrl) placesUpdate.placePhotoUrl = enriched.imageUrl;
          if (enriched.website) placesUpdate.websiteUrl = enriched.website;
          if (enriched.city) { placesUpdate.destinationCity = enriched.city; urlSaveCity = enriched.city; }
          if (Object.keys(placesUpdate).length > 0) {
            await db.savedItem.update({ where: { id: savedItem.id }, data: placesUpdate });
          }
          console.log('[trips-save] enrichment complete for', savedItem.id, '| city:', urlSaveCity);
        } catch (e) {
          console.error('[trips-save] enrichment failed:', e);
        }
        enrichSavedItem(savedItem.id).catch(e => console.error('[trips-save] enrichSavedItem failed:', e));
        // Re-read latest rawTitle (may have been updated by title extraction)
        const latestItem = await db.savedItem.findUnique({ where: { id: savedItem.id }, select: { rawTitle: true } });
        const confirmTitle = latestItem?.rawTitle ?? rawUrl;
        let urlBranchTrip: { id: string; title: string } | null = null;
        try {
          const urlSaveCountry = await getCountryForCity(urlSaveCity ?? '');
          urlBranchTrip = await geoMatchTrips(familyProfile.id, urlSaveCity, urlSaveCountry);
          if (urlBranchTrip) {
            await db.savedItem.update({ where: { id: savedItem.id }, data: { tripId: urlBranchTrip.id } });
            console.log('[trips-save] auto-assigned to trip:', urlBranchTrip.id);
          }
        } catch (e) {
          console.error('[trips-save] trip match/assign failed:', e);
        }
        try {
          await resend.emails.send({
            from: "Flokk <trips@flokktravel.com>",
            to: senderEmail,
            subject: `Saved to Flokk: ${confirmTitle}`,
            html: buildSaveConfirmationEmail(confirmTitle, urlSaveCity, urlBranchTrip, savedItem.id),
          });
        } catch (e) {
          console.error('[trips-save] confirmation email failed:', e);
        }
      } else {
        console.log('[trips-save] no URL found in low-confidence email, skipping');
      }
      await logExtraction({ ...logCtx, outcome: "dropped", errorMessage: `low confidence: ${extracted?.confidence ?? "null"}` });
      return NextResponse.json({ received: true, status: "low_confidence" });
    }

    // Resolve guest names against known family members
    if (Array.isArray(extracted.guestNames)) {
      extracted.guestNames = (extracted.guestNames as string[]).map((n) => resolveGuestName(n, knownMembers));
    }
    console.log("[email-inbound] resolved guests:", extracted.guestNames);

    console.log("[email-inbound] parsed:", JSON.stringify(extracted));
    console.log("[email-inbound] airports — fromAirport:", extracted.fromAirport, "| toAirport:", extracted.toAirport, "| fromCity:", extracted.fromCity, "| toCity:", extracted.toCity, "| returnFromAirport:", extracted.returnFromAirport, "| returnToAirport:", extracted.returnToAirport);

    // ── Match trip ─────────────────────────────────────────────────────────────
    const bookingDate = (extracted.checkIn ?? extracted.departureDate) as string | null;

    // Discipline 4.11: booking emails are explicit signals. ALL trips eligible regardless of recency.
    // Founding Contributor flow imports historical bookings to populate imported past trips — the
    // 30-day window blocked that path and created duplicate trips. Note: this is the booking-email
    // path. URL forwards via geoMatchTrips() correctly DO exclude past trips because URL saves are
    // typically future-inspiration, not retroactive memory capture (different semantics).
    const eligibleTrips = trips;

    // Destination keywords from Claude-extracted location fields, normalized
    // through AIRPORT_TO_CITY so IATA codes / full airport names expand to
    // canonical city/country strings that match trip.destinationCity/Country.
    const destKeywords: string[] = [
      ...new Set(
        [extracted.city, extracted.toCity, extracted.fromCity, extracted.country]
          .filter((v): v is string => typeof v === "string" && v.length > 0)
          .flatMap((v) => normalizeLocationToKeywords(v))
      ),
    ].filter((k) => k.length > 2);

    console.log(`[email-match] type: ${extracted.type ?? "unknown"} | toCity: ${extracted.toCity ?? "null"} | fromCity: ${extracted.fromCity ?? "null"} | city: ${extracted.city ?? "null"} | country: ${extracted.country ?? "null"} | bookingDate: ${bookingDate ?? "null"}`);
    console.log(`[email-match] destKeywords: [${destKeywords.join(", ")}]`);

    // Subject words kept as weak last-resort fallback only
    const subjectWords = subject.replace(/fwd?:/i, "")
      .split(/[\s|:\-–—]+/).map((w) => w.trim()).filter((w) => w.length > 2);

    // Helper: does a booking date fall within a trip's range (allow 3 days before start for pre-trip hotels)
    function dateInTripRange(dateStr: string, trip: typeof trips[0]): boolean {
      if (!trip.startDate || !trip.endDate) return false;
      const [y, m, d] = dateStr.split("-").map(Number);
      const booking = new Date(y, m - 1, d);
      const start = new Date(trip.startDate); start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 3); // allow 3 days before trip start
      const end = new Date(trip.endDate);   end.setHours(23, 59, 59, 999);
      return booking >= start && booking <= end;
    }

    const now = new Date();
    function sortByRelevance(a: typeof trips[0], b: typeof trips[0]): number {
      const score = (s: string | null) => s === "PLANNING" ? 0 : s === "ACTIVE" ? 1 : 2;
      const diff = score(a.status ?? null) - score(b.status ?? null);
      if (diff !== 0) return diff;
      const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      const aFuture = a.startDate ? new Date(a.startDate) >= now : false;
      const bFuture = b.startDate ? new Date(b.startDate) >= now : false;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aDate - bDate;
    }

    let matchedTrip: typeof trips[0] | null = null;

    // Priority 0: Round-trip flight — both fromAirport and toAirport are home airports.
    // toAirport is the return leg landing at home, so it is NOT the trip destination.
    // Skip keyword matching entirely and match by departure date overlap instead.
    // Example: NRT→SIN→CMB→LHR→NRT — toAirport=NRT, but destination is Sri Lanka.
    const fromIATA = (extracted.fromAirport as string | null)?.toUpperCase() ?? null;
    const toIATA   = (extracted.toAirport   as string | null)?.toUpperCase() ?? null;
    const isRoundTrip =
      extracted.type === "flight" &&
      !!fromIATA && HOME_AIRPORTS.has(fromIATA) &&
      !!toIATA   && HOME_AIRPORTS.has(toIATA);

    if (isRoundTrip && bookingDate) {
      const roundTripMatches = eligibleTrips.filter((t) => dateInTripRange(bookingDate, t));
      console.log(`[email-match] P0 round-trip (${fromIATA}→${toIATA}) date matches (${roundTripMatches.length}): ${roundTripMatches.map(t => `"${t.title}"`).join(", ")}`);
      if (roundTripMatches.length === 1) {
        matchedTrip = roundTripMatches[0];
      } else if (roundTripMatches.length > 1) {
        // Multiple trips overlap — pick shortest (most specific) trip
        roundTripMatches.sort((a, b) => {
          const durA = (a.endDate ? new Date(a.endDate).getTime() : Infinity) - (a.startDate ? new Date(a.startDate).getTime() : 0);
          const durB = (b.endDate ? new Date(b.endDate).getTime() : Infinity) - (b.startDate ? new Date(b.startDate).getTime() : 0);
          return durA - durB;
        });
        matchedTrip = roundTripMatches[0];
      }
    }

    // Priority 1: Destination keyword match — primary signal, most reliable
    // Uses city/toCity/fromCity/country from Claude extraction.
    // For flights: toCity matches the arrival trip; fromCity matches the departure trip (date disambiguates).
    // For hotels/activities: city matches the local trip.
    // Skipped if P0 already matched (round trip).
    if (!matchedTrip && destKeywords.length > 0) {
      const destMatches = eligibleTrips.filter((t) => tripMatchesDestination(t, destKeywords));
      console.log(`[email-match] P1 dest matches (${destMatches.length}): ${destMatches.map(t => `"${t.title}"`).join(", ")}`);
      if (destMatches.length > 0) {
        // Promote trips that match the full extracted city phrase over partial token matches.
        // Prevents "Chiang" matching both Chiang Mai and Chiang Rai — the full phrase wins.
        const exactPhraseMatches = destMatches.filter((t) => {
          const haystack = [t.title, t.destinationCity, t.destinationCountry]
            .filter(Boolean).join(" ").toLowerCase();
          return [extracted.city, extracted.toCity, extracted.fromCity]
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .some((phrase) => haystack.includes(phrase.toLowerCase()));
        });
        const promotedMatches = exactPhraseMatches.length > 0 ? exactPhraseMatches : destMatches;
        const withDate = bookingDate ? promotedMatches.filter((t) => dateInTripRange(bookingDate, t)) : [];
        // Only commit to a P1 match if the date also overlaps.
        // If no promoted match has a date in range, fall through to P2
        // so date-based matching can find the correct trip.
        if (withDate.length > 0) {
          withDate.sort(sortByRelevance);
          matchedTrip = withDate[0];
        }
      }
    }

    // Priority 2: Date overlap only — when destination wasn't extracted or didn't match
    if (!matchedTrip && bookingDate) {
      const dateMatches = eligibleTrips.filter((t) => dateInTripRange(bookingDate, t));
      console.log(`[email-match] P2 date matches (${dateMatches.length}): ${dateMatches.map(t => `"${t.title}"`).join(", ")}`);
      if (dateMatches.length > 0) {
        dateMatches.sort((a, b) => {
          const score = (s: string | null) => s === "PLANNING" ? 0 : s === "ACTIVE" ? 1 : 2;
          const diff = score(a.status ?? null) - score(b.status ?? null);
          if (diff !== 0) return diff;
          // Prefer shorter (more specific) trips
          const durA = (a.endDate ? new Date(a.endDate).getTime() : Infinity) - (a.startDate ? new Date(a.startDate).getTime() : 0);
          const durB = (b.endDate ? new Date(b.endDate).getTime() : Infinity) - (b.startDate ? new Date(b.startDate).getTime() : 0);
          return durA - durB;
        });
        matchedTrip = dateMatches[0];
      }
    }

    // Priority 3: Subject word match as weak fallback (only if neither destination nor date matched)
    if (!matchedTrip && subjectWords.length > 0) {
      const subjectMatches = eligibleTrips.filter((t) => tripMatchesDestination(t, subjectWords));
      if (subjectMatches.length > 0) {
        console.log(`[email-match] P3 subject matches (${subjectMatches.length}): ${subjectMatches.map(t => `"${t.title}"`).join(", ")}`);
        subjectMatches.sort(sortByRelevance);
        matchedTrip = subjectMatches[0];
      }
    }

    // No match → unassigned (tripId = null, stored against familyProfile for surfacing in UI)
    const confidenceScore = (extracted.confidence as number) ?? 0;
    let resolvedTripId: string | null =
      (matchedTrip && confidenceScore >= 0.8) ? matchedTrip.id : null;
    console.log(`[email-match] result: tripId = ${resolvedTripId ?? "null — unassigned"} | matched: "${matchedTrip?.title ?? "none"}" | confidence: ${confidenceScore}`);
    console.log(`[email-inbound] trip match: "${matchedTrip?.title ?? "UNASSIGNED"}" | resolvedTripId: ${resolvedTripId ?? "null"} | confidence: ${confidenceScore}`);
    logCtx.matchedTripId = resolvedTripId;

    // Auto-create trip when no match found, confidence >= 0.9, type is flight or hotel, and destination is known
    // Lowered from 0.9 to 0.85 (Chat 32 P5) — Unassigned Bookings fallback catches misses.
    if (!matchedTrip && confidenceScore >= 0.85) {
      const autoType = (extracted.type as string | null) ?? null;
      if (autoType === "flight" || autoType === "hotel") {
        const rawToCity = (extracted.toCity as string | null)?.trim() ?? null;
        const rawCity = (extracted.city as string | null)?.trim() ?? null;
        const autoDestCity = (rawToCity || rawCity || null)?.replace(/,\s*[A-Z]{2}$/, "").trim() ?? null;
        if (autoDestCity) {
          const autoDestCountry = (extracted.country as string | null) ?? null;
          const autoStart = (extracted.departureDate as string | null) ?? (extracted.checkIn as string | null) ?? null;
          const autoEnd = (extracted.returnDepartureDate as string | null) ?? (extracted.checkOut as string | null) ?? null;
          const autoData = await buildTripFromExtraction({
            cities: [autoDestCity],
            country: autoDestCountry,
            startDate: autoStart,
            endDate: autoEnd,
          });
          const autoTrip = await db.$transaction(async (tx) => {
            const created = await tx.trip.create({
              data: { ...autoData, familyProfileId: familyProfile.id },
            });
            await tx.tripCollaborator.create({
              data: {
                tripId: created.id,
                familyProfileId: familyProfile.id,
                role: "OWNER",
                invitedById: familyProfile.id,
                invitedAt: new Date(),
                acceptedAt: new Date(),
              },
            });
            return created;
          });
          matchedTrip = autoTrip as typeof trips[0];
          resolvedTripId = autoTrip.id;
          logCtx.autoCreatedTripId = autoTrip.id;
          logCtx.matchedTripId = autoTrip.id;
          console.log(`[email-inbound] auto-created trip: "${autoData.title}" id: ${autoTrip.id}`);
        }
      }

      // Path 2: operator plan detection + structured extraction + day-level writes
      // Fires only when Path 1 classified as "activity" AND the body looks like multi-day prose.
      if (autoType === "activity" && looksLikeOperatorPlan(text || html)) {
        console.log("[email-inbound] Path 2: operator plan heuristic triggered, running structured extraction");
        const rawBodyForExtraction = (text || html).substring(0, 12000);
        const plan = await extractOperatorPlan(rawBodyForExtraction, subject);
        if (plan && plan.confidence >= 0.8 && plan.days.length >= 2) {
          console.log(`[email-inbound] Path 2: extracted ${plan.days.length} days, ${plan.accommodations.length} lodgings`);

          // Build the trip from plan-level metadata
          const planCountry = plan.destinationCountry ?? null;
          const planCities = plan.cities.length > 0 ? plan.cities : [];
          const planData = await buildTripFromExtraction({
            cities: planCities,
            country: planCountry,
            startDate: plan.startDate,
            endDate: plan.endDate,
          });

          const planTrip = await db.$transaction(async (tx) => {
            const created = await tx.trip.create({
              data: { ...planData, familyProfileId: familyProfile.id },
            });
            await tx.tripCollaborator.create({
              data: {
                tripId: created.id,
                familyProfileId: familyProfile.id,
                role: "OWNER",
                invitedById: familyProfile.id,
                invitedAt: new Date(),
                acceptedAt: new Date(),
              },
            });
            return created;
          });
          logCtx.autoCreatedTripId = planTrip.id;
          logCtx.matchedTripId = planTrip.id;

          // Helper: compute scheduledDate (YYYY-MM-DD string) from trip startDate + dayIndex offset
          const computeScheduledDate = (dayIndex: number): string | null => {
            if (!plan.startDate) return null;
            try {
              const start = new Date(plan.startDate);
              start.setDate(start.getDate() + dayIndex);
              return start.toISOString().substring(0, 10);
            } catch { return null; }
          };

          // Write N day-level ACTIVITY items
          // Geocode each day's primary city so TripMap renders pins instead of Seoul fallback.
          const dayItemIds: string[] = [];
          for (const day of plan.days) {
            let dayLat: number | null = null;
            let dayLng: number | null = null;
            const dayCityGuess = planCities[day.dayIndex] ?? planCities[0] ?? planCountry ?? null;
            if (dayCityGuess) {
              try {
                const geo = await geocodePlace(`${dayCityGuess}${planCountry ? " " + planCountry : ""}`);
                if (geo) { dayLat = geo.lat; dayLng = geo.lng; }
              } catch { /* geocoding failure must not block item write */ }
            }
            const created = await db.itineraryItem.create({
              data: {
                tripId: planTrip.id,
                familyProfileId: familyProfile.id,
                type: "ACTIVITY",
                title: day.title,
                notes: day.description,
                dayIndex: day.dayIndex,
                scheduledDate: computeScheduledDate(day.dayIndex),
                latitude: dayLat,
                longitude: dayLng,
                sourceType: "EMAIL_IMPORT",
                sortOrder: day.dayIndex * 100,
                venueUrl: resolveCanonicalUrl({ name: day.title, city: dayCityGuess ?? '' }),
              },
            });
            dayItemIds.push(created.id);
          }

          // Write M lodging items
          const lodgingItemIds: string[] = [];
          for (const lodging of plan.accommodations) {
            let lodgingLat: number | null = null;
            let lodgingLng: number | null = null;
            if (lodging.city || lodging.name) {
              try {
                const geo = await geocodePlace(`${lodging.name}${lodging.city ? " " + lodging.city : ""}${planCountry ? " " + planCountry : ""}`);
                if (geo) { lodgingLat = geo.lat; lodgingLng = geo.lng; }
              } catch { /* geocoding failure must not block item write */ }
            }
            const created = await db.itineraryItem.create({
              data: {
                tripId: planTrip.id,
                familyProfileId: familyProfile.id,
                type: "LODGING",
                title: lodging.name,
                notes: lodging.city ? `${lodging.name} · ${lodging.city}` : lodging.name,
                dayIndex: lodging.checkInDayIndex,
                scheduledDate: computeScheduledDate(lodging.checkInDayIndex),
                latitude: lodgingLat,
                longitude: lodgingLng,
                sourceType: "EMAIL_IMPORT",
                sortOrder: lodging.checkInDayIndex * 100 + 50,
                venueUrl: resolveCanonicalUrl({ name: lodging.name, city: lodging.city ?? planCities[lodging.checkInDayIndex] ?? planCities[0] ?? '' }),
              },
            });
            lodgingItemIds.push(created.id);
          }

          // Write TripDocument with operator-plan metadata (content is String in schema)
          const planDoc = await db.tripDocument.create({
            data: {
              tripId: planTrip.id,
              label: plan.operatorName ?? "Operator plan",
              type: "operator_plan",
              content: JSON.stringify({
                operatorName: plan.operatorName,
                operatorEmail: plan.operatorEmail,
                operatorPhone: plan.operatorPhone,
                operatorWebsite: plan.operatorWebsite,
                totalCost: plan.totalCost,
                currency: plan.currency,
                cities: plan.cities,
                bundledActivities: plan.bundledActivities,
              }),
            },
          });
          logCtx.tripDocumentId = planDoc.id;
          logCtx.itineraryItemIds = [...dayItemIds, ...lodgingItemIds];

          // Completeness check
          const expected = plan.days.length + plan.accommodations.length + 1; // +1 for TripDocument
          const actual = dayItemIds.length + lodgingItemIds.length + 1;
          const completenessOutcome: "success" | "partial" = expected === actual ? "success" : "partial";
          const completenessError = expected === actual ? null : `expected ${expected} entities, wrote ${actual}`;

          console.log(`[email-inbound] Path 2: auto-created trip "${planData.title}" id: ${planTrip.id} | days: ${dayItemIds.length} | lodgings: ${lodgingItemIds.length} | completeness: ${completenessOutcome}`);

          await logExtraction({ ...logCtx, outcome: completenessOutcome, errorMessage: completenessError });
          return NextResponse.json({ received: true, operator_plan: true, tripId: planTrip.id, completeness: completenessOutcome });
        } else {
          console.log(`[email-inbound] Path 2: extraction declined (confidence ${plan?.confidence ?? 0}, days ${plan?.days?.length ?? 0})`);
          // Fall through to existing activity handling (creates the single flat orphan)
        }
      }
    }

    // Duplicate guard: check confirmationCode scoped to the resolved trip.
    // Phase Vault: narrowed from profile-global to trip-scoped so that re-forwarding
    // a booking to a different trip (e.g. a code that was previously mismatched) now succeeds.
    // Only applied when confirmationCode is non-null — null-code bookings are allowed through.
    //
    // Pre-extraction dedup removed for flights in Phase 2A.1 — writeFlightFromEmail now handles
    // dedup at the write layer (find-or-replace on FlightBooking by tripId+confirmationCode).
    // See src/lib/flights/extract-and-write.ts. Guard retained for hotel/activity types which
    // do not yet have write-layer dedup.
    const incomingConfCode = (extracted.confirmationCode as string | null) ?? null;
    if (incomingConfCode && extracted.type !== "flight" && resolvedTripId) {
      const existing = await db.itineraryItem.findFirst({
        where: { confirmationCode: incomingConfCode, tripId: resolvedTripId },
        select: { id: true, title: true, tripId: true },
      });
      if (existing) {
        console.log(`[email-inbound] duplicate detected (trip-scoped) — confirmationCode: ${incomingConfCode} already exists as "${existing.title}" on trip ${existing.tripId ?? "unassigned"} — skipping`);
        await logExtraction({ ...logCtx, outcome: "dropped", errorMessage: `duplicate confirmationCode: ${incomingConfCode}` });
        return NextResponse.json({ received: true, skipped: "duplicate" });
      }
    }

    const passengers = Array.isArray(extracted.guestNames) ? (extracted.guestNames as string[]) : [];

    // ── FIX 4: cost helper ────────────────────────────────────────────────────
    const parsedCost = parseCost(extracted.totalCost);
    const detectedCurrency = (extracted.currency as string | null) ?? detectCurrency(extracted.totalCost) ?? "USD";

    // No-op: budgetSpent is deprecated. Tracked total is computed dynamically
    // from ItineraryItem.totalCost in /api/trips/[id]/budget GET route.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function incrementBudget(_tripId: string | null, _cost: number | null) {
      return;
    }

    // ── Flights ───────────────────────────────────────────────────────────────
    // flightNumber is NOT required — multi-leg itinerary emails and some airline
    // direct booking confirmations do not surface a single flightNumber field.
    if (extracted.type === "flight") {
      const outboundDayIndex = extracted.departureDate
        ? await getDayIndex(resolvedTripId, extracted.departureDate as string)
        : null;

      // Resolve airports/times — fills in any fields Claude missed by checking
      // prior vault docs for the same trip+confirmationCode (re-forward resilience)
      const outboundConf = (extracted.confirmationCode as string | null) ?? null;
      const resolved = await resolveFlightFieldsFromVault(resolvedTripId, outboundConf, extracted);
      if (resolved.fromAirport !== extracted.fromAirport || resolved.toAirport !== extracted.toAirport) {
        console.log(`[email-inbound] resolved flight fields from prior vault — from: ${resolved.fromAirport} to: ${resolved.toAirport} dep: ${resolved.departureTime}`);
      }

      // Derive outbound destination from legs array — never trust Claude's
      // outboundDestination/outboundDestinationAirport interpretation.
      // For HND→SIN→CMB→LHR→HND: nonHomeLegs = [SIN, CMB], picks CMB (last non-home).
      const legs = Array.isArray(extracted.legs)
        ? extracted.legs as Array<{ from: string; to: string; fromCity?: string; toCity?: string; departure?: string }>
        : [];

      const HOME = new Set(["NRT", "HND", "LHR", "LGW", "YVR", "JFK", "LAX"]);

      let effectiveToAirport: string | null = null;
      let effectiveToCity: string | null = null;

      if (legs.length > 1) {
        const nonHomeLegs = legs.filter((l) => !HOME.has(l.to));
        const outboundLeg = nonHomeLegs[nonHomeLegs.length - 1] ?? null;
        if (outboundLeg) {
          effectiveToAirport = outboundLeg.to;
          effectiveToCity    = outboundLeg.toCity ?? outboundLeg.to;
          console.log(`[email-inbound] multi-leg flight detected: ${legs.length} legs, derived outbound: ${effectiveToCity} (${effectiveToAirport})`);
        }
      } else if (legs.length === 1) {
        effectiveToAirport = legs[0].to;
        effectiveToCity    = legs[0].toCity ?? legs[0].to;
      }

      // Fall back to Claude's raw fields only if legs array is empty
      if (!effectiveToAirport) effectiveToAirport = resolved.toAirport;
      if (!effectiveToCity)    effectiveToCity    = resolved.toCity;

      // Patch resolved so geocoding and title use the correct destination
      resolved.toAirport = effectiveToAirport;
      resolved.toCity    = effectiveToCity;

      const outboundFrom = resolved.fromAirport || resolved.fromCity || null;
      const outboundTo   = effectiveToAirport   || effectiveToCity   || null;
      const outboundTitle = outboundFrom && outboundTo
        ? `${outboundFrom} → ${outboundTo}`
        : outboundFrom ? `${outboundFrom} → (destination)` : outboundTo ? `(origin) → ${outboundTo}` : (extracted.flightNumber as string) ?? "Flight";

      // ── Per-leg flight ItineraryItem creation ────────────────────────────────
      // Each segment in legs[] becomes its own ItineraryItem row. Same
      // confirmationCode, different scheduledDate → no dedup collision.
      // Falls back to scalar fromAirport/toAirport synthesis if legs[] is empty.

      type FlightLeg = {
        from: string;
        to: string;
        fromCity: string | null;
        toCity: string | null;
        departureDate: string | null;
        departureTime: string | null;
        arrivalDate: string | null;
        arrivalTime: string | null;
        flightNumber: string | null;
        airline: string | null;
      };

      let flightLegs: FlightLeg[] = [];

      const rawLegs = Array.isArray(extracted.legs)
        ? extracted.legs as Array<{ from: string; to: string; fromCity?: string; toCity?: string; departure?: string; arrival?: string; flightNumber?: string | null; airline?: string | null }>
        : [];

      if (rawLegs.length > 0) {
        flightLegs = rawLegs.map((l) => {
          const [depDate, depTime] = typeof l.departure === "string" ? l.departure.split("T") : [null, null];
          const [arrDate, arrTime] = typeof l.arrival === "string" ? l.arrival.split("T") : [null, null];
          return {
            from: l.from,
            to: l.to,
            fromCity: l.fromCity ?? null,
            toCity: l.toCity ?? null,
            departureDate: depDate ?? null,
            departureTime: depTime ? depTime.slice(0, 5) : null,
            arrivalDate: arrDate ?? null,
            arrivalTime: arrTime ? arrTime.slice(0, 5) : null,
            flightNumber: (l.flightNumber as string | null | undefined) ?? null,
            airline: (l.airline as string | null | undefined) ?? null,
          };
        });
      } else {
        // Fallback: synthesize from scalar fields when legs[] was not populated
        if ((extracted.fromAirport as string | null) && (extracted.toAirport as string | null)) {
          flightLegs.push({
            from: extracted.fromAirport as string,
            to: extracted.toAirport as string,
            fromCity: (extracted.fromCity as string | null) ?? null,
            toCity: (extracted.toCity as string | null) ?? null,
            departureDate: (extracted.departureDate as string | null) ?? null,
            departureTime: (extracted.departureTime as string | null) ?? null,
            arrivalDate: (extracted.arrivalDate as string | null) ?? null,
            arrivalTime: (extracted.arrivalTime as string | null) ?? null,
            flightNumber: (extracted.flightNumber as string | null) ?? null,
            airline: (extracted.airline as string | null) ?? null,
          });
        }
        // Synthesize return leg from scalar return fields if present
        if (
          (extracted.returnDepartureDate as string | null) &&
          (extracted.returnFromAirport as string | null) &&
          (extracted.returnToAirport as string | null)
        ) {
          flightLegs.push({
            from: extracted.returnFromAirport as string,
            to: extracted.returnToAirport as string,
            fromCity: (extracted.toCity as string | null) ?? null,
            toCity: (extracted.fromCity as string | null) ?? null,
            departureDate: extracted.returnDepartureDate as string,
            departureTime: (extracted.returnDepartureTime as string | null) ?? null,
            arrivalDate: (extracted.returnArrivalDate as string | null) ?? null,
            arrivalTime: (extracted.returnArrivalTime as string | null) ?? null,
            flightNumber: null,
            airline: (extracted.airline as string | null) ?? null,
          });
        }
      }

      console.log(`[email-inbound] creating ${flightLegs.length} flight ItineraryItem(s) for confirmation ${outboundConf ?? "(no code)"}`);

      // Delete stale FLIGHT ItineraryItems before writing fresh legs.
      // The upsert key includes fromAirport+toAirport, so airport corrections
      // (e.g. NRT→HND) create new rows rather than updating existing ones,
      // leaving duplicates. deleteMany is idempotent — returns 0 on first write.
      if (outboundConf) {
        const deleted = await db.itineraryItem.deleteMany({
          where: {
            tripId: resolvedTripId,
            confirmationCode: outboundConf,
            OR: [
              { type: "FLIGHT" },
              // Legacy ACTIVITY-type orphans (e.g. "Flight arrival" rows written
              // when the extractor didn't recognise the email as a flight booking)
              { type: "ACTIVITY", title: { contains: "Flight", mode: "insensitive" } },
            ],
          },
        });
        if (deleted.count > 0) {
          console.log(`[email-inbound] cleared ${deleted.count} stale FLIGHT/ACTIVITY ItineraryItem(s) for ${outboundConf} on trip ${resolvedTripId}`);
        }
      }

      const createdLegItemIds: string[] = [];
      const writeFlightLegs: WriteFlightLeg[] = [];

      for (let legIdx = 0; legIdx < flightLegs.length; legIdx++) {
        const leg = flightLegs[legIdx];

        if (!leg.from || !leg.to) {
          console.warn(`[email-inbound] skipping leg with missing airports: from=${leg.from} to=${leg.to}`);
          continue;
        }

        const legTitle = `${leg.from} → ${leg.to}`;
        const legDayIndex = leg.departureDate ? await getDayIndex(resolvedTripId, leg.departureDate) : null;

        // Collect leg for Flight table write (after ItineraryItem loop completes)
        writeFlightLegs.push({
          airline: leg.airline ?? (extracted.airline as string | null) ?? null,
          flightNumber: leg.flightNumber ?? (extracted.flightNumber as string | null) ?? "",
          fromAirport: leg.from,
          fromCity: leg.fromCity ?? leg.from,
          toAirport: leg.to,
          toCity: leg.toCity ?? leg.to,
          departureDate: leg.departureDate ?? "",
          departureTime: leg.departureTime ?? "",
          arrivalDate: leg.arrivalDate ?? null,
          arrivalTime: leg.arrivalTime ?? null,
          duration: null,
          dayIndex: legDayIndex,
          type: "outbound",
          notes: null,
        });

        // Geocode arrival airport for map pin — IATA+city preferred, IATA-only fallback
        const geoQuery = leg.toCity
          ? `${leg.to} airport ${leg.toCity}`
          : `${leg.to} airport`;
        const legGeo = await geocodePlace(geoQuery);
        const legArrivalLat = legGeo?.lat ?? null;
        const legArrivalLng = legGeo?.lng ?? null;

        // Upsert key: tripId + confirmationCode + scheduledDate + fromAirport + toAirport
        // fromAirport/toAirport prevent collision when two legs depart on the same calendar date.
        const existingLeg = outboundConf ? await db.itineraryItem.findFirst({
          where: {
            tripId: resolvedTripId,
            confirmationCode: outboundConf,
            type: "FLIGHT",
            scheduledDate: leg.departureDate ?? null,
            fromAirport: leg.from,
            toAirport: leg.to,
          },
        }) : null;

        // Booking cost charged to the first leg only — avoids double-counting in budget
        const legCost = legIdx === 0 ? parsedCost : null;

        const legItemData = {
          type: "FLIGHT" as const,
          title: legTitle,
          scheduledDate: leg.departureDate ?? null,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
          fromAirport: leg.from,
          toAirport: leg.to,
          fromCity: leg.fromCity,
          toCity: leg.toCity,
          confirmationCode: outboundConf,
          totalCost: legCost,
          currency: detectedCurrency,
          passengers,
          dayIndex: legDayIndex,
          latitude: legArrivalLat,
          longitude: legArrivalLng,
          arrivalLat: legArrivalLat,
          arrivalLng: legArrivalLng,
        };

        const legItemId = existingLeg
          ? (await db.itineraryItem.update({
              where: { id: existingLeg.id },
              data: legItemData,
            })).id
          : (await db.itineraryItem.create({
              data: { ...legItemData, tripId: resolvedTripId, familyProfileId: familyProfile.id, sourceType: "EMAIL_IMPORT" },
            })).id;

        createdLegItemIds.push(legItemId);
        console.log(`[email-inbound] upserted leg ${legIdx + 1}/${flightLegs.length} ItineraryItem: ${legItemId} (${legTitle})`);
      }

      // Grow trip.cities[] with intermediate stopover cities (legs[0..n-2] destinations)
      // so Layer 2 save matching works for cities visited during stopovers.
      if (resolvedTripId && flightLegs.length > 1) {
        const stopoverCities = flightLegs
          .slice(0, -1)
          .map((l) => l.toCity)
          .filter((c): c is string => typeof c === "string" && c.trim().length > 0);

        if (stopoverCities.length > 0) {
          const tripForCities = await db.trip.findUnique({
            where: { id: resolvedTripId },
            select: { cities: true },
          });
          if (tripForCities) {
            const existingLower = new Set((tripForCities.cities ?? []).map((c: string) => c.toLowerCase()));
            const newCities = stopoverCities.filter((c) => !existingLower.has(c.toLowerCase()));
            if (newCities.length > 0) {
              await db.trip.update({
                where: { id: resolvedTripId },
                data: { cities: { set: [...(tripForCities.cities ?? []), ...newCities] } },
              });
              console.log(`[email-inbound] grew trip.cities with stopover(s): ${newCities.join(", ")}`);
            }
          }
        }
      }

      // FlightBooking + per-leg Flight rows (idempotent on re-import via confirmationCode dedup)
      let writeResult: { flightBookingId: string; legCount: number; dedupAction: string } | null = null;
      const writtenTrips: Array<{ tripId: string; flightBookingId: string; legCount: number; dedupAction: string }> = [];

      if (resolvedTripId) {
        writeResult = await writeFlightFromEmail({
          tripId: resolvedTripId,
          confirmationCode: outboundConf,
          airline: (extracted.airline as string | null) ?? null,
          cabinClass: "economy",
          status: "booked",
          sortOrder: 0,
          seatNumbers: null,
          notes: null,
          legs: writeFlightLegs,
        });
        console.log(
          `[email-inbound] FlightBooking written: id=${writeResult.flightBookingId}, legs=${writeResult.legCount}, action=${writeResult.dedupAction}`
        );
        writtenTrips.push({ tripId: resolvedTripId, flightBookingId: writeResult.flightBookingId, legCount: writeResult.legCount, dedupAction: writeResult.dedupAction });

        // TripDocument vault — one per booking (represents the whole booking, not per leg)
        const vaultLabel = outboundFrom && outboundTo
          ? `${outboundFrom} → ${outboundTo}`
          : `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string}`.trim();
        const vaultContent = JSON.stringify({
          type: "flight", vendorName: extracted.airline, flightNumber: extracted.flightNumber,
          airline: extracted.airline, fromAirport: extracted.fromAirport, toAirport: extracted.toAirport,
          fromCity: extracted.fromCity, toCity: extracted.toCity,
          departureDate: extracted.departureDate, departureTime: extracted.departureTime,
          arrivalDate: extracted.arrivalDate, arrivalTime: extracted.arrivalTime,
          confirmationCode: extracted.confirmationCode,
          totalCost: extracted.totalCost, currency: extracted.currency,
          guestNames: extracted.guestNames, returnDepartureDate: extracted.returnDepartureDate,
          legs: extracted.legs, bookingUrl: (extracted.bookingUrl as string | null) ?? null,
        });

        // Dedup by confirmationCode (for booking docs with a code), else fall back to label
        const existingVaultDoc = outboundConf
          ? await db.$queryRaw<{ id: string }[]>`
              SELECT id FROM "TripDocument"
              WHERE "tripId" = ${resolvedTripId}
                AND type = 'booking'
                AND content::jsonb->>'confirmationCode' = ${outboundConf}
              LIMIT 1
            `.then((rows: { id: string }[]) => rows[0] ?? null)
          : await db.tripDocument.findFirst({ where: { tripId: resolvedTripId, label: vaultLabel } });

        if (existingVaultDoc) {
          await db.tripDocument.update({
            where: { id: existingVaultDoc.id },
            data: { label: vaultLabel, content: vaultContent },
          });
          logCtx.tripDocumentId = existingVaultDoc.id;
          console.log("[vault] Updated existing tripDocument:", existingVaultDoc.id, "label:", vaultLabel);
        } else {
          const flightDoc = await db.tripDocument.create({
            data: {
              tripId: resolvedTripId,
              label: vaultLabel,
              type: "booking",
              content: vaultContent,
            },
          });
          logCtx.tripDocumentId = flightDoc.id;
          console.log("[email-inbound] created vault doc for trip:", resolvedTripId);
        }
      }

      // ── Phase Multi-Trip: write FlightBooking + ItineraryItems + TripDocument ──
      // for every additional trip that shares leg dates with this booking.
      // Only runs for flight bookings. Non-flight branches are unaffected.
      {
        // Helper: convert Date to YYYY-MM-DD (for trip date range comparison)
        const dateToYMD = (d: Date | null | undefined): string | null =>
          d ? d.toISOString().slice(0, 10) : null;

        const allRelatedTrips = findAllRelatedTrips(
          extracted,
          trips as unknown as TripRecord[],
          resolvedTripId,
        );

        const additionalRelatedTrips = allRelatedTrips.filter(
          (r) => r.trip.id !== resolvedTripId && r.confidence >= 0.85,
        );

        if (additionalRelatedTrips.length > 0) {
          console.log(
            `[email-inbound] multi-trip: ${additionalRelatedTrips.length} additional trip(s) — ` +
            additionalRelatedTrips.map((r) => `"${r.trip.title ?? r.trip.id}" (${r.matchType})`).join(", ")
          );
        }

        for (const { trip: relatedTrip, confidence, matchType } of additionalRelatedTrips) {
          const relTripId = relatedTrip.id;
          const rtStart = dateToYMD(relatedTrip.startDate ?? null);
          const rtEnd   = dateToYMD(relatedTrip.endDate   ?? null);

          if (!rtStart || !rtEnd) continue;

          // Partition legs to those whose dep or arr falls in this trip's date range
          const relFlightLegs = flightLegs.filter((l) =>
            (!!l.departureDate && l.departureDate >= rtStart && l.departureDate <= rtEnd) ||
            (!!l.arrivalDate   && l.arrivalDate   >= rtStart && l.arrivalDate   <= rtEnd)
          );

          if (relFlightLegs.length === 0) {
            console.log(`[email-inbound] multi-trip: no partitioned legs for trip "${relatedTrip.title ?? relTripId}" — skipping`);
            continue;
          }

          // Delete stale FLIGHT + legacy ACTIVITY-type orphan ItineraryItems before writing partitioned legs
          if (outboundConf) {
            const relDeleted = await db.itineraryItem.deleteMany({
              where: {
                tripId: relTripId,
                confirmationCode: outboundConf,
                OR: [
                  { type: "FLIGHT" },
                  { type: "ACTIVITY", title: { contains: "Flight", mode: "insensitive" } },
                ],
              },
            });
            if (relDeleted.count > 0) {
              console.log(`[email-inbound] (multi-trip) cleared ${relDeleted.count} stale FLIGHT/ACTIVITY ItineraryItem(s) for ${outboundConf} on trip ${relTripId}`);
            }
          }

          // ── ItineraryItems for related trip (partitioned legs only) ────────────
          for (let legIdx = 0; legIdx < relFlightLegs.length; legIdx++) {
            const leg = relFlightLegs[legIdx];
            if (!leg.from || !leg.to) continue;

            const legTitle = `${leg.from} → ${leg.to}`;
            const legDayIndex = leg.departureDate ? await getDayIndex(relTripId, leg.departureDate) : null;

            const geoQuery = leg.toCity ? `${leg.to} airport ${leg.toCity}` : `${leg.to} airport`;
            const legGeo = await geocodePlace(geoQuery);
            const legArrivalLat = legGeo?.lat ?? null;
            const legArrivalLng = legGeo?.lng ?? null;

            const existingLeg = outboundConf ? await db.itineraryItem.findFirst({
              where: {
                tripId: relTripId,
                confirmationCode: outboundConf,
                type: "FLIGHT",
                scheduledDate: leg.departureDate ?? null,
                fromAirport: leg.from,
                toAirport: leg.to,
              },
            }) : null;

            const legCost = legIdx === 0 ? parsedCost : null;
            const legItemData = {
              type: "FLIGHT" as const,
              title: legTitle,
              scheduledDate: leg.departureDate ?? null,
              departureTime: leg.departureTime,
              arrivalTime: leg.arrivalTime,
              fromAirport: leg.from,
              toAirport: leg.to,
              fromCity: leg.fromCity,
              toCity: leg.toCity,
              confirmationCode: outboundConf,
              totalCost: legCost,
              currency: detectedCurrency,
              passengers,
              dayIndex: legDayIndex,
              latitude: legArrivalLat,
              longitude: legArrivalLng,
              arrivalLat: legArrivalLat,
              arrivalLng: legArrivalLng,
            };

            const legItemId = existingLeg
              ? (await db.itineraryItem.update({ where: { id: existingLeg.id }, data: legItemData })).id
              : (await db.itineraryItem.create({
                  data: { ...legItemData, tripId: relTripId, familyProfileId: familyProfile.id, sourceType: "EMAIL_IMPORT" },
                })).id;

            console.log(`[email-inbound] (related trip ${relTripId}) upserted leg ${legIdx + 1}/${relFlightLegs.length}: ${legItemId} (${legTitle})`);
          }

          // ── FlightBooking + Flight rows for related trip (partitioned legs) ────
          const relWriteFlightLegs: WriteFlightLeg[] = await Promise.all(
            relFlightLegs.map(async (leg) => ({
              airline: leg.airline ?? (extracted.airline as string | null) ?? null,
              flightNumber: leg.flightNumber ?? (extracted.flightNumber as string | null) ?? "",
              fromAirport: leg.from,
              fromCity: leg.fromCity ?? leg.from,
              toAirport: leg.to,
              toCity: leg.toCity ?? leg.to,
              departureDate: leg.departureDate ?? "",
              departureTime: leg.departureTime ?? "",
              arrivalDate: leg.arrivalDate ?? null,
              arrivalTime: leg.arrivalTime ?? null,
              duration: null,
              dayIndex: leg.departureDate ? await getDayIndex(relTripId, leg.departureDate) : null,
              type: "outbound",
              notes: null,
            }))
          );

          const relWriteResult = await writeFlightFromEmail({
            tripId: relTripId,
            confirmationCode: outboundConf,
            airline: (extracted.airline as string | null) ?? null,
            cabinClass: "economy",
            status: "booked",
            sortOrder: 0,
            seatNumbers: null,
            notes: null,
            legs: relWriteFlightLegs,
          });
          console.log(
            `[email-inbound] FlightBooking written for related trip ${relTripId} (${matchType}, confidence ${confidence}): ` +
            `legs=${relWriteResult.legCount}, action=${relWriteResult.dedupAction}`
          );
          writtenTrips.push({ tripId: relTripId, flightBookingId: relWriteResult.flightBookingId, legCount: relWriteResult.legCount, dedupAction: relWriteResult.dedupAction });

          // ── TripDocument vault for related trip ────────────────────────────────
          const relVaultLabel = outboundFrom && outboundTo
            ? `${outboundFrom} → ${outboundTo}`
            : `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string}`.trim();
          const relVaultContent = JSON.stringify({
            type: "flight", vendorName: extracted.airline, flightNumber: extracted.flightNumber,
            airline: extracted.airline, fromAirport: extracted.fromAirport, toAirport: extracted.toAirport,
            fromCity: extracted.fromCity, toCity: extracted.toCity,
            departureDate: extracted.departureDate, departureTime: extracted.departureTime,
            arrivalDate: extracted.arrivalDate, arrivalTime: extracted.arrivalTime,
            confirmationCode: extracted.confirmationCode,
            totalCost: extracted.totalCost, currency: extracted.currency,
            guestNames: extracted.guestNames, returnDepartureDate: extracted.returnDepartureDate,
            legs: extracted.legs, bookingUrl: (extracted.bookingUrl as string | null) ?? null,
          });

          const existingRelVaultDoc = outboundConf
            ? await db.$queryRaw<{ id: string }[]>`
                SELECT id FROM "TripDocument"
                WHERE "tripId" = ${relTripId}
                  AND type = 'booking'
                  AND content::jsonb->>'confirmationCode' = ${outboundConf}
                LIMIT 1
              `.then((rows: { id: string }[]) => rows[0] ?? null)
            : await db.tripDocument.findFirst({ where: { tripId: relTripId, label: relVaultLabel } });

          if (existingRelVaultDoc) {
            await db.tripDocument.update({
              where: { id: existingRelVaultDoc.id },
              data: { label: relVaultLabel, content: relVaultContent },
            });
            console.log(`[vault] Updated existing tripDocument for related trip ${relTripId}:`, existingRelVaultDoc.id);
          } else {
            await db.tripDocument.create({
              data: { tripId: relTripId, label: relVaultLabel, type: "booking", content: relVaultContent },
            });
            console.log(`[email-inbound] created vault doc for related trip:`, relTripId);
          }
        }
      }

      await incrementBudget(resolvedTripId, parsedCost);
      logCtx.itineraryItemIds = createdLegItemIds;
      // Capture multi-trip outcome in log when more than one trip was written
      if (writtenTrips.length > 1) {
        console.log(`[email-inbound] multi-trip summary: wrote to ${writtenTrips.length} trips: ${writtenTrips.map(t => t.tripId).join(", ")}`);
      }
      await logExtraction({ ...logCtx, outcome: "success" });
      return NextResponse.json({
        received: true, status: "success", type: "flight",
        primaryTripId: resolvedTripId,
        writtenTrips,
        // backward-compat: keep legacy tripId + flightBookingId fields
        tripId: resolvedTripId,
        ...(writeResult && { flightBookingId: writeResult.flightBookingId, legCount: writeResult.legCount }),
      });

    // ── Hotels ────────────────────────────────────────────────────────────────
    } else if (extracted.type === "hotel" && extracted.vendorName) {
      const hotelName = toTitleCase(extracted.vendorName as string | null) || (extracted.vendorName as string);
      const checkInDate = (extracted.checkIn as string | null) ?? null;
      const checkOutDate = (extracted.checkOut as string | null) ?? null;

      const checkInDayIndex = checkInDate ? await getDayIndex(resolvedTripId, checkInDate) : null;

      // Multi-room support: rooms[] present → use it; otherwise null (single room)
      const extractedRooms = Array.isArray(extracted.rooms) && (extracted.rooms as unknown[]).length > 0
        ? extracted.rooms as Array<{ confirmationCode: string; guests: string[]; cost?: number }>
        : null;

      // Derive total cost: prefer Claude's extracted value; fall back to summing rooms[].cost
      let derivedTotalCost = parsedCost;
      if (!derivedTotalCost && extractedRooms) {
        const roomSum = extractedRooms
          .map((r) => typeof r.cost === "number" ? r.cost : 0)
          .reduce((a, b) => a + b, 0);
        if (roomSum > 0) derivedTotalCost = roomSum;
      }

      // Check-in ItineraryItem — upsert by confirmationCode + title prefix
      const hotelConf = (extracted.confirmationCode as string | null) ?? null;
      const existingCheckIn = hotelConf ? await db.itineraryItem.findFirst({
        where: { tripId: resolvedTripId, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-in:" } },
      }) : null;
      // Resolve hotel city before creates so toCity is persisted at write time (Discipline 4.18)
      const hotelCity = (extracted.city as string | null) ?? (extracted.toCity as string | null) ?? "";
      const checkInVenueUrl = resolveCanonicalUrl({ name: hotelName, city: hotelCity });
      const checkInItem = existingCheckIn
        ? await db.itineraryItem.update({ where: { id: existingCheckIn.id }, data: { title: `Check-in: ${hotelName}`, scheduledDate: checkInDate, arrivalTime: "15:00", address: (extracted.address as string | null) ?? null, totalCost: derivedTotalCost, currency: detectedCurrency, passengers, dayIndex: checkInDayIndex, rooms: extractedRooms ?? Prisma.JsonNull, venueUrl: checkInVenueUrl, toCity: hotelCity || null } })
        : await db.itineraryItem.create({
            data: { tripId: resolvedTripId, familyProfileId: familyProfile.id, type: "LODGING", title: `Check-in: ${hotelName}`, scheduledDate: checkInDate, arrivalTime: "15:00", confirmationCode: hotelConf, address: (extracted.address as string | null) ?? null, totalCost: derivedTotalCost, currency: detectedCurrency, notes: null, passengers, dayIndex: checkInDayIndex, rooms: extractedRooms ?? Prisma.JsonNull, venueUrl: checkInVenueUrl, toCity: hotelCity || null },
          });
      // Geocode hotel by name + city
      const hotelGeo = await geocodePlace(`${hotelName}${hotelCity ? " " + hotelCity : ""}`);
      if (hotelGeo) {
        await db.itineraryItem.update({ where: { id: checkInItem.id }, data: { latitude: hotelGeo.lat, longitude: hotelGeo.lng } });
      }
      console.log("[email-inbound] created hotel check-in ItineraryItem:", checkInItem.id, "dayIndex:", checkInDayIndex, "rooms:", extractedRooms ? extractedRooms.length : null);

      // Check-out ItineraryItem — upsert by confirmationCode + title prefix
      if (checkOutDate) {
        const checkOutDayIndex = await getDayIndex(resolvedTripId, checkOutDate);
        const existingCheckOut = hotelConf ? await db.itineraryItem.findFirst({
          where: { tripId: resolvedTripId, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-out:" } },
        }) : null;
        const checkOutVenueUrl = resolveCanonicalUrl({ name: hotelName, city: hotelCity });
        const checkOutItem = existingCheckOut
          ? await db.itineraryItem.update({ where: { id: existingCheckOut.id }, data: { title: `Check-out: ${hotelName}`, scheduledDate: checkOutDate, departureTime: "11:00", address: (extracted.address as string | null) ?? null, passengers, dayIndex: checkOutDayIndex, rooms: extractedRooms ?? Prisma.JsonNull, venueUrl: checkOutVenueUrl, toCity: hotelCity || null } })
          : await db.itineraryItem.create({
          data: {
            tripId: resolvedTripId,
            familyProfileId: familyProfile.id,
            type: "LODGING",
            title: `Check-out: ${hotelName}`,
            scheduledDate: checkOutDate,
            departureTime: "11:00",
            confirmationCode: hotelConf,
            address: (extracted.address as string | null) ?? null,
            totalCost: derivedTotalCost,
            currency: detectedCurrency,
            notes: null,
            passengers,
            dayIndex: checkOutDayIndex,
            rooms: extractedRooms ?? Prisma.JsonNull,
            venueUrl: checkOutVenueUrl,
            toCity: hotelCity || null,
          },
        });
        if (hotelGeo) await db.itineraryItem.update({ where: { id: checkOutItem.id }, data: { latitude: hotelGeo.lat, longitude: hotelGeo.lng } });
        console.log("[email-inbound] created hotel check-out ItineraryItem:", checkOutItem.id, "dayIndex:", checkOutDayIndex);
      }

      // Detect booking source from email metadata and persist on both lodging items
      const { source: detectedSource, managementUrl: detectedManagementUrl } = detectBookingSource({
        contactEmail: (extracted.contactEmail as string | null) ?? null,
        vendorName: hotelName,
      });
      const inferredLodgingType = inferLodgingType({ bookingSource: detectedSource, name: hotelName });
      const lodgingIds = [checkInItem.id, ...(checkOutDate ? [] : [])];
      // Update check-in item
      await db.itineraryItem.update({
        where: { id: checkInItem.id },
        data: { bookingSource: detectedSource, managementUrl: detectedManagementUrl, lodgingType: inferredLodgingType },
      });
      // Update check-out item if it exists (re-find by conf code + title prefix)
      if (hotelConf) {
        const co = await db.itineraryItem.findFirst({
          where: { tripId: resolvedTripId, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-out:" } },
          select: { id: true },
        });
        if (co) {
          await db.itineraryItem.update({
            where: { id: co.id },
            data: { bookingSource: detectedSource, managementUrl: detectedManagementUrl, lodgingType: inferredLodgingType },
          });
        }
      }
      console.log(`[email-inbound] hotel booking source: ${detectedSource} managementUrl: ${detectedManagementUrl ?? "none"}`);
      void lodgingIds; // suppress unused var

      // Vault contact + key info + doc
      if (matchedTrip && (extracted.contactPhone || extracted.contactEmail)) {
        await db.tripContact.create({
          data: {
            tripId: matchedTrip.id,
            name: hotelName,
            role: "Hotel",
            phone: (extracted.contactPhone as string) ?? null,
            email: (extracted.contactEmail as string) ?? null,
          },
        });
      }
      if (matchedTrip && extracted.confirmationCode) {
        await db.tripKeyInfo.create({
          data: {
            tripId: matchedTrip.id,
            label: `${hotelName} confirmation`,
            value: extracted.confirmationCode as string,
          },
        });
      }
      if (matchedTrip) {
        const hotelSavedItemId = await createBookingSavedItem(db, {
          familyProfileId: familyProfile.id,
          tripId: matchedTrip.id,
          vendorName: hotelName,
          city: (extracted.city as string | null) ?? null,
          country: (extracted.country as string | null) ?? null,
          address: (extracted.address as string | null) ?? null,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          extractedType: "hotel",
          websiteUrl: (extracted.bookingUrl as string | null) ?? null,
        });
        const hotelDoc = await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: hotelName,
            type: "booking",
            savedItemId: hotelSavedItemId,
            content: JSON.stringify({
              type: "hotel", vendorName: hotelName,
              checkIn: extracted.checkIn, checkOut: extracted.checkOut,
              address: extracted.address, city: extracted.city, country: extracted.country,
              confirmationCode: extracted.confirmationCode,
              totalCost: derivedTotalCost, currency: extracted.currency,
              contactPhone: extracted.contactPhone, contactEmail: extracted.contactEmail,
              guestNames: extracted.guestNames,
              rooms: extractedRooms ?? Prisma.JsonNull,
              bookingUrl: (extracted.bookingUrl as string | null) ?? null,
            }),
          },
        });
        logCtx.tripDocumentId = hotelDoc.id;

        // Fire-and-forget Places enrichment — fills in photo + websiteUrl asynchronously.
        // If it fails/hangs, the cron at /api/cron/enrich-saved-items catches up.
        const hotelCityStr = [(extracted.city as string | null), (extracted.country as string | null)]
          .filter(Boolean).join(", ");
        enrichWithPlaces(hotelName, hotelCityStr)
          .then(async (result) => {
            if (!result) return;
            const current = await db.savedItem.findUnique({
              where: { id: hotelSavedItemId },
              select: { placePhotoUrl: true, websiteUrl: true },
            });
            if (!current) return;
            const updateData: Record<string, string> = {};
            if (result.imageUrl && !current.placePhotoUrl) updateData.placePhotoUrl = result.imageUrl;
            if (result.website && !current.websiteUrl) updateData.websiteUrl = result.website;
            if (Object.keys(updateData).length > 0) {
              await db.savedItem.update({ where: { id: hotelSavedItemId }, data: updateData });
            }
            // Discipline 4.18 — propagate enriched fields to ItineraryItem rows.
            const venueUrlFromPlaces = result.website && !isManageUrl(result.website) ? result.website : null;
            const itineraryUpdateData: { imageUrl?: string; venueUrl?: string } = {};
            if (result.imageUrl) itineraryUpdateData.imageUrl = result.imageUrl;
            if (venueUrlFromPlaces) itineraryUpdateData.venueUrl = venueUrlFromPlaces;
            if (Object.keys(itineraryUpdateData).length > 0) {
              await db.itineraryItem.update({ where: { id: checkInItem.id }, data: itineraryUpdateData });
              if (hotelConf) {
                const checkOutItineraryItem = await db.itineraryItem.findFirst({
                  where: { tripId: resolvedTripId!, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-out:" } },
                  select: { id: true },
                });
                if (checkOutItineraryItem) {
                  await db.itineraryItem.update({ where: { id: checkOutItineraryItem.id }, data: itineraryUpdateData });
                }
              }
            }
          })
          .catch((e) => console.warn("[email-inbound] post-create hotel enrich failed:", (e as Error)?.message ?? e));
      }

      await incrementBudget(resolvedTripId, derivedTotalCost);
      logCtx.itineraryItemIds = [checkInItem.id];
      await logExtraction({ ...logCtx, outcome: "success" });
      return NextResponse.json({ received: true, status: "success", type: "hotel", tripId: resolvedTripId });

    // ── Train / activity / other (replaces SavedItem) ─────────────────────────
    } else {
      const confirmedDate = (extracted.departureDate ?? extracted.checkIn ?? extracted.arrivalDate) as string | null;
      const dayIndex = confirmedDate ? await getDayIndex(resolvedTripId, confirmedDate) : null;

      const routeParts: string[] = [];
      if (extracted.fromCity && extracted.toCity) routeParts.push(`${extracted.fromCity as string} → ${extracted.toCity as string}`);
      if (extracted.departureTime) routeParts.push(`departs ${extracted.departureTime as string}`);
      if (extracted.arrivalTime) routeParts.push(`arrives ${extracted.arrivalTime as string}`);
      const autoNotes = routeParts.length > 0 ? routeParts.join(" · ") : null;

      const itemTitle = (extracted.activityName as string | null) ?? gygActivityHint ?? (extracted.vendorName as string | null) ?? subject;
      const itemTypeStr = (extracted.type as string | null) ?? "OTHER";

      const isConfirmedBooking = !!(extracted.confirmationCode || extracted.checkIn || extracted.totalCost);
      if (!isConfirmedBooking && (extracted.confidence as number) < 0.8) {
        console.log('[email-inbound] non-booking low confidence, routing to SavedItem');
        const placeTitle = (extracted.vendorName as string | null) ?? (extracted.activityName as string | null) ?? subject;
        const placeCity = (extracted.city as string | null) ?? null;
        const urlMatchForSave = (text || html || '').match(/https?:\/\/[^\s<>"]+/);
        const sourceUrlForSave = urlMatchForSave ? urlMatchForSave[0].replace(/[.,;!?)]+$/, '') : null;
        const savedItem = await db.savedItem.create({
          data: {
            familyProfileId: familyProfile.id,
            sourceMethod: "EMAIL_FORWARD",
            sourcePlatform: inferPlatformFromUrl(sourceUrlForSave),
            sourceUrl: sourceUrlForSave,
            rawTitle: placeTitle,
            categoryTags: normalizeAndDedupeCategoryTags([]),
            status: 'UNORGANIZED',
            extractionStatus: 'PENDING',
            tripId: null,
            destinationCity: placeCity,
          }
        });
        console.log('[email-inbound] created SavedItem instead:', savedItem.id, placeTitle);
        try {
          const enriched = await enrichWithPlaces(placeTitle, placeCity ?? '');
          if (enriched?.imageUrl) {
            await db.savedItem.update({
              where: { id: savedItem.id },
              data: { placePhotoUrl: enriched.imageUrl }
            });
            console.log('[email-inbound] image enriched:', enriched.imageUrl);
          }
        } catch (e) {
          console.error('[email-inbound] enrichment failed:', e);
        }
        enrichSavedItem(savedItem.id).catch(e => console.error('[email-inbound] enrichSavedItem failed:', e));
        let nonBookingTrip: { id: string; title: string } | null = null;
        try {
          const nonBookingCountry = await getCountryForCity(placeCity ?? '');
          nonBookingTrip = await geoMatchTrips(familyProfile.id, placeCity, nonBookingCountry);
          if (nonBookingTrip) {
            await db.savedItem.update({ where: { id: savedItem.id }, data: { tripId: nonBookingTrip.id } });
            console.log('[email-inbound] auto-assigned to trip:', nonBookingTrip.id);
          }
        } catch (e) {
          console.error('[email-inbound] trip match/assign failed:', e);
        }
        try {
          await resend.emails.send({
            from: "Flokk <trips@flokktravel.com>",
            to: senderEmail,
            subject: `Saved to Flokk: ${placeTitle}`,
            html: buildSaveConfirmationEmail(placeTitle, placeCity, nonBookingTrip, savedItem.id),
          });
        } catch (e) {
          console.error('[email-inbound] confirmation email failed:', e);
        }
        await logExtraction({ ...logCtx, outcome: "partial", errorMessage: "saved_as_place: non-booking low confidence" });
        return NextResponse.json({ status: 'saved_as_place' });
      }

      const catchAllConf = (extracted.confirmationCode as string | null) ?? null;
      const catchAllType = itemTypeStr.toUpperCase();
      const existingCatchAll = catchAllConf ? await db.itineraryItem.findFirst({
        where: { tripId: resolvedTripId, confirmationCode: catchAllConf, type: catchAllType },
      }) : null;

      // Title-based dedup for null-code items: extract first 3 significant words, require all to match
      if (!catchAllConf && !existingCatchAll) {
        const titleWords = itemTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 3);
        if (titleWords.length > 0) {
          const existingByTitle = await db.itineraryItem.findFirst({
            where: {
              tripId: resolvedTripId,
              AND: titleWords.map((word: string) => ({ title: { contains: word, mode: 'insensitive' as const } })),
            },
            select: { id: true, title: true },
          });
          if (existingByTitle) {
            console.log(`[dedup] skipped title match: "${itemTitle}" ~ "${existingByTitle.title}"`);
            await logExtraction({ ...logCtx, outcome: "dropped", errorMessage: `title_duplicate: "${itemTitle}" ~ "${existingByTitle.title}"` });
            return NextResponse.json({ received: true, skipped: 'title_duplicate' });
          }
        }
      }

      const catchAllVenueUrl = resolveCanonicalUrl({ name: itemTitle, city: (extracted.city as string | null) ?? (extracted.toCity as string | null) ?? '' });
      const item = existingCatchAll
        ? await db.itineraryItem.update({
            where: { id: existingCatchAll.id },
            data: { title: itemTitle, scheduledDate: confirmedDate, departureTime: (extracted.departureTime as string | null) ?? null, arrivalTime: (extracted.arrivalTime as string | null) ?? null, fromCity: (extracted.fromCity as string | null) ?? null, toCity: (extracted.toCity as string | null) ?? null, notes: autoNotes, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, passengers, dayIndex, venueUrl: catchAllVenueUrl },
          })
        : await db.itineraryItem.create({
            data: { tripId: resolvedTripId, familyProfileId: familyProfile.id, type: catchAllType, title: itemTitle, scheduledDate: confirmedDate, departureTime: (extracted.departureTime as string | null) ?? null, arrivalTime: (extracted.arrivalTime as string | null) ?? null, fromCity: (extracted.fromCity as string | null) ?? null, toCity: (extracted.toCity as string | null) ?? null, confirmationCode: catchAllConf, notes: autoNotes, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, passengers, dayIndex, venueUrl: catchAllVenueUrl },
          });

      if (matchedTrip && extracted.confirmationCode) {
        await db.tripKeyInfo.create({
          data: {
            tripId: matchedTrip.id,
            label: `${itemTitle} confirmation`,
            value: extracted.confirmationCode as string,
          },
        });
      }
      if (matchedTrip) {
        let catchAllSavedItemId: string | null = null;
        if (isSaveableBooking(extracted.type as string | null, itemTitle)) {
          catchAllSavedItemId = await createBookingSavedItem(db, {
            familyProfileId: familyProfile.id,
            tripId: matchedTrip.id,
            vendorName: itemTitle,
            city: (extracted.city as string | null) ?? null,
            country: (extracted.country as string | null) ?? null,
            address: (extracted.address as string | null) ?? null,
            checkIn: null,
            checkOut: null,
            extractedType: ((extracted.type as string | null) ?? "activity").toLowerCase(),
            websiteUrl: (extracted.bookingUrl as string | null) ?? null,
          });
        }
        const catchAllDoc = await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: itemTitle,
            type: "booking",
            savedItemId: catchAllSavedItemId,
            content: JSON.stringify({
              type: extracted.type, vendorName: extracted.vendorName,
              activityName: extracted.activityName ?? null,
              fromCity: extracted.fromCity, toCity: extracted.toCity,
              departureDate: extracted.departureDate, departureTime: extracted.departureTime,
              arrivalDate: extracted.arrivalDate, arrivalTime: extracted.arrivalTime,
              confirmationCode: extracted.confirmationCode,
              totalCost: extracted.totalCost, currency: extracted.currency,
              contactPhone: extracted.contactPhone, contactEmail: extracted.contactEmail,
              guestNames: extracted.guestNames, address: extracted.address,
              bookingUrl: (extracted.bookingUrl as string | null) ?? null,
            }),
          },
        });
        logCtx.tripDocumentId = catchAllDoc.id;

        // Fire-and-forget Places enrichment for saveable catch-all bookings (activities, restaurants, driver-services).
        if (catchAllSavedItemId) {
          const catchAllCityStr = [(extracted.city as string | null), (extracted.country as string | null)]
            .filter(Boolean).join(", ");
          enrichWithPlaces(itemTitle, catchAllCityStr)
            .then(async (result) => {
              if (!result || !catchAllSavedItemId) return;
              const current = await db.savedItem.findUnique({
                where: { id: catchAllSavedItemId },
                select: { placePhotoUrl: true, websiteUrl: true },
              });
              if (!current) return;
              const updateData: Record<string, string> = {};
              if (result.imageUrl && !current.placePhotoUrl) updateData.placePhotoUrl = result.imageUrl;
              if (result.website && !current.websiteUrl) updateData.websiteUrl = result.website;
              if (Object.keys(updateData).length > 0) {
                await db.savedItem.update({ where: { id: catchAllSavedItemId }, data: updateData });
              }
              // Discipline 4.18 — propagate enriched fields to ItineraryItem.
              const venueUrlFromPlaces = result.website && !isManageUrl(result.website) ? result.website : null;
              const itineraryUpdateData: { imageUrl?: string; venueUrl?: string } = {};
              if (result.imageUrl) itineraryUpdateData.imageUrl = result.imageUrl;
              if (venueUrlFromPlaces) itineraryUpdateData.venueUrl = venueUrlFromPlaces;
              if (Object.keys(itineraryUpdateData).length > 0) {
                await db.itineraryItem.update({ where: { id: item.id }, data: itineraryUpdateData });
              }
            })
            .catch((e) => console.warn("[email-inbound] post-create catch-all enrich failed:", (e as Error)?.message ?? e));
        }
      }

      // Geocode: trains → departure station; others → vendor name + city
      const geocodeQuery = itemTypeStr === "TRAIN"
        ? `${(extracted.fromCity as string | null) ?? (extracted.vendorName as string | null) ?? ""} train station`.trim()
        : `${itemTitle}${(extracted.city as string | null) ? " " + (extracted.city as string) : ""}`.trim();
      if (geocodeQuery) {
        const geo = await geocodePlace(geocodeQuery);
        if (geo) await db.itineraryItem.update({ where: { id: item.id }, data: { latitude: geo.lat, longitude: geo.lng } });
      }
      // TRAIN: also geocode arrival station for correct transit card "from" coords
      if (itemTypeStr === "TRAIN" && (extracted.toCity as string | null)) {
        const arrivalQuery = `${extracted.toCity as string} train station`;
        const arrivalGeo = await geocodePlace(arrivalQuery);
        if (arrivalGeo) await db.itineraryItem.update({ where: { id: item.id }, data: { arrivalLat: arrivalGeo.lat, arrivalLng: arrivalGeo.lng } });
      }
      console.log("[email-inbound] created ItineraryItem:", item.id, "type:", itemTypeStr, "dayIndex:", dayIndex);
      await incrementBudget(resolvedTripId, parsedCost);
      logCtx.itineraryItemIds = [item.id];
      await logExtraction({ ...logCtx, outcome: "success" });
      return NextResponse.json({ received: true, status: "success", type: itemTypeStr, tripId: resolvedTripId });
    }

  } catch (err) {
    console.error("[email-inbound] error:", err);
    await logExtraction({ ...logCtx, outcome: "error", errorMessage: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
