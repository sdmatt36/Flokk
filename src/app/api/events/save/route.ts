import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canEditTripContent } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  let body: { tripId?: unknown; eventId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tripId, eventId } = body;
  if (typeof tripId !== "string" || typeof eventId !== "string") {
    return NextResponse.json({ error: "tripId and eventId required" }, { status: 400 });
  }

  // Verify the event belongs to a trip owned by this profile
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.tripId !== tripId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Dedup: return existing save if same event already saved for this profile
  if (event.sourceProvider && event.sourceEventId) {
    const existing = await db.savedItem.findFirst({
      where: {
        familyProfileId: profileId,
        eventSourceProvider: event.sourceProvider,
        eventSourceEventId: event.sourceEventId,
        deletedAt: null,
      },
    });
    if (existing) {
      return NextResponse.json({ save: existing, created: false }, { status: 200 });
    }
  }

  const saved = await db.savedItem.create({
    data: {
      familyProfileId: profileId,
      tripId,
      rawTitle: event.title,
      destinationCity: event.segmentCity || null,
      categoryTags: ["event", event.category],
      placePhotoUrl: event.imageUrl ?? null,
      status: "TRIP_ASSIGNED",
      extractionStatus: "PENDING",
      eventDateTime: event.startDateTime,
      eventVenue: event.venue ?? null,
      eventCategory: event.category,
      eventTicketUrl: event.ticketUrl ?? null,
      eventSourceProvider: event.sourceProvider,
      eventSourceEventId: event.sourceEventId,
    },
  });

  return NextResponse.json({ save: saved, created: true }, { status: 201 });
}
