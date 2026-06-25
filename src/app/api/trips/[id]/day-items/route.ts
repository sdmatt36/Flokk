import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip, getTripAccess } from "@/lib/trip-permissions";
import { buildDayItems } from "@/lib/itinerary/build-day-items";

export const dynamic = "force-dynamic";

export type { DayItemRow } from "@/lib/itinerary/build-day-items";

// ── GET /api/trips/[id]/day-items ─────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const [canView, access] = await Promise.all([
    canViewTrip(profileId, tripId),
    getTripAccess(profileId, tripId),
  ]);
  if (!canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [trip, rawItineraryItems, activities, flights, savedItems] = await Promise.all([
    db.trip.findUnique({ where: { id: tripId }, select: { destinationCity: true, startDate: true, endDate: true } }),
    db.itineraryItem.findMany({
      where: { tripId, cancelledAt: null },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, type: true, title: true, scheduledDate: true,
        departureTime: true, arrivalTime: true,
        fromAirport: true, toAirport: true, fromCity: true, toCity: true,
        confirmationCode: true, address: true, dayIndex: true,
        sortOrder: true, currency: true, imageUrl: true,
        latitude: true, longitude: true,
      },
    }),
    db.manualActivity.findMany({
      where: { tripId, dayIndex: { not: null }, deletedAt: null },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true, title: true, time: true, endTime: true, venueName: true,
        address: true, dayIndex: true, sortOrder: true, type: true, imageUrl: true,
        lat: true, lng: true,
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
        lat: true, lng: true,
      },
    }),
  ]);

  const days = buildDayItems(
    trip ?? { destinationCity: null, startDate: null, endDate: null },
    rawItineraryItems,
    activities,
    flights,
    savedItems,
  );

  if (!access) {
    for (const day of days) {
      for (const item of day.items) {
        item.confirmationCode = null;
      }
    }
  }

  return NextResponse.json({ days });
}
