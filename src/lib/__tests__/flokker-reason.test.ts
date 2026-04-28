import { describe, it, expect } from "vitest";
import { buildFlokkerReason } from "../flokker-reason";
import type { FamilyContext } from "../flokker-reason";

const ctx: FamilyContext = { childAges: [7, 10], pace: "relaxed", interests: ["food", "culture"] };

describe("buildFlokkerReason", () => {
  it("singular family when ratingCount is 1", () => {
    const result = buildFlokkerReason(
      { name: "Cape Manzamo", destinationCity: "Okinawa", avgRating: 4.8, ratingCount: 1 },
      ctx
    );
    expect(result).toContain("1 Flokk family");
    expect(result).toContain("Okinawa");
  });

  it("plural families when ratingCount > 1", () => {
    const result = buildFlokkerReason(
      { name: "Shuri Castle", destinationCity: "Okinawa", avgRating: 4.5, ratingCount: 3 },
      ctx
    );
    expect(result).toContain("3 Flokk families");
  });

  it("falls back to 'the area' when destinationCity is null", () => {
    const result = buildFlokkerReason(
      { name: "Some Place", destinationCity: null, avgRating: 4.0, ratingCount: 2 },
      ctx
    );
    expect(result).toContain("the area");
  });

  it("formats rating to one decimal place", () => {
    const result = buildFlokkerReason(
      { name: "Gyeongbokgung", destinationCity: "Seoul", avgRating: 4.666, ratingCount: 5 },
      ctx
    );
    expect(result).toContain("4.7");
  });
});
