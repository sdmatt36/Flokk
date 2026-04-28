import { describe, it, expect } from "vitest";
import { buildContextHash, buildHaikuContextPrompt } from "../recommendation-context";
import type { TripContext } from "../recommendation-context";

const base: TripContext = {
  tripId: "trip-1",
  destinationCity: "Seoul",
  destinationCountry: "South Korea",
  lodgingLat: 37.5,
  lodgingLng: 127.0,
  itineraryItemIds: ["item-a", "item-b"],
  savedItemIds: ["save-1"],
};

describe("buildContextHash", () => {
  it("returns a 16-char hex string", () => {
    const hash = buildContextHash(base);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("same inputs produce same hash", () => {
    expect(buildContextHash(base)).toBe(buildContextHash(base));
  });

  it("different city produces different hash", () => {
    const other = { ...base, destinationCity: "Tokyo" };
    expect(buildContextHash(base)).not.toBe(buildContextHash(other));
  });

  it("adding an itineraryItem changes the hash", () => {
    const other = { ...base, itineraryItemIds: [...base.itineraryItemIds, "item-c"] };
    expect(buildContextHash(base)).not.toBe(buildContextHash(other));
  });

  it("itineraryItemIds order is normalized (sort before hash)", () => {
    const a = { ...base, itineraryItemIds: ["item-b", "item-a"] };
    const b = { ...base, itineraryItemIds: ["item-a", "item-b"] };
    expect(buildContextHash(a)).toBe(buildContextHash(b));
  });

  it("city comparison is case-insensitive", () => {
    const lower = { ...base, destinationCity: "seoul" };
    expect(buildContextHash(base)).toBe(buildContextHash(lower));
  });
});

describe("buildHaikuContextPrompt", () => {
  it("includes destination city and country", () => {
    const result = buildHaikuContextPrompt(base, {
      familyContext: "",
      plannedActivities: [],
      savedForTrip: [],
      lodgingAddress: null,
    });
    expect(result).toContain("Seoul");
    expect(result).toContain("South Korea");
  });

  it("includes lodging address when provided", () => {
    const result = buildHaikuContextPrompt(base, {
      familyContext: "",
      plannedActivities: [],
      savedForTrip: [],
      lodgingAddress: "Hyatt Regency, Gangnam",
    });
    expect(result).toContain("Hyatt Regency, Gangnam");
  });

  it("includes planned activities dedup hint", () => {
    const result = buildHaikuContextPrompt(base, {
      familyContext: "",
      plannedActivities: ["Gyeongbokgung", "Bukchon"],
      savedForTrip: [],
      lodgingAddress: null,
    });
    expect(result).toContain("Gyeongbokgung");
    expect(result).toContain("do not duplicate");
  });

  it("omits sections when arrays are empty", () => {
    const result = buildHaikuContextPrompt(base, {
      familyContext: "",
      plannedActivities: [],
      savedForTrip: [],
      lodgingAddress: null,
    });
    expect(result).not.toContain("do not duplicate");
    expect(result).not.toContain("Lodging:");
  });

  it("includes family context string", () => {
    const result = buildHaikuContextPrompt(base, {
      familyContext: "Family with kids aged 7 and 10.",
      plannedActivities: [],
      savedForTrip: [],
      lodgingAddress: null,
    });
    expect(result).toContain("Family with kids aged 7 and 10.");
  });
});
