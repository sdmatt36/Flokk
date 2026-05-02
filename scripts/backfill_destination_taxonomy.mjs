import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_GEOCODING_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('No Google API key found in env. Expected GOOGLE_MAPS_API_KEY or similar.');
  process.exit(1);
}

const LIMIT = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : null;
const DRY_RUN = process.argv.includes('--dry-run');

// Haversine diagonal in km between two lat/lng points
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Classify a Geocoding result into our DestinationType
// Uses address_components ISLAND precheck, then types[], then viewport size to disambiguate metro-prefectures
function classifyResult(result, query) {
  const googleTypes = result?.types || [];
  const components = result?.address_components || [];
  const viewport = result?.geometry?.viewport;
  const diagKm = viewport ? haversineKm(viewport.southwest, viewport.northeast) : null;
  const queryLower = (query || '').toLowerCase();

  // ISLAND PRECHECK: any address_component is a natural_feature whose name is in the query
  // Catches Hokkaido, Okinawa, Sicily, Hawaii even when Google tags the top result as admin-1
  const islandComponent = components.find((c) => {
    if (!c.types?.includes('natural_feature')) return false;
    const name = (c.long_name || '').toLowerCase();
    return name && queryLower.includes(name);
  });
  if (islandComponent) {
    return { type: 'ISLAND', diagKm, ambiguous: false, signal: 'natural_feature_component' };
  }

  // COUNTRY: tagged as country, but downgrade microstates to CITY (Vatican, Monaco, etc.)
  if (googleTypes.includes('country')) {
    if (diagKm !== null && diagKm < 30) return { type: 'CITY', diagKm, ambiguous: false, signal: 'country_microstate' };
    return { type: 'COUNTRY', diagKm, ambiguous: false, signal: 'country' };
  }

  // ISLAND: explicit natural_feature on the top result itself
  if (googleTypes.includes('natural_feature')) {
    return { type: 'ISLAND', diagKm, ambiguous: false, signal: 'natural_feature_top' };
  }

  // CITY: explicit locality tag — strongest signal
  if (googleTypes.includes('locality')) {
    return { type: 'CITY', diagKm, ambiguous: false, signal: 'locality' };
  }

  // administrative_area_level_1 needs viewport disambiguation
  // Seoul (~48km), Singapore (~40km), Hong Kong (~50km) are admin-1 with city-sized viewports
  // Tokyo (337km) is mid-band; California (~1300km), Hawaii (~800km) are large
  if (googleTypes.includes('administrative_area_level_1')) {
    if (diagKm === null) return { type: 'STATE', diagKm: null, ambiguous: true, signal: 'admin1_no_viewport' };
    if (diagKm < 400) return { type: 'CITY', diagKm, ambiguous: false, signal: 'admin1_small_viewport' };
    if (diagKm < 1000) return { type: 'STATE', diagKm, ambiguous: true, signal: 'admin1_mid_viewport_review' };
    return { type: 'STATE', diagKm, ambiguous: false, signal: 'admin1_large_viewport' };
  }

  // REGION fallback — covers admin levels 2 through 4, colloquial areas, sublocalities
  // admin_level_3/4 catches small towns and villages that aren't tagged as locality
  // (Canggu in Bali, Tuscan hill towns, Japanese towns smaller than locality, etc.)
  if (
    googleTypes.includes('administrative_area_level_2') ||
    googleTypes.includes('administrative_area_level_3') ||
    googleTypes.includes('administrative_area_level_4') ||
    googleTypes.includes('colloquial_area') ||
    googleTypes.includes('sublocality')
  ) {
    return { type: 'REGION', diagKm, ambiguous: false, signal: 'region_admin' };
  }

  return { type: null, diagKm, ambiguous: true, signal: 'unmapped' };
}

async function geocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.length) {
    return { ok: false, status: json.status, results: [] };
  }
  return { ok: true, status: json.status, results: json.results };
}

// For destinations whose admin viewport is too large for tour generation,
// re-geocode "central <name>" to get the urban-core viewport.
// If the re-geocode doesn't yield a tighter result, synthesize a viewport
// from the destination center point with type-aware radius.
async function resolveUrbanCore(destinationName, originalViewport, originalDiagKm, centerLat, centerLng, type) {
  if (originalDiagKm === null || originalDiagKm <= 100) {
    return { viewport: originalViewport, source: 'original' };
  }

  // Try urban-core re-geocode first
  const stem = destinationName.split(',')[0].trim();
  const coreQuery = `central ${stem}`;
  let regeocodeResult = null;
  try {
    const result = await geocode(coreQuery);
    if (result.ok && result.results?.length) {
      const top = result.results[0];
      const coreViewport = top.geometry?.viewport;
      if (coreViewport) {
        const coreDiagKm = haversineKm(coreViewport.southwest, coreViewport.northeast);
        if (coreDiagKm !== null && coreDiagKm < originalDiagKm * 0.7) {
          return { viewport: coreViewport, source: 'urban_core', coreDiagKm };
        }
        regeocodeResult = { coreDiagKm, reason: 'not_smaller' };
      } else {
        regeocodeResult = { reason: 'no_viewport' };
      }
    } else {
      regeocodeResult = { reason: 'no_result' };
    }
  } catch (e) {
    regeocodeResult = { reason: 'error', error: String(e) };
  }

  // Fallback: synthesize a viewport from the center point with type-aware radius
  if (centerLat != null && centerLng != null) {
    // CITY: 15km — captures urban core, walkable in a day
    // STATE / ISLAND / COUNTRY / REGION: 50km — captures urban hub + immediate surroundings
    const radiusKm = type === 'CITY' ? 15 : 50;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));
    const synthesized = {
      northeast: { lat: centerLat + latDelta, lng: centerLng + lngDelta },
      southwest: { lat: centerLat - latDelta, lng: centerLng - lngDelta },
    };
    return {
      viewport: synthesized,
      source: 'synthesized_from_center',
      radiusKm,
      regeocodeReason: regeocodeResult?.reason ?? 'unknown',
    };
  }

  // No center point available — return original as last resort
  return { viewport: originalViewport, source: 'fallback_no_center', regeocodeReason: regeocodeResult?.reason ?? 'unknown' };
}

function buildStructured(components) {
  const out = {};
  for (const c of components || []) {
    if (c.types.includes('locality')) out.city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) {
      out.state = c.long_name;
      out.stateShort = c.short_name;
    }
    if (c.types.includes('administrative_area_level_2')) out.region = c.long_name;
    if (c.types.includes('country')) {
      out.country = c.long_name;
      out.countryShort = c.short_name;
    }
    if (c.types.includes('natural_feature')) out.island = c.long_name;
    if (c.types.includes('colloquial_area')) out.colloquial = c.long_name;
  }
  return out;
}

async function processRow(row, table) {
  const query = [row.destinationCity, row.destinationCountry].filter(Boolean).join(', ');
  if (!query) return { row, decision: 'SKIP_NO_QUERY' };

  const result = await geocode(query);

  if (!result.ok || result.results.length === 0) {
    return { row, decision: 'NO_RESULT', query, status: result.status };
  }

  const top = result.results[0];
  const classification = classifyResult(top, query);
  const type = classification.type;

  const formatted = (top.formatted_address || '').toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/[\s,]+/).filter((t) => t.length > 2);
  const matchedTokens = queryTokens.filter((t) => formatted.includes(t)).length;
  const tokenMatchRatio = queryTokens.length ? matchedTokens / queryTokens.length : 0;

  const lowConfidence =
    type === null ||
    classification.ambiguous ||
    tokenMatchRatio < 0.3 ||
    result.results.length > 3;

  if (lowConfidence) {
    return {
      row,
      decision: 'REVIEW',
      query,
      type,
      classification,
      tokenMatchRatio,
      candidates: result.results.slice(0, 3).map((r) => ({
        formatted: r.formatted_address,
        types: r.types,
        placeId: r.place_id,
      })),
    };
  }

  // Resolve tour viewport: for any destination with admin viewport > 100km, re-geocode for urban core
  // Type-independent: applies to CITY, STATE, ISLAND, COUNTRY, REGION alike. Tour viewport is the
  // bounding box where stops should actually be placed, distinct from the destination's full extent.
  let tourViewport = top.geometry?.viewport ?? null;
  let tourViewportSource = 'destination_viewport';
  if (classification.diagKm !== null && classification.diagKm > 100) {
    const resolved = await resolveUrbanCore(
      top.formatted_address || query,
      top.geometry?.viewport,
      classification.diagKm,
      top.geometry?.location?.lat ?? null,
      top.geometry?.location?.lng ?? null,
      type
    );
    tourViewport = resolved.viewport;
    tourViewportSource = resolved.source;
    await new Promise((res) => setTimeout(res, 50));
  }

  const update = {
    destinationType: type,
    destinationName: top.formatted_address,
    destinationPlaceId: top.place_id,
    destinationStructured: buildStructured(top.address_components),
    destinationCenterLat: top.geometry?.location?.lat ?? null,
    destinationCenterLng: top.geometry?.location?.lng ?? null,
    destinationViewportNE: top.geometry?.viewport?.northeast ?? null,
    destinationViewportSW: top.geometry?.viewport?.southwest ?? null,
    tourViewportNE: tourViewport?.northeast ?? null,
    tourViewportSW: tourViewport?.southwest ?? null,
  };

  if (!DRY_RUN) {
    if (table === 'trip') {
      await prisma.trip.update({ where: { id: row.id }, data: update });
    } else {
      await prisma.generatedTour.update({ where: { id: row.id }, data: update });
    }
  }

  return { row, decision: 'OK', query, type, placeId: top.place_id, classification, tourViewport, tourViewportSource };
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE WRITE'}`);
  if (LIMIT) console.log(`Limited to ${LIMIT} rows per table`);

  const tripSql = LIMIT
    ? `SELECT id, "destinationCity", "destinationCountry" FROM "Trip" WHERE "destinationCity" IS NOT NULL AND "destinationPlaceId" IS NULL LIMIT ${LIMIT}`
    : `SELECT id, "destinationCity", "destinationCountry" FROM "Trip" WHERE "destinationCity" IS NOT NULL AND "destinationPlaceId" IS NULL`;
  const tourSql = LIMIT
    ? `SELECT id, "destinationCity", "destinationCountry" FROM "GeneratedTour" WHERE "destinationCity" IS NOT NULL AND "destinationPlaceId" IS NULL LIMIT ${LIMIT}`
    : `SELECT id, "destinationCity", "destinationCountry" FROM "GeneratedTour" WHERE "destinationCity" IS NOT NULL AND "destinationPlaceId" IS NULL`;

  const trips = await prisma.$queryRawUnsafe(tripSql);
  const tours = await prisma.$queryRawUnsafe(tourSql);

  console.log(`\nProcessing ${trips.length} trips and ${tours.length} generated tours\n`);

  const reviewQueue = [];
  let okCount = 0;
  let noResultCount = 0;
  let skipCount = 0;

  for (const t of trips) {
    const r = await processRow(t, 'trip');
    if (r.decision === 'OK') okCount++;
    else if (r.decision === 'REVIEW') reviewQueue.push({ table: 'Trip', ...r });
    else if (r.decision === 'NO_RESULT') {
      noResultCount++;
      reviewQueue.push({ table: 'Trip', ...r });
    } else skipCount++;
    console.log(`Trip ${t.id.slice(0, 8)} [${r.decision}] ${r.query ?? ''} ${r.type ?? ''} ${r.classification?.diagKm != null ? '(' + Math.round(r.classification.diagKm) + 'km, ' + r.classification.signal + ')' : ''}${r.tourViewportSource && r.tourViewportSource !== 'destination_viewport' ? ' [tour:' + r.tourViewportSource + ']' : ''}`);
    await new Promise((res) => setTimeout(res, 50));
  }

  for (const t of tours) {
    const r = await processRow(t, 'tour');
    if (r.decision === 'OK') okCount++;
    else if (r.decision === 'REVIEW') reviewQueue.push({ table: 'GeneratedTour', ...r });
    else if (r.decision === 'NO_RESULT') {
      noResultCount++;
      reviewQueue.push({ table: 'GeneratedTour', ...r });
    } else skipCount++;
    console.log(`Tour ${t.id.slice(0, 8)} [${r.decision}] ${r.query ?? ''} ${r.type ?? ''} ${r.classification?.diagKm != null ? '(' + Math.round(r.classification.diagKm) + 'km, ' + r.classification.signal + ')' : ''}${r.tourViewportSource && r.tourViewportSource !== 'destination_viewport' ? ' [tour:' + r.tourViewportSource + ']' : ''}`);
    await new Promise((res) => setTimeout(res, 50));
  }

  console.log(`\nSummary: OK=${okCount}, REVIEW=${reviewQueue.filter((r) => r.decision === 'REVIEW').length}, NO_RESULT=${noResultCount}, SKIP=${skipCount}`);

  if (reviewQueue.length > 0) {
    const csvRows = [
      ['table', 'id', 'query', 'decision', 'tokenMatchRatio', 'topCandidate1Formatted', 'topCandidate1Types', 'topCandidate1PlaceId', 'topCandidate2Formatted', 'topCandidate3Formatted'],
    ];
    for (const r of reviewQueue) {
      csvRows.push([
        r.table,
        r.row.id,
        r.query ?? '',
        r.decision,
        r.tokenMatchRatio?.toFixed(2) ?? '',
        r.candidates?.[0]?.formatted ?? '',
        r.candidates?.[0]?.types?.join('|') ?? '',
        r.candidates?.[0]?.placeId ?? '',
        r.candidates?.[1]?.formatted ?? '',
        r.candidates?.[2]?.formatted ?? '',
      ]);
    }
    const csv = csvRows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const path = '/tmp/destination_backfill_review.csv';
    writeFileSync(path, csv);
    console.log(`\nReview queue written to ${path} (${reviewQueue.length} rows)`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
