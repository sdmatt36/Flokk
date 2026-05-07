// One-shot backfill: reverse-geocode toCity for null-toCity LODGING rows
// Run with: node /tmp/backfill-lodging-tocity.mjs
import pg from "pg";
const { Client } = pg;

const GOOGLE_MAPS_API_KEY = "AIzaSyBRoep2gJ1t-LANkCzplbS25Rtf7rL6IXA";
const DATABASE_URL = "postgresql://postgres.egnvlwgngyrkhhbxtlqa:KnMtaLDaFG3nBgi1@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function reverseGeocodeCity(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality&language=en&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) return null;
  const components = data.results[0].address_components;
  return components.find(c => c.types.includes("locality"))?.long_name
    ?? components.find(c => c.types.includes("sublocality"))?.long_name
    ?? components.find(c => c.types.includes("administrative_area_level_2"))?.long_name
    ?? null;
}

async function forwardGeocodeCity(hotelName) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(hotelName)}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  const components = first.address_components ?? [];
  return components.find(c => c.types.includes("locality"))?.long_name
    ?? components.find(c => c.types.includes("administrative_area_level_2"))?.long_name
    ?? null;
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(`
  SELECT id, title, latitude, longitude, "tripId"
  FROM "ItineraryItem"
  WHERE type = 'LODGING'
    AND (COALESCE("toCity", '') = '')
    AND title LIKE 'Check-in:%'
  ORDER BY "tripId", "dayIndex"
`);

console.log(`Found ${rows.length} null-toCity check-in rows`);

let resolved = 0;
let unresolved = 0;

for (const row of rows) {
  const hotelName = row.title.replace(/^check[\s-]?in:\s*/i, "").trim();
  let city = null;
  let method = "none";

  if (row.latitude != null && row.longitude != null) {
    city = await reverseGeocodeCity(row.latitude, row.longitude);
    if (city) method = "reverse";
  }

  if (!city) {
    city = await forwardGeocodeCity(hotelName);
    if (city) method = "forward";
  }

  if (city) {
    // Update this check-in row
    await client.query(`UPDATE "ItineraryItem" SET "toCity" = $1 WHERE id = $2`, [city, row.id]);
    // Update matching check-out for same hotel + trip
    await client.query(`
      UPDATE "ItineraryItem"
      SET "toCity" = $1
      WHERE "tripId" = $2
        AND type = 'LODGING'
        AND title = $3
        AND (COALESCE("toCity", '') = '')
    `, [city, row.tripId, `Check-out: ${hotelName}`]);
    console.log(`  [${method}] "${hotelName}" → ${city}`);
    resolved++;
  } else {
    console.log(`  [UNRESOLVED] "${hotelName}"`);
    unresolved++;
  }
}

await client.end();
console.log(`\nDone. Resolved: ${resolved}, Unresolved: ${unresolved}`);
