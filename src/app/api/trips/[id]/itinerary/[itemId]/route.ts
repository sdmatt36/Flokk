import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// PATCH /api/trips/[id]/itinerary/[itemId]
// Updates dayIndex (and optionally other fields) on an ItineraryItem.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { dayIndex, sortOrder, title, departureTime, scheduledDate, notes } = body;

  const updated = await db.itineraryItem.update({
    where: { id: itemId },
    data: {
      ...(dayIndex !== undefined ? { dayIndex: dayIndex as number } : {}),
      ...(sortOrder !== undefined ? { sortOrder: sortOrder as number } : {}),
      ...(title !== undefined ? { title: title as string } : {}),
      ...(departureTime !== undefined ? { departureTime: (departureTime as string | null) ?? null } : {}),
      ...(scheduledDate !== undefined ? { scheduledDate: (scheduledDate as string | null) ?? null } : {}),
      ...(notes !== undefined ? { notes: (notes as string | null) ?? null } : {}),
    },
  });

  // Geocode from address if coords are missing (fires after save so new coords appear on next load)
  if (updated.latitude == null && updated.address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(updated.address)}&key=${apiKey}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json() as { results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };
        const loc = geoData.results?.[0]?.geometry?.location;
        if (loc?.lat && loc?.lng) {
          const withCoords = await db.itineraryItem.update({ where: { id: itemId }, data: { latitude: loc.lat, longitude: loc.lng } });
          return NextResponse.json({ item: withCoords });
        }
      } catch { /* geocoding optional */ }
    }
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, itemId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch item to check cost before deleting (for budget decrement)
  const item = await db.itineraryItem.findUnique({
    where: { id: itemId },
    select: { totalCost: true, type: true, title: true },
  });

  await db.itineraryItem.delete({ where: { id: itemId } });

  // Decrement budgetSpent — skip LODGING check-out to avoid double-counting (cost stored on check-in too)
  const isLodgingCheckout = item?.type === "LODGING" && /^check-out:/i.test(item.title ?? "");
  if (item?.totalCost && item.totalCost > 0 && !isLodgingCheckout) {
    await db.trip.update({
      where: { id: tripId },
      data: { budgetSpent: { decrement: item.totalCost } },
    });
  }

  return NextResponse.json({ success: true });
}
