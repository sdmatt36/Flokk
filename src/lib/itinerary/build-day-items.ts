import { mergeDuplicateLodging } from "@/lib/itinerary/merge-duplicate-lodging";

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
  address: string | null;
  time: string | null;
  badge: string;
  dayIndex: number;
  // Intra-day order key. Items are returned sorted by this ASC (with a stable time-then-id
  // tiebreak), and the value is exposed so the client can trust and reconstruct that order
  // instead of re-deriving it. Unreordered items are 0 and fall back to time order.
  sortOrder: number;
  sourceType: "savedItem" | "manualActivity" | "itineraryItem" | "flight";
  photoUrl: string | null;
  categoryTags: string[];
  rawTime: string | null;
  endTime: string | null;
  // Public place-level fields (additive). description is the public place blurb
  // (savedItem.rawDescription) shown to all viewers — NOT the private family note.
  lat: number | null;
  lng: number | null;
  websiteUrl: string | null;
  description: string | null;
  sourceTripId: string | null;
  savedItemId?: string | null;
  confirmationCode?: string | null;
  // True for a read-time "borrowed" departing flight owned by the next trip. The client
  // marks it (badge "Departing") and suppresses edit/remove — it is not this trip's row.
  borrowed?: boolean;
  // Discrete flight fields (additive; flight rows only). Today the title bakes in the
  // airports and the subtitle carries the airline (or, for borrowed rows, the continuation
  // line). These let a renderer show airline + flight number + both airports + both times
  // without parsing the title. Populated for BOTH normal and borrowed flights. Title and
  // subtitle are unchanged. Consumed by the mobile flight card (next EAS build).
  flightNumber?: string | null;
  airline?: string | null;
  fromAirport?: string | null;
  toAirport?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  departureDate?: string | null;
};

// ── input types ───────────────────────────────────────────────────────────────

export type RawItineraryItem = {
  id: string; type: string; title: string; scheduledDate: string | null;
  departureTime: string | null; arrivalTime: string | null;
  fromAirport: string | null; toAirport: string | null;
  fromCity: string | null; toCity: string | null;
  confirmationCode: string | null; address: string | null;
  dayIndex: number | null; sortOrder: number | null;
  manuallyPlaced?: boolean | null;
  currency: string | null; imageUrl: string | null;
  // Optional: only some callers (the public preview) select coordinates.
  latitude?: number | null; longitude?: number | null;
};

export type RawManualActivity = {
  id: string; title: string; time: string | null; endTime: string | null;
  venueName: string | null; address: string | null;
  dayIndex: number | null; sortOrder: number | null;
  manuallyPlaced?: boolean | null;
  type: string | null; imageUrl: string | null;
  savedItem: { id: string; categoryTags: string[] } | null;
  // Optional: only some callers (the public preview) select coordinates.
  lat?: number | null; lng?: number | null;
};

export type RawFlight = {
  id: string; type: string | null; airline: string | null; flightNumber: string | null;
  fromAirport: string | null; toAirport: string | null;
  fromCity: string | null; toCity: string | null;
  departureTime: string | null; arrivalTime: string | null;
  departureDate?: string | null;
  confirmationCode: string | null; dayIndex: number | null; sortOrder: number | null;
  // Read-time cross-trip injection: this flight is OWNED by another (next) trip and is
  // shown here because it departs at this trip's end. Display-only — never persisted.
  borrowed?: boolean; ownerTripName?: string | null;
};

export type RawSavedItem = {
  id: string; rawTitle: string | null; rawDescription: string | null;
  startTime: string | null; endTime: string | null;
  categoryTags: string[]; tourId: string | null;
  dayIndex: number | null; sortOrder: number | null;
  manuallyPlaced?: boolean | null;
  placePhotoUrl: string | null; address: string | null;
  // Optional: only some callers (the public preview) select these.
  lat?: number | null; lng?: number | null; websiteUrl?: string | null;
};

// ── builder ───────────────────────────────────────────────────────────────────

export function buildDayItems(
  // id is optional: callers that don't select it (owned-trip day-items) get
  // sourceTripId: null. The public preview passes it for the Flokk It payload.
  trip: { id?: string | null; destinationCity: string | null; startDate: Date | null; endDate: Date | null },
  rawItineraryItems: RawItineraryItem[],
  activities: RawManualActivity[],
  flights: RawFlight[],
  savedItems: RawSavedItem[],
): { dayIndex: number; items: DayItemRow[] }[] {
  const dest = (trip.destinationCity ?? "").toLowerCase().trim();
  const sourceTripId = trip.id ?? null;
  const itineraryItems = mergeDuplicateLodging(rawItineraryItems);

  const allDayIndexes = new Set<number>();
  const startMs = trip.startDate?.getTime() ?? null;
  const endMs = trip.endDate?.getTime() ?? null;
  if (startMs !== null && endMs !== null && endMs >= startMs) {
    const dayCount = Math.round((endMs - startMs) / 86400000) + 1;
    for (let d = 0; d < dayCount; d++) allDayIndexes.add(d);
  }
  for (const it of itineraryItems) { if (it.dayIndex !== null) allDayIndexes.add(it.dayIndex); }
  for (const a of activities) { if (a.dayIndex !== null) allDayIndexes.add(a.dayIndex); }
  for (const f of flights) { if (f.dayIndex !== null) allDayIndexes.add(f.dayIndex); }
  for (const s of savedItems) { if (s.dayIndex !== null) allDayIndexes.add(s.dayIndex); }

  type Sortable = {
    sortId: string;
    sortOrder: number;
    sortTimeMin: number;
    effTimeMin?: number;
    manuallyPlaced: boolean;
    anchorW: number;
    lodgingW: number;
    tourId: string | null;
    // sortOrder is added onto the row from the Sortable's own value at emit time (below), so the
    // returned row.sortOrder always equals the key it was sorted by.
    row: Omit<DayItemRow, "sortOrder">;
  };

  return [...allDayIndexes].sort((a, b) => a - b).map(dayIdx => {
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

    // 1. SavedItems
    for (const s of savedItems) {
      if (s.dayIndex !== dayIdx) continue;
      const rawTitle = s.rawTitle ?? "";
      if (itineraryTitlesForDay.has(rawTitle.trim().toLowerCase())) continue;
      if (hasTrainOnDay) {
        const cats = s.categoryTags.join(" ").toLowerCase();
        const tl = rawTitle.trim().toLowerCase();
        if (/train|transit|rail/i.test(cats) || /rail\.ninja|train/i.test(tl)) continue;
      }
      items.push({
        sortId: `saved_${s.id}`,
        sortOrder: s.sortOrder ?? 0,
        manuallyPlaced: s.manuallyPlaced ?? false,
        sortTimeMin: parseHHMM(s.startTime) ?? 9999,
        anchorW: 50,
        lodgingW: 50,
        tourId: s.tourId ?? null,
        row: {
          id: s.id, kind: "activity",
          title: rawTitle,
          subtitle: s.rawDescription ?? null,
          address: s.address ?? null,
          time: formatTime(s.startTime),
          badge: s.categoryTags.length > 0 ? formatCategoryTag(s.categoryTags[0]) : "Activity",
          dayIndex: dayIdx,
          sourceType: "savedItem",
          photoUrl: s.placePhotoUrl ?? null,
          categoryTags: s.categoryTags,
          rawTime: s.startTime ?? null,
          endTime: s.endTime ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          websiteUrl: s.websiteUrl ?? null,
          // Public place blurb — shown to all viewers (not a private note).
          description: s.rawDescription ?? null,
          sourceTripId,
        },
      });
    }

    // 2. ManualActivities
    for (const a of activities) {
      if (a.dayIndex !== dayIdx) continue;
      const activityCategoryTags = a.savedItem?.categoryTags ?? (a.type ? [a.type] : []);
      items.push({
        sortId: `activity_${a.id}`,
        sortOrder: a.sortOrder ?? 0,
        manuallyPlaced: a.manuallyPlaced ?? false,
        sortTimeMin: parseHHMM(a.time) ?? 9999,
        anchorW: 50,
        lodgingW: 50,
        tourId: null,
        row: {
          id: a.id, kind: "activity",
          title: a.title,
          subtitle: a.venueName ?? null,
          address: a.address ?? null,
          time: formatTime(a.time),
          badge: activityCategoryTags.length > 0 ? formatCategoryTag(activityCategoryTags[0]) : "Activity",
          dayIndex: dayIdx,
          sourceType: "manualActivity",
          photoUrl: a.imageUrl ?? null,
          categoryTags: activityCategoryTags,
          rawTime: a.time ?? null,
          endTime: a.endTime ?? null,
          lat: a.lat ?? null,
          lng: a.lng ?? null,
          // Manual activities have no public website; their notes are a private
          // family note and are intentionally NOT exposed here.
          websiteUrl: null,
          description: null,
          sourceTripId,
          savedItemId: a.savedItem?.id ?? null,
        },
      });
    }

    // 3. Flights
    for (const f of flights) {
      if (f.dayIndex !== dayIdx) continue;
      // Borrowed (read-time cross-trip) flights are injected and never duplicate one of
      // this trip's own ItineraryItems — skip the within-trip de-dup for them.
      const covered = !f.borrowed && itineraryItems.some(it =>
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
        manuallyPlaced: false, // flights are not one of the three user-movable day-stop models

        sortTimeMin: isArrival ? (parseHHMM(f.arrivalTime) ?? 0) : (1440 + (parseHHMM(f.departureTime) ?? 0)),
        anchorW: 50,
        lodgingW: 50,
        tourId: null,
        row: {
          id: f.id, kind: "booking",
          title: `Flight: ${f.fromAirport} → ${f.toAirport}`,
          // Server-text marking: a borrowed flight belongs to the NEXT trip.
          subtitle: f.borrowed ? `Continues your ${f.ownerTripName ?? "next"} trip` : (f.airline ?? null),
          address: null,
          // Show BOTH times via the existing time/endTime fields (renderers append
          // " – {endTime}"): time = departure, endTime = arrival. Do not collapse to one,
          // and do not rely on f.type (all flights are typed "outbound" upstream).
          time: formatTime(f.departureTime ?? f.arrivalTime),
          badge: f.borrowed ? "Departing" : "Flight",
          dayIndex: dayIdx,
          sourceType: "flight",
          photoUrl: null,
          categoryTags: [],
          rawTime: null,
          endTime: f.departureTime && f.arrivalTime ? f.arrivalTime : null,
          lat: null,
          lng: null,
          websiteUrl: null,
          description: null,
          sourceTripId,
          confirmationCode: f.borrowed ? null : (f.confirmationCode ?? null),
          // Display-only: the booking lives on another trip. Lets the client suppress
          // edit/remove affordances for this row.
          borrowed: f.borrowed ?? false,
          // Discrete flight fields (additive) for both normal and borrowed rows. Title and
          // subtitle above are unchanged; these just expose the same data structured.
          flightNumber: f.flightNumber ?? null,
          airline: f.airline ?? null,
          fromAirport: f.fromAirport ?? null,
          toAirport: f.toAirport ?? null,
          departureTime: f.departureTime ?? null,
          arrivalTime: f.arrivalTime ?? null,
          departureDate: f.departureDate ?? null,
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
      // For flights, the row carries BOTH times (departure → arrival) via time/endTime;
      // non-flight rows leave this null. Ordering still uses the arrival/departure split.
      let displayEndTime: string | null = null;
      if (it.type === "FLIGHT") {
        displayTime = formatTime(it.departureTime ?? it.arrivalTime);
        displayEndTime = it.departureTime && it.arrivalTime ? it.arrivalTime : null;
        if (isArrivalFlight) {
          sortTimeMin = parseHHMM(it.arrivalTime) ?? 0;
        } else {
          sortTimeMin = 1440 + (parseHHMM(it.departureTime) ?? 0);
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
        manuallyPlaced: it.manuallyPlaced ?? false,
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
          address: it.type !== "FLIGHT" ? (it.address ?? null) : null,
          time: displayTime,
          badge: TYPE_LABELS[it.type] ?? it.type,
          dayIndex: dayIdx,
          sourceType: "itineraryItem",
          photoUrl: it.imageUrl ?? null,
          categoryTags: [],
          rawTime: null,
          endTime: displayEndTime,
          lat: it.latitude ?? null,
          lng: it.longitude ?? null,
          websiteUrl: null,
          description: null,
          sourceTripId,
          confirmationCode: it.confirmationCode ?? null,
        },
      });
    }

    // Effective-time pre-pass: give each item an effective time so TIMED items order by the clock
    // while UNTIMED items hold their manual position instead of all jumping to the end. Walk in the
    // same (anchorW, sortOrder, id) order untimed items are anchored by, carrying the most recent
    // real time forward: a timed item uses its own time; an untimed item inherits the time of the
    // timed item it currently follows (leading untimed items keep -1 and stay on top). sortTimeMin
    // === 9999 is the untimed sentinel (SavedItem/ManualActivity); flights, lodging and trains always
    // carry a real derived value, so they are never untimed and never inherit. Computed once per item
    // (independent of the pair), so the final comparator stays transitive.
    const preOrdered = [...items].sort((a, b) =>
      (a.anchorW - b.anchorW) ||
      (a.sortOrder - b.sortOrder) ||
      a.row.id.localeCompare(b.row.id)
    );
    let lastTimed = -1;
    for (const it of preOrdered) {
      if (it.sortTimeMin !== 9999) lastTimed = it.sortTimeMin;
      it.effTimeMin = lastTimed;
    }

    // Rule A — a manually moved stop stays put, absolutely. Two per-day modes:
    //  - MANUAL (any item on the day has manuallyPlaced): sortOrder LEADS, so a user-moved stop is
    //    absolute and never re-derived from the clock. anchorW -> sortOrder -> effTimeMin -> lodgingW -> id.
    //  - SMART DEFAULT (nothing manually placed): time leads via the effTimeMin pre-pass, untimed
    //    items holding their manual position. anchorW -> effTimeMin -> sortOrder -> lodgingW -> id.
    // anchorW stays the top key either way, so lodging/hotel anchoring is unchanged. dayIsManual is a
    // per-day constant, so the comparator is a fixed lexicographic order (transitive) within a day.
    const dayIsManual = items.some(i => i.manuallyPlaced);
    items.sort((a, b) => {
      const aw = a.anchorW - b.anchorW;
      if (aw !== 0) return aw;
      const et = (a.effTimeMin ?? -1) - (b.effTimeMin ?? -1);
      const so = a.sortOrder - b.sortOrder;
      if (dayIsManual) {
        if (so !== 0) return so;
        if (et !== 0) return et;
      } else {
        if (et !== 0) return et;
        if (so !== 0) return so;
      }
      const lw = a.lodgingW - b.lodgingW;
      if (lw !== 0) return lw;
      // Final stable tiebreak: deterministic across requests regardless of query/insertion order.
      return a.row.id.localeCompare(b.row.id);
    });

    // Tour-cluster compaction, with a Rule A yield so a moved stop is never re-pinned:
    //  - a manuallyPlaced item ALWAYS emits at its own sorted position (never gathered into a cluster);
    //  - the cluster gather excludes manuallyPlaced members (items.filter(... && !x.manuallyPlaced));
    //  - if the FIRST member of a tour we reach (its anchor) is manuallyPlaced, that tour is not
    //    compacted at all — every member emits in place.
    const compacted: Sortable[] = [];
    const emittedTourIds = new Set<string>();
    const noCompactTourIds = new Set<string>();
    for (const item of items) {
      if (item.manuallyPlaced) {
        // A moved stop emits in place. If it is the anchor (first member of its tour we reach), opt
        // the whole tour out of compaction so its other members are not re-pinned around the move.
        if (item.tourId && !emittedTourIds.has(item.tourId)) noCompactTourIds.add(item.tourId);
        compacted.push(item);
        continue;
      }
      if (!item.tourId) {
        compacted.push(item);
        continue;
      }
      if (emittedTourIds.has(item.tourId)) continue;                 // already gathered at the anchor
      if (noCompactTourIds.has(item.tourId)) { compacted.push(item); continue; } // tour opted out — in place
      emittedTourIds.add(item.tourId);
      compacted.push(...items.filter(x => x.tourId === item.tourId && !x.manuallyPlaced));
    }

    return { dayIndex: dayIdx, items: compacted.map(i => ({ ...i.row, sortOrder: i.sortOrder })) };
  });
}
