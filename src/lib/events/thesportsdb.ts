// TheSportsDB Phase A adapter — sports_events only.
// Free tier API key is the literal string "123" (publicly documented, no registration).
// Patreon tier ($3/mo) unlocks additional endpoints; not needed for Phase A.
//
// Coverage gaps (Phase A known limitations):
// - venueLat/venueLng are null — free tier doesn't return venue coordinates.
//   Proximity scoring in the endpoint skips location ranking for sports events.
// - KBO and NPB (Korea/Japan baseball) league coverage verified during commit 3 endpoint test.
// - eventsnext.php returns up to 25 upcoming events per team; events older than today are excluded.
// - City matching is text-based (strCity/strStadiumLocation). Outlying stadium locations
//   (e.g., a team whose strCity is a suburb) may miss if the query city doesn't substring-match.

import type { EventQueryParams, RawEvent } from "./types";

const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";

// Major spectator sports queried per country. Order matters only for rate-limit bookkeeping.
const SPORTS = ["Soccer", "Baseball", "Basketball", "Ice Hockey", "Cricket", "Rugby"];

type ApiLeague = { idLeague: string; strLeague: string };
type ApiTeam = {
  idTeam: string;
  strTeam: string;
  strCity: string | null;
  strStadiumLocation: string | null;
};
type ApiEvent = {
  idEvent: string;
  strEvent: string;
  strVenue: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strThumb: string | null;
};

function teamInCity(team: ApiTeam, city: string): boolean {
  const target = city.toLowerCase();
  const fields = [team.strCity, team.strStadiumLocation].filter(Boolean) as string[];
  return fields.some(
    (f) => f.toLowerCase().includes(target) || target.includes(f.toLowerCase())
  );
}

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

  if (!params.country) {
    console.warn("[thesportsdb] No country in params, cannot discover leagues");
    return [];
  }

  const base = `${THESPORTSDB_BASE}/${apiKey}`;
  const seenEventIds = new Set<string>();
  const events: RawEvent[] = [];

  for (const sport of SPORTS) {
    // Step 1: leagues in country for this sport. Failure here must not cascade to other sports.
    const leaguesData = await fetchJson<{ countrys?: ApiLeague[] }>(
      `${base}/search_all_leagues.php?c=${encodeURIComponent(params.country)}&s=${encodeURIComponent(sport)}`
    );
    const leagues = leaguesData?.countrys ?? [];

    for (const league of leagues) {
      // Step 2: all teams in league, filter by city
      const teamsData = await fetchJson<{ teams?: ApiTeam[] }>(
        `${base}/lookup_all_teams.php?id=${league.idLeague}`
      );
      const cityTeams = (teamsData?.teams ?? []).filter((t) => teamInCity(t, params.city));

      for (const team of cityTeams) {
        // Step 3: next events for team (up to 25 on free tier)
        const eventsData = await fetchJson<{ events?: ApiEvent[] }>(
          `${base}/eventsnext.php?id=${team.idTeam}`
        );

        for (const ev of eventsData?.events ?? []) {
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
    }
  }

  return events;
}
