import { inngest } from "../client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { getVenueImage } from "@/lib/destination-images";

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

// ── Main Inngest function ──────────────────────────────────────────────────────

export const parseBookingEmail = inngest.createFunction(
  { id: "parse-booking-email" },
  { event: "email/booking-received" },
  async ({ event, step }) => {
    const { from, subject, html, text } = event.data as {
      from: string;
      subject: string;
      html: string;
      text: string;
      to?: string;
    };

    // ── Step 1: Extract sender email ──────────────────────────────────────────
    const senderEmail = await step.run("extract-sender", async () => {
      const match = from.match(/<(.+?)>/);
      return match?.[1]?.trim() ?? from.trim();
    });

    // ── Step 2: Find user — primary email then senderEmails fallback ──────────
    const user = await step.run("find-user", async () => {
      let found = await db.user.findFirst({
        where: { email: senderEmail },
        include: { familyProfile: { include: { trips: true } } },
      });
      console.log("[parse-booking] primary lookup:", !!found, "| familyProfile:", !!found?.familyProfile);

      if (!found?.familyProfile) {
        const fp = await db.familyProfile.findFirst({
          where: { senderEmails: { has: senderEmail } },
          include: { user: { include: { familyProfile: { include: { trips: true } } } } },
        });
        if (fp?.user) {
          console.log("[parse-booking] found via senderEmails fallback — familyProfileId:", fp.id);
          found = fp.user;
        }
      }

      return found ?? null;
    });

    if (!user?.familyProfile) {
      console.log("[parse-booking] no user for senderEmail:", senderEmail);
      return { status: "no_user_found", senderEmail };
    }

    // Trips fallback: if include returned empty, query directly
    let trips = user.familyProfile.trips;
    if (trips.length === 0) {
      trips = await step.run("fetch-trips-fallback", async () => {
        console.log("[parse-booking] trips empty via include — running fallback for familyProfileId:", user.familyProfile!.id);
        return db.trip.findMany({ where: { familyProfileId: user.familyProfile!.id } });
      });
    }

    // ── Step 3: Claude extraction ─────────────────────────────────────────────
    const extracted = await step.run("claude-extract", async () => {
      const emailContent = text
        ? text.substring(0, 8000)
        : html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 8000);

      console.log("[parse-booking] calling Claude, content length:", emailContent.length);

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
  "activityName": "string or null",
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
}

Field notes:
- activityName: For activity/tour bookings, extract the specific tour or activity title (NOT the platform name). For GetYourGuide bookings: extract the exact tour title shown in the booking, e.g. "Gyeongbokgung Palace Guided Tour" or "Bukchon Hanok Village Walking Tour" — never return "GetYourGuide" as the activityName. For non-activity types, set to null.
- vendorName: The operator/company name (e.g. "GetYourGuide", "Airbnb", "Korean Air"). For activities, this is the platform or operator, not the tour title.`,
        }],
      });

      const content = response.content[0];
      if (content.type !== "text") return null;

      try {
        const clean = content.text.replace(/```json|```/g, "").trim();
        return JSON.parse(clean) as Record<string, unknown>;
      } catch {
        console.error("[parse-booking] JSON parse failed:", content.text);
        return null;
      }
    });

    if (!extracted || (extracted.confidence as number) < 0.5) {
      console.log("[parse-booking] low confidence:", extracted?.confidence);
      return { status: "low_confidence", extracted };
    }

    // Clean guest names
    if (Array.isArray(extracted.guestNames)) {
      extracted.guestNames = (extracted.guestNames as string[]).map(cleanGuestName);
    }

    console.log("[parse-booking] parsed:", JSON.stringify(extracted));

    // ── Step 4: Match trip ────────────────────────────────────────────────────
    const matchedTrip = await step.run("match-trip", async () => {
      const bookingDate = (extracted.checkIn ?? extracted.departureDate) as string | null;

      // Build destination keywords from parsed fields + subject
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

      console.log("[parse-booking] destination keywords:", allKeywords);

      // 1. Try: date range match
      let matched: typeof trips[0] | null = null;
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
        matched = dateMatches[0] ?? null;
        console.log("[parse-booking] date match:", matched?.title ?? "none");
      }

      // 2. Try: destination keyword match
      if (!matched && allKeywords.length > 0) {
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
        matched = destMatches[0] ?? null;
        console.log("[parse-booking] keyword match:", matched?.title ?? "none");
      }

      console.log("[parse-booking] final matched trip:", matched?.title ?? "none");
      return matched ?? null;
    });

    // ── Step 5: Write to DB ───────────────────────────────────────────────────
    const result = await step.run("create-booking", async () => {
      const familyProfileId = user.familyProfile!.id;
      const resolvedTripId = matchedTrip?.id ?? trips[0]?.id ?? null;

      if (!resolvedTripId) {
        console.log("[parse-booking] no trip to assign — dropping");
        return { status: "no_trip" };
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
        console.log("[parse-booking] created flight:", flight.id, "dayIndex:", dayIndex);

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
        console.log("[parse-booking] attempting return flight creation:", extracted.returnDepartureDate ?? "null/undefined — WILL SKIP");
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
          console.log("[parse-booking] created return flight:", returnFlight.id, "dayIndex:", returnDayIndex);

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
          console.log("[parse-booking] skipping return flight: returnDepartureDate is", extracted.returnDepartureDate ?? "null/undefined");
        }

        return { type: "flight", id: flight.id };

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

        console.log("[parse-booking] created hotel savedItem:", saved.id, "dayIndex:", hotelDayIndex, "status:", hotelStatus);
        return { type: "hotel", id: saved.id };

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
        const trainTitle = (extracted.activityName as string | null) || (extracted.vendorName as string | null) || subject;

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
              label: `${(extracted.activityName as string | null) || (extracted.vendorName as string | null) || subject} confirmation`,
              value: extracted.confirmationCode as string,
            },
          });
        }

        if (matchedTrip) {
          await db.tripDocument.create({
            data: {
              tripId: matchedTrip.id,
              label: (extracted.activityName as string | null) || (extracted.vendorName as string | null) || subject,
              type: "booking",
              content: JSON.stringify({
                type: extracted.type, vendorName: extracted.vendorName, activityName: extracted.activityName,
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

        console.log("[parse-booking] created savedItem:", saved.id, "type:", extracted.type, "dayIndex:", dayIndex, "startTime:", startTime, "status:", itemStatus);
        return { type: extracted.type, id: saved.id, dayIndex, startTime };
      }
    });

    console.log("[parse-booking] done:", result);
    return { status: "success", tripId: matchedTrip?.id ?? null, result };
  }
);
