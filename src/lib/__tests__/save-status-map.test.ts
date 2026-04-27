import { describe, it, expect } from "vitest";
import { buildSaveStatusMap } from "../save-status-map";


const baseSave = {
  dayIndex: null,
  hasItineraryLink: false,
  hasBooking: false,
  userRating: null,
  tripStatus: null,
  tripEndDate: null,
};

describe("buildSaveStatusMap", () => {
  it("single save produces a single entry", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Cape Manzamo", destinationCity: "Okinawa", ...baseSave },
    ]);
    expect(map.size).toBe(1);
    expect(map.get("cape manzamo|okinawa")?.status).toBe("saved");
  });

  it("two saves with different keys produce two entries", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Cape Manzamo", destinationCity: "Okinawa", ...baseSave },
      { rawTitle: "Shuri Castle", destinationCity: "Okinawa", ...baseSave },
    ]);
    expect(map.size).toBe(2);
  });

  it("duplicate key: on_itinerary wins over saved", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Cape Manzamo", destinationCity: "Okinawa", ...baseSave, dayIndex: 3 },
      { rawTitle: "Cape Manzamo", destinationCity: "Okinawa", ...baseSave },
    ]);
    expect(map.get("cape manzamo|okinawa")?.status).toBe("on_itinerary");
  });

  it("duplicate key: higher progression wins regardless of insertion order", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Place X", destinationCity: "Tokyo", ...baseSave },
      { rawTitle: "Place X", destinationCity: "Tokyo", ...baseSave, hasBooking: true },
    ]);
    expect(map.get("place x|tokyo")?.status).toBe("booked");
  });

  it("duplicate key: rated beats booked", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Place X", destinationCity: "Tokyo", ...baseSave, hasBooking: true },
      { rawTitle: "Place X", destinationCity: "Tokyo", ...baseSave, userRating: 4 },
    ]);
    expect(map.get("place x|tokyo")?.status).toBe("rated");
  });

  it("empty rawTitle is skipped", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "", destinationCity: "Tokyo", ...baseSave },
      { rawTitle: null, destinationCity: "Tokyo", ...baseSave },
      { rawTitle: "   ", destinationCity: "Tokyo", ...baseSave },
    ]);
    expect(map.size).toBe(0);
  });

  it("missing destinationCity treated as empty string", () => {
    const map = buildSaveStatusMap([
      { rawTitle: "Cape Manzamo", destinationCity: null, ...baseSave },
    ]);
    expect(map.get("cape manzamo|")).toBeDefined();
  });

  it("empty saves array returns empty map", () => {
    const map = buildSaveStatusMap([]);
    expect(map.size).toBe(0);
  });
});
