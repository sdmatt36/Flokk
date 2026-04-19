import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { findMatchingTrip } from "@/lib/find-matching-trip";
import { nanoid } from "nanoid";
import { getTripCoverImage } from "@/lib/destination-images";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildSaveConfirmationEmail(
  title: string,
  city: string | null,
  matchedTrip?: { id: string; title: string } | null
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
    : `<a href="https://www.flokktravel.com/saves"
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
  const tokens = raw.split(/[\s,/-]+/).filter((v) => v.length > 2);
  return [raw.trim(), ...tokens];
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const senderEmailMatch = from.match(/<(.+?)>/);
    const senderEmail = senderEmailMatch?.[1]?.trim() ?? from.trim();

    // ── Look up FamilyProfile via verified sender email ────────────────────────
    let familyProfile = await db.familyProfile.findFirst({
      where: {
        senderEmails: { has: senderEmail },
        senderEmailVerifications: { some: { email: senderEmail, verifiedAt: { not: null } } },
      },
      include: { trips: true, members: true },
    });

    // Fallback: user's primary email
    if (!familyProfile) {
      const user = await db.user.findFirst({
        where: { email: senderEmail },
        include: { familyProfile: { include: { trips: true, members: true } } },
      });
      if (user?.familyProfile) familyProfile = user.familyProfile;
    }

    if (!familyProfile) {
      console.log("[email-inbound] no verified sender match for:", senderEmail, "— dropping silently");
      return NextResponse.json({ received: true });
    }

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
  "vendorName": "string or null",
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
  "legs": [{ "from": "IATA", "to": "IATA", "fromCity": "string", "toCity": "string", "departure": "YYYY-MM-DDTHH:MM", "arrival": "YYYY-MM-DDTHH:MM" }] or [],
  "outboundDestination": "string or null — the furthest non-home city in the itinerary (the actual trip destination, not the return airport)",
  "outboundDestinationAirport": "IATA code or null — airport code for outboundDestination",
  "confidence": "0.0 to 1.0"
}

Field notes:
- guestNames: Extract ALL passenger/guest/traveler names as an array. For activity/tour bookings (GetYourGuide, Viator, Klook), look under "Travelers", "Guests", "Participants" sections and include every name listed. For flights, include all passenger names on the booking, not just the primary contact. For hotels, include all guests listed. Return [] only if no names are found anywhere in the email.
- legs: For flights ONLY. Extract EVERY individual flight segment as a separate leg object, INCLUDING intermediate stops like layovers or stopovers. A Tokyo→Singapore→Colombo itinerary has 2 legs: TYO→SIN and SIN→CMB. A Seattle→Keflavík→Bergen itinerary has 2 legs: SEA→KEF and KEF→BGO. NEVER consolidate segments — if the email mentions a ticketed segment, it MUST appear in legs. Always populate this array for flights even if only one segment. Include arrival datetime per leg when visible in the email.
- outboundDestination / outboundDestinationAirport: For round-trip flights that depart from and return to a home airport (NRT, HND, LHR, LGW), identify the furthest destination city/airport — NOT the return airport. Example: NRT→SIN→CMB→LHR→NRT has outboundDestination="Colombo" and outboundDestinationAirport="CMB". For one-way or simple round trips, this is just toCity/toAirport.
- fromAirport/toAirport/fromCity/toCity: Keep these for backward compatibility. fromAirport = first leg departure, toAirport = outboundDestinationAirport (NOT the return leg airport), fromCity = first leg departure city, toCity = outboundDestination city.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      console.error("[email-inbound] unexpected Claude response type");
      return NextResponse.json({ received: true, status: "claude_error" });
    }

    let extracted: Record<string, unknown>;
    try {
      const clean = content.text.replace(/```json|```/g, "").trim();
      extracted = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      console.error("[email-inbound] JSON parse failed:", content.text);
      return NextResponse.json({ received: true, status: "parse_error" });
    }

    if (!extracted || (extracted.confidence as number) < 0.5) {
      console.log("[email-inbound] low confidence:", extracted?.confidence);
      const urlMatch = (text || html || '').match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        const rawUrl = urlMatch[0].replace(/[.,;!?)]+$/, '');
        console.log('[trips-save] URL detected:', rawUrl);
        const savedItem = await db.savedItem.create({
          data: {
            familyProfileId: familyProfile.id,
            sourceType: 'EMAIL_IMPORT',
            sourceUrl: rawUrl,
            rawTitle: rawUrl,
            categoryTags: [],
            status: 'UNORGANIZED',
            extractionStatus: 'ENRICHED',
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
            html: buildSaveConfirmationEmail(confirmTitle, urlSaveCity, urlBranchTrip),
          });
        } catch (e) {
          console.error('[trips-save] confirmation email failed:', e);
        }
      } else {
        console.log('[trips-save] no URL found in low-confidence email, skipping');
      }
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
      const roundTripMatches = trips.filter((t) => dateInTripRange(bookingDate, t));
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
      const destMatches = trips.filter((t) => tripMatchesDestination(t, destKeywords));
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
        const candidates = withDate.length > 0 ? withDate : promotedMatches;
        candidates.sort(sortByRelevance);
        matchedTrip = candidates[0];
      }
    }

    // Priority 2: Date overlap only — when destination wasn't extracted or didn't match
    if (!matchedTrip && bookingDate) {
      const dateMatches = trips.filter((t) => dateInTripRange(bookingDate, t));
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
      const subjectMatches = trips.filter((t) => tripMatchesDestination(t, subjectWords));
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

    // Auto-create trip when no match found, confidence >= 0.9, type is flight or hotel, and destination is known
    if (!matchedTrip && confidenceScore >= 0.9) {
      const autoType = (extracted.type as string | null) ?? null;
      if (autoType === "flight" || autoType === "hotel") {
        const rawToCity = (extracted.toCity as string | null)?.trim() ?? null;
        const rawCity = (extracted.city as string | null)?.trim() ?? null;
        const autoDestCity = (rawToCity || rawCity || null)?.replace(/,\s*[A-Z]{2}$/, "").trim() ?? null;
        if (autoDestCity) {
          const autoDestCountry = (extracted.country as string | null) ?? null;
          const rawDate = (extracted.departureDate as string | null) ?? (extracted.checkIn as string | null) ?? null;
          let autoTitle = autoDestCity;
          if (rawDate) {
            try {
              const [y, m] = rawDate.split("-").map(Number);
              const monthName = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
              autoTitle = `${autoDestCity} - ${monthName} ${y}`;
            } catch { /* use city only */ }
          }
          const autoStart = (extracted.departureDate as string | null) ?? (extracted.checkIn as string | null) ?? null;
          const autoEnd = (extracted.returnDepartureDate as string | null) ?? (extracted.checkOut as string | null) ?? null;
          const autoStatus = autoEnd && new Date(autoEnd) < new Date() ? "COMPLETED" : "PLANNING";
          const autoHeroImage = getTripCoverImage(autoDestCity, autoDestCountry ?? "");
          const autoShareToken = nanoid(12);
          const autoTrip = await db.trip.create({
            data: {
              title: autoTitle,
              destinationCity: autoDestCity,
              destinationCountry: autoDestCountry,
              startDate: autoStart ? new Date(autoStart) : null,
              endDate: autoEnd ? new Date(autoEnd) : null,
              status: autoStatus,
              heroImageUrl: autoHeroImage,
              shareToken: autoShareToken,
              familyProfileId: familyProfile.id,
            },
          });
          matchedTrip = autoTrip as typeof trips[0];
          resolvedTripId = autoTrip.id;
          console.log(`[email-inbound] auto-created trip: "${autoTitle}" id: ${autoTrip.id}`);
        }
      }
    }

    // Duplicate guard: check confirmationCode across ALL trips for this profile.
    // A trip-scoped check misses cases where a prior forward mismatched to the wrong trip —
    // the code already exists on that trip, so a re-forward to the correct trip must be blocked too.
    // Only applied when confirmationCode is non-null — null-code bookings are allowed through.
    const incomingConfCode = (extracted.confirmationCode as string | null) ?? null;
    if (incomingConfCode) {
      const existing = await db.itineraryItem.findFirst({
        where: { confirmationCode: incomingConfCode, familyProfileId: familyProfile.id },
        select: { id: true, title: true, tripId: true },
      });
      if (existing) {
        console.log(`[email-inbound] duplicate detected globally — confirmationCode: ${incomingConfCode} already exists as "${existing.title}" on trip ${existing.tripId ?? "unassigned"} — skipping`);
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
      };

      let flightLegs: FlightLeg[] = [];

      const rawLegs = Array.isArray(extracted.legs)
        ? extracted.legs as Array<{ from: string; to: string; fromCity?: string; toCity?: string; departure?: string; arrival?: string }>
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
          });
        }
      }

      console.log(`[email-inbound] creating ${flightLegs.length} flight ItineraryItem(s) for confirmation ${outboundConf ?? "(no code)"}`);

      const createdLegItemIds: string[] = [];

      for (let legIdx = 0; legIdx < flightLegs.length; legIdx++) {
        const leg = flightLegs[legIdx];

        if (!leg.from || !leg.to) {
          console.warn(`[email-inbound] skipping leg with missing airports: from=${leg.from} to=${leg.to}`);
          continue;
        }

        const legTitle = `${leg.from} → ${leg.to}`;
        const legDayIndex = leg.departureDate ? await getDayIndex(resolvedTripId, leg.departureDate) : null;

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

      // Flight record (powers booking intel card) — one per booking, not per leg
      if (resolvedTripId) {
        await db.flight.create({
          data: {
            tripId: resolvedTripId,
            type: "outbound",
            airline: (extracted.airline as string | null) ?? "",
            flightNumber: extracted.flightNumber as string,
            fromAirport: (extracted.fromAirport as string | null) ?? "",
            fromCity: (extracted.fromCity as string | null) ?? (extracted.fromAirport as string | null) ?? "",
            toAirport: (extracted.toAirport as string | null) ?? "",
            toCity: (extracted.toCity as string | null) ?? (extracted.toAirport as string | null) ?? "",
            departureDate: (extracted.departureDate as string | null) ?? "",
            departureTime: (extracted.departureTime as string | null) ?? "",
            arrivalDate: (extracted.arrivalDate as string | null) ?? null,
            arrivalTime: (extracted.arrivalTime as string | null) ?? null,
            confirmationCode: (extracted.confirmationCode as string | null) ?? null,
            status: "booked",
            dayIndex: outboundDayIndex,
          },
        });

        // TripDocument vault — one per booking (represents the whole booking, not per leg)
        const vaultLabel = outboundFrom && outboundTo
          ? `${outboundFrom} → ${outboundTo}`
          : `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string}`.trim();
        const existingVaultDoc = await db.tripDocument.findFirst({ where: { tripId: resolvedTripId, label: vaultLabel } });
        if (existingVaultDoc) {
          console.log("[vault] Skipping duplicate tripDocument:", vaultLabel);
        } else {
          await db.tripDocument.create({
            data: {
              tripId: resolvedTripId,
              label: vaultLabel,
              type: "booking",
              content: JSON.stringify({
                type: "flight", vendorName: extracted.airline, flightNumber: extracted.flightNumber,
                airline: extracted.airline, fromAirport: extracted.fromAirport, toAirport: extracted.toAirport,
                fromCity: extracted.fromCity, toCity: extracted.toCity,
                departureDate: extracted.departureDate, departureTime: extracted.departureTime,
                arrivalDate: extracted.arrivalDate, arrivalTime: extracted.arrivalTime,
                confirmationCode: extracted.confirmationCode,
                totalCost: extracted.totalCost, currency: extracted.currency,
                guestNames: extracted.guestNames, returnDepartureDate: extracted.returnDepartureDate,
                legs: extracted.legs,
              }),
            },
          });
          console.log("[email-inbound] created vault doc for trip:", resolvedTripId);
        }
      }

      await incrementBudget(resolvedTripId, parsedCost);
      return NextResponse.json({ received: true, status: "success", type: "flight", tripId: resolvedTripId });

    // ── Hotels ────────────────────────────────────────────────────────────────
    } else if (extracted.type === "hotel" && extracted.vendorName) {
      const hotelName = extracted.vendorName as string;
      const checkInDate = (extracted.checkIn as string | null) ?? null;
      const checkOutDate = (extracted.checkOut as string | null) ?? null;

      const checkInDayIndex = checkInDate ? await getDayIndex(resolvedTripId, checkInDate) : null;

      // FIX 1: Check-in ItineraryItem — upsert by confirmationCode + title prefix
      const hotelConf = (extracted.confirmationCode as string | null) ?? null;
      const existingCheckIn = hotelConf ? await db.itineraryItem.findFirst({
        where: { tripId: resolvedTripId, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-in:" } },
      }) : null;
      const checkInItem = existingCheckIn
        ? await db.itineraryItem.update({ where: { id: existingCheckIn.id }, data: { title: `Check-in: ${hotelName}`, scheduledDate: checkInDate, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, passengers, dayIndex: checkInDayIndex } })
        : await db.itineraryItem.create({
            data: { tripId: resolvedTripId, familyProfileId: familyProfile.id, type: "LODGING", title: `Check-in: ${hotelName}`, scheduledDate: checkInDate, confirmationCode: hotelConf, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, notes: null, passengers, dayIndex: checkInDayIndex },
          });
      // Geocode hotel by name + city
      const hotelCity = (extracted.city as string | null) ?? (extracted.toCity as string | null) ?? "";
      const hotelGeo = await geocodePlace(`${hotelName}${hotelCity ? " " + hotelCity : ""}`);
      if (hotelGeo) {
        await db.itineraryItem.update({ where: { id: checkInItem.id }, data: { latitude: hotelGeo.lat, longitude: hotelGeo.lng } });
      }
      console.log("[email-inbound] created hotel check-in ItineraryItem:", checkInItem.id, "dayIndex:", checkInDayIndex);

      // FIX 1: Check-out ItineraryItem — upsert by confirmationCode + title prefix
      if (checkOutDate) {
        const checkOutDayIndex = await getDayIndex(resolvedTripId, checkOutDate);
        const existingCheckOut = hotelConf ? await db.itineraryItem.findFirst({
          where: { tripId: resolvedTripId, confirmationCode: hotelConf, type: "LODGING", title: { startsWith: "Check-out:" } },
        }) : null;
        const checkOutItem = existingCheckOut
          ? await db.itineraryItem.update({ where: { id: existingCheckOut.id }, data: { title: `Check-out: ${hotelName}`, scheduledDate: checkOutDate, departureTime: "11:00", address: (extracted.address as string | null) ?? null, passengers, dayIndex: checkOutDayIndex } })
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
            totalCost: parsedCost,
            currency: detectedCurrency,
            notes: null,
            passengers,
            dayIndex: checkOutDayIndex,
          },
        });
        if (hotelGeo) await db.itineraryItem.update({ where: { id: checkOutItem.id }, data: { latitude: hotelGeo.lat, longitude: hotelGeo.lng } });
        console.log("[email-inbound] created hotel check-out ItineraryItem:", checkOutItem.id, "dayIndex:", checkOutDayIndex);
      }

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
        await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: hotelName,
            type: "booking",
            content: JSON.stringify({
              type: "hotel", vendorName: hotelName,
              checkIn: extracted.checkIn, checkOut: extracted.checkOut,
              address: extracted.address, city: extracted.city, country: extracted.country,
              confirmationCode: extracted.confirmationCode,
              totalCost: extracted.totalCost, currency: extracted.currency,
              contactPhone: extracted.contactPhone, contactEmail: extracted.contactEmail,
              guestNames: extracted.guestNames,
            }),
          },
        });
      }

      await incrementBudget(resolvedTripId, parsedCost);
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
            sourceType: 'EMAIL_IMPORT',
            sourceUrl: sourceUrlForSave,
            rawTitle: placeTitle,
            categoryTags: [],
            status: 'UNORGANIZED',
            extractionStatus: 'ENRICHED',
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
            html: buildSaveConfirmationEmail(placeTitle, placeCity, nonBookingTrip),
          });
        } catch (e) {
          console.error('[email-inbound] confirmation email failed:', e);
        }
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
            return NextResponse.json({ received: true, skipped: 'title_duplicate' });
          }
        }
      }

      const item = existingCatchAll
        ? await db.itineraryItem.update({
            where: { id: existingCatchAll.id },
            data: { title: itemTitle, scheduledDate: confirmedDate, departureTime: (extracted.departureTime as string | null) ?? null, arrivalTime: (extracted.arrivalTime as string | null) ?? null, fromCity: (extracted.fromCity as string | null) ?? null, toCity: (extracted.toCity as string | null) ?? null, notes: autoNotes, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, passengers, dayIndex },
          })
        : await db.itineraryItem.create({
            data: { tripId: resolvedTripId, familyProfileId: familyProfile.id, type: catchAllType, title: itemTitle, scheduledDate: confirmedDate, departureTime: (extracted.departureTime as string | null) ?? null, arrivalTime: (extracted.arrivalTime as string | null) ?? null, fromCity: (extracted.fromCity as string | null) ?? null, toCity: (extracted.toCity as string | null) ?? null, confirmationCode: catchAllConf, notes: autoNotes, address: (extracted.address as string | null) ?? null, totalCost: parsedCost, currency: detectedCurrency, passengers, dayIndex },
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
        await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: itemTitle,
            type: "booking",
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
            }),
          },
        });
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
      return NextResponse.json({ received: true, status: "success", type: itemTypeStr, tripId: resolvedTripId });
    }

  } catch (err) {
    console.error("[email-inbound] error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
