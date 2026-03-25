/**
 * Backfill placePhotoUrl for COMPLETED+PUBLIC trip SavedItems with null placePhotoUrl.
 * Uses Google Places findplacefromtext with location bias where available.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, '..', '.env.local');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m) envVars[m[1]] = m[2];
}

const DB_URL = envVars.DATABASE_URL;
const GOOGLE_MAPS_API_KEY = envVars.GOOGLE_MAPS_API_KEY;

if (!DB_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }
if (!GOOGLE_MAPS_API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY'); process.exit(1); }
console.log(`API key prefix: ${GOOGLE_MAPS_API_KEY.substring(0, 10)}…`);

const { Pool } = pg;
const pool = new Pool({ connectionString: DB_URL });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getPlacePhoto(title, lat, lng) {
  const locationBias = (lat != null && lng != null)
    ? `&location=${lat},${lng}&radius=2000`
    : '';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(title)}&inputtype=textquery&fields=photos${locationBias}&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.candidates?.[0]) return null;
    const ref = data.candidates[0].photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_MAPS_API_KEY}`;
  } catch (e) {
    console.error(`  [places error] ${title}: ${e.message}`);
    return null;
  }
}

// Fetch all COMPLETED+PUBLIC items with null placePhotoUrl
const { rows: items } = await pool.query(`
  SELECT si.id, si."rawTitle", si.lat, si.lng
  FROM "SavedItem" si
  JOIN "Trip" t ON si."tripId" = t.id
  WHERE t.status = 'COMPLETED' AND t.privacy = 'PUBLIC'
  AND si."placePhotoUrl" IS NULL
  AND si."rawTitle" IS NOT NULL
  ORDER BY t."destinationCity", si."rawTitle"
`);

console.log(`\n${items.length} items to process\n`);

let updated = 0;
let skipped = 0;

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const photoUrl = await getPlacePhoto(item.rawTitle, item.lat, item.lng);

  if (photoUrl) {
    await pool.query(
      `UPDATE "SavedItem" SET "placePhotoUrl" = $1 WHERE id = $2`,
      [photoUrl, item.id]
    );
    console.log(`  ✓ ${item.rawTitle.substring(0, 50).padEnd(51)} → saved`);
    updated++;
  } else {
    console.log(`  ✗ ${item.rawTitle.substring(0, 50).padEnd(51)} → no photo`);
    skipped++;
  }

  // Rate limit: 500ms between requests
  if (i < items.length - 1) await sleep(500);
}

console.log(`\nDone — updated: ${updated}, no photo: ${skipped}`);
await pool.end();
