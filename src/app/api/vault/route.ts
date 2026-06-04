import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { synthesizeVaultDocuments } from "@/lib/vault/synthesize-booking";
import type { VaultDocument } from "@/lib/vault/synthesize-booking";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // per-trip synthesizer calls; optimize later if needed

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// ── Types ─────────────────────────────────────────────────────────────────────

type FlightLeg = {
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  flightNumber: string;
  airline: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string | null;
  arrivalTime: string | null;
};

type FlightCard = {
  id: string;
  bookingType: "flight";
  airline: string | null;
  confirmationCode: string | null;
  cabinClass: string | null;
  legs: FlightLeg[];
};

type HotelCard = {
  id: string;
  bookingType: "hotel";
  property: string;
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  confirmationCode: string | null;
  additionalConfirmations: string[];
  roomCount: number;
  bookingSource: string | null;
};

type OtherCard = {
  id: string;
  bookingType: string;
  label: string;
  content: Record<string, unknown>;
};

type BookingCard = FlightCard | HotelCard | OtherCard;

type TripVaultEntry = {
  tripId: string;
  tripName: string;
  tripStartDate: string | null;
  tripEndDate: string | null;
  bookings: BookingCard[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseContent(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function computeNights(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const diff = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  );
  return diff > 0 ? diff : null;
}

function normalizeLodgingLabel(label: string): string {
  return label
    .replace(/^check-(?:in|out):\s*/i, "")
    .trim()
    .toLowerCase();
}

// ── Hotel merge ───────────────────────────────────────────────────────────────
// Collapses VaultDocuments for the same property + same check-in date into one
// card. Secondary cards are removed; their confirmationCodes are carried in
// `additionalConfirmations` on the primary. `roomCount` reflects the group size.
// Preserves original synthesizer order — primary stays at its first position.

type EnrichedVaultDocument = VaultDocument & {
  additionalConfirmations: string[];
  roomCount: number;
};

function applyHotelMerge(docs: VaultDocument[]): EnrichedVaultDocument[] {
  const hotelDocs = docs.filter(
    (d) => str(parseContent(d.content).type)?.toLowerCase() === "hotel",
  );

  const groups = new Map<string, VaultDocument[]>();
  for (const doc of hotelDocs) {
    const checkIn = str(parseContent(doc.content).checkIn) ?? "";
    const key = normalizeLodgingLabel(doc.label) + "|" + checkIn;
    const existing = groups.get(key) ?? [];
    existing.push(doc);
    groups.set(key, existing);
  }

  const mergedIds = new Set<string>();
  const mergeMap = new Map<
    string,
    { additionalConfirmations: string[]; roomCount: number }
  >();

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    // Primary election: stable lexicographic id (same stability as mergeDuplicateLodging)
    const sorted = [...group].sort((a, b) => (a.id < b.id ? -1 : 1));
    const primary = sorted[0];
    const secondaries = sorted.slice(1);
    mergeMap.set(primary.id, {
      additionalConfirmations: secondaries
        .map((s) => str(parseContent(s.content).confirmationCode))
        .filter((c): c is string => c !== null),
      roomCount: group.length,
    });
    for (const sec of secondaries) mergedIds.add(sec.id);
  }

  return docs
    .filter((d) => !mergedIds.has(d.id))
    .map((d) => ({
      ...d,
      additionalConfirmations: mergeMap.get(d.id)?.additionalConfirmations ?? [],
      roomCount: mergeMap.get(d.id)?.roomCount ?? 1,
    }));
}

// ── Card shapers ──────────────────────────────────────────────────────────────

function shapeFlightCard(doc: EnrichedVaultDocument): FlightCard {
  const c = parseContent(doc.content);
  return {
    id: doc.id,
    bookingType: "flight",
    airline: str(c.airline),
    confirmationCode: str(c.confirmationCode),
    cabinClass: str(c.cabinClass),
    legs: (c.legs as FlightLeg[] | undefined) ?? [],
  };
}

function shapeHotelCard(
  doc: EnrichedVaultDocument,
  tripCity: string | null,
): HotelCard {
  const c = parseContent(doc.content);
  const checkIn = str(c.checkIn);
  const checkOut = str(c.checkOut);
  return {
    id: doc.id,
    bookingType: "hotel",
    property: doc.label,
    city: tripCity,
    checkIn,
    checkOut,
    nights: computeNights(checkIn, checkOut),
    confirmationCode: str(c.confirmationCode),
    additionalConfirmations: doc.additionalConfirmations,
    roomCount: doc.roomCount,
    bookingSource: str(c.bookingSource),
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "no-user" },
      { status: 401, ...NO_STORE },
    );
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json(
      { error: "Not found", reason: "no-profile" },
      { status: 404, ...NO_STORE },
    );
  }

  const now = new Date();

  const allTrips = await db.trip.findMany({
    where: { familyProfileId: profileId, isPlacesLibrary: false },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      startDate: true,
      endDate: true,
    },
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  });

  // Upcoming/current first (soonest to latest), then past (most recent to oldest)
  const upcoming = allTrips.filter((t) => !t.endDate || t.endDate >= now);
  const past = allTrips.filter((t) => t.endDate && t.endDate < now).reverse();
  const sortedTrips = [...upcoming, ...past];

  const tripEntries: TripVaultEntry[] = [];

  for (const trip of sortedTrips) {
    // synthesizeVaultDocuments makes ~4–6 DB queries per trip internally.
    // For families with many trips this will be sequential and may be slow;
    // acceptable at correctness-first phase — optimize with Promise.all or a
    // unified cross-trip query in a future iteration.
    const rawDocs = await synthesizeVaultDocuments(trip.id, db);

    // Mobile vault shows booking confirmations only — skip links, notes, operator_plans
    const bookingDocs = rawDocs.filter((d) => d.type === "booking");
    if (bookingDocs.length === 0) continue;

    // Merge hotel cards for same property + same check-in date (double-room case)
    const mergedDocs = applyHotelMerge(bookingDocs);

    const bookings: BookingCard[] = [];

    for (const doc of mergedDocs) {
      const c = parseContent(doc.content);
      const bookingType = str(c.type)?.toLowerCase() ?? "other";

      if (bookingType === "flight") {
        bookings.push(shapeFlightCard(doc));
      } else if (bookingType === "hotel") {
        bookings.push(shapeHotelCard(doc, trip.destinationCity));
      } else {
        // activity, train, car_rental, restaurant — pass content through
        bookings.push({
          id: doc.id,
          bookingType,
          label: doc.label,
          content: c,
        });
      }
    }

    if (bookings.length === 0) continue;

    tripEntries.push({
      tripId: trip.id,
      tripName: trip.title,
      tripStartDate: trip.startDate ? trip.startDate.toISOString() : null,
      tripEndDate: trip.endDate ? trip.endDate.toISOString() : null,
      bookings,
    });
  }

  return NextResponse.json(
    { trips: tripEntries, forwardingEmail: "trips@flokktravel.com" },
    NO_STORE,
  );
}
