import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

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

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
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
    },
  });

  return NextResponse.json({ items });
}
