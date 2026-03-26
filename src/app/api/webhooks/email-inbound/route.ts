import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

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
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
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
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

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
  tripId: string,
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
  // No confirmation code — can't match vault docs
  if (!confirmationCode) return result;

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

async function getDayIndex(tripId: string, dateStr: string): Promise<number> {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true, endDate: true } });
  if (!trip?.startDate) return 0;
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

    console.log("[email-inbound] from:", from, "| to:", to, "| subject:", subject);

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
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Extract booking information from this confirmation email. Return ONLY valid JSON with no markdown.

Email subject: ${subject}
Email content: ${emailContent}

Return this exact JSON structure:
{
  "type": "hotel" | "flight" | "activity" | "restaurant" | "car_rental" | "train" | "unknown",
  "vendorName": "string or null",
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
  "confidence": "0.0 to 1.0"
}`,
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

    const destKeywords: string[] = [
      extracted.city, extracted.fromCity, extracted.toCity, extracted.country,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .flatMap((v) => v.split(/[\s,/-]+/))
      .filter((v) => v.length > 2);

    const subjectWords = subject.replace(/fwd?:/i, "")
      .split(/[\s|:\-–—]+/).map((w) => w.trim()).filter((w) => w.length > 2);
    const allKeywords = [...new Set([...destKeywords, ...subjectWords])];

    let matchedTrip: typeof trips[0] | null = null;

    if (bookingDate) {
      const [by, bm, bd] = bookingDate.split("-").map(Number);
      const booking = new Date(by, bm - 1, bd);
      const dateMatches = trips.filter((trip) => {
        if (!trip.startDate || !trip.endDate) return false;
        const start = new Date(trip.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(trip.endDate);     end.setHours(23, 59, 59, 999);
        return booking >= start && booking <= end;
      });
      dateMatches.sort((a, b) => {
        const score = (s: string | null) => s === "PLANNING" ? 0 : s === "ACTIVE" ? 1 : 2;
        const diff = score(a.status ?? null) - score(b.status ?? null);
        if (diff !== 0) return diff;
        const durA = (a.endDate ? new Date(a.endDate).getTime() : Infinity) - (a.startDate ? new Date(a.startDate).getTime() : 0);
        const durB = (b.endDate ? new Date(b.endDate).getTime() : Infinity) - (b.startDate ? new Date(b.startDate).getTime() : 0);
        return durA - durB;
      });
      matchedTrip = dateMatches[0] ?? null;
    }

    if (!matchedTrip && allKeywords.length > 0) {
      const now = new Date();
      matchedTrip = trips
        .filter((t) => tripMatchesDestination(t, allKeywords))
        .sort((a, b) => {
          const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          const aFuture = aDate >= now.getTime(), bFuture = bDate >= now.getTime();
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          return aDate - bDate;
        })[0] ?? null;
    }

    const resolvedTripId = matchedTrip?.id ?? trips[0]?.id ?? null;
    if (!resolvedTripId) {
      console.log("[email-inbound] no trip to assign — dropping");
      return NextResponse.json({ received: true, status: "no_trip" });
    }

    const passengers = Array.isArray(extracted.guestNames) ? (extracted.guestNames as string[]) : [];

    // ── FIX 4: cost helper ────────────────────────────────────────────────────
    const parsedCost = parseCost(extracted.totalCost);
    const detectedCurrency = (extracted.currency as string | null) ?? detectCurrency(extracted.totalCost) ?? "USD";

    async function incrementBudget(tripId: string, cost: number | null) {
      if (!cost) return;
      const t = await db.trip.findUnique({ where: { id: tripId }, select: { budgetCurrency: true } });
      await db.trip.update({
        where: { id: tripId },
        data: {
          budgetSpent: { increment: cost },
          budgetCurrency: t?.budgetCurrency ?? detectedCurrency,
        },
      });
    }

    // ── Flights ───────────────────────────────────────────────────────────────
    if (extracted.type === "flight" && extracted.flightNumber) {
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

      const outboundFrom = resolved.fromAirport || resolved.fromCity || null;
      const outboundTo   = resolved.toAirport   || resolved.toCity   || null;
      const outboundTitle = outboundFrom && outboundTo
        ? `${outboundFrom} → ${outboundTo}`
        : outboundFrom ? `${outboundFrom} → (destination)` : outboundTo ? `(origin) → ${outboundTo}` : (extracted.flightNumber as string) ?? "Flight";

      // Outbound ItineraryItem
      const outboundItem = await db.itineraryItem.create({
        data: {
          tripId: resolvedTripId,
          type: "FLIGHT",
          title: outboundTitle,
          scheduledDate: (extracted.departureDate as string | null) ?? null,
          departureTime: resolved.departureTime,
          arrivalTime: resolved.arrivalTime,
          fromAirport: resolved.fromAirport,
          toAirport: resolved.toAirport,
          fromCity: resolved.fromCity,
          toCity: resolved.toCity,
          confirmationCode: outboundConf,
          totalCost: parsedCost,
          currency: detectedCurrency,
          passengers,
          dayIndex: outboundDayIndex,
        },
      });
      // Geocode arrival airport (where the family lands — critical map pin)
      const outboundArrival = resolved.toAirport ?? resolved.toCity ?? (extracted.toCity as string | null);
      if (outboundArrival) {
        const geo = await geocodePlace(`${outboundArrival} airport`);
        if (geo) await db.itineraryItem.update({ where: { id: outboundItem.id }, data: { latitude: geo.lat, longitude: geo.lng } });
      }
      console.log("[email-inbound] created outbound ItineraryItem:", outboundItem.id);

      // Also keep Flight record (powers booking intel card)
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

      // Outbound vault doc — always create using resolvedTripId
      const outboundVaultLabel = outboundFrom && outboundTo
        ? `${outboundFrom} → ${outboundTo}`
        : `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string}`.trim();
      await db.tripDocument.create({
        data: {
          tripId: resolvedTripId,
          label: outboundVaultLabel,
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
          }),
        },
      });
      console.log("[email-inbound] created outbound vault doc for trip:", resolvedTripId);

      // FIX 2: Return flight ItineraryItem
      if (extracted.returnDepartureDate) {
        const returnDayIndex = await getDayIndex(resolvedTripId, extracted.returnDepartureDate as string);
        const returnTitle = `${extracted.toAirport ?? extracted.toCity ?? "?"} → ${extracted.fromAirport ?? extracted.fromCity ?? "?"}`;

        const returnItem = await db.itineraryItem.create({
          data: {
            tripId: resolvedTripId,
            type: "FLIGHT",
            title: returnTitle,
            scheduledDate: extracted.returnDepartureDate as string,
            departureTime: (extracted.returnDepartureTime as string | null) ?? null,
            arrivalTime: (extracted.returnArrivalTime as string | null) ?? null,
            fromAirport: (extracted.returnFromAirport as string | null) ?? (extracted.toAirport as string | null) ?? null,
            toAirport: (extracted.returnToAirport as string | null) ?? (extracted.fromAirport as string | null) ?? null,
            fromCity: (extracted.toCity as string | null) ?? null,
            toCity: (extracted.fromCity as string | null) ?? null,
            confirmationCode: (extracted.confirmationCode as string | null) ?? null,
            passengers,
            dayIndex: returnDayIndex,
          },
        });
        // Geocode return arrival airport
        const returnArrival = (extracted.returnToAirport as string | null) ?? (extracted.fromAirport as string | null) ?? (extracted.fromCity as string | null);
        if (returnArrival) {
          const geo = await geocodePlace(`${returnArrival} airport`);
          if (geo) await db.itineraryItem.update({ where: { id: returnItem.id }, data: { latitude: geo.lat, longitude: geo.lng } });
        }
        console.log("[email-inbound] created return ItineraryItem:", returnItem.id);

        // Also keep return Flight record
        await db.flight.create({
          data: {
            tripId: resolvedTripId,
            type: "return",
            airline: (extracted.airline as string | null) ?? "",
            flightNumber: ((extracted.flightNumber as string) ?? "") + " (return)",
            fromAirport: (extracted.returnFromAirport as string | null) ?? (extracted.toAirport as string | null) ?? "",
            fromCity: (extracted.toCity as string | null) ?? (extracted.returnFromAirport as string | null) ?? "",
            toAirport: (extracted.returnToAirport as string | null) ?? (extracted.fromAirport as string | null) ?? "",
            toCity: (extracted.fromCity as string | null) ?? (extracted.returnToAirport as string | null) ?? "",
            departureDate: extracted.returnDepartureDate as string,
            departureTime: (extracted.returnDepartureTime as string | null) ?? "",
            arrivalDate: (extracted.returnArrivalDate as string | null) ?? null,
            arrivalTime: (extracted.returnArrivalTime as string | null) ?? null,
            confirmationCode: (extracted.confirmationCode as string | null) ?? null,
            status: "booked",
            dayIndex: returnDayIndex,
          },
        });

        // Return vault doc — always create using resolvedTripId
        const returnVaultFrom = (extracted.returnFromAirport as string | null) || (extracted.toAirport as string | null) || null;
        const returnVaultTo   = (extracted.returnToAirport   as string | null) || (extracted.fromAirport as string | null) || null;
        const returnVaultLabel = returnVaultFrom && returnVaultTo
          ? `${returnVaultFrom} → ${returnVaultTo}`
          : `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string} (return)`.trim();
        await db.tripDocument.create({
          data: {
            tripId: resolvedTripId,
            label: returnVaultLabel,
            type: "booking",
            content: JSON.stringify({
              type: "flight", vendorName: extracted.airline,
              flightNumber: ((extracted.flightNumber as string) ?? "") + " (return)",
              airline: extracted.airline,
              fromAirport: extracted.returnFromAirport ?? extracted.toAirport,
              toAirport: extracted.returnToAirport ?? extracted.fromAirport,
              fromCity: extracted.toCity, toCity: extracted.fromCity,
              departureDate: extracted.returnDepartureDate, departureTime: extracted.returnDepartureTime,
              arrivalDate: extracted.returnArrivalDate ?? null, arrivalTime: extracted.returnArrivalTime ?? null,
              confirmationCode: extracted.confirmationCode,
              totalCost: null, currency: extracted.currency, guestNames: extracted.guestNames,
            }),
          },
        });
        console.log("[email-inbound] created return vault doc for trip:", resolvedTripId);
      }

      await incrementBudget(resolvedTripId, parsedCost);
      return NextResponse.json({ received: true, status: "success", type: "flight", tripId: resolvedTripId });

    // ── Hotels ────────────────────────────────────────────────────────────────
    } else if (extracted.type === "hotel" && extracted.vendorName) {
      const hotelName = extracted.vendorName as string;
      const checkInDate = (extracted.checkIn as string | null) ?? null;
      const checkOutDate = (extracted.checkOut as string | null) ?? null;

      const checkInDayIndex = checkInDate ? await getDayIndex(resolvedTripId, checkInDate) : null;

      // FIX 1: Check-in ItineraryItem (replaces SavedItem)
      const checkInItem = await db.itineraryItem.create({
        data: {
          tripId: resolvedTripId,
          type: "LODGING",
          title: `Check-in: ${hotelName}`,
          scheduledDate: checkInDate,
          confirmationCode: (extracted.confirmationCode as string | null) ?? null,
          address: (extracted.address as string | null) ?? null,
          totalCost: parsedCost,
          currency: detectedCurrency,
          notes: null,
          passengers,
          dayIndex: checkInDayIndex,
        },
      });
      // Geocode hotel by name + city
      const hotelCity = (extracted.city as string | null) ?? (extracted.toCity as string | null) ?? "";
      const hotelGeo = await geocodePlace(`${hotelName}${hotelCity ? " " + hotelCity : ""}`);
      if (hotelGeo) {
        await db.itineraryItem.update({ where: { id: checkInItem.id }, data: { latitude: hotelGeo.lat, longitude: hotelGeo.lng } });
      }
      console.log("[email-inbound] created hotel check-in ItineraryItem:", checkInItem.id, "dayIndex:", checkInDayIndex);

      // FIX 1: Check-out ItineraryItem
      if (checkOutDate) {
        const checkOutDayIndex = await getDayIndex(resolvedTripId, checkOutDate);
        const extractedCheckOutTime = null; // hotel emails rarely specify time; default applied below
        const checkOutItem = await db.itineraryItem.create({
          data: {
            tripId: resolvedTripId,
            type: "LODGING",
            title: `Check-out: ${hotelName}`,
            scheduledDate: checkOutDate,
            departureTime: extractedCheckOutTime ?? "11:00",
            confirmationCode: (extracted.confirmationCode as string | null) ?? null,
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

      const itemTitle = (extracted.vendorName as string | null) ?? subject;
      const itemTypeStr = (extracted.type as string | null) ?? "OTHER";

      const item = await db.itineraryItem.create({
        data: {
          tripId: resolvedTripId,
          type: itemTypeStr.toUpperCase(),
          title: itemTitle,
          scheduledDate: confirmedDate,
          departureTime: (extracted.departureTime as string | null) ?? null,
          arrivalTime: (extracted.arrivalTime as string | null) ?? null,
          fromCity: (extracted.fromCity as string | null) ?? null,
          toCity: (extracted.toCity as string | null) ?? null,
          confirmationCode: (extracted.confirmationCode as string | null) ?? null,
          notes: autoNotes,
          address: (extracted.address as string | null) ?? null,
          totalCost: parsedCost,
          currency: detectedCurrency,
          passengers,
          dayIndex,
        },
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

      // Geocode: trains → origin station; others → vendor name + city
      const geocodeQuery = itemTypeStr === "TRAIN"
        ? `${(extracted.fromCity as string | null) ?? (extracted.vendorName as string | null) ?? ""} train station`.trim()
        : `${itemTitle}${(extracted.city as string | null) ? " " + (extracted.city as string) : ""}`.trim();
      if (geocodeQuery) {
        const geo = await geocodePlace(geocodeQuery);
        if (geo) await db.itineraryItem.update({ where: { id: item.id }, data: { latitude: geo.lat, longitude: geo.lng } });
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
