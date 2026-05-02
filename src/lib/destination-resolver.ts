/**
 * Destination taxonomy resolver.
 *
 * Single source of truth for resolving a placeId or free-text query into the full
 * destination taxonomy payload (type, name, structured data, center, viewports).
 *
 * Used by:
 *   - Trip create write paths (lib/trip-builder.ts)
 *   - GeneratedTour create write paths (api/tours/save)
 *   - Backfill script (scripts/backfill_destination_taxonomy.mjs — refactored to import this)
 *
 * Per Discipline 4.27 (Shared Component / Shared API Verification): if you find yourself
 * duplicating any of this classification or viewport logic elsewhere, import from here instead.
 */

export type DestinationType = 'CITY' | 'STATE' | 'ISLAND' | 'COUNTRY' | 'REGION';

export type ViewportPoint = { lat: number; lng: number };
export type Viewport = { northeast: ViewportPoint; southwest: ViewportPoint };

export type StructuredAddress = {
  city?: string;
  state?: string;
  stateShort?: string;
  region?: string;
  country?: string;
  countryShort?: string;
  island?: string;
  colloquial?: string;
};

export type DestinationTaxonomy = {
  destinationType: DestinationType | null;
  destinationName: string;
  destinationPlaceId: string;
  destinationStructured: StructuredAddress;
  destinationCenterLat: number | null;
  destinationCenterLng: number | null;
  destinationViewportNE: ViewportPoint | null;
  destinationViewportSW: ViewportPoint | null;
  tourViewportNE: ViewportPoint | null;
  tourViewportSW: ViewportPoint | null;
  classification?: { signal: string; diagKm: number | null; ambiguous: boolean };
  tourViewportSource?: string;
};

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_GEOCODING_API_KEY ||
  '';

function haversineKm(a: ViewportPoint, b: ViewportPoint): number | null {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

type GeocodeResult = {
  place_id: string;
  formatted_address: string;
  types: string[];
  geometry: {
    location: ViewportPoint;
    viewport?: Viewport;
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
};

async function geocodeByPlaceId(placeId: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_API_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const json: any = await res.json();
  if (json.status !== 'OK' || !json.results?.length) return null;
  return json.results[0] as GeocodeResult;
}

async function geocodeByQuery(query: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_API_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const json: any = await res.json();
  if (json.status !== 'OK' || !json.results?.length) return null;
  return json.results[0] as GeocodeResult;
}

function classifyResult(
  result: GeocodeResult,
  query: string,
): { type: DestinationType | null; diagKm: number | null; ambiguous: boolean; signal: string } {
  const googleTypes = result?.types || [];
  const components = result?.address_components || [];
  const viewport = result?.geometry?.viewport;
  const diagKm = viewport ? haversineKm(viewport.southwest, viewport.northeast) : null;
  const queryLower = (query || '').toLowerCase();

  const islandComponent = components.find((c) => {
    if (!c.types?.includes('natural_feature')) return false;
    const name = (c.long_name || '').toLowerCase();
    return !!name && queryLower.includes(name);
  });
  if (islandComponent) {
    return { type: 'ISLAND', diagKm, ambiguous: false, signal: 'natural_feature_component' };
  }

  if (googleTypes.includes('country')) {
    if (diagKm !== null && diagKm < 30) return { type: 'CITY', diagKm, ambiguous: false, signal: 'country_microstate' };
    return { type: 'COUNTRY', diagKm, ambiguous: false, signal: 'country' };
  }

  if (googleTypes.includes('natural_feature')) {
    return { type: 'ISLAND', diagKm, ambiguous: false, signal: 'natural_feature_top' };
  }

  if (googleTypes.includes('locality')) {
    return { type: 'CITY', diagKm, ambiguous: false, signal: 'locality' };
  }

  if (googleTypes.includes('administrative_area_level_1')) {
    if (diagKm === null) return { type: 'STATE', diagKm: null, ambiguous: true, signal: 'admin1_no_viewport' };
    if (diagKm < 400) return { type: 'CITY', diagKm, ambiguous: false, signal: 'admin1_small_viewport' };
    if (diagKm < 1000) return { type: 'STATE', diagKm, ambiguous: true, signal: 'admin1_mid_viewport_review' };
    return { type: 'STATE', diagKm, ambiguous: false, signal: 'admin1_large_viewport' };
  }

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

async function resolveUrbanCore(
  destinationName: string,
  originalViewport: Viewport | undefined,
  originalDiagKm: number | null,
  centerLat: number | null,
  centerLng: number | null,
  type: DestinationType | null,
): Promise<{ viewport: Viewport | undefined; source: string }> {
  if (originalDiagKm === null || originalDiagKm <= 100) {
    return { viewport: originalViewport, source: 'original' };
  }
  const stem = destinationName.split(',')[0].trim();
  let regeocodeReason = 'unknown';
  try {
    const result = await geocodeByQuery(`central ${stem}`);
    if (result) {
      const coreViewport = result.geometry?.viewport;
      if (coreViewport) {
        const coreDiagKm = haversineKm(coreViewport.southwest, coreViewport.northeast);
        if (coreDiagKm !== null && coreDiagKm < originalDiagKm * 0.7) {
          return { viewport: coreViewport, source: 'urban_core' };
        }
        regeocodeReason = 'not_smaller';
      } else {
        regeocodeReason = 'no_viewport';
      }
    } else {
      regeocodeReason = 'no_result';
    }
  } catch (e) {
    regeocodeReason = 'error';
  }

  if (centerLat != null && centerLng != null) {
    const radiusKm = type === 'CITY' ? 15 : 50;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    return {
      viewport: {
        northeast: { lat: centerLat + latDelta, lng: centerLng + lngDelta },
        southwest: { lat: centerLat - latDelta, lng: centerLng - lngDelta },
      },
      source: 'synthesized_from_center',
    };
  }

  return { viewport: originalViewport, source: 'fallback_no_center' };
}

function buildStructured(components: GeocodeResult['address_components']): StructuredAddress {
  const out: StructuredAddress = {};
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

async function buildTaxonomyFromResult(
  result: GeocodeResult,
  query: string,
): Promise<DestinationTaxonomy> {
  const classification = classifyResult(result, query);
  const adminViewport = result.geometry?.viewport;
  const center = result.geometry?.location;

  let tourViewport = adminViewport;
  let tourViewportSource = 'destination_viewport';
  if (classification.diagKm !== null && classification.diagKm > 100) {
    const resolved = await resolveUrbanCore(
      result.formatted_address || query,
      adminViewport,
      classification.diagKm,
      center?.lat ?? null,
      center?.lng ?? null,
      classification.type,
    );
    tourViewport = resolved.viewport;
    tourViewportSource = resolved.source;
  }

  return {
    destinationType: classification.type,
    destinationName: result.formatted_address,
    destinationPlaceId: result.place_id,
    destinationStructured: buildStructured(result.address_components),
    destinationCenterLat: center?.lat ?? null,
    destinationCenterLng: center?.lng ?? null,
    destinationViewportNE: adminViewport?.northeast ?? null,
    destinationViewportSW: adminViewport?.southwest ?? null,
    tourViewportNE: tourViewport?.northeast ?? null,
    tourViewportSW: tourViewport?.southwest ?? null,
    classification,
    tourViewportSource,
  };
}

/**
 * Resolve a placeId to the full destination taxonomy.
 * Returns null if the placeId cannot be resolved (Google rejected it, network error, etc.).
 */
export async function resolveTaxonomyByPlaceId(placeId: string): Promise<DestinationTaxonomy | null> {
  if (!placeId) return null;
  const result = await geocodeByPlaceId(placeId);
  if (!result) return null;
  return buildTaxonomyFromResult(result, result.formatted_address);
}

/**
 * Resolve a free-text query to the full destination taxonomy. Used for AI-fallback
 * paths where the user's destination string came from AI extraction rather than
 * autocomplete selection.
 */
export async function resolveTaxonomyByQuery(query: string): Promise<DestinationTaxonomy | null> {
  if (!query) return null;
  const result = await geocodeByQuery(query);
  if (!result) return null;
  return buildTaxonomyFromResult(result, query);
}
