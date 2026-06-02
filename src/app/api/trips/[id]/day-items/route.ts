import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip } from "@/lib/trip-permissions";
import { mergeDuplicateLodging } from "@/lib/itinerary/merge-duplicate-lodging";

export const dynamic = "force-dynamic";

// ── time helpers ──────────────────────────────────────────────────────────────

function parseHHMM(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
    const min = parseHHMM(t);
    if (min === null) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const TYPE_LABELS: Record<string, string> = {
  FLIGHT: "Flight", LODGING: "Lodging", ACTIVITY: "Activity",
  TRAIN: "Train", CRUISE: "Cruise", TRANSFER: "Transfer",
  CAR_RENTAL: "Car Rental", CRUISE_PORT: "Cruise Port",
};

function formatCategoryTag(tag: string): string {
  return tag.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function matchesDest(city: string | null | undefined, dest: string): boolean {
  if (!dest || !city) return false;
  const c = city.toLowerCase();
  return c.includes(dest) || dest.split(/[\s,/-]+/).some(w => w.length > 2 && c.includes(w));
}

// ── output shape ──────────────────────────────────────────────────────────────

export type DayItemRow = {
  id: string;
  kind: "booking" | "activity";
  title: string;
  subtitle: string | null;
  time: string | null;   // pre-formatted "3:00 PM" or null
  badge: string;
  dayIndex: number;
};

// ── GET /api/trips/[id]/day-items ─────────────────────────────────────────────
//
// Server-side merge of all four itinerary sources for mobile consumption.
// Replicates buildDayItems from TripTabContent.tsx:
//   1. recAdditions  → SavedItem (dayIndex set, not manual_activity)
//   2. activities    → ManualActivity (dayIndex set, not deleted)
//   3. flights       → Flight (dayIndex set), deduped against FLIGHT ItineraryItems
//   4. itineraryItems → ItineraryItem (not cancelled), after mergeDuplicateLodging
//
// Dedup rules (faithful to TripTabContent):
//   - SavedItem suppressed if ItineraryItem on same day has same normalized title
//   - SavedItem rail entries suppressed if a TRAIN ItineraryItem exists on same day
//   - Flight suppressed if a FLIGHT ItineraryItem covers same confirmationCode or route+day
//
// Sort (per day): anchorWeight → sortOrder → toSortKey → lodgingW

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  if (!(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [trip, rawItineraryItems, activities, flights, savedItems] = await Promise.all([
    db.trip.findUnique({ where: { id: tripId }, select: { destinationCity: true } }),
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
        id: true, title: true, time: true, venueName: true,
        address: true, dayIndex: true, sortOrder: true, type: true,
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
        id: true, rawTitle: true, rawDescription: true, startTime: true,
        categoryTags: true, tourId: true, dayIndex: true, sortOrder: true,
      },
    }),
  ]);

  const dest = (trip?.destinationCity ?? "").toLowerCase().trim();
  const itineraryItems = mergeDuplicateLodging(rawItineraryItems);

  // Collect all day indexes across all sources
  const allDayIndexes = new Set<number>();
  for (const it of itineraryItems) { if (it.dayIndex !== null) allDayIndexes.add(it.dayIndex); }
  for (const a of activities) { if (a.dayIndex !== null) allDayIndexes.add(a.dayIndex); }
  for (const f of flights) { if (f.dayIndex !== null) allDayIndexes.add(f.dayIndex); }
  for (const s of savedItems) { if (s.dayIndex !== null) allDayIndexes.add(s.dayIndex); }

  type Sortable = {
    sortId: string;
    sortOrder: number;
    sortTimeMin: number;
    anchorW: number;
    lodgingW: number;
    tourId: string | null;
    row: DayItemRow;
  };

  const days = [...allDayIndexes].sort((a, b) => a - b).map(dayIdx => {
    // Build dedup set from ItineraryItems on this day
    const itineraryTitlesForDay = new Set(
      itineraryItems
        .filter(it => it.dayIndex === dayIdx)
        .flatMap(it => {
          const lower = it.title.trim().toLowerCase();
          const normalized = lower.replace(/^check-(?:in|out):\s*/, "");
          return normalized !== lower ? [lower, normalized] : [lower];
        })
    );
    const hasTrainOnDay = itineraryItems.some(it => it.dayIndex === dayIdx && it.type === "TRAIN");

    const items: Sortable[] = [];

    // 1. SavedItems (rec additions)
    for (const s of savedItems) {
      if (s.dayIndex !== dayIdx) continue;
      const rawTitle = s.rawTitle ?? "";
      if (itineraryTitlesForDay.has(rawTitle.trim().toLowerCase())) continue;
      if (hasTrainOnDay) {
        const cats = s.categoryTags.join(" ").toLowerCase();
        const tl = rawTitle.trim().toLowerCase();
        if (/train|transit|rail/i.test(cats) || /rail\.ninja|train/i.test(tl)) continue;
      }
      const startTimeMin: number = (() => {
        if (!s.startTime) return 9999;
        const d = new Date(s.startTime);
        if (isNaN(d.getTime())) return 9999;
        return d.getHours() * 60 + d.getMinutes();
      })();
      items.push({
        sortId: `saved_${s.id}`,
        sortOrder: s.sortOrder ?? 0,
        sortTimeMin: startTimeMin,
        anchorW: 50,
        lodgingW: 50,
        tourId: s.tourId ?? null,
        row: {
          id: s.id, kind: "activity",
          title: rawTitle,
          subtitle: s.rawDescription ?? null,
          time: formatTime(s.startTime),
          badge: s.categoryTags.length > 0 ? formatCategoryTag(s.categoryTags[0]) : "Activity",
          dayIndex: dayIdx,
        },
      });
    }

    // 2. ManualActivities
    for (const a of activities) {
      if (a.dayIndex !== dayIdx) continue;
      items.push({
        sortId: `activity_${a.id}`,
        sortOrder: a.sortOrder ?? 0,
        sortTimeMin: parseHHMM(a.time) ?? 720,
        anchorW: 50,
        lodgingW: 50,
        tourId: null,
        row: {
          id: a.id, kind: "activity",
          title: a.title,
          subtitle: a.venueName ?? a.address ?? null,
          time: formatTime(a.time),
          badge: a.type ? formatCategoryTag(a.type) : "Activity",
          dayIndex: dayIdx,
        },
      });
    }

    // 3. Flights (manual, deduped against FLIGHT ItineraryItems)
    for (const f of flights) {
      if (f.dayIndex !== dayIdx) continue;
      const covered = itineraryItems.some(it =>
        it.type === "FLIGHT" && (
          (f.confirmationCode && it.confirmationCode && f.confirmationCode === it.confirmationCode) ||
          (it.fromAirport && it.toAirport && it.fromAirport === f.fromAirport && it.toAirport === f.toAirport && it.dayIndex === f.dayIndex)
        )
      );
      if (covered) continue;
      const isArrival = f.type === "outbound" || matchesDest(f.toCity, dest) || matchesDest(f.toAirport, dest);
      items.push({
        sortId: `flight_${f.id}`,
        sortOrder: f.sortOrder ?? 0,
        sortTimeMin: isArrival ? (parseHHMM(f.arrivalTime) ?? 0) : (1440 + (parseHHMM(f.departureTime) ?? 0)),
        anchorW: 50,
        lodgingW: 50,
        tourId: null,
        row: {
          id: f.id, kind: "booking",
          title: `Flight: ${f.fromAirport} → ${f.toAirport}`,
          subtitle: f.airline ?? null,
          time: isArrival ? formatTime(f.arrivalTime) : formatTime(f.departureTime),
          badge: "Flight",
          dayIndex: dayIdx,
        },
      });
    }

    // 4. ItineraryItems
    for (const it of itineraryItems) {
      if (it.dayIndex !== dayIdx) continue;

      let subtitle: string | null = null;
      if (it.type === "FLIGHT" && it.fromAirport && it.toAirport) {
        subtitle = `${it.fromAirport} → ${it.toAirport}`;
      } else {
        subtitle = it.address ?? it.fromCity ?? it.toCity ?? null;
      }

      const isArrivalFlight = it.type === "FLIGHT" &&
        (matchesDest(it.toCity, dest) || matchesDest(it.toAirport, dest));

      let sortTimeMin: number;
      let displayTime: string | null;
      if (it.type === "FLIGHT") {
        if (isArrivalFlight) {
          sortTimeMin = parseHHMM(it.arrivalTime) ?? 0;
          displayTime = formatTime(it.arrivalTime);
        } else {
          sortTimeMin = 1440 + (parseHHMM(it.departureTime) ?? 0);
          displayTime = formatTime(it.departureTime);
        }
      } else if (it.type === "LODGING") {
        const isCheckOut = it.title.toLowerCase().includes("check-out");
        sortTimeMin = isCheckOut ? (parseHHMM(it.departureTime) ?? 50) : (parseHHMM(it.departureTime) ?? 900);
        displayTime = formatTime(it.departureTime ?? it.arrivalTime);
      } else if (it.type === "TRAIN") {
        sortTimeMin = parseHHMM(it.departureTime) ?? 660;
        displayTime = formatTime(it.departureTime);
      } else {
        sortTimeMin = parseHHMM(it.departureTime ?? it.arrivalTime) ?? 720;
        displayTime = formatTime(it.departureTime ?? it.arrivalTime);
      }

      let anchorW = 50;
      if (it.type === "LODGING" && (it.sortOrder ?? 0) === 0) {
        const tl = it.title.toLowerCase();
        if (tl.startsWith("check-in:")) anchorW = 1000;
        else if (tl.startsWith("check-out:")) anchorW = it.departureTime ? 50 : -1000;
      }

      items.push({
        sortId: `itinerary_${it.id}`,
        sortOrder: it.sortOrder ?? 0,
        sortTimeMin,
        anchorW,
        lodgingW: it.type === "LODGING"
          ? (it.title.toLowerCase().includes("check-out") ? 80 : 20)
          : 50,
        tourId: null,
        row: {
          id: it.id, kind: "booking",
          title: it.title,
          subtitle,
          time: displayTime,
          badge: TYPE_LABELS[it.type] ?? it.type,
          dayIndex: dayIdx,
        },
      });
    }

    // Sort: anchorWeight → sortOrder → sortTimeMin → lodgingW
    items.sort((a, b) => {
      const aw = a.anchorW - b.anchorW;
      if (aw !== 0) return aw;
      const so = a.sortOrder - b.sortOrder;
      if (so !== 0) return so;
      const sk = a.sortTimeMin - b.sortTimeMin;
      if (sk !== 0) return sk;
      return a.lodgingW - b.lodgingW;
    });

    // Tour compaction: keep tourId clusters contiguous
    const compacted: Sortable[] = [];
    const emittedTourIds = new Set<string>();
    for (const item of items) {
      if (item.tourId) {
        if (emittedTourIds.has(item.tourId)) continue;
        emittedTourIds.add(item.tourId);
        compacted.push(...items.filter(x => x.tourId === item.tourId));
      } else {
        compacted.push(item);
      }
    }

    return { dayIndex: dayIdx, items: compacted.map(i => i.row) };
  });

  return NextResponse.json({ days });
}
