import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const MANUAL_ACTIVITY_PREFIX = "manual-activity:";

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId, documentId } = await params;
  const body = await req.json() as { content?: string; label?: string };

  // ── Manual activity: synthetic doc, route to ManualActivity directly ──
  if (documentId.startsWith(MANUAL_ACTIVITY_PREFIX)) {
    const maId = documentId.slice(MANUAL_ACTIVITY_PREFIX.length);
    const parsed = (() => {
      try { return JSON.parse(body.content ?? "{}") as Record<string, unknown>; } catch { return {}; }
    })();

    const updated = await db.manualActivity.update({
      where: { id: maId },
      data: {
        ...(body.label ? { title: body.label } : {}),
        ...(parsed.activityName && typeof parsed.activityName === "string"
          ? { title: parsed.activityName }
          : {}),
        ...(parsed.address && typeof parsed.address === "string"
          ? { address: parsed.address }
          : {}),
        ...(parsed.departureDate && typeof parsed.departureDate === "string"
          ? { date: parsed.departureDate }
          : {}),
        ...(parsed.departureTime && typeof parsed.departureTime === "string"
          ? { time: parsed.departureTime }
          : {}),
        ...(parsed.arrivalTime && typeof parsed.arrivalTime === "string"
          ? { endTime: parsed.arrivalTime }
          : {}),
        ...(typeof parsed.totalCost === "number" ? { price: parsed.totalCost } : {}),
        ...(parsed.currency && typeof parsed.currency === "string"
          ? { currency: parsed.currency }
          : {}),
        ...(parsed.confirmationCode !== undefined
          ? { confirmationCode: (parsed.confirmationCode as string | null) ?? null }
          : {}),
      },
    });

    // Return a synthetic VaultDocument shape matching what the frontend expects
    const content: Record<string, unknown> = {
      type: "activity",
      activityName: updated.title,
      vendorName: updated.venueName ?? null,
      address: updated.address ?? null,
      departureDate: updated.date,
      departureTime: updated.time ?? null,
      arrivalTime: updated.endTime ?? null,
      totalCost: updated.price ?? null,
      currency: updated.currency ?? null,
      confirmationCode: updated.confirmationCode ?? null,
      bookingUrl: updated.website ?? null,
      _source: "manual-activity",
      _manualActivityId: updated.id,
    };
    return NextResponse.json({
      id: `${MANUAL_ACTIVITY_PREFIX}${updated.id}`,
      label: updated.title,
      type: "booking",
      url: updated.website ?? null,
      content: JSON.stringify(content),
    });
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
          // Write through checkIn → LODGING check-in ItineraryItem.scheduledDate
          // Write through checkOut → LODGING check-out ItineraryItem.scheduledDate
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
          // Write through date/time changes to ItineraryItem
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
        // Note: flight edits go through EditFlightModal → PATCH /api/trips/[id]/flights/[flightId]
        // which updates Flight directly. The Vault PATCH for flights only archives TripDocument.
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

  // ── Manual activity: synthetic doc, soft-delete ManualActivity ──
  if (documentId.startsWith(MANUAL_ACTIVITY_PREFIX)) {
    const maId = documentId.slice(MANUAL_ACTIVITY_PREFIX.length);
    await db.manualActivity.update({
      where: { id: maId },
      data: { deletedAt: new Date() },
    });
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
              // Flight rows cascade-delete via FK when FlightBooking is deleted
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
