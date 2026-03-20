import { inngest } from "../client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const parseBookingEmail = inngest.createFunction(
  { id: "parse-booking-email" },
  { event: "email/booking-received" },
  async ({ event, step }) => {
    const { from, subject, html, text } = event.data as {
      from: string;
      subject: string;
      html: string;
      text: string;
      to: string;
    };

    // Step 1 — Extract sender email address
    const senderEmail = await step.run("extract-sender", async () => {
      const match = from.match(/<(.+?)>/);
      return match?.[1]?.trim() ?? from.trim();
    });

    // Step 2 — Find user by email
    const user = await step.run("find-user", async () => {
      return await db.user.findFirst({
        where: { email: senderEmail },
        include: {
          familyProfile: {
            include: { trips: true },
          },
        },
      });
    });

    if (!user?.familyProfile) {
      console.log("[parse-booking] no user found for:", senderEmail);
      return { status: "no_user_found", senderEmail };
    }

    // Step 3 — Use Claude to extract booking details
    const extracted = await step.run("claude-extract", async () => {
      const emailContent = text
        ? text.substring(0, 8000)
        : html
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 8000);

      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Extract booking information from this confirmation email. Return ONLY valid JSON with no markdown.

Email subject: ${subject}
Email content: ${emailContent}

Return this exact JSON structure:
{
  "type": "hotel" | "flight" | "activity" | "restaurant" | "car_rental" | "unknown",
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
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") return null;

      try {
        const clean = content.text.replace(/```json|```/g, "").trim();
        return JSON.parse(clean);
      } catch {
        console.error("[parse-booking] JSON parse failed:", content.text);
        return null;
      }
    });

    if (!extracted || extracted.confidence < 0.5) {
      console.log("[parse-booking] low confidence extraction:", extracted?.confidence);
      return { status: "low_confidence", extracted };
    }

    // Step 4 — Match to the right trip by dates
    const matchedTrip = await step.run("match-trip", async () => {
      const trips = user.familyProfile!.trips;
      if (!trips.length) return null;

      const bookingDate = extracted.checkIn ?? extracted.departureDate;

      if (!bookingDate) return trips[0];

      const [by, bm, bd] = (bookingDate as string).split("-").map(Number);
      const booking = new Date(by, bm - 1, bd);

      const matched = trips.find((trip) => {
        if (!trip.startDate || !trip.endDate) return false;
        const start = new Date(trip.startDate);
        const end = new Date(trip.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return booking >= start && booking <= end;
      });

      return matched ?? trips[0];
    });

    if (!matchedTrip) {
      return { status: "no_trip_matched" };
    }

    // Step 5 — Create the booking record
    const result = await step.run("create-booking", async () => {
      const familyProfileId = user.familyProfile!.id;

      if (extracted.type === "flight" && extracted.flightNumber) {
        // Calculate dayIndex
        const trip = await db.trip.findUnique({
          where: { id: matchedTrip.id },
          select: { startDate: true },
        });

        let dayIndex: number | null = null;
        if (trip?.startDate && extracted.departureDate) {
          const rawStart = new Date(trip.startDate);
          const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
          const start = new Date(
            shiftedStart.getUTCFullYear(),
            shiftedStart.getUTCMonth(),
            shiftedStart.getUTCDate()
          );
          const [dy, dm, dd] = (extracted.departureDate as string).split("-").map(Number);
          const dep = new Date(dy, dm - 1, dd);
          dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        const flight = await db.flight.create({
          data: {
            tripId: matchedTrip.id,
            type: "outbound",
            airline: extracted.airline ?? "",
            flightNumber: extracted.flightNumber,
            fromAirport: extracted.fromAirport ?? "",
            fromCity: extracted.fromAirport ?? "",
            toAirport: extracted.toAirport ?? "",
            toCity: extracted.toAirport ?? "",
            departureDate: extracted.departureDate ?? "",
            departureTime: extracted.departureTime ?? "",
            arrivalDate: extracted.arrivalDate ?? null,
            arrivalTime: extracted.arrivalTime ?? null,
            confirmationCode: extracted.confirmationCode ?? null,
            status: "booked",
            dayIndex,
          },
        });

        return { type: "flight", id: flight.id };
      } else if (extracted.type === "hotel" && extracted.vendorName) {
        const saved = await db.savedItem.create({
          data: {
            familyProfileId,
            tripId: matchedTrip.id,
            sourceType: "EMAIL_IMPORT",
            rawTitle: extracted.vendorName,
            destinationCity: extracted.city ?? null,
            destinationCountry: extracted.country ?? null,
            categoryTags: ["lodging"],
            status: "TRIP_ASSIGNED",
            isBooked: true,
            bookedAt: new Date(),
            extractedCheckin: extracted.checkIn ?? null,
            extractedCheckout: extracted.checkOut ?? null,
          },
        });

        // Add hotel contact to vault if found
        if (extracted.contactPhone || extracted.contactEmail) {
          await db.tripContact.create({
            data: {
              tripId: matchedTrip.id,
              name: extracted.vendorName,
              role: "Hotel",
              phone: extracted.contactPhone ?? null,
              email: extracted.contactEmail ?? null,
            },
          });
        }

        // Add confirmation code to vault key info
        if (extracted.confirmationCode) {
          await db.tripKeyInfo.create({
            data: {
              tripId: matchedTrip.id,
              label: `${extracted.vendorName} confirmation`,
              value: extracted.confirmationCode,
            },
          });
        }

        return { type: "hotel", id: saved.id };
      } else {
        // Generic activity / other booking
        const saved = await db.savedItem.create({
          data: {
            familyProfileId,
            tripId: matchedTrip.id,
            sourceType: "EMAIL_IMPORT",
            rawTitle: extracted.vendorName ?? subject,
            categoryTags: [extracted.type ?? "other"],
            status: "TRIP_ASSIGNED",
            isBooked: true,
            bookedAt: new Date(),
          },
        });

        return { type: extracted.type, id: saved.id };
      }
    });

    console.log("[parse-booking] created:", result);
    return { status: "success", tripId: matchedTrip.id, result };
  }
);
