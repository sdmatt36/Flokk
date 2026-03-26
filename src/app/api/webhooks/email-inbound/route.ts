import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getVenueImage } from "@/lib/destination-images";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Guest name cleaning ────────────────────────────────────────────────────────

const TITLE_SUFFIXES = new Set(["MR", "MS", "MRS", "MSTR", "DR"]);

const COMMON_FIRST_NAMES: string[] = [
  "STEPHANIE","MARGARET","VICTORIA","KIMBERLY","JENNIFER","PATRICIA","JESSICA",
  "MATTHEW","MICHAEL","WILLIAM","CHARLES","RICHARD","TIMOTHY","STEPHEN","BARBARA",
  "DOUGLAS","JEFFREY","ANTHONY","RAYMOND","RUSSELL","BRADLEY","STANLEY",
  "SANDRA","GEORGE","DONALD","THOMAS","ROBERT","DANIEL","ARTHUR","WALTER",
  "OLIVER","SOPHIA","RACHEL","MEGAN","KAREN","HELEN","GRACE","EMILY",
  "DIANE","DONNA","CAROL","ALICE","SARAH","LAURA","ROBIN","NANCY",
  "HOLLY","JULIA","MARIA","LINDA","DIANA","CLAIRE","SANDY","JANET",
  "MILES","SCOTT","BRIAN","PETER","ROGER","JAMES","FRANK","DAVID",
  "JASON","KEVIN","BRYAN","DEREK","BLAKE","BRETT","LANCE","BARRY",
  "BRUCE","CRAIG","FLOYD","GRANT","PERRY","RALPH","RANDY","TERRY",
  "VINCE","WADE","BEAU","JOHN","JANE","MARY","ANNE","KATE","LILY",
  "ROSE","JACK","JODY","ERIC","ALAN","ADAM","ALEX","ANNA","BETH",
  "CARL","DANA","DAVE","EVAN","GLEN","GREG","IVAN","JADE","JOEL",
  "JOSH","JUNE","KARL","KENT","KURT","LARS","LEAH","LEON","LISA",
  "LORI","LUIS","LYNN","MARC","MIKE","NEIL","NICK","NINA","PETE",
  "PHIL","RICK","RITA","RORY","ROSS","RUBY","RYAN","SEAN","SETH",
  "STAN","TARA","THEO","TINA","TODD","TROY","VERA","AMY","BOB",
  "KIM","RON","TOM","TIM","SUE","JOE","DAN","RAY","PAT","LEE",
  "KEN","ZAC","MAX","SAM","IAN",
].sort((a, b) => b.length - a.length);

function splitCompoundGivenName(compound: string): string {
  const upper = compound.toUpperCase();
  for (const name of COMMON_FIRST_NAMES) {
    if (upper.startsWith(name) && upper.length > name.length + 2) {
      return name;
    }
  }
  return compound;
}

function tc(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function cleanGuestName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  while (parts.length > 0 && TITLE_SUFFIXES.has(parts[parts.length - 1].toUpperCase())) {
    parts.pop();
  }
  if (parts.length === 0) return raw;
  const surname = parts[0];
  if (parts.length === 1) return tc(surname);
  const givenCompound = parts.slice(1).join("");
  const firstName = splitCompoundGivenName(givenCompound);
  return `${tc(firstName)} ${tc(surname)}`;
}

// ── Trip matching helpers ──────────────────────────────────────────────────────

function tripMatchesDestination(
  trip: { title: string; destinationCity?: string | null; destinationCountry?: string | null },
  keywords: string[]
): boolean {
  const haystack = [trip.title, trip.destinationCity, trip.destinationCountry]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await req.json() as Record<string, any>;

    // Normalise CloudMailin JSON (Normalized) or plain JSON
    let from: string;
    let subject: string;
    let html: string;
    let text: string;
    let to: string;

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

    // Extract bare email address
    const senderEmailMatch = from.match(/<(.+?)>/);
    const senderEmail = senderEmailMatch?.[1]?.trim() ?? from.trim();

    // ── Look up FamilyProfile via verified sender email ────────────────────────
    // First: senderEmails array (only populated after verification)
    let familyProfile = await db.familyProfile.findFirst({
      where: {
        senderEmails: { has: senderEmail },
        senderEmailVerifications: { some: { email: senderEmail, verifiedAt: { not: null } } },
      },
      include: { trips: true },
    });

    // Fallback: user's primary email (treat as implicitly verified)
    if (!familyProfile) {
      const user = await db.user.findFirst({
        where: { email: senderEmail },
        include: { familyProfile: { include: { trips: true } } },
      });
      if (user?.familyProfile) {
        familyProfile = user.familyProfile;
      }
    }

    if (!familyProfile) {
      console.log("[email-inbound] no verified sender match for:", senderEmail, "— dropping silently");
      return NextResponse.json({ received: true });
    }

    console.log("[email-inbound] matched familyProfile:", familyProfile.id);

    // Trips fallback: if include returned empty, query directly
    let trips = familyProfile.trips;
    if (trips.length === 0) {
      trips = await db.trip.findMany({ where: { familyProfileId: familyProfile.id } });
      console.log("[email-inbound] trips fallback — found:", trips.length);
    }

    const familyProfileId = familyProfile.id;

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
  "departureTime": "HH:MM or null",
  "arrivalDate": "YYYY-MM-DD or null",
  "arrivalTime": "HH:MM or null",
  "flightNumber": "string or null",
  "fromAirport": "IATA code or null",
  "toAirport": "IATA code or null",
  "airline": "string or null",
  "fromCity": "string or null",
  "toCity": "string or null",
  "returnDepartureDate": "YYYY-MM-DD or null",
  "returnDepartureTime": "HH:MM or null",
  "returnArrivalDate": "YYYY-MM-DD or null",
  "returnArrivalTime": "HH:MM or null",
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

    // Clean guest names
    if (Array.isArray(extracted.guestNames)) {
      extracted.guestNames = (extracted.guestNames as string[]).map(cleanGuestName);
    }

    console.log("[email-inbound] parsed:", JSON.stringify(extracted));

    // ── Match trip ─────────────────────────────────────────────────────────────
    const bookingDate = (extracted.checkIn ?? extracted.departureDate) as string | null;

    const destKeywords: string[] = [
      extracted.city,
      extracted.fromCity,
      extracted.toCity,
      extracted.country,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .flatMap((v) => v.split(/[\s,/-]+/))
      .filter((v) => v.length > 2);

    const subjectWords = subject
      .replace(/fwd?:/i, "")
      .split(/[\s|:\-–—]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2);
    const allKeywords = [...new Set([...destKeywords, ...subjectWords])];

    console.log("[email-inbound] destination keywords:", allKeywords);

    let matchedTrip: typeof trips[0] | null = null;

    // 1. Date range match
    if (bookingDate) {
      const [by, bm, bd] = bookingDate.split("-").map(Number);
      const booking = new Date(by, bm - 1, bd);
      const dateMatches = trips.filter((trip) => {
        if (!trip.startDate || !trip.endDate) return false;
        const start = new Date(trip.startDate);
        const end = new Date(trip.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
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
      console.log("[email-inbound] date match:", matchedTrip?.title ?? "none");
    }

    // 2. Destination keyword match
    if (!matchedTrip && allKeywords.length > 0) {
      const now = new Date();
      const destMatches = trips
        .filter((t) => tripMatchesDestination(t, allKeywords))
        .sort((a, b) => {
          const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          const aFuture = aDate >= now.getTime();
          const bFuture = bDate >= now.getTime();
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          return aDate - bDate;
        });
      matchedTrip = destMatches[0] ?? null;
      console.log("[email-inbound] keyword match:", matchedTrip?.title ?? "none");
    }

    console.log("[email-inbound] final matched trip:", matchedTrip?.title ?? "none");

    // ── Write to DB ────────────────────────────────────────────────────────────
    const resolvedTripId = matchedTrip?.id ?? trips[0]?.id ?? null;

    if (!resolvedTripId) {
      console.log("[email-inbound] no trip to assign — dropping");
      return NextResponse.json({ received: true, status: "no_trip" });
    }

    if (extracted.type === "flight" && extracted.flightNumber) {
      // dayIndex for outbound leg
      let dayIndex: number | null = null;
      if (matchedTrip && extracted.departureDate) {
        const trip = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
        if (trip?.startDate) {
          const rawStart = new Date(trip.startDate);
          const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
          const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
          const [dy, dm, dd] = (extracted.departureDate as string).split("-").map(Number);
          dayIndex = Math.round((new Date(dy, dm - 1, dd).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const flight = await db.flight.create({
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
          dayIndex,
        },
      });
      console.log("[email-inbound] created flight:", flight.id, "dayIndex:", dayIndex);

      // Vault document for outbound leg
      if (matchedTrip) {
        await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string}`.trim(),
            type: "booking",
            content: JSON.stringify({
              type: "flight", vendorName: extracted.airline,
              flightNumber: extracted.flightNumber, airline: extracted.airline,
              fromAirport: extracted.fromAirport, toAirport: extracted.toAirport,
              fromCity: extracted.fromCity, toCity: extracted.toCity,
              departureDate: extracted.departureDate, departureTime: extracted.departureTime,
              arrivalDate: extracted.arrivalDate, arrivalTime: extracted.arrivalTime,
              confirmationCode: extracted.confirmationCode,
              totalCost: extracted.totalCost, currency: extracted.currency,
              guestNames: extracted.guestNames,
              returnDepartureDate: extracted.returnDepartureDate,
            }),
          },
        });
      }

      // Return flight
      console.log("[email-inbound] attempting return flight creation:", extracted.returnDepartureDate ?? "null/undefined — WILL SKIP");
      if (extracted.returnDepartureDate) {
        let returnDayIndex: number | null = null;
        if (matchedTrip) {
          const tripForReturn = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
          if (tripForReturn?.startDate) {
            const rawStart = new Date(tripForReturn.startDate);
            const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
            const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
            const [ry, rm, rd] = (extracted.returnDepartureDate as string).split("-").map(Number);
            returnDayIndex = Math.round((new Date(ry, rm - 1, rd).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        const returnFlight = await db.flight.create({
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
        console.log("[email-inbound] created return flight:", returnFlight.id, "dayIndex:", returnDayIndex);

        // Vault document for return leg
        if (matchedTrip) {
          await db.tripDocument.create({
            data: {
              tripId: matchedTrip.id,
              label: `${(extracted.airline as string) ?? ""} ${extracted.flightNumber as string} (return)`.trim(),
              type: "booking",
              content: JSON.stringify({
                type: "flight", vendorName: extracted.airline,
                flightNumber: ((extracted.flightNumber as string) ?? "") + " (return)",
                airline: extracted.airline,
                fromAirport: extracted.returnFromAirport,
                toAirport: extracted.returnToAirport,
                fromCity: extracted.toCity,
                toCity: extracted.fromCity,
                departureDate: extracted.returnDepartureDate,
                departureTime: extracted.returnDepartureTime,
                arrivalDate: extracted.returnArrivalDate ?? null,
                arrivalTime: extracted.returnArrivalTime ?? null,
                confirmationCode: extracted.confirmationCode,
                totalCost: null, currency: extracted.currency,
                guestNames: extracted.guestNames,
              }),
            },
          });
        }
      } else {
        console.log("[email-inbound] skipping return flight: returnDepartureDate is", extracted.returnDepartureDate ?? "null/undefined");
      }

      return NextResponse.json({ received: true, status: "success", type: "flight", id: flight.id, tripId: resolvedTripId });

    } else if (extracted.type === "hotel" && extracted.vendorName) {
      let hotelDayIndex: number | null = null;
      if (matchedTrip && extracted.checkIn) {
        const trip = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
        if (trip?.startDate) {
          const rawStart = new Date(trip.startDate);
          const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
          const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
          const [cy, cm, cd] = (extracted.checkIn as string).split("-").map(Number);
          hotelDayIndex = Math.round((new Date(cy, cm - 1, cd).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const hotelStatus = (matchedTrip && hotelDayIndex != null) ? "SCHEDULED" : (matchedTrip ? "TRIP_ASSIGNED" : "UNORGANIZED");
      const saved = await db.savedItem.create({
        data: {
          familyProfileId,
          tripId: matchedTrip?.id ?? null,
          sourceType: "EMAIL_IMPORT",
          rawTitle: extracted.vendorName as string,
          destinationCity: (extracted.city as string) ?? null,
          destinationCountry: (extracted.country as string) ?? null,
          categoryTags: ["lodging"],
          placePhotoUrl: getVenueImage(extracted.vendorName as string) ?? null,
          status: hotelStatus,
          isBooked: true,
          bookedAt: new Date(),
          extractedCheckin: (extracted.checkIn as string) ?? null,
          extractedCheckout: (extracted.checkOut as string) ?? null,
          ...(hotelDayIndex != null ? { dayIndex: hotelDayIndex } : {}),
        },
      });

      if (matchedTrip && (extracted.contactPhone || extracted.contactEmail)) {
        await db.tripContact.create({
          data: {
            tripId: matchedTrip.id,
            name: extracted.vendorName as string,
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
            label: `${extracted.vendorName as string} confirmation`,
            value: extracted.confirmationCode as string,
          },
        });
      }

      if (matchedTrip) {
        await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: extracted.vendorName as string,
            type: "booking",
            content: JSON.stringify({
              type: extracted.type, vendorName: extracted.vendorName,
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

      console.log("[email-inbound] created hotel savedItem:", saved.id, "dayIndex:", hotelDayIndex, "status:", hotelStatus);
      return NextResponse.json({ received: true, status: "success", type: "hotel", id: saved.id, tripId: resolvedTripId });

    } else {
      // Train, activity, restaurant, car rental, unknown
      let dayIndex: number | null = null;
      let startTime: string | null = null;
      const confirmedDate = (extracted.departureDate ?? extracted.checkIn ?? extracted.arrivalDate) as string | null;

      if (matchedTrip && confirmedDate) {
        const trip = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
        if (trip?.startDate) {
          const rawStart = new Date(trip.startDate);
          const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
          const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
          const [dy, dm, dd] = confirmedDate.split("-").map(Number);
          dayIndex = Math.round((new Date(dy, dm - 1, dd).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
        startTime = (extracted.departureTime as string | null) ?? null;
      }

      const routeParts: string[] = [];
      if (extracted.fromCity && extracted.toCity) routeParts.push(`${extracted.fromCity as string} → ${extracted.toCity as string}`);
      if (extracted.departureTime) routeParts.push(`departs ${extracted.departureTime as string}`);
      if (extracted.arrivalTime) routeParts.push(`arrives ${extracted.arrivalTime as string}`);
      const autoDescription = routeParts.length > 0 ? routeParts.join(" · ") : null;

      const itemStatus = (matchedTrip && dayIndex != null) ? "SCHEDULED" : (matchedTrip ? "TRIP_ASSIGNED" : "UNORGANIZED");
      const trainTitle = (extracted.vendorName as string) ?? subject;

      const saved = await db.savedItem.create({
        data: {
          familyProfileId,
          tripId: matchedTrip?.id ?? null,
          sourceType: "EMAIL_IMPORT",
          rawTitle: trainTitle,
          rawDescription: autoDescription,
          destinationCity: ((extracted.city ?? extracted.toCity) as string) ?? null,
          categoryTags: [(extracted.type as string) ?? "other"],
          placePhotoUrl: getVenueImage(trainTitle) ?? null,
          status: itemStatus,
          isBooked: true,
          bookedAt: new Date(),
          ...(dayIndex != null ? { dayIndex } : {}),
          ...(startTime ? { startTime } : {}),
        },
      });

      if (matchedTrip && extracted.confirmationCode) {
        await db.tripKeyInfo.create({
          data: {
            tripId: matchedTrip.id,
            label: `${(extracted.vendorName as string) ?? subject} confirmation`,
            value: extracted.confirmationCode as string,
          },
        });
      }

      if (matchedTrip) {
        await db.tripDocument.create({
          data: {
            tripId: matchedTrip.id,
            label: (extracted.vendorName as string) ?? subject,
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

      console.log("[email-inbound] created savedItem:", saved.id, "type:", extracted.type, "dayIndex:", dayIndex, "startTime:", startTime, "status:", itemStatus);
      return NextResponse.json({ received: true, status: "success", type: extracted.type, id: saved.id, tripId: resolvedTripId });
    }

  } catch (err) {
    console.error("[email-inbound] error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
