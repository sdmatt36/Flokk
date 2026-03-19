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

  // Calculate dayIndex from trip startDate
  let dayIndex: number | null = null;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
  if (trip?.startDate) {
    const start = new Date(trip.startDate);
    start.setHours(0, 0, 0, 0);
    const dep = new Date(departureDate + "T00:00:00");
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
