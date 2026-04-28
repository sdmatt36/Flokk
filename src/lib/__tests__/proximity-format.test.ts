import { describe, it, expect } from "vitest";
import { computeProximity, formatProximityLabel } from "../proximity-format";
import type { ActivityForProximity } from "../proximity-format";

// Okinawa-area coords for realistic distances
const HYATT = { lat: 26.5120, lng: 127.8689 }; // lodging
const CAPE_MANZAMO = { lat: 26.5165, lng: 127.8349 }; // ~3.5km from Hyatt — activity
const NEAR_MANZAMO = { lat: 26.517, lng: 127.837 }; // ~0.2km from Cape Manzamo — within activity threshold
const NAHA = { lat: 26.2124, lng: 127.6809 }; // ~40km from Hyatt — drive distance

const activities: ActivityForProximity[] = [
  { title: "Cape Manzamo", lat: CAPE_MANZAMO.lat, lng: CAPE_MANZAMO.lng, dayIndex: 3 },
];

describe("computeProximity", () => {
  it("returns none when rec has null coords", () => {
    const result = computeProximity(null, null, HYATT.lat, HYATT.lng, "Hyatt Regency", activities);
    expect(result.kind).toBe("none");
  });

  it("returns activity when rec is within 2km of a planned activity", () => {
    const result = computeProximity(NEAR_MANZAMO.lat, NEAR_MANZAMO.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", activities);
    expect(result.kind).toBe("activity");
    if (result.kind === "activity") {
      expect(result.activityTitle).toBe("Cape Manzamo");
      expect(result.dayLabel).toBe("Day 4");
    }
  });

  it("returns activity with null dayLabel when activity has no dayIndex", () => {
    const noDay: ActivityForProximity[] = [
      { title: "Blue Cave", lat: NEAR_MANZAMO.lat, lng: NEAR_MANZAMO.lng, dayIndex: null },
    ];
    const result = computeProximity(NEAR_MANZAMO.lat, NEAR_MANZAMO.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", noDay);
    expect(result.kind).toBe("activity");
    if (result.kind === "activity") {
      expect(result.dayLabel).toBeNull();
    }
  });

  it("returns lodging walk when rec is close to lodging and no nearby activities", () => {
    // 0.3km from Hyatt — should be walk
    const nearHyatt = { lat: HYATT.lat + 0.003, lng: HYATT.lng };
    const result = computeProximity(nearHyatt.lat, nearHyatt.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", []);
    expect(result.kind).toBe("lodging");
    if (result.kind === "lodging") {
      expect(result.mode).toBe("walk");
      expect(result.minutes).toBeGreaterThan(0);
    }
  });

  it("returns lodging drive when rec is far from lodging", () => {
    const result = computeProximity(NAHA.lat, NAHA.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", []);
    expect(result.kind).toBe("lodging");
    if (result.kind === "lodging") {
      expect(result.mode).toBe("drive");
      expect(result.minutes).toBeGreaterThan(5);
    }
  });

  it("returns lodging drive for long distances", () => {
    // ~40km away = ~60 min drive
    const result = computeProximity(NAHA.lat, NAHA.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", []);
    expect(result.kind).toBe("lodging");
    if (result.kind === "lodging") {
      expect(result.mode).toBe("drive");
      expect(result.minutes).toBeGreaterThan(30);
    }
  });

  it("returns none when no lodging coords and no nearby activities", () => {
    const result = computeProximity(NAHA.lat, NAHA.lng, null, null, null, []);
    expect(result.kind).toBe("none");
  });

  it("activity check takes priority over lodging even when both match", () => {
    // Rec is close to both lodging AND an activity — activity should win
    const nearHyattAct: ActivityForProximity[] = [
      { title: "Hotel Pool Bar", lat: HYATT.lat + 0.001, lng: HYATT.lng, dayIndex: 0 },
    ];
    const result = computeProximity(HYATT.lat + 0.001, HYATT.lng, HYATT.lat, HYATT.lng, "Hyatt Regency", nearHyattAct);
    expect(result.kind).toBe("activity");
  });
});

describe("formatProximityLabel", () => {
  it("returns null for none", () => {
    expect(formatProximityLabel({ kind: "none" })).toBeNull();
  });

  it("formats activity with day", () => {
    const label = formatProximityLabel({ kind: "activity", activityTitle: "Cape Manzamo", dayLabel: "Day 4" });
    expect(label).toBe("Near Cape Manzamo (your Day 4 plan)");
  });

  it("formats activity without day", () => {
    const label = formatProximityLabel({ kind: "activity", activityTitle: "Blue Cave", dayLabel: null });
    expect(label).toBe("Near Blue Cave (your plan)");
  });

  it("formats lodging walk", () => {
    const label = formatProximityLabel({ kind: "lodging", minutes: 5, mode: "walk", lodgingName: "Hyatt Regency" });
    expect(label).toBe("5 min walk from Hyatt Regency");
  });

  it("formats lodging drive", () => {
    const label = formatProximityLabel({ kind: "lodging", minutes: 12, mode: "drive", lodgingName: "THE NEST NAHA" });
    expect(label).toBe("12 min drive from THE NEST NAHA");
  });
});
