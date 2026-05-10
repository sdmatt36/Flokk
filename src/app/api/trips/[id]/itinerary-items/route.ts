import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip, canEditTripContent } from "@/lib/trip-permissions";
import { inferLodgingType } from "@/lib/infer-lodging-type";

export const dynamic = "force-dynamic";

// GET /api/trips/[id]/itinerary-items
// Returns all ItineraryItems for the trip except FLIGHT (those are covered by Flight records).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  if (!(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await db.itineraryItem.findMany({
    where: { tripId },
    orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      scheduledDate: true,
      departureTime: true,
      arrivalTime: true,
      fromAirport: true,
      toAirport: true,
      fromCity: true,
      toCity: true,
      confirmationCode: true,
      notes: true,
      address: true,
      totalCost: true,
      currency: true,
      passengers: true,
      dayIndex: true,
      latitude: true,
      longitude: true,
      arrivalLat: true,
      arrivalLng: true,
      sortOrder: true,
      needsVerification: true,
      bookingSource: true,
      managementUrl: true,
      imageUrl: true,
      status: true,
      lodgingType: true,
    },
  });

  return NextResponse.json({ items });
}

// POST /api/trips/[id]/itinerary-items
// Manually creates a LODGING entry (check-in + check-out pair).
// sourceType: MANUAL, bookingSource: direct.
// check-in time -> arrivalTime; check-out time -> departureTime (matches email-inbound convention).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true, familyProfileId: true },
  });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const body = await req.json() as {
    type?: string;
    propertyName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
    address?: string;
    confirmationCode?: string;
    totalCost?: number;
    currency?: string;
    notes?: string;
    venueUrl?: string;
    status?: string;
  };

  if (body.type !== "LODGING") {
    return NextResponse.json({ error: "Only LODGING type supported in v1" }, { status: 400 });
  }

  const { propertyName, checkInDate, checkOutDate } = body;
  if (!propertyName?.trim() || !checkInDate || !checkOutDate) {
    return NextResponse.json(
      { error: "propertyName, checkInDate, and checkOutDate are required" },
      { status: 400 }
    );
  }

  // Compute dayIndex using the T+12h timezone-safe pattern (matches activities route)
  function computeDayIndex(dateStr: string): number | null {
    if (!trip?.startDate) return null;
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const start = new Date(
      shiftedStart.getUTCFullYear(),
      shiftedStart.getUTCMonth(),
      shiftedStart.getUTCDate()
    );
    const [y, m, d] = dateStr.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    return Math.round((day.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  const checkInDay = computeDayIndex(checkInDate);
  const checkOutDay = computeDayIndex(checkOutDate);

  if (checkInDay !== null && checkOutDay !== null && checkOutDay <= checkInDay) {
    return NextResponse.json(
      { error: "Check-out date must be after check-in date" },
      { status: 400 }
    );
  }

  const arrivalTime = body.checkInTime || "15:00";
  const departureTime = body.checkOutTime || "11:00";
  const finalStatus = body.status || "BOOKED";
  const finalCurrency = body.currency || "USD";
  const name = propertyName.trim();

  const manualLodgingType = inferLodgingType({
    url: body.venueUrl?.trim() || null,
    name,
  });

  const result = await db.$transaction(async (tx) => {
    const checkIn = await tx.itineraryItem.create({
      data: {
        tripId,
        familyProfileId: trip.familyProfileId,
        type: "LODGING",
        title: `Check-in: ${name}`,
        scheduledDate: checkInDate,
        arrivalTime,
        address: body.address?.trim() || null,
        confirmationCode: body.confirmationCode?.trim() || null,
        totalCost: body.totalCost ?? null,
        currency: finalCurrency,
        notes: body.notes?.trim() || null,
        venueUrl: body.venueUrl?.trim() || null,
        dayIndex: checkInDay,
        sourceType: "MANUAL",
        bookingSource: "direct",
        status: finalStatus,
        sortOrder: 0,
        needsVerification: false,
        lodgingType: manualLodgingType,
      },
    });

    const checkOut = await tx.itineraryItem.create({
      data: {
        tripId,
        familyProfileId: trip.familyProfileId,
        type: "LODGING",
        title: `Check-out: ${name}`,
        scheduledDate: checkOutDate,
        departureTime,
        address: body.address?.trim() || null,
        confirmationCode: body.confirmationCode?.trim() || null,
        totalCost: body.totalCost ?? null,
        currency: finalCurrency,
        notes: body.notes?.trim() || null,
        venueUrl: body.venueUrl?.trim() || null,
        dayIndex: checkOutDay,
        sourceType: "MANUAL",
        bookingSource: "direct",
        status: finalStatus,
        sortOrder: 0,
        needsVerification: false,
        lodgingType: manualLodgingType,
      },
    });

    // Companion TripDocument so manual entries appear in Vault Imported Bookings.
    // Base content populated here so synthesizer renders correctly even if confirmationCode
    // is null (lookup path in synthesizeHotelVaultDocument falls back to base content).
    await tx.tripDocument.create({
      data: {
        tripId,
        label: name,
        type: "booking",
        content: JSON.stringify({
          type: "hotel",
          vendorName: name,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          address: body.address?.trim() || null,
          confirmationCode: body.confirmationCode?.trim() || null,
          totalCost: body.totalCost ?? null,
          currency: finalCurrency,
          bookingSource: "direct",
          guestNames: [],
          source: "manual",
          itineraryItemIds: [checkIn.id, checkOut.id],
        }),
      },
    });

    return { checkIn, checkOut };
  });

  return NextResponse.json({
    checkIn: { id: result.checkIn.id, dayIndex: result.checkIn.dayIndex },
    checkOut: { id: result.checkOut.id, dayIndex: result.checkOut.dayIndex },
  });
}
