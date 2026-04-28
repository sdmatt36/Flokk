// TheSportsDB Phase A adapter — sports_events only.
// Free tier API key is the literal string "123" (publicly documented, no registration).
//
// Discovery path: searchteams.php?t={city} — teams whose name includes the city name.
// Works for US/EU cities where teams are named after cities (Chicago Cubs, Manchester City, etc.).
// Known gap: Korean/Japanese teams use sponsor names (Lotte Giants, not Busan Giants) —
// they won't be discovered this way. Phase A limitation.
//
// eventsnext.php returns up to 25 upcoming events per team; past trips return zero events.
// venueLat/venueLng are null on the free tier.

import type { EventQueryParams, RawEvent } from "./types";

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";

const SPORTS_FILTER = new Set(["Soccer", "Baseball", "Basketball", "Ice Hockey", "Cricket", "Rugby"]);

type ApiTeam = {
  idTeam: string;
  strTeam: string;
  strSport: string | null;
};
type ApiEvent = {
  idEvent: string;
  strEvent: string;
  strVenue: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strThumb: string | null;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSportsDBEvents(params: EventQueryParams): Promise<RawEvent[]> {
  if (!params.categories.includes("sports_events")) return [];

  // Key is read at call time (not module init) so vi.stubEnv works in tests without dynamic import.
  const apiKey = process.env.THESPORTSDB_API_KEY ?? "123";
  if (!apiKey) {
    console.warn("[thesportsdb] API key empty, skipping sports events");
    return [];
  }

  const base = `${THESPORTSDB_BASE}/${apiKey}`;

  // Step 1: find teams in the target city by city name
  const teamsData = await fetchJson<{ teams?: ApiTeam[] }>(
    `${base}/searchteams.php?t=${encodeURIComponent(params.city)}`
  );
  const teams = (teamsData?.teams ?? []).filter(
    (t) => t.strSport && SPORTS_FILTER.has(t.strSport)
  );

  if (teams.length === 0) return [];

  // Step 2: fetch next events for all city teams in parallel
  const teamEventArrays = await Promise.all(
    teams.map(async (team) => {
      const data = await fetchJson<{ events?: ApiEvent[] }>(
        `${base}/eventsnext.php?id=${team.idTeam}`
      );
      return data?.events ?? [];
    })
  );

  const seenEventIds = new Set<string>();
  const events: RawEvent[] = [];

  for (const teamEvents of teamEventArrays) {
    for (const ev of teamEvents) {
      if (!ev.idEvent || !ev.dateEvent || seenEventIds.has(ev.idEvent)) continue;
      seenEventIds.add(ev.idEvent);

      // strTime may include timezone offset (e.g. "18:00:00+09:00"). Strip offset — treat as local.
      const timeStr = (ev.strTime ?? "12:00:00").replace(/[+-]\d{2}:\d{2}$/, "");
      const startDateTime = new Date(`${ev.dateEvent}T${timeStr}`);
      if (isNaN(startDateTime.getTime())) continue;
      if (startDateTime < params.startDate || startDateTime > params.endDate) continue;

      events.push({
        sourceProvider: "thesportsdb",
        sourceEventId: ev.idEvent,
        category: "sports_events",
        title: ev.strEvent,
        venue: ev.strVenue ?? null,
        venueLat: null,
        venueLng: null,
        startDateTime,
        endDateTime: null,
        description: null,
        imageUrl: ev.strThumb ?? null,
        ticketUrl: null,
      });
    }
  }

  return events;
}
