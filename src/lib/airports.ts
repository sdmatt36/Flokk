import Fuse from 'fuse.js';
import airportsData from '@/data/airports.json';
import metrosData from '@/data/airport-metros.json';

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  size: 'large' | 'medium';
}

export interface Metro {
  code: string;
  city: string;
  country: string;
  airports: string[];
}

export const AIRPORTS: Airport[] = airportsData as Airport[];
export const METROS: Metro[] = metrosData as Metro[];

let codeMap: Map<string, Airport> | null = null;
function getCodeMap(): Map<string, Airport> {
  if (!codeMap) {
    codeMap = new Map(AIRPORTS.map(a => [a.iata, a]));
  }
  return codeMap;
}

export function getAirportByCode(code: string): Airport | null {
  if (!code) return null;
  return getCodeMap().get(code.toUpperCase()) ?? null;
}

export function getAirportCity(code: string): string {
  return getAirportByCode(code)?.city ?? code;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface IndexedAirport {
  airport: Airport;
  iata_n: string;
  city_n: string;
  name_n: string;
  country_n: string;
}

interface IndexedMetro {
  metro: Metro;
  city_n: string;
  code_n: string;
}

let airportFuse: Fuse<IndexedAirport> | null = null;
let metroFuse: Fuse<IndexedMetro> | null = null;

function getAirportFuse(): Fuse<IndexedAirport> {
  if (!airportFuse) {
    const indexed: IndexedAirport[] = AIRPORTS.map(a => ({
      airport: a,
      iata_n: normalize(a.iata),
      city_n: normalize(a.city),
      name_n: normalize(a.name),
      country_n: normalize(a.country),
    }));
    airportFuse = new Fuse(indexed, {
      keys: [
        { name: 'iata_n', weight: 2 },
        { name: 'city_n', weight: 1.5 },
        { name: 'name_n', weight: 1 },
        { name: 'country_n', weight: 0.5 },
      ],
      threshold: 0.2,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }
  return airportFuse;
}

function getMetroFuse(): Fuse<IndexedMetro> {
  if (!metroFuse) {
    const indexed: IndexedMetro[] = METROS.map(m => ({
      metro: m,
      city_n: normalize(m.city),
      code_n: normalize(m.code),
    }));
    metroFuse = new Fuse(indexed, {
      keys: ['city_n', 'code_n'],
      threshold: 0.2,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }
  return metroFuse;
}

let relaxedFuse: Fuse<IndexedAirport> | null = null;
function getRelaxedFuse(): Fuse<IndexedAirport> {
  if (!relaxedFuse) {
    const indexed: IndexedAirport[] = AIRPORTS.map(a => ({
      airport: a,
      iata_n: normalize(a.iata),
      city_n: normalize(a.city),
      name_n: normalize(a.name),
      country_n: normalize(a.country),
    }));
    relaxedFuse = new Fuse(indexed, {
      keys: [
        { name: 'city_n', weight: 1.5 },
        { name: 'name_n', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
  }
  return relaxedFuse;
}

export function searchAirports(query: string, limit = 10): Airport[] {
  const q = query.trim();
  if (!q) {
    return AIRPORTS.filter(a => a.size === 'large').slice(0, limit);
  }

  if (q.length === 3) {
    const exact = getAirportByCode(q);
    if (exact) return [exact];
  }

  const normalized = normalize(q);
  const merged: Airport[] = [];
  const seen = new Set<string>();

  const metroResults = getMetroFuse().search(normalized).slice(0, 2);
  const topMetroScore = metroResults[0]?.score ?? 1;
  for (const mr of metroResults) {
    for (const code of mr.item.metro.airports) {
      if (merged.length >= limit) break;
      const a = getAirportByCode(code);
      if (a && !seen.has(a.iata)) {
        seen.add(a.iata);
        merged.push(a);
      }
    }
    if (merged.length >= limit) break;
  }

  // Strong metro match ("tokyo" -> TYO metro at score ~0): return metro airports only.
  // Prevents fuzzy fallback from adding unrelated airports (NGO/TJH/LFW etc.)
  if (topMetroScore < 0.1 && merged.length > 0) {
    return merged;
  }

  const airportResults = getAirportFuse().search(normalized);
  const ranked = airportResults
    .map(r => ({
      airport: r.item.airport,
      adjustedScore: (r.score ?? 0) + (r.item.airport.size === 'medium' ? 0.05 : 0),
    }))
    .sort((a, b) => a.adjustedScore - b.adjustedScore);

  for (const r of ranked) {
    if (merged.length >= limit) break;
    if (!seen.has(r.airport.iata)) {
      seen.add(r.airport.iata);
      merged.push(r.airport);
    }
  }

  // Typo fallback: if nothing matched (e.g., "rekyjavik"), retry at a looser
  // threshold against city/name only. Kept out of the primary pass so normal
  // queries stay precise.
  if (merged.length === 0) {
    for (const r of getRelaxedFuse().search(normalized).slice(0, limit)) {
      if (!seen.has(r.item.airport.iata)) {
        seen.add(r.item.airport.iata);
        merged.push(r.item.airport);
      }
    }
  }

  return merged;
}
