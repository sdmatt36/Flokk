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

// Returns an empty leagues response for all sports except the one provided.
function makeLeagueResponse(forSport: string, sport: string): object {
  if (sport !== forSport) return { countrys: [] };
  return {
    countrys: [{ idLeague: "4408", strLeague: "Korean Baseball Organization League" }],
  };
}

// Wires up mockFetch for a full "Lotte Giants events in Busan" run.
// Soccer/Basketball/IceHockey/Cricket/Rugby leagues → empty.
// Baseball leagues → KBO.
// KBO teams → Lotte Giants (strCity: Busan).
// Lotte Giants next events → one in range, one outside.
function setupLotteGiantsMock(inRangeDate: string, outOfRangeDate: string) {
  const sports = ["Soccer", "Baseball", "Basketball", "Ice Hockey", "Cricket", "Rugby"];
  mockFetch.mockImplementation((url: string) => {
    // League lookups
    for (const sport of sports) {
      if (url.includes("search_all_leagues.php") && url.includes(encodeURIComponent(sport))) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeLeagueResponse("Baseball", sport)),
        });
      }
    }
    // Team lookup for KBO
    if (url.includes("lookup_all_teams.php?id=4408")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            teams: [
              { idTeam: "133739", strTeam: "Lotte Giants", strCity: "Busan", strStadiumLocation: "Busan" },
            ],
          }),
      });
    }
    // Events for Lotte Giants
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

  it("KBO team in Busan returns Lotte Giants event in date range", async () => {
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

  it("failed league lookup does not cascade to other sports", async () => {
    const sports = ["Soccer", "Baseball", "Basketball", "Ice Hockey", "Cricket", "Rugby"];
    mockFetch.mockImplementation((url: string) => {
      // Soccer league lookup hard-fails
      if (url.includes("search_all_leagues.php") && url.includes("Soccer")) {
        return Promise.reject(new Error("Network error"));
      }
      // Baseball league lookup succeeds with KBO
      for (const sport of sports) {
        if (url.includes("search_all_leagues.php") && url.includes(encodeURIComponent(sport))) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(makeLeagueResponse("Baseball", sport)),
          });
        }
      }
      if (url.includes("lookup_all_teams.php?id=4408")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              teams: [
                { idTeam: "133739", strTeam: "Lotte Giants", strCity: "Busan", strStadiumLocation: "Busan" },
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
                  idEvent: "evt1",
                  strEvent: "Lotte Giants vs NC Dinos",
                  strVenue: "Sajik Baseball Stadium",
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

    const result = await fetchSportsDBEvents(BUSAN_PARAMS);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Lotte Giants vs NC Dinos");
  });
});
