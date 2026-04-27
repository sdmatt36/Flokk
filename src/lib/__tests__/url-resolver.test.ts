import { describe, it, expect } from "vitest";
import { resolveCanonicalUrl } from "../url-resolver";

describe("resolveCanonicalUrl", () => {
  it("returns P1 website when provided", () => {
    const result = resolveCanonicalUrl({ website: "https://example.com", name: "Place", city: "City" });
    expect(result).toBe("https://example.com");
  });

  it("returns P2 Maps URL when placeId provided and no website", () => {
    const result = resolveCanonicalUrl({ placeId: "ChIJ123", name: "Place", city: "City" });
    expect(result).toBe("https://www.google.com/maps/place/?q=place_id:ChIJ123");
  });

  it("returns null when neither website nor placeId is available", () => {
    const result = resolveCanonicalUrl({ name: "Some Venue", city: "Tokyo" });
    expect(result).toBeNull();
  });

  it("prefers website over placeId when both present", () => {
    const result = resolveCanonicalUrl({ website: "https://example.com", placeId: "ChIJ123", name: "Place", city: "City" });
    expect(result).toBe("https://example.com");
  });
});
