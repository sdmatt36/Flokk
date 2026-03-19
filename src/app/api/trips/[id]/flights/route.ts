import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const flights = await db.flight.findMany({
    where: { tripId },
    orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
  });

  return NextResponse.json(flights);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const body = await request.json();
  const {
    type,
    airline,
    flightNumber,
    fromAirport,
    fromCity,
    toAirport,
    toCity,
    departureDate,
    departureTime,
    arrivalDate,
    arrivalTime,
    duration,
    cabinClass,
    confirmationCode,
    seatNumbers,
    notes,
    status,
  } = body;

  if (!flightNumber || !fromAirport || !toAirport || !departureDate || !departureTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Calculate dayIndex from trip startDate.
  // Dates are stored as midnight JST (T15:00:00.000Z). Add 12h before extracting
  // UTC fields to get the correct calendar day regardless of server timezone.
  let dayIndex: number | null = null;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
  if (trip?.startDate) {
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
    const [dy, dm, dd] = departureDate.split("-").map(Number);
    const dep = new Date(dy, dm - 1, dd);
    const diff = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    dayIndex = diff + 1; // Day 1 = trip start date
  }

  const flight = await db.flight.create({
    data: {
      tripId,
      type: type ?? "outbound",
      airline: airline ?? "",
      flightNumber,
      fromAirport,
      fromCity: fromCity ?? fromAirport,
      toAirport,
      toCity: toCity ?? toAirport,
      departureDate,
      departureTime,
      arrivalDate: arrivalDate ?? null,
      arrivalTime: arrivalTime ?? null,
      duration: duration ?? null,
      cabinClass: cabinClass ?? "economy",
      confirmationCode: confirmationCode ?? null,
      seatNumbers: seatNumbers ?? null,
      notes: notes ?? null,
      dayIndex,
      status: status ?? "saved",
    },
  });

  return NextResponse.json(flight, { status: 201 });
}
