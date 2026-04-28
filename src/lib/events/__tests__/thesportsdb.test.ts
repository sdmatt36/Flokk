import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSportsDBEvents } from "../thesportsdb";
import type { EventQueryParams } from "../types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const BUSAN_PARAMS: EventQueryParams = {
  city: "Busan",
  country: "South Korea",
  startDate: new Date("2026-04-03T00:00:00"),
  endDate: new Date("2026-04-06T23:59:59"),
  categories: ["sports_events"],
};

// Wires up mockFetch for a "Lotte Giants events in Busan" run.
// searchteams?t=Busan → Lotte Giants (Baseball).
// eventsnext for Lotte Giants → one event in range, one outside.
function setupLotteGiantsMock(inRangeDate: string, outOfRangeDate: string) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("searchteams.php") && url.includes("Busan")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            teams: [
              { idTeam: "133739", strTeam: "Lotte Giants", strSport: "Baseball" },
            ],
          }),
      });
    }
    if (url.includes("eventsnext.php?id=133739")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              {
                idEvent: "evt_in",
                strEvent: "Lotte Giants vs Samsung Lions",
                strVenue: "Sajik Baseball Stadium",
                dateEvent: inRangeDate,
                strTime: "18:00:00",
                strThumb: null,
              },
              {
                idEvent: "evt_out",
                strEvent: "Lotte Giants vs Kia Tigers",
                strVenue: "Sajik Baseball Stadium",
                dateEvent: outOfRangeDate,
                strTime: "18:00:00",
                strThumb: null,
              },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

afterEach(() => {
  mockFetch.mockReset();
  vi.unstubAllEnvs();
});

describe("fetchSportsDBEvents", () => {
  it("returns empty array when sports_events not in categories", async () => {
    const params: EventQueryParams = { ...BUSAN_PARAMS, categories: ["live_music"] };
    const result = await fetchSportsDBEvents(params);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array when API key is empty string", async () => {
    vi.stubEnv("THESPORTSDB_API_KEY", "");
    const result = await fetchSportsDBEvents(BUSAN_PARAMS);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("city team search returns Lotte Giants event in date range", async () => {
    setupLotteGiantsMock("2026-04-04", "2026-04-10");
    const result = await fetchSportsDBEvents(BUSAN_PARAMS);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Lotte Giants vs Samsung Lions");
    expect(result[0].sourceProvider).toBe("thesportsdb");
    expect(result[0].category).toBe("sports_events");
    expect(result[0].venue).toBe("Sajik Baseball Stadium");
    expect(result[0].venueLat).toBeNull();
    expect(result[0].venueLng).toBeNull();
  });

  it("date range filter excludes events outside window", async () => {
    setupLotteGiantsMock("2026-04-04", "2026-04-10");
    const result = await fetchSportsDBEvents(BUSAN_PARAMS);

    const titles = result.map((e) => e.title);
    expect(titles).not.toContain("Lotte Giants vs Kia Tigers");
  });

  it("failed event lookup for one team does not cascade to other teams", async () => {
    const chicagoParams: EventQueryParams = {
      city: "Chicago",
      country: "United States",
      startDate: new Date("2026-04-03T00:00:00"),
      endDate: new Date("2026-04-06T23:59:59"),
      categories: ["sports_events"],
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("searchteams.php") && url.includes("Chicago")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              teams: [
                { idTeam: "135269", strTeam: "Chicago Cubs", strSport: "Baseball" },
                { idTeam: "135253", strTeam: "Chicago White Sox", strSport: "Baseball" },
              ],
            }),
        });
      }
      // Cubs lookup hard-fails
      if (url.includes("eventsnext.php?id=135269")) {
        return Promise.reject(new Error("Network error"));
      }
      // White Sox succeeds
      if (url.includes("eventsnext.php?id=135253")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              events: [
                {
                  idEvent: "evt1",
                  strEvent: "White Sox vs Tigers",
                  strVenue: "Guaranteed Rate Field",
                  dateEvent: "2026-04-04",
                  strTime: "18:00:00",
                  strThumb: null,
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const result = await fetchSportsDBEvents(chicagoParams);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("White Sox vs Tigers");
  });
});
