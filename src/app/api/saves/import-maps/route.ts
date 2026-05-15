import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ExtractionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Google Takeout "Saved Places.json" shape ──────────────────────────────────
interface TakeoutFeature {
  type: "Feature";
  geometry?: { type: string; coordinates?: [number, number] };
  properties?: {
    Title?: string;
    "Google Maps URL"?: string;
    Published?: string;
    location?: {
      Address?: string;
      "Business Name"?: string;
      "Geo Coordinates"?: { Latitude?: number; Longitude?: number };
    };
  };
}

interface TakeoutGeoJSON {
  type?: string;
  features?: TakeoutFeature[];
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles Google Takeout per-list CSVs (Title, Note, URL, Comment columns).
// Coordinates are not in the CSV directly; they're embedded in the URL column
// as the @lat,lng,zoom pattern that Google Maps uses in its deep links.
function parseCsvRows(text: string): string[][] {
  const clean = text.startsWith("﻿") ? text.slice(1) : text; // strip UTF-8 BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r' && clean[i + 1] === '\n') {
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = []; i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field); field = '';
        if (row.some(f => f.trim())) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim())) rows.push(row);
  }
  return rows;
}

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// ── KML parser ────────────────────────────────────────────────────────────────
function parseCoordsString(raw: string): { lat: number; lng: number } | null {
  const trimmed = raw.trim().split(/\s+/)[0];
  const parts = trimmed.split(",");
  if (parts.length < 2) return null;
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function extractTagValue(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || null;
}

function parseKml(xml: string): Array<{ name: string; lat: number; lng: number; description: string | null; address: string | null }> {
  const results: Array<{ name: string; lat: number; lng: number; description: string | null; address: string | null }> = [];
  const re = /<Placemark[\s\S]*?<\/Placemark>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const block = match[0];
    const name = extractTagValue(block, "name") ?? "Imported place";
    const coordStr = extractTagValue(block, "coordinates");
    if (!coordStr) continue;
    const coords = parseCoordsString(coordStr);
    if (!coords) continue;
    const description = extractTagValue(block, "description");
    const address = extractTagValue(block, "address");
    results.push({ name, ...coords, description, address });
  }
  return results;
}

// ── Category inference ────────────────────────────────────────────────────────
function inferCategory(name: string, mapsUrl: string | undefined): string {
  const combined = `${name} ${mapsUrl ?? ""}`.toLowerCase();
  if (/restaurant|cafe|coffee|ramen|sushi|pizza|bar|izakaya|bistro|brasserie|eatery|food|dining/.test(combined)) return "food_and_drink";
  if (/hotel|inn|hostel|ryokan|airbnb|resort|motel|lodge/.test(combined)) return "accommodation";
  if (/museum|gallery|art|exhibit|history|heritage/.test(combined)) return "culture";
  if (/park|garden|nature|trail|hike|beach|lake|mountain|forest/.test(combined)) return "nature";
  if (/temple|shrine|church|cathedral|mosque|pagoda/.test(combined)) return "culture";
  if (/shop|store|market|mall|boutique|souvenir/.test(combined)) return "shopping";
  if (/onsen|spa|bath|wellness/.test(combined)) return "wellness";
  if (/station|airport|train|bus|ferry|transport/.test(combined)) return "transport";
  return "points_of_interest";
}

// ── Proximity dedup (50m) ─────────────────────────────────────────────────────
function approxSame(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = dLat * dLat + dLng * dLng * Math.cos(a.lat * Math.PI / 180) ** 2;
  return Math.sqrt(x) * R < 50;
}

// ── Haversine distance in km ──────────────────────────────────────────────────
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a2 = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

// ── 2km greedy clustering ─────────────────────────────────────────────────────
// Returns cluster centroids with their member indices.
interface Cluster {
  lat: number;   // running centroid
  lng: number;
  count: number;
  indices: number[]; // indices into the places array
}

function buildClusters(places: Array<{ lat: number; lng: number }>, radiusKm = 2): Cluster[] {
  const clusters: Cluster[] = [];
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    let matched = false;
    for (const c of clusters) {
      if (haversineKm(c, p) <= radiusKm) {
        // Update running centroid
        c.lat = (c.lat * c.count + p.lat) / (c.count + 1);
        c.lng = (c.lng * c.count + p.lng) / (c.count + 1);
        c.count++;
        c.indices.push(i);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ lat: p.lat, lng: p.lng, count: 1, indices: [i] });
    }
  }
  return clusters;
}

// ── Geocode a cluster centroid → city + country ───────────────────────────────
const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

interface GeoDetail {
  cityName: string;
  countryCode: string; // ISO 2-letter
  countryName: string;
}

async function geocodeCluster(lat: number, lng: number): Promise<GeoDetail | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL(GEOCODE_API);
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("result_type", "locality|administrative_area_level_3|administrative_area_level_2");
    url.searchParams.set("language", "en");
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as {
      status: string;
      results?: Array<{
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;

    let cityName: string | null = null;
    let countryCode = "";
    let countryName = "";

    for (const result of data.results) {
      for (const comp of result.address_components) {
        if (!cityName && (comp.types.includes("locality") || comp.types.includes("administrative_area_level_3") || comp.types.includes("administrative_area_level_2"))) {
          cityName = comp.long_name;
        }
        if (comp.types.includes("country")) {
          countryCode = comp.short_name; // ISO 2-letter
          countryName = comp.long_name;
        }
      }
      if (cityName && countryCode) break;
    }

    if (!cityName) return null;
    return { cityName, countryCode, countryName };
  } catch {
    return null;
  }
}

// ── City resolution + auto-creation ──────────────────────────────────────────
// Returns cityId or null. Auto-creates City row only when clusterSize >= 3.
async function resolveOrCreateCity(
  geo: GeoDetail,
  clusterSize: number,
  slugCache: Map<string, string | null>
): Promise<string | null> {
  const cacheKey = `${geo.cityName.toLowerCase()}_${geo.countryCode}`;
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey)!;

  // 1. Try existing City by name (case-insensitive match)
  const existing = await db.city.findFirst({
    where: { name: { equals: geo.cityName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    slugCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // 2. Below threshold — don't auto-create
  if (clusterSize < 3) {
    slugCache.set(cacheKey, null);
    return null;
  }

  // 3. Look up Country by ISO code
  const country = await db.country.findFirst({
    where: { code: geo.countryCode },
    select: { id: true },
  });
  if (!country) {
    slugCache.set(cacheKey, null);
    return null;
  }

  // 4. Generate a unique slug
  const baseSlug = geo.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = baseSlug;
  const slugConflict = await db.city.findUnique({ where: { slug } });
  if (slugConflict) {
    slug = `${baseSlug}-${geo.countryCode.toLowerCase()}`;
    const slug2Conflict = await db.city.findUnique({ where: { slug } });
    if (slug2Conflict) slug = `${baseSlug}-${Date.now()}`;
  }

  // 5. Create City (featured: false, priorityRank: 999 — won't surface in Discover)
  try {
    const city = await db.city.create({
      data: {
        slug,
        name: geo.cityName,
        countryId: country.id,
        featured: false,
        priorityRank: 999,
        tags: [],
      },
      select: { id: true },
    });
    slugCache.set(cacheKey, city.id);
    return city.id;
  } catch {
    // Race condition — another request created the same city
    const retry = await db.city.findFirst({
      where: { name: { equals: geo.cityName, mode: "insensitive" } },
      select: { id: true },
    });
    const id = retry?.id ?? null;
    slugCache.set(cacheKey, id);
    return id;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const text = await file.text();
  const fileName = file.name.toLowerCase();

  // Parse ─────────────────────────────────────────────────────────────────────
  type ParsedPlace = { name: string; lat: number; lng: number; address: string | null; mapsUrl: string | null; notes: string | null; listName: string | null };
  const parsed: ParsedPlace[] = [];

  if (fileName.endsWith(".json")) {
    let data: TakeoutGeoJSON;
    try { data = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 }); }

    for (const f of data.features ?? []) {
      const props = f.properties ?? {};
      const geo = f.geometry?.coordinates;
      const geoCoords = props.location?.["Geo Coordinates"];
      let lat: number | null = null;
      let lng: number | null = null;

      if (geo && Array.isArray(geo) && geo.length >= 2) {
        lng = geo[0]; lat = geo[1];
      } else if (geoCoords?.Latitude != null && geoCoords?.Longitude != null) {
        lat = geoCoords.Latitude; lng = geoCoords.Longitude;
      }

      if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

      const name = props.location?.["Business Name"] ?? props.Title ?? "Saved place";
      parsed.push({
        name: name.trim(),
        lat, lng,
        address: props.location?.Address?.trim() ?? null,
        mapsUrl: props["Google Maps URL"] ?? null,
        notes: null,
        listName: null,
      });
    }
  } else if (fileName.endsWith(".kml") || fileName.endsWith(".kmz")) {
    const places = parseKml(text);
    for (const p of places) {
      parsed.push({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, mapsUrl: null, notes: p.description, listName: null });
    }
  } else if (fileName.endsWith(".csv")) {
    // Google Takeout per-list CSV: one file per saved list (e.g. "Kamakura food.csv")
    const listName = file.name.replace(/\.csv$/i, "").trim();
    const rows = parseCsvRows(text);
    if (rows.length < 2) {
      return NextResponse.json({ error: "Empty or unreadable CSV file." }, { status: 400 });
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    // Locate columns by name; fall back to positional defaults if headers differ
    const titleIdx = headers.indexOf("title") >= 0 ? headers.indexOf("title") : 0;
    const urlIdx = headers.indexOf("url") >= 0 ? headers.indexOf("url") : 2;
    const noteIdx = headers.indexOf("note") >= 0 ? headers.indexOf("note")
      : headers.indexOf("comment") >= 0 ? headers.indexOf("comment") : -1;

    for (const row of rows.slice(1)) {
      const name = row[titleIdx]?.trim() || "Saved place";
      const url = (urlIdx < row.length ? row[urlIdx] : "")?.trim() ?? "";
      const note = noteIdx >= 0 && noteIdx < row.length ? (row[noteIdx]?.trim() || null) : null;

      const coords = extractCoordsFromUrl(url);
      if (!coords) continue; // no @lat,lng in URL — skipped; backfill cron handles remainder

      parsed.push({
        name,
        lat: coords.lat,
        lng: coords.lng,
        address: null,
        mapsUrl: url || null,
        notes: note,
        listName,
      });
    }
  } else {
    return NextResponse.json({ error: "Unsupported file type. Upload a .json (Google Takeout), .kml, or .csv file." }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "No places found in the file." }, { status: 400 });
  }

  // Dedup against existing saves ─────────────────────────────────────────────
  const existing = await db.savedItem.findMany({
    where: { familyProfileId: profileId, deletedAt: null, lat: { not: null }, lng: { not: null } },
    select: { lat: true, lng: true },
  });

  const toCreate = parsed.filter(p =>
    !existing.some(e => e.lat != null && e.lng != null && approxSame({ lat: p.lat, lng: p.lng }, { lat: e.lat!, lng: e.lng! }))
  );

  if (toCreate.length === 0) {
    return NextResponse.json({ imported: 0, skipped: parsed.length, message: "All places already exist in your saves." });
  }

  // ── Phase 2: cluster → geocode → city resolution ──────────────────────────
  // Cap at 150 unique clusters to stay within maxDuration=60.
  // Places in clusters beyond cap get cityId=null; backfill cron handles them.
  const MAX_SYNC_CLUSTERS = 150;
  const clusters = buildClusters(toCreate);
  const clustersToGeocode = clusters.slice(0, MAX_SYNC_CLUSTERS);

  // Fire all geocoding requests in parallel
  const geoResults = await Promise.all(
    clustersToGeocode.map(c => geocodeCluster(c.lat, c.lng))
  );

  // Resolve cityIds sequentially to avoid duplicate City creation races
  const cityIdByCluster: (string | null)[] = new Array(clusters.length).fill(null);
  const cityNameByCluster: (string | null)[] = new Array(clusters.length).fill(null);
  const slugCache = new Map<string, string | null>();

  for (let i = 0; i < clustersToGeocode.length; i++) {
    const geo = geoResults[i];
    if (!geo) continue;
    cityIdByCluster[i] = await resolveOrCreateCity(geo, clusters[i].count, slugCache);
    cityNameByCluster[i] = geo.cityName;
  }

  // Build place → cityId + cityName maps via cluster index
  const placeIdxToCityId: (string | null)[] = new Array(toCreate.length).fill(null);
  const placeIdxToCityName: (string | null)[] = new Array(toCreate.length).fill(null);
  for (let ci = 0; ci < clusters.length; ci++) {
    const cityId = cityIdByCluster[ci] ?? null;
    const cityName = cityNameByCluster[ci] ?? null;
    for (const idx of clusters[ci].indices) {
      placeIdxToCityId[idx] = cityId;
      placeIdxToCityName[idx] = cityName;
    }
  }

  // Batch create ──────────────────────────────────────────────────────────────
  const BATCH = 500;
  let totalCreated = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await db.savedItem.createMany({
      data: batch.map((p, bi) => ({
        familyProfileId: profileId,
        sourceMethod: "maps_import",
        sourcePlatform: fileName.endsWith(".json") ? "google_maps" : fileName.endsWith(".csv") ? "google_maps_csv" : "kml",
        rawTitle: p.name,
        lat: p.lat,
        lng: p.lng,
        websiteUrl: p.mapsUrl ?? null,
        rawDescription: [p.address, p.notes].filter(Boolean).join(" · ") || null,
        categoryTags: [inferCategory(p.name, p.mapsUrl ?? undefined), ...(p.listName ? [`list:${p.listName}`] : [])],
        status: "UNORGANIZED",
        extractionStatus: ExtractionStatus.ENRICHED,
        needsPlaceConfirmation: false,
        cityId: placeIdxToCityId[i + bi],
        destinationCity: placeIdxToCityName[i + bi],
      })),
      skipDuplicates: true,
    });
    totalCreated += batch.length;
  }

  return NextResponse.json({
    imported: totalCreated,
    skipped: parsed.length - totalCreated,
    total: parsed.length,
  });
}
