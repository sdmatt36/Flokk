import { describe, it, expect } from "vitest";
import {
  deriveSegments,
  allocateRecCounts,
  assignActivityToSegment,
} from "../trip-context-rich";
import type { ItineraryItemInput, TripSegment } from "../trip-context-rich";

// ─── Fixture helpers ────────────────────────────────────────────────────────

function lodging(
  title: string,
  dayIndex: number,
  opts: { lat?: number; lng?: number; toCity?: string } = {}
): ItineraryItemInput {
  return {
    type: "LODGING",
    title,
    latitude: opts.lat ?? null,
    longitude: opts.lng ?? null,
    dayIndex,
    fromCity: null,
    toCity: opts.toCity ?? null,
  };
}

function flight(
  title: string,
  dayIndex: number,
  toCity: string,
  fromCity = ""
): ItineraryItemInput {
  return {
    type: "FLIGHT",
    title,
    latitude: null,
    longitude: null,
    dayIndex,
    fromCity,
    toCity,
  };
}

function seg(overrides: Partial<TripSegment>): TripSegment {
  return {
    index: 0,
    city: "",
    lodgingName: "",
    lodgingLat: null,
    lodgingLng: null,
    dayStart: 0,
    dayEnd: 0,
    nights: 0,
    recAllocation: 0,
    ...overrides,
  };
}

// Seoul-Busan test data
const SEOUL_BUSAN_ITEMS: ItineraryItemInput[] = [
  lodging("Check-in: Moxy Seoul Insadong", 0, {
    lat: 37.5723995,
    lng: 126.9892209,
    toCity: "Seoul",
  }),
  lodging("Check-out: Moxy Seoul Insadong", 5),
  lodging("Check-in: Baymond Hotel", 5, {
    lat: 35.1595278,
    lng: 129.1567185,
    toCity: "Busan",
  }),
  lodging("Check-out: Baymond Hotel", 8),
];

// Okinawa test data — toCity is null on lodging items (real data shape)
const OKINAWA_ITEMS: ItineraryItemInput[] = [
  flight("HND → OKA", 0, "Naha", "Tokyo"),
  lodging("Check-in: THE NEST NAHA", 0, { lat: 26.2195247, lng: 127.6822391 }),
  lodging("Check-out: THE NEST NAHA", 1),
  // Duplicate check-in (mirrors real import data)
  lodging("Check-in: Hyatt Regency Seragaki Island, Okinawa", 1, {
    lat: 26.5120024,
    lng: 127.8689248,
  }),
  lodging("Check-in: Hyatt Regency Seragaki Island, Okinawa", 1, {
    lat: 26.5120024,
    lng: 127.8689248,
  }),
  lodging("Check-out: Hyatt Regency Seragaki Island, Okinawa", 4),
];

// ─── deriveSegments ──────────────────────────────────────────────────────────

describe("deriveSegments", () => {
  it("single lodging → 1 segment", () => {
    const items: ItineraryItemInput[] = [
      lodging("Check-in: Park Hyatt Tokyo", 0, {
        lat: 35.686,
        lng: 139.691,
        toCity: "Tokyo",
      }),
      lodging("Check-out: Park Hyatt Tokyo", 5),
    ];
    const segs = deriveSegments(items);
    expect(segs).toHaveLength(1);
    expect(segs[0].city).toBe("Tokyo");
    expect(segs[0].lodgingName).toBe("Park Hyatt Tokyo");
    expect(segs[0].dayStart).toBe(0);
    expect(segs[0].dayEnd).toBe(5);
    expect(segs[0].nights).toBe(5);
  });

  it("Seoul-Busan shape → 2 segments with correct cities, coords, nights", () => {
    const segs = deriveSegments(SEOUL_BUSAN_ITEMS);
    expect(segs).toHaveLength(2);

    expect(segs[0].city).toBe("Seoul");
    expect(segs[0].lodgingName).toBe("Moxy Seoul Insadong");
    expect(segs[0].lodgingLat).toBeCloseTo(37.5723995);
    expect(segs[0].lodgingLng).toBeCloseTo(126.9892209);
    expect(segs[0].dayStart).toBe(0);
    expect(segs[0].dayEnd).toBe(5);
    expect(segs[0].nights).toBe(5);

    expect(segs[1].city).toBe("Busan");
    expect(segs[1].lodgingName).toBe("Baymond Hotel");
    expect(segs[1].lodgingLat).toBeCloseTo(35.1595278);
    expect(segs[1].lodgingLng).toBeCloseTo(129.1567185);
    expect(segs[1].dayStart).toBe(5);
    expect(segs[1].dayEnd).toBe(8);
    expect(segs[1].nights).toBe(3);
  });

  it("Okinawa shape — derives Naha via same-day transit, Okinawa via comma-parse", () => {
    const segs = deriveSegments(OKINAWA_ITEMS);
    expect(segs).toHaveLength(2);

    expect(segs[0].city).toBe("Naha");
    expect(segs[0].lodgingName).toBe("THE NEST NAHA");
    expect(segs[0].dayStart).toBe(0);
    expect(segs[0].dayEnd).toBe(1);
    expect(segs[0].nights).toBe(1);

    expect(segs[1].city).toBe("Okinawa");
    expect(segs[1].lodgingName).toBe("Hyatt Regency Seragaki Island, Okinawa");
    expect(segs[1].dayStart).toBe(1);
    expect(segs[1].dayEnd).toBe(4);
    expect(segs[1].nights).toBe(3);
  });

  it("deduplicates check-in items with identical names", () => {
    // Both Hyatt check-ins are present in OKINAWA_ITEMS
    const segs = deriveSegments(OKINAWA_ITEMS);
    expect(segs).toHaveLength(2); // not 3
  });

  it("lodging with no toCity, no transit, no comma → last word of name", () => {
    const items: ItineraryItemInput[] = [
      lodging("Check-in: HOTEL NAHA", 0),
      lodging("Check-out: HOTEL NAHA", 3),
    ];
    const segs = deriveSegments(items);
    expect(segs).toHaveLength(1);
    expect(segs[0].city).toBe("NAHA");
  });

  it("no lodging items → empty array", () => {
    expect(deriveSegments([])).toEqual([]);
    expect(
      deriveSegments([
        { type: "ACTIVITY", title: "Museum", latitude: null, longitude: null, dayIndex: 1, fromCity: null, toCity: null },
      ])
    ).toEqual([]);
  });
});

// ─── allocateRecCounts ───────────────────────────────────────────────────────

describe("allocateRecCounts", () => {
  it("5n + 3n with target 12 → [8, 4]", () => {
    const segs = [seg({ nights: 5 }), seg({ nights: 3 })];
    const result = allocateRecCounts(segs, 12);
    expect(result.map((s) => s.recAllocation)).toEqual([8, 4]);
  });

  it("1n + 3n with target 12 → [3, 9]", () => {
    const segs = [seg({ nights: 1 }), seg({ nights: 3 })];
    const result = allocateRecCounts(segs, 12);
    expect(result.map((s) => s.recAllocation)).toEqual([3, 9]);
  });

  it("1n + 1n + 1n with target 12 → [4, 4, 4]", () => {
    const segs = [seg({ nights: 1 }), seg({ nights: 1 }), seg({ nights: 1 })];
    const result = allocateRecCounts(segs, 12);
    expect(result.map((s) => s.recAllocation)).toEqual([4, 4, 4]);
  });

  it("single segment → [12]", () => {
    const segs = [seg({ nights: 7 })];
    const result = allocateRecCounts(segs, 12);
    expect(result[0].recAllocation).toBe(12);
  });

  it("empty segments → []", () => {
    expect(allocateRecCounts([], 12)).toEqual([]);
  });

  it("total allocation always equals targetTotal", () => {
    const segs = [seg({ nights: 5 }), seg({ nights: 3 })];
    const result = allocateRecCounts(segs, 12);
    const total = result.reduce((sum, s) => sum + s.recAllocation, 0);
    expect(total).toBe(12);
  });

  it("zero-night segments get equal split", () => {
    const segs = [seg({ nights: 0 }), seg({ nights: 0 })];
    const result = allocateRecCounts(segs, 12);
    expect(result.map((s) => s.recAllocation)).toEqual([6, 6]);
  });
});

// ─── assignActivityToSegment ─────────────────────────────────────────────────

describe("assignActivityToSegment", () => {
  const seoulBusanSegs = deriveSegments(SEOUL_BUSAN_ITEMS);

  it("dayIndex 3 → Seoul", () => {
    expect(assignActivityToSegment({ dayIndex: 3 }, seoulBusanSegs)).toBe("Seoul");
  });

  it("dayIndex 6 → Busan", () => {
    expect(assignActivityToSegment({ dayIndex: 6 }, seoulBusanSegs)).toBe("Busan");
  });

  it("dayIndex 5 (transition day) → arriving segment Busan", () => {
    expect(assignActivityToSegment({ dayIndex: 5 }, seoulBusanSegs)).toBe("Busan");
  });

  it("dayIndex null → null", () => {
    expect(assignActivityToSegment({ dayIndex: null }, seoulBusanSegs)).toBeNull();
  });

  it("dayIndex 8 (after all segments) → null", () => {
    expect(assignActivityToSegment({ dayIndex: 8 }, seoulBusanSegs)).toBeNull();
  });

  it("empty segments → null", () => {
    expect(assignActivityToSegment({ dayIndex: 3 }, [])).toBeNull();
  });
});
