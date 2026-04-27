import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before importing the module under test
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Stub the API key env var before import
vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-api-key");

// Dynamic import so env stub is in place before module-level const API_KEY is read
const { reverseGeocodeCityFromCoords } = await import("../google-places");

function makeGeoResponse(city: string): object {
  return {
    status: "OK",
    results: [
      {
        address_components: [
          { long_name: city, short_name: city, types: ["locality", "political"] },
          { long_name: "South Korea", short_name: "KR", types: ["country", "political"] },
        ],
      },
    ],
  };
}

function makeAdminFallbackResponse(adminName: string): object {
  return {
    status: "OK",
    results: [
      {
        address_components: [
          { long_name: adminName, short_name: adminName, types: ["administrative_area_level_2", "political"] },
          { long_name: "Japan", short_name: "JP", types: ["country", "political"] },
        ],
      },
    ],
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("reverseGeocodeCityFromCoords", () => {
  it("Busan coordinates → returns 'Busan'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGeoResponse("Busan"),
    });

    const result = await reverseGeocodeCityFromCoords({ lat: 35.1796, lng: 129.0756 });
    expect(result).toBe("Busan");
  });

  it("Seoul coordinates → returns 'Seoul'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGeoResponse("Seoul"),
    });

    const result = await reverseGeocodeCityFromCoords({ lat: 37.5665, lng: 126.978 });
    expect(result).toBe("Seoul");
  });

  it("locality-less result falls back to administrative_area_level_2", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeAdminFallbackResponse("Hokkaido"),
    });

    const result = await reverseGeocodeCityFromCoords({ lat: 43.0642, lng: 141.3469 });
    expect(result).toBe("Hokkaido");
  });

  it("ZERO_RESULTS → returns null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });

    const result = await reverseGeocodeCityFromCoords({ lat: 0, lng: 0 });
    expect(result).toBeNull();
  });

  it("non-OK HTTP response → returns null", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await reverseGeocodeCityFromCoords({ lat: 35.1796, lng: 129.0756 });
    expect(result).toBeNull();
  });

  it("fetch throws → returns null without propagating", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await reverseGeocodeCityFromCoords({ lat: 35.1796, lng: 129.0756 });
    expect(result).toBeNull();
  });
});
