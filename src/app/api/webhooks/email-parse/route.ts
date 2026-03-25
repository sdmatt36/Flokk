import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { getVenueImage } from "@/lib/destination-images";
import { sendTransactional } from "@/lib/loops";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Guest name cleaning (FIX 2) ──────────────────────────────────────────────

const TITLE_SUFFIXES = new Set(["MR", "MS", "MRS", "MSTR", "DR"]);

// Common first names sorted by descending length — prefer longer matches (e.g. MATTHEW over MATT)
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

// ─────────────────────────────────────────────────────────────────────────────

function tripMatchesDestination(trip: { title: string; destinationCity?: string | null; destinationCountry?: string | null }, keywords: string[]): boolean {
  const haystack = [trip.title, trip.destinationCity, trip.destinationCountry]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { from, subject, text, html } = await req.json() as {
    from: string;
    subject: string;
    text?: string;
    html?: string;
    to?: string;
  };

  // Extract sender email — handle "Name <email>" format
  const match = from.match(/<(.+?)>/);
  const senderEmail = match?.[1]?.trim() ?? from.trim();
  console.log("[email-parse] from:", from, "| senderEmail:", senderEmail, "| subject:", subject);

  // Find user by sender email
  let user = await db.user.findFirst({
    where: { email: senderEmail },
    include: { familyProfile: { include: { trips: true } } },
  });

  console.log("[email-parse] user found:", !!user, "| familyProfile:", !!user?.familyProfile, "| familyProfileId:", user?.familyProfile?.id ?? "none", "| trips:", user?.familyProfile?.trips?.length ?? 0);

  // FIX 4: If no user found, try senderEmails array fallback
  if (!user?.familyProfile) {
    const fp = await db.familyProfile.findFirst({
      where: { senderEmails: { has: senderEmail } },
      include: { user: { include: { familyProfile: { include: { trips: true } } } } },
    });
    if (fp?.user) {
      console.log("[email-parse] found via senderEmails fallback — familyProfileId:", fp.id, "| trips:", fp.user.familyProfile?.trips?.length ?? 0);
      user = fp.user;
    }
  }

  if (!user?.familyProfile) {
    console.log("[email-parse] no user for senderEmail:", senderEmail);
    return NextResponse.json({ error: "no_user_found", senderEmail }, { status: 404 });
  }

  // If trips came back empty via include, fallback to direct query by familyProfileId
  let trips = user.familyProfile.trips;
  if (trips.length === 0) {
    console.log("[email-parse] trips: 0 via include — running fallback query for familyProfileId:", user.familyProfile.id);
    trips = await db.trip.findMany({ where: { familyProfileId: user.familyProfile.id } });
    console.log("[email-parse] fallback trips found:", trips.map(t => `${t.id}: ${t.title} (${t.destinationCity ?? "no city"}, ${t.startDate?.toISOString().slice(0, 10) ?? "no date"})`));
  }

  // Call Claude to extract booking details
  const emailContent = text
    ? text.substring(0, 8000)
    : (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 8000);

  console.log("[email-parse] calling Claude, content length:", emailContent.length);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
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
    console.log("[email-parse] Claude returned non-text content type:", content.type);
    return NextResponse.json({ error: "claude_no_text" }, { status: 500 });
  }

  let extracted: Record<string, unknown>;
  try {
    const clean = content.text.replace(/```json|```/g, "").trim();
    extracted = JSON.parse(clean);
  } catch {
    console.log("[email-parse] JSON parse failed. Raw Claude output:", content.text);
    return NextResponse.json({ error: "claude_parse_failed", raw: content.text }, { status: 500 });
  }

  // Clean guest names
  if (Array.isArray(extracted.guestNames)) {
    extracted.guestNames = (extracted.guestNames as string[]).map(cleanGuestName);
  }

  console.log("[email-parse] parsed:", JSON.stringify(extracted));

  if (!extracted || (extracted.confidence as number) < 0.5) {
    console.log("[email-parse] low confidence:", extracted?.confidence);
    return NextResponse.json({ error: "low_confidence", confidence: extracted?.confidence, parsed: extracted }, { status: 422 });
  }

  // Build destination keywords from parsed output + subject
  const destKeywords: string[] = [
    extracted.city,
    extracted.fromCity,
    extracted.toCity,
    extracted.country,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .flatMap((v) => v.split(/[\s,/-]+/))
    .filter((v) => v.length > 2);

  // Also pull keywords from subject line (e.g. "Seoul - Busan")
  const subjectWords = subject.replace(/fwd?:/i, "").split(/[\s|:\-–—]+/).map((w) => w.trim()).filter((w) => w.length > 2);
  const allKeywords = [...new Set([...destKeywords, ...subjectWords])];

  console.log("[email-parse] trips found:", trips.map((t) => `${t.title} (${t.destinationCity ?? "no city"}, ${t.startDate?.toISOString().slice(0, 10) ?? "no date"} – ${t.endDate?.toISOString().slice(0, 10) ?? ""})`));
  console.log("[email-parse] destination keywords:", allKeywords);

  const bookingDate = (extracted.checkIn ?? extracted.departureDate) as string | null;
  let matchedTrip: typeof trips[0] | null = null;

  // 1. Try: date range match — prefer PLANNING > ACTIVE > COMPLETED, then shortest duration
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
      const statusScore = (s: string | null) => s === "PLANNING" ? 0 : s === "ACTIVE" ? 1 : 2;
      const sA = statusScore(a.status ?? null);
      const sB = statusScore(b.status ?? null);
      if (sA !== sB) return sA - sB;
      const durA = (a.endDate?.getTime() ?? Infinity) - (a.startDate?.getTime() ?? 0);
      const durB = (b.endDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? 0);
      return durA - durB;
    });
    matchedTrip = dateMatches[0] ?? null;
    console.log("[email-parse] date match result:", matchedTrip?.title ?? "none", "| candidates:", dateMatches.map(t => `${t.title} (${t.status})`));
  }

  // 2. Try: destination keyword match — pick nearest upcoming trip
  if (!matchedTrip && allKeywords.length > 0) {
    const now = new Date();
    const destMatches = trips
      .filter((t) => tripMatchesDestination(t, allKeywords))
      .sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        // Prefer upcoming trips; among upcoming prefer nearest
        const aFuture = aDate >= now.getTime();
        const bFuture = bDate >= now.getTime();
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        return aDate - bDate;
      });
    matchedTrip = destMatches[0] ?? null;
    console.log("[email-parse] destination keyword match result:", matchedTrip?.title ?? "none", "| matched keywords against:", destMatches.map((t) => t.title));
  }

  console.log("[email-parse] final matched trip:", matchedTrip?.title ?? "none (will save unassigned)");

  const familyProfileId = user.familyProfile.id;

  const userClerkId = user!.clerkId;

  // Helper: fire Loops booking triggers after any savedItem is created from email
  async function fireLoopsBookingTriggers(vendorName: string, tripTitle: string | null) {
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userClerkId);
      const firstName = clerkUser.firstName ?? "";

      // booking-confirmed — every time
      await sendTransactional(senderEmail, "cmn5ls3210rtf0ix38tilrgot", {
        userName: firstName,
        bookingDetails: vendorName || "your booking",
        date: (extracted.departureDate ?? extracted.checkIn ?? "") as string,
        confirmationNumber: (extracted.confirmationCode ?? "") as string,
      });

      // first-booking-imported — only on first email import
      const importCount = await db.savedItem.count({
        where: { familyProfileId, sourceType: "EMAIL_IMPORT" },
      });
      if (importCount === 1) {
        await sendTransactional(senderEmail, "cmn5ln8cn0v1h0iyvn6glrqnb", {
          firstName,
          vendorName: vendorName || "your booking",
          tripName: tripTitle || "your trip",
        });
      }
    } catch (e) {
      console.error("[loops] booking triggers failed:", e);
    }
  }

  const parsedSummary = {
    type: extracted.type,
    destination: extracted.city ?? extracted.toCity ?? null,
    dates: bookingDate ?? extracted.checkIn ?? null,
  };

  // Write to DB
  const resolvedTripId = matchedTrip?.id ?? trips[0]?.id ?? null;

  if (extracted.type === "flight" && extracted.flightNumber && resolvedTripId) {
    let dayIndex: number | null = null;
    if (matchedTrip) {
      const trip = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
      if (trip?.startDate && extracted.departureDate) {
        const rawStart = new Date(trip.startDate);
        const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
        const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
        const [dy, dm, dd] = (extracted.departureDate as string).split("-").map(Number);
        const dep = new Date(dy, dm - 1, dd);
        dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

    if (extracted.returnDepartureDate) {
      // Compute dayIndex for return leg
      let returnDayIndex: number | null = null;
      if (matchedTrip) {
        const tripForReturn = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
        if (tripForReturn?.startDate) {
          const rawStart = new Date(tripForReturn.startDate);
          const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
          const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
          const [ry, rm, rd] = (extracted.returnDepartureDate as string).split("-").map(Number);
          const returnDep = new Date(ry, rm - 1, rd);
          returnDayIndex = Math.round((returnDep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
          arrivalDate: null,
          arrivalTime: null,
          confirmationCode: (extracted.confirmationCode as string | null) ?? null,
          status: "booked",
          dayIndex: returnDayIndex,
        },
      });
      console.log("[email-parse] created return flight:", returnFlight.id, "dayIndex:", returnDayIndex);

      // Vault document for return flight
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
              arrivalDate: null,
              arrivalTime: null,
              confirmationCode: extracted.confirmationCode,
              totalCost: null,
              currency: extracted.currency,
              guestNames: extracted.guestNames,
            }),
          },
        });
      }
    }

    // Vault booking document for flight
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

    console.log("[email-parse] created flight:", flight.id, "tripId:", flight.tripId);
    return NextResponse.json({ success: true, parsed: parsedSummary, tripMatched: matchedTrip?.title ?? null, itemCreated: flight.id });

  } else if (extracted.type === "hotel" && extracted.vendorName) {
    // Compute dayIndex from checkIn date if available
    let hotelDayIndex: number | null = null;
    if (matchedTrip && extracted.checkIn) {
      const trip = await db.trip.findUnique({ where: { id: matchedTrip.id }, select: { startDate: true } });
      if (trip?.startDate) {
        const rawStart = new Date(trip.startDate);
        const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
        const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
        const [cy, cm, cd] = (extracted.checkIn as string).split("-").map(Number);
        const checkin = new Date(cy, cm - 1, cd);
        hotelDayIndex = Math.round((checkin.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

    // Vault booking document
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

    console.log("[email-parse] created hotel savedItem:", saved.id, "tripId:", saved.tripId, "dayIndex:", hotelDayIndex, "status:", hotelStatus);
    await fireLoopsBookingTriggers(extracted.vendorName as string, matchedTrip?.title ?? null);
    return NextResponse.json({ success: true, parsed: parsedSummary, tripMatched: matchedTrip?.title ?? null, itemCreated: saved.id });

  } else {
    // Train, activity, restaurant, or unknown — save as SavedItem
    // Auto-schedule: if we have a confirmed date + matched trip, compute dayIndex and startTime
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
        const dep = new Date(dy, dm - 1, dd);
        dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
      // Use extracted departureTime directly — never default
      startTime = (extracted.departureTime as string | null) ?? null;
    }

    // Build a description from route + departure/arrival times so it renders on the itinerary card
    const routeParts: string[] = [];
    if (extracted.fromCity && extracted.toCity) routeParts.push(`${extracted.fromCity} → ${extracted.toCity}`);
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

    // Vault booking document
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

    console.log("[email-parse] created savedItem:", saved.id, "type:", extracted.type, "tripId:", saved.tripId, "dayIndex:", dayIndex, "startTime:", startTime, "status:", itemStatus);
    await fireLoopsBookingTriggers((extracted.vendorName as string) ?? subject, matchedTrip?.title ?? null);
    return NextResponse.json({ success: true, parsed: parsedSummary, tripMatched: matchedTrip?.title ?? null, itemCreated: saved.id, dayIndex, startTime });
  }
}
