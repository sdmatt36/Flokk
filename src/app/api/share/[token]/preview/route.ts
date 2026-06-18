import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDayItems } from "@/lib/itinerary/build-day-items";

export const dynamic = "force-dynamic";

// ── GET /api/share/[token]/preview ────────────────────────────────────────────
//
// Public JSON preview of a shared trip's days and stops.
// No auth required — possessing the shareToken is the access grant.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const trip = await db.trip.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      heroImageUrl: true,
      isAnonymous: true,
      startDate: true,
      endDate: true,
      familyProfile: { select: { familyName: true } },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tripId = trip.id;

  const [rawItineraryItems, activities, flights, savedItems] = await Promise.all([
    db.itineraryItem.findMany({
      where: { tripId, cancelledAt: null },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, type: true, title: true, scheduledDate: true,
        departureTime: true, arrivalTime: true,
        fromAirport: true, toAirport: true, fromCity: true, toCity: true,
        confirmationCode: true, address: true, dayIndex: true,
        sortOrder: true, currency: true, imageUrl: true,
      },
    }),
    db.manualActivity.findMany({
      where: { tripId, dayIndex: { not: null }, deletedAt: null },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, title: true, time: true, endTime: true, venueName: true,
        address: true, dayIndex: true, sortOrder: true, type: true, imageUrl: true,
        savedItem: { select: { id: true, categoryTags: true } },
      },
    }),
    db.flight.findMany({
      where: { tripId, dayIndex: { not: null } },
      orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
      select: {
        id: true, type: true, airline: true, flightNumber: true,
        fromAirport: true, toAirport: true, fromCity: true, toCity: true,
        departureTime: true, arrivalTime: true,
        confirmationCode: true, dayIndex: true, sortOrder: true,
      },
    }),
    db.savedItem.findMany({
      where: { tripId, dayIndex: { not: null }, deletedAt: null, sourceMethod: { not: "manual_activity" } },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }, { savedAt: "asc" }],
      select: {
        id: true, rawTitle: true, rawDescription: true, startTime: true, endTime: true,
        categoryTags: true, tourId: true, dayIndex: true, sortOrder: true,
        placePhotoUrl: true, address: true,
      },
    }),
  ]);

  const days = buildDayItems(trip, rawItineraryItems, activities, flights, savedItems);

  return NextResponse.json({
    title: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    heroImageUrl: trip.heroImageUrl,
    isAnonymous: trip.isAnonymous,
    familyName: trip.isAnonymous ? null : (trip.familyProfile?.familyName ?? null),
    days,
  });
}
