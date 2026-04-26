/**
 * synthesize-booking.ts
 *
 * Phase Vault: unified read synthesizer for the Vault display layer.
 *
 * TripDocument becomes archive-only. The Vault GET endpoint calls
 * synthesizeVaultDocuments() which rebuilds each booking card's content
 * from the authoritative typed source (FlightBooking+Flight, ItineraryItem,
 * ManualActivity). TripDocument.content fields fill gaps for fields not yet
 * in typed models (totalCost, currency, guestNames, bookingUrl).
 *
 * Returns the same { id, label, type, url, content } shape the frontend
 * already consumes — frontend render code for non-flight types is unchanged.
 *
 * Manual activities get synthetic id "manual-activity:{id}". PATCH and DELETE
 * handlers in vault/documents/[documentId]/route.ts detect this prefix and
 * route to ManualActivity directly.
 *
 * Phase Vault Multi-Leg additions:
 * - synthesizeFlightVaultDocument now accepts tripStartDate + tripEndDate.
 *   Only Flight legs whose departureDate or arrivalDate falls within [startDate,
 *   endDate] are included in the synthesized card. This lets the same FHMI74
 *   FlightBooking show different leg projections on the Sri Lanka vs London Vault.
 * - `_flightBookingId` is included in synthesized flight content so the frontend
 *   edit handler can open the booking-aware EditFlightModal.
 *
 * Leg-belongs-to-trip rule:
 *   A Flight leg belongs to a trip T if:
 *     leg.departureDate >= T.startDate AND leg.departureDate <= T.endDate
 *     OR
 *     leg.arrivalDate >= T.startDate AND leg.arrivalDate <= T.endDate
 *   Dates compared as YYYY-MM-DD strings (lexical ISO comparison is correct for
 *   full date strings). If no legs survive the filter, all legs are included as
 *   a defensive fallback.
 */

import type {
  TripDocument,
  ItineraryItem,
  ManualActivity,
  FlightBooking,
  Flight,
} from "@prisma/client";
import { db as defaultDb } from "@/lib/db";

export type VaultDocument = {
  id: string;
  label: string;
  type: string;
  url: string | null;
  content: string;
};

type RawContent = Record<string, unknown>;

function parseContent(raw: string | null | undefined): RawContent {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RawContent;
  } catch {
    return {};
  }
}

// ── FLIGHT synthesizer ────────────────────────────────────────────────────────

export function synthesizeFlightVaultDocument(opts: {
  tripDocument: TripDocument;
  flightBooking?: (FlightBooking & { flights: Flight[] }) | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}): VaultDocument {
  const { tripDocument, flightBooking, tripStartDate, tripEndDate } = opts;
  const base = parseContent(tripDocument.content);

  let merged: RawContent = { ...base };

  if (flightBooking && flightBooking.flights.length > 0) {
    // Sort all legs chronologically
    let sorted = [...flightBooking.flights].sort((a, b) => {
      const ad = `${a.departureDate}T${a.departureTime || "00:00"}`;
      const bd = `${b.departureDate}T${b.departureTime || "00:00"}`;
      return ad.localeCompare(bd);
    });

    // Partition: keep only legs whose dep or arr date falls within this trip's date range.
    // Fallback to all legs if nothing survives (e.g. trip dates not available).
    if (tripStartDate && tripEndDate) {
      const filtered = sorted.filter((f) => {
        const dep = f.departureDate; // YYYY-MM-DD
        const arr = f.arrivalDate;   // YYYY-MM-DD | null
        return (
          (dep >= tripStartDate && dep <= tripEndDate) ||
          (!!arr && arr >= tripStartDate && arr <= tripEndDate)
        );
      });
      if (filtered.length > 0) sorted = filtered;
      // else: defensive fallback — show all legs rather than empty card
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const legs = sorted.map((f) => ({
      from: f.fromAirport,
      fromCity: f.fromCity,
      to: f.toAirport,
      toCity: f.toCity,
      flightNumber: f.flightNumber,
      airline: f.airline,
      departureDate: f.departureDate,
      departureTime: f.departureTime,
      arrivalDate: f.arrivalDate ?? null,
      arrivalTime: f.arrivalTime ?? null,
    }));

    merged = {
      // Preserve TripDocument-only fields not yet in typed models
      totalCost: base.totalCost ?? null,
      currency: base.currency ?? null,
      guestNames: base.guestNames ?? [],
      bookingUrl: base.bookingUrl ?? null,
      // Override route/time fields from typed model (authoritative)
      type: "flight",
      vendorName: flightBooking.airline ?? base.vendorName ?? null,
      airline: flightBooking.airline ?? base.airline ?? null,
      confirmationCode: flightBooking.confirmationCode ?? base.confirmationCode ?? null,
      cabinClass: flightBooking.cabinClass ?? base.cabinClass ?? null,
      fromAirport: first.fromAirport,
      fromCity: first.fromCity,
      toAirport: last.toAirport,
      toCity: last.toCity,
      departureDate: first.departureDate,
      departureTime: first.departureTime,
      arrivalDate: last.arrivalDate ?? null,
      arrivalTime: last.arrivalTime ?? null,
      // flightNumber from first leg — frontend uses this to match Flight record
      // for the legacy EditFlightModal path (flights.find by flightNumber)
      flightNumber: first.flightNumber,
      legs,
      // Used by the booking-aware EditFlightModal path (Phase Vault Multi-Leg)
      _flightBookingId: flightBooking.id,
    };
  }

  return {
    id: tripDocument.id,
    label: tripDocument.label,
    type: tripDocument.type,
    url: tripDocument.url ?? null,
    content: JSON.stringify(merged),
  };
}

// ── HOTEL synthesizer ─────────────────────────────────────────────────────────

export function synthesizeHotelVaultDocument(opts: {
  tripDocument: TripDocument;
  checkInItem?: ItineraryItem | null;
  checkOutItem?: ItineraryItem | null;
}): VaultDocument {
  const { tripDocument, checkInItem, checkOutItem } = opts;
  const base = parseContent(tripDocument.content);

  const merged: RawContent = { ...base, type: "hotel" };

  if (checkInItem) {
    // scheduledDate on check-in ItineraryItem is authoritative for check-in date
    if (checkInItem.scheduledDate) merged.checkIn = checkInItem.scheduledDate;
    if (checkInItem.address) merged.address = checkInItem.address;
    if (checkInItem.confirmationCode) merged.confirmationCode = checkInItem.confirmationCode;
  }

  if (checkOutItem) {
    if (checkOutItem.scheduledDate) merged.checkOut = checkOutItem.scheduledDate;
  }

  return {
    id: tripDocument.id,
    label: tripDocument.label,
    type: tripDocument.type,
    url: tripDocument.url ?? null,
    content: JSON.stringify(merged),
  };
}

// ── ACTIVITY / TRAIN / CAR_RENTAL / RESTAURANT synthesizer ───────────────────

export function synthesizeActivityLikeVaultDocument(opts: {
  tripDocument: TripDocument;
  itineraryItem?: ItineraryItem | null;
  bookingType: string;
}): VaultDocument {
  const { tripDocument, itineraryItem, bookingType } = opts;
  const base = parseContent(tripDocument.content);

  const merged: RawContent = { ...base };

  if (itineraryItem) {
    if (itineraryItem.confirmationCode) merged.confirmationCode = itineraryItem.confirmationCode;
    if (itineraryItem.scheduledDate) merged.departureDate = itineraryItem.scheduledDate;
    if (itineraryItem.departureTime) merged.departureTime = itineraryItem.departureTime;
    if (itineraryItem.arrivalTime) merged.arrivalTime = itineraryItem.arrivalTime;
    if (itineraryItem.address) merged.address = itineraryItem.address;

    if (bookingType === "train" || bookingType === "car_rental") {
      if (itineraryItem.fromCity) merged.fromCity = itineraryItem.fromCity;
      if (itineraryItem.toCity) merged.toCity = itineraryItem.toCity;
      if (itineraryItem.fromAirport) merged.fromAirport = itineraryItem.fromAirport;
      if (itineraryItem.toAirport) merged.toAirport = itineraryItem.toAirport;
      if (itineraryItem.arrivalTime) merged.arrivalTime = itineraryItem.arrivalTime;
    }

    // For activity: prefer ItineraryItem.title as activityName if not already set
    if (bookingType === "activity" && itineraryItem.title && !merged.activityName) {
      merged.activityName = itineraryItem.title;
    }
  }

  return {
    id: tripDocument.id,
    label: tripDocument.label,
    type: tripDocument.type,
    url: tripDocument.url ?? null,
    content: JSON.stringify(merged),
  };
}

// ── MANUAL ACTIVITY synthesizer ───────────────────────────────────────────────

export function synthesizeManualActivityVaultDocument(ma: ManualActivity): VaultDocument {
  const content: RawContent = {
    type: "activity",
    activityName: ma.title,
    vendorName: ma.venueName ?? null,
    address: ma.address ?? null,
    departureDate: ma.date,
    departureTime: ma.time ?? null,
    arrivalTime: ma.endTime ?? null,
    totalCost: ma.price ?? null,
    currency: ma.currency ?? null,
    confirmationCode: ma.confirmationCode ?? null,
    bookingUrl: ma.website ?? null,
    _source: "manual-activity",
    _manualActivityId: ma.id,
  };

  return {
    id: `manual-activity:${ma.id}`,
    label: ma.title,
    type: "booking",
    url: ma.website ?? null,
    content: JSON.stringify(content),
  };
}

// ── ORCHESTRATOR ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function synthesizeVaultDocuments(tripId: string, prisma?: any): Promise<VaultDocument[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma ?? defaultDb;

  // 1. Fetch trip date range for leg partitioning (flight synthesizer only)
  const trip = (await db.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true, endDate: true },
  })) as { startDate: Date | null; endDate: Date | null } | null;

  const tripStartDate = trip?.startDate
    ? new Date(trip.startDate).toISOString().slice(0, 10)
    : null;
  const tripEndDate = trip?.endDate
    ? new Date(trip.endDate).toISOString().slice(0, 10)
    : null;

  // 2. Fetch all TripDocument rows for this trip (preserve existing sort order)
  const tripDocs = (await db.tripDocument.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
  })) as TripDocument[];

  const results: VaultDocument[] = [];
  // Track conf codes already covered by TripDocument-sourced bookings for de-dup
  const tdConfCodes = new Set<string>();

  for (const doc of tripDocs) {
    if (doc.type !== "booking") {
      // Non-booking docs (link, note, operator_plan): return as-is, no synthesis
      results.push({
        id: doc.id,
        label: doc.label,
        type: doc.type,
        url: doc.url ?? null,
        content: doc.content ?? "",
      });
      continue;
    }

    const base = parseContent(doc.content);
    const bookingType = ((base.type as string | undefined) ?? "").toLowerCase();
    const confCode = (base.confirmationCode as string | null | undefined) ?? null;

    if (confCode) tdConfCodes.add(confCode);

    if (bookingType === "flight") {
      const flightBooking = confCode
        ? ((await db.flightBooking.findUnique({
            where: { unique_trip_confirmation: { tripId, confirmationCode: confCode } },
            include: { flights: true },
          })) as (FlightBooking & { flights: Flight[] }) | null)
        : null;
      results.push(
        synthesizeFlightVaultDocument({
          tripDocument: doc,
          flightBooking,
          tripStartDate,
          tripEndDate,
        })
      );

    } else if (bookingType === "hotel") {
      const items = confCode
        ? ((await db.itineraryItem.findMany({
            where: { tripId, confirmationCode: confCode, type: "LODGING" },
          })) as ItineraryItem[])
        : [];
      const checkInItem =
        items.find((i: ItineraryItem) => i.title?.startsWith("Check-in:")) ?? null;
      const checkOutItem =
        items.find((i: ItineraryItem) => i.title?.startsWith("Check-out:")) ?? null;
      results.push(synthesizeHotelVaultDocument({ tripDocument: doc, checkInItem, checkOutItem }));

    } else if (["activity", "train", "car_rental", "restaurant"].includes(bookingType)) {
      // ItineraryItem.type is uppercase: ACTIVITY, TRAIN, CAR_RENTAL, RESTAURANT
      const itemType = bookingType.toUpperCase();
      const itineraryItem = confCode
        ? ((await db.itineraryItem.findFirst({
            where: { tripId, confirmationCode: confCode, type: itemType },
          })) as ItineraryItem | null)
        : null;
      results.push(
        synthesizeActivityLikeVaultDocument({ tripDocument: doc, itineraryItem, bookingType })
      );

    } else {
      // Unknown booking type — return TripDocument as-is (defensive fallback)
      results.push({
        id: doc.id,
        label: doc.label,
        type: doc.type,
        url: doc.url ?? null,
        content: doc.content ?? "",
      });
    }
  }

  // 3. Append ManualActivity rows as synthetic booking docs
  // De-dup: skip if a TripDocument-sourced booking shares the same confirmationCode
  const manualActivities = (await db.manualActivity.findMany({
    where: { tripId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  })) as ManualActivity[];

  for (const ma of manualActivities) {
    if (ma.confirmationCode && tdConfCodes.has(ma.confirmationCode)) continue;
    results.push(synthesizeManualActivityVaultDocument(ma));
  }

  console.log(
    `[vault-synthesize] tripId=${tripId} tripDocs=${tripDocs.length} manualActivities=${manualActivities.length} total=${results.length} tripRange=${tripStartDate ?? "?"}–${tripEndDate ?? "?"}`
  );

  return results;
}
