import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const FLIGHT_BOOKING_PREFIX = "flight-booking:";

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, documentId } = await params;
  const body = await req.json() as { content?: string; label?: string };

  // ── flight-booking: synthetic doc — edits go through the dedicated endpoint ──
  if (documentId.startsWith(FLIGHT_BOOKING_PREFIX)) {
    return NextResponse.json(
      { error: "Use /api/trips/[id]/flight-bookings/[bookingId] to edit flight bookings" },
      { status: 400 }
    );
  }

  // ── Regular TripDocument PATCH ────────────────────────────────────────────
  const updated = await db.$transaction(async (tx) => {
    const doc = await tx.tripDocument.update({
      where: { id: documentId },
      data: {
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.label !== undefined ? { label: body.label } : {}),
      },
    });

    // Sync SavedItem rawTitle/website if linked (existing behavior)
    if (doc.savedItemId && body.content !== undefined) {
      try {
        const parsed = JSON.parse(body.content) as Record<string, unknown>;
        const vendorName = typeof parsed?.vendorName === "string" ? parsed.vendorName : null;
        const websiteUrl = typeof parsed?.websiteUrl === "string" ? parsed.websiteUrl : null;
        await tx.savedItem.update({
          where: { id: doc.savedItemId },
          data: {
            ...(vendorName ? { rawTitle: vendorName } : {}),
            websiteUrl: websiteUrl,
          },
        });
      } catch { /* ignore malformed content */ }
    }

    // Write-through to typed sources for fields the synthesizer reads
    if (body.content !== undefined && doc.type === "booking") {
      try {
        const parsed = JSON.parse(body.content) as Record<string, unknown>;
        const bookingType = ((parsed.type as string | undefined) ?? "").toLowerCase();
        const confCode = (parsed.confirmationCode as string | null | undefined) ?? null;

        if (bookingType === "hotel" && confCode) {
          const lodgingItems = await tx.itineraryItem.findMany({
            where: { tripId, confirmationCode: confCode, type: "LODGING" },
            select: { id: true, title: true },
          });
          for (const item of lodgingItems) {
            if (item.title?.startsWith("Check-in:") && parsed.checkIn) {
              await tx.itineraryItem.update({
                where: { id: item.id },
                data: { scheduledDate: parsed.checkIn as string },
              });
            }
            if (item.title?.startsWith("Check-out:") && parsed.checkOut) {
              await tx.itineraryItem.update({
                where: { id: item.id },
                data: { scheduledDate: parsed.checkOut as string },
              });
            }
          }

        } else if (["activity", "train", "car_rental"].includes(bookingType) && confCode) {
          const itItem = await tx.itineraryItem.findFirst({
            where: { tripId, confirmationCode: confCode, type: bookingType.toUpperCase() },
            select: { id: true },
          });
          if (itItem) {
            await tx.itineraryItem.update({
              where: { id: itItem.id },
              data: {
                ...(parsed.departureDate ? { scheduledDate: parsed.departureDate as string } : {}),
                ...(parsed.departureTime ? { departureTime: parsed.departureTime as string } : {}),
                ...(parsed.arrivalTime ? { arrivalTime: parsed.arrivalTime as string } : {}),
                ...(["train", "car_rental"].includes(bookingType) && parsed.fromCity
                  ? { fromCity: parsed.fromCity as string }
                  : {}),
                ...(["train", "car_rental"].includes(bookingType) && parsed.toCity
                  ? { toCity: parsed.toCity as string }
                  : {}),
              },
            });
          }
        }
        // Note: flight edits go through EditFlightModal → PATCH /api/trips/[id]/flight-bookings/[bookingId]
        // which updates FlightBooking + Flight directly. Vault PATCH for flights only archives TripDocument.
      } catch { /* ignore write-through failures — TripDocument update already succeeded */ }
    }

    return doc;
  }, { timeout: 30000 });

  return NextResponse.json(updated);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, documentId } = await params;

  // ── flight-booking: synthetic doc — delete FlightBooking + its Flight rows ──
  if (documentId.startsWith(FLIGHT_BOOKING_PREFIX)) {
    const fbId = documentId.slice(FLIGHT_BOOKING_PREFIX.length);
    const fb = await db.flightBooking.findUnique({
      where: { id: fbId },
      select: { id: true, tripId: true },
    });
    if (!fb || fb.tripId !== tripId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.$transaction(async (tx) => {
      // Flight rows cascade-delete via FK, but explicit delete is safe too
      await tx.flight.deleteMany({ where: { flightBookingId: fbId } });
      await tx.flightBooking.delete({ where: { id: fbId } });
    }, { timeout: 30000 });
    return NextResponse.json({ success: true });
  }

  // ── Regular TripDocument DELETE ───────────────────────────────────────────
  await db.$transaction(async (tx) => {
    const doc = await tx.tripDocument.findUnique({ where: { id: documentId } });
    if (!doc) return;

    if (doc.type === "booking" && doc.content) {
      try {
        const parsed = JSON.parse(doc.content) as Record<string, unknown>;
        const confCode = (parsed.confirmationCode as string | null | undefined) ?? null;
        const bookingType = ((parsed.type as string | undefined) ?? "").toLowerCase();

        if (confCode) {
          // Delete linked ItineraryItems (all booking types)
          await tx.itineraryItem.deleteMany({ where: { tripId, confirmationCode: confCode } });

          // Additionally cascade to FlightBooking + Flight for flight type (FM-2 fix)
          if (bookingType === "flight") {
            const flightBooking = await tx.flightBooking.findUnique({
              where: { unique_trip_confirmation: { tripId, confirmationCode: confCode } },
              select: { id: true },
            });
            if (flightBooking) {
              await tx.flightBooking.delete({ where: { id: flightBooking.id } });
              console.log(
                `[vault-delete] cascaded FlightBooking ${flightBooking.id} (code=${confCode})`
              );
            }
          }
        }
      } catch { /* ignore malformed content */ }
    }

    await tx.tripDocument.delete({ where: { id: documentId } });
  }, { timeout: 30000 });

  return NextResponse.json({ success: true });
}
