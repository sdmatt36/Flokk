/**
 * extract-and-write.ts
 *
 * Shared flight write logic used by both the email-inbound webhook and
 * the phase2a-test-extractor script.
 *
 * Dedup behaviour (Option 1 / re-extraction):
 *   When an email with a matching (tripId, confirmationCode) is re-forwarded,
 *   the existing booking's Flight legs are wiped and recreated from the new
 *   legs[] array. Manual edits to email-imported flights are lost on re-forward.
 *   Phase 4 will add a `source` column on Flight to preserve manual edits.
 *
 * Null-code bookings always create a new FlightBooking (no dedup possible).
 * Phase 4 will add a fallback key (tripId, fromAirport, toAirport, departureDate).
 */

import { db as defaultDb } from "../db";

export type WriteFlightLeg = {
  airline: string | null;
  flightNumber: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string | null;
  arrivalTime: string | null;
  duration: string | null;
  dayIndex: number | null;
  type: string;
  notes: string | null;
};

export type WriteFlightInput = {
  tripId: string;
  confirmationCode: string | null;
  airline: string | null;
  cabinClass: string;
  status: string;
  sortOrder: number;
  seatNumbers: string | null;
  notes: string | null;
  legs: WriteFlightLeg[];
};

export type WriteFlightResult = {
  flightBookingId: string;
  legCount: number;
  dedupAction: "created" | "replaced";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeFlightFromEmail(input: WriteFlightInput, dbOverride?: any): Promise<WriteFlightResult> {
  const { tripId, confirmationCode, airline, cabinClass, status, sortOrder, seatNumbers, notes, legs } = input;
  const prisma = dbOverride ?? defaultDb;
  const trimmedCode = confirmationCode?.trim() || null;

  if (!trimmedCode) {
    console.warn("[write-flight] flight booking written without confirmationCode — may create duplicates on re-import");
  }

  const { flightBookingId, dedupAction } = await prisma.$transaction(
    async (tx: typeof prisma) => {
      let bookingId: string;
      let action: "created" | "replaced";

      if (trimmedCode) {
        const existing = await tx.flightBooking.findUnique({
          where: { unique_trip_confirmation: { tripId, confirmationCode: trimmedCode } },
          select: { id: true },
        });

        if (existing) {
          // Re-extraction: wipe legs, update booking metadata
          const deleted = await tx.flight.deleteMany({ where: { flightBookingId: existing.id } });
          await tx.flightBooking.update({
            where: { id: existing.id },
            data: { airline, cabinClass, seatNumbers, notes, status, sortOrder },
          });
          bookingId = existing.id;
          action = "replaced";
          console.log(
            `[write-flight] replaced FlightBooking ${existing.id} (code=${trimmedCode}) — deleted ${deleted.count} old leg(s)`
          );
        } else {
          const booking = await tx.flightBooking.create({
            data: { tripId, confirmationCode: trimmedCode, airline, cabinClass, seatNumbers, notes, status, sortOrder },
          });
          bookingId = booking.id;
          action = "created";
        }
      } else {
        // No confirmation code — always create; dedup not possible
        const booking = await tx.flightBooking.create({
          data: { tripId, confirmationCode: null, airline, cabinClass, seatNumbers, notes, status, sortOrder },
        });
        bookingId = booking.id;
        action = "created";
      }

      // Create per-leg Flight rows
      for (const leg of legs) {
        await tx.flight.create({
          data: {
            tripId,
            flightBookingId: bookingId,
            type: leg.type || "outbound",
            // Per-leg airline preferred (codeshare operating carrier); fall back to booking-level
            airline: leg.airline ?? airline ?? "",
            flightNumber: leg.flightNumber,
            fromAirport: leg.fromAirport,
            fromCity: leg.fromCity,
            toAirport: leg.toAirport,
            toCity: leg.toCity,
            departureDate: leg.departureDate,
            departureTime: leg.departureTime,
            arrivalDate: leg.arrivalDate ?? null,
            arrivalTime: leg.arrivalTime ?? null,
            duration: leg.duration ?? null,
            cabinClass,
            // Denormalized for legacy Vault card reads during Phase 2→3 transition.
            // Phase 3 will stop reading this field; Phase 4 will drop it.
            confirmationCode: trimmedCode,
            seatNumbers: null,
            notes: leg.notes ?? null,
            dayIndex: leg.dayIndex ?? null,
            sortOrder,
            status,
          },
        });
      }

      return { flightBookingId: bookingId, dedupAction: action };
    },
    { timeout: 30000 }
  );

  console.log(
    `[write-flight] flight write complete: tripId=${tripId}, confirmationCode=${trimmedCode ?? "null"}, ` +
    `flightBookingId=${flightBookingId}, legs_written=${legs.length}, dedup_action=${dedupAction}`
  );

  return { flightBookingId, legCount: legs.length, dedupAction };
}
