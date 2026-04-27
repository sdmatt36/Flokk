import { describe, it, expect } from "vitest";
import { mapPlaceTypesToCanonicalSlugs } from "../categories";

describe("mapPlaceTypesToCanonicalSlugs", () => {
  it("specific type wins — restaurant first", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["restaurant", "food", "establishment"])).toEqual(["food_and_drink"]);
  });

  it("specific type wins over generic — museum beats tourist_attraction", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["museum", "tourist_attraction", "establishment"])).toEqual(["culture"]);
  });

  it("specific type wins — amusement_park beats tourist_attraction", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["amusement_park", "tourist_attraction"])).toEqual(["kids_and_family"]);
  });

  it("generic fallback — tourist_attraction + point_of_interest → experiences", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["tourist_attraction", "point_of_interest"])).toEqual(["experiences"]);
  });

  it("lone establishment falls back to experiences", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["establishment"])).toEqual(["experiences"]);
  });

  it("empty array → empty", () => {
    expect(mapPlaceTypesToCanonicalSlugs([])).toEqual([]);
  });

  it("null → empty", () => {
    expect(mapPlaceTypesToCanonicalSlugs(null)).toEqual([]);
  });

  it("undefined → empty", () => {
    expect(mapPlaceTypesToCanonicalSlugs(undefined)).toEqual([]);
  });

  it("unknown type with no generic → empty", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["unknown_type"])).toEqual([]);
  });

  it("first specific type in array wins — lodging before hotel → lodging (single result)", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["lodging", "hotel"])).toEqual(["lodging"]);
  });

  it("park → nature_and_outdoors", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["park", "natural_feature"])).toEqual(["nature_and_outdoors"]);
  });

  it("spa → wellness", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["spa"])).toEqual(["wellness"]);
  });

  it("stadium beats establishment → sports_and_entertainment", () => {
    expect(mapPlaceTypesToCanonicalSlugs(["stadium", "establishment"])).toEqual(["sports_and_entertainment"]);
  });
});
