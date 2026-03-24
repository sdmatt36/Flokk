/**
 * Backfill placePhotoUrl for all SavedItems where it is null.
 * Uses the same Google Places findplacefromtext flow as enrich-saved-item.ts.
 *
 * Phase 1: Matt's items (familyProfileId = 'cmmmv15y7000104jvocfz5kt6')
 * Phase 2: All remaining items with placePhotoUrl = null
 *
 * Runs in batches of 10 with 500ms delay between batches.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
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

console.log(`GOOGLE_MAPS_API_KEY prefix: ${GOOGLE_MAPS_API_KEY.substring(0, 10)}… (length: ${GOOGLE_MAPS_API_KEY.length})`);

const { Pool } = pg;
const pool = new Pool({ connectionString: DB_URL });

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getPlacePhoto(title, lat, lng) {
  const locationBias = (lat != null && lng != null)
    ? `&location=${lat},${lng}&radius=5000`
    : '';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(title)}&inputtype=textquery&fields=photos,rating${locationBias}&key=${GOOGLE_MAPS_API_KEY}`;
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

async function runPhase(label, whereExtra) {
  const countRes = await pool.query(`
    SELECT COUNT(*) FROM "SavedItem"
    WHERE "placePhotoUrl" IS NULL
    AND "rawTitle" IS NOT NULL
    ${whereExtra}
  `);
  const total = parseInt(countRes.rows[0].count, 10);
  console.log(`\n=== ${label} — ${total} items to process ===\n`);
  if (total === 0) return 0;

  let offset = 0;
  let updated = 0;
  let skipped = 0;

  while (offset < total) {
    const items = await pool.query(`
      SELECT id, "rawTitle", lat, lng, "destinationCity", "destinationCountry"
      FROM "SavedItem"
      WHERE "placePhotoUrl" IS NULL
      AND "rawTitle" IS NOT NULL
      ${whereExtra}
      ORDER BY "savedAt" DESC
      LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);

    if (!items.rows.length) break;

    console.log(`Batch ${Math.floor(offset / BATCH_SIZE) + 1}: items ${offset + 1}–${offset + items.rows.length} of ${total}`);

    for (const item of items.rows) {
      const title = item.rawTitle;
      const lat = item.lat ?? null;
      const lng = item.lng ?? null;
      const photoUrl = await getPlacePhoto(title, lat, lng);

      if (photoUrl) {
        await pool.query(
          `UPDATE "SavedItem" SET "placePhotoUrl" = $1 WHERE id = $2`,
          [photoUrl, item.id]
        );
        console.log(`  ✓ ${title.substring(0, 45).padEnd(46)} → photo saved`);
        updated++;
      } else {
        console.log(`  ✗ ${title.substring(0, 45).padEnd(46)} → no photo found`);
        skipped++;
      }
    }

    offset += items.rows.length;
    if (offset < total) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n${label} complete — updated: ${updated}, no photo: ${skipped}`);
  return updated;
}

// Phase 1: Matt's items
const mattUpdated = await runPhase(
  "Phase 1 — Matt's items",
  `AND "familyProfileId" = 'cmmmv15y7000104jvocfz5kt6'`
);

// Phase 2: All remaining
const othersUpdated = await runPhase(
  "Phase 2 — All other items",
  `AND "familyProfileId" != 'cmmmv15y7000104jvocfz5kt6'`
);

console.log(`\n=== TOTAL UPDATED: ${mattUpdated + othersUpdated} ===`);
await pool.end();
