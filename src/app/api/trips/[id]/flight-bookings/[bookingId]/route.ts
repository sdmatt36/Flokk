import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// ── GET /api/trips/[id]/flight-bookings/[bookingId] ───────────────────────────
// Returns FlightBooking + all legs sorted chronologically.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, bookingId } = await params;

  const booking = await db.flightBooking.findUnique({
    where: { id: bookingId },
    include: {
      flights: { orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }] },
    },
  });

  if (!booking || booking.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

// ── PATCH /api/trips/[id]/flight-bookings/[bookingId] ─────────────────────────
// Updates booking-level fields (airline, cabinClass, confirmationCode) and/or
// per-leg fields. All updates run in a single transaction.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, bookingId } = await params;

  const body = await req.json() as {
    airline?: string;
    cabinClass?: string;
    confirmationCode?: string;
    legs?: Array<{
      id: string;
      flightNumber?: string;
      fromAirport?: string;
      fromCity?: string;
      toAirport?: string;
      toCity?: string;
      departureDate?: string;
      departureTime?: string;
      arrivalDate?: string | null;
      arrivalTime?: string | null;
    }>;
  };

  const booking = await db.flightBooking.findUnique({
    where: { id: bookingId },
    select: { id: true, tripId: true },
  });

  if (!booking || booking.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.flightBooking.update({
      where: { id: bookingId },
      data: {
        ...(body.airline !== undefined ? { airline: body.airline } : {}),
        ...(body.cabinClass !== undefined ? { cabinClass: body.cabinClass } : {}),
        ...(body.confirmationCode !== undefined ? { confirmationCode: body.confirmationCode } : {}),
      },
    });

    if (body.legs && body.legs.length > 0) {
      for (const leg of body.legs) {
        await tx.flight.update({
          where: { id: leg.id },
          data: {
            ...(leg.flightNumber !== undefined ? { flightNumber: leg.flightNumber } : {}),
            ...(leg.fromAirport !== undefined ? { fromAirport: leg.fromAirport } : {}),
            ...(leg.fromCity !== undefined ? { fromCity: leg.fromCity } : {}),
            ...(leg.toAirport !== undefined ? { toAirport: leg.toAirport } : {}),
            ...(leg.toCity !== undefined ? { toCity: leg.toCity } : {}),
            ...(leg.departureDate !== undefined ? { departureDate: leg.departureDate } : {}),
            ...(leg.departureTime !== undefined ? { departureTime: leg.departureTime } : {}),
            ...(leg.arrivalDate !== undefined ? { arrivalDate: leg.arrivalDate ?? null } : {}),
            ...(leg.arrivalTime !== undefined ? { arrivalTime: leg.arrivalTime ?? null } : {}),
          },
        });
      }
    }

    return tx.flightBooking.findUnique({
      where: { id: bookingId },
      include: {
        flights: { orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }] },
      },
    });
  }, { timeout: 30000 });

  return NextResponse.json(updated);
}
