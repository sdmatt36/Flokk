#!/usr/bin/env node
// Build src/data/airports.json from OurAirports dataset.
// Filter: large_airport + medium_airport + non-empty IATA + scheduled_service=yes.
// Run manually: node scripts/build-airports.mjs
// Commit the resulting JSON. Do NOT run this in CI.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PRIMARY_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const FALLBACK_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

async function fetchCsv() {
  for (const url of [PRIMARY_URL, FALLBACK_URL]) {
    try {
      console.log(`Fetching ${url}...`);
      const res = await fetch(url);
      if (res.ok) return await res.text();
      console.warn(`  HTTP ${res.status}, trying next source`);
    } catch (err) {
      console.warn(`  Fetch error: ${err.message}, trying next source`);
    }
  }
  throw new Error('All OurAirports sources failed');
}

async function main() {
  const csv = await fetchCsv();
  console.log(`Downloaded ${(csv.length / 1024).toFixed(0)} KB`);

  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  console.log(`Parsed ${rows.length} total rows`);

  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const SIZE_MAP = { large_airport: 'large', medium_airport: 'medium' };

  const withIata = rows.filter(r => SIZE_MAP[r.type] && r.iata_code && r.iata_code.length === 3);
  const schedYes = withIata.filter(r => r.scheduled_service === 'yes').length;
  const schedNo = withIata.length - schedYes;
  console.log(`IATA airports: ${withIata.length} (scheduled=yes: ${schedYes}, scheduled=no: ${schedNo})`);

  const filtered = withIata
    .map(r => {
      let countryName = r.iso_country;
      try { countryName = regionNames.of(r.iso_country) || r.iso_country; } catch {}
      return {
        iata: r.iata_code.toUpperCase(),
        name: r.name,
        city: r.municipality || r.name,
        country: countryName,
        countryCode: r.iso_country,
        lat: Number(r.latitude_deg),
        lng: Number(r.longitude_deg),
        size: SIZE_MAP[r.type],
      };
    })
    .sort((a, b) => {
      if (a.size !== b.size) return a.size === 'large' ? -1 : 1;
      return a.iata.localeCompare(b.iata);
    });

  const seen = new Set();
  const deduped = filtered.filter(a => {
    if (seen.has(a.iata)) return false;
    seen.add(a.iata);
    return true;
  });

  if (deduped.length < 4000 || deduped.length > 5500) {
    console.error(`\nUNEXPECTED COUNT: ${deduped.length} (expected 4000-5500)`);
    console.error('Upstream data may have changed. Review before committing.');
    process.exit(1);
  }

  const outPath = resolve(ROOT, 'src/data/airports.json');
  writeFileSync(outPath, JSON.stringify(deduped) + '\n');

  const large = deduped.filter(a => a.size === 'large').length;
  const medium = deduped.filter(a => a.size === 'medium').length;
  console.log(`\nWrote ${deduped.length} airports to src/data/airports.json`);
  console.log(`  Large: ${large}`);
  console.log(`  Medium: ${medium}`);
  console.log(`  Raw size: ${(JSON.stringify(deduped).length / 1024).toFixed(0)} KB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
