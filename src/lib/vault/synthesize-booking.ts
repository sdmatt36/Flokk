/**
 * synthesize-booking.ts
 *
 * Phase Vault: unified read synthesizer for the Vault display layer.
 *
 * TripDocument becomes archive-only. The Vault GET endpoint calls
 * synthesizeVaultDocuments() which rebuilds each booking card's content
 * from the authoritative typed source (FlightBooking+Flight, ItineraryItem).
 * TripDocument.content fields fill gaps for fields not yet in typed models
 * (totalCost, currency, guestNames, bookingUrl).
 *
 * Returns the same { id, label, type, url, content } shape the frontend
 * already consumes — frontend render code is unchanged.
 *
 * Vault scope: forwarded confirmation bookings only.
 * ManualActivity, tour stops, and saves are NOT in Vault scope — they have
 * proper homes in the Saved tab, Itinerary, and Tours tab.
 *
 * Phase Vault Multi-Leg:
 * - synthesizeFlightVaultDocument partitions legs by trip date range.
 * - `_flightBookingId` is included in synthesized flight content.
 * - synthesizeOrphanFlightBookingVaultDocument handles FlightBookings that
 *   have no corresponding TripDocument. These get id `flight-booking:{id}`.
 *   PATCH/DELETE in vault/documents/[documentId]/route.ts handle this prefix.
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

// ── FLIGHT synthesizer (TripDocument-backed) ──────────────────────────────────

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
    merged = buildFlightContent(flightBooking, base, tripStartDate, tripEndDate);
  }

  return {
    id: tripDocument.id,
    label: tripDocument.label,
    type: tripDocument.type,
    url: tripDocument.url ?? null,
    content: JSON.stringify(merged),
  };
}

// ── FLIGHT synthesizer (orphan — no TripDocument) ─────────────────────────────
// Used when a FlightBooking exists but no flight-type TripDocument was created
// (e.g. email landed in wrong trip, or pre-Phase-Vault import).

export function synthesizeOrphanFlightBookingVaultDocument(opts: {
  flightBooking: FlightBooking & { flights: Flight[] };
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}): VaultDocument {
  const { flightBooking, tripStartDate, tripEndDate } = opts;
  const content = buildFlightContent(flightBooking, {}, tripStartDate, tripEndDate);
  const first = (content.legs as RawContent[] | undefined)?.[0];

  const label = flightBooking.confirmationCode
    ? `Flight ${flightBooking.confirmationCode}`
    : first
    ? `${String(first.from ?? "")} → ${String((content.legs as RawContent[])[((content.legs as RawContent[]).length - 1)].to ?? "")}`
    : "Flight booking";

  return {
    id: `flight-booking:${flightBooking.id}`,
    label,
    type: "booking",
    url: null,
    content: JSON.stringify(content),
  };
}

// ── Shared flight content builder ─────────────────────────────────────────────

function buildFlightContent(
  flightBooking: FlightBooking & { flights: Flight[] },
  base: RawContent,
  tripStartDate?: string | null,
  tripEndDate?: string | null
): RawContent {
  // Sort all legs chronologically
  let sorted = [...flightBooking.flights].sort((a, b) => {
    const ad = `${a.departureDate}T${a.departureTime || "00:00"}`;
    const bd = `${b.departureDate}T${b.departureTime || "00:00"}`;
    return ad.localeCompare(bd);
  });

  // Partition: keep only legs whose dep or arr date falls within this trip's date range.
  // Fallback to all legs if nothing survives (trip dates not available, or all out of range).
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

  return {
    // Preserve TripDocument-only fields not yet in typed models (empty for orphan cards)
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
    fromAirport: first?.fromAirport ?? null,
    fromCity: first?.fromCity ?? null,
    toAirport: last?.toAirport ?? null,
    toCity: last?.toCity ?? null,
    departureDate: first?.departureDate ?? null,
    departureTime: first?.departureTime ?? null,
    arrivalDate: last?.arrivalDate ?? null,
    arrivalTime: last?.arrivalTime ?? null,
    // flightNumber from first leg — used by legacy EditFlightModal path
    flightNumber: first?.flightNumber ?? null,
    legs,
    // Used by the booking-aware EditFlightModal (Phase Vault Multi-Leg)
    _flightBookingId: flightBooking.id,
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
  // Track conf codes covered by TripDocument-sourced flight bookings for orphan dedup
  const tdFlightConfCodes = new Set<string>();

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

    if (bookingType === "flight") {
      if (confCode) tdFlightConfCodes.add(confCode);
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

  // 3. Append FlightBookings that have no corresponding TripDocument.
  // A FlightBooking is "covered" if its confirmationCode is already in tdFlightConfCodes.
  // Null-confirmationCode bookings are never covered and always appended (if they have legs).
  const allFlightBookings = (await db.flightBooking.findMany({
    where: { tripId },
    include: { flights: true },
    orderBy: { createdAt: "asc" },
  })) as (FlightBooking & { flights: Flight[] })[];

  const fbConfCodesSeen = new Set<string>();
  for (const fb of allFlightBookings) {
    // Skip if a TripDocument-backed flight card already covers this confirmationCode
    if (fb.confirmationCode && tdFlightConfCodes.has(fb.confirmationCode)) continue;
    // Dedup within orphan FlightBookings sharing the same confirmationCode
    if (fb.confirmationCode && fbConfCodesSeen.has(fb.confirmationCode)) continue;
    // Skip bookings with no legs (nothing to display)
    if (fb.flights.length === 0) continue;
    if (fb.confirmationCode) fbConfCodesSeen.add(fb.confirmationCode);
    results.push(
      synthesizeOrphanFlightBookingVaultDocument({ flightBooking: fb, tripStartDate, tripEndDate })
    );
  }

  console.log(
    `[vault-synthesize] tripId=${tripId} tripDocs=${tripDocs.length} orphanFlightBookings=${fbConfCodesSeen.size + allFlightBookings.filter(fb => !fb.confirmationCode && fb.flights.length > 0).length} total=${results.length} tripRange=${tripStartDate ?? "?"}–${tripEndDate ?? "?"}`
  );

  return results;
}
