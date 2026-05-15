import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ExtractionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Google Takeout "Saved Places.json" shape ──────────────────────────────────
// GeoJSON FeatureCollection. Each feature has:
//   geometry.coordinates: [lng, lat]
//   properties.Title: place name
//   properties["Google Maps URL"]: maps URL
//   properties.location.Address
//   properties.location["Business Name"]
//   properties.location["Geo Coordinates"].Latitude / .Longitude

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

// ── KML shape (Google My Maps export) ────────────────────────────────────────
// Simplified: extract <Placemark> elements with <name>, <description>,
// and <coordinates> (lng,lat,alt).

function parseCoordsString(raw: string): { lat: number; lng: number } | null {
  const trimmed = raw.trim().split(/\s+/)[0]; // take first coord pair
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

// ── Category inference from Google Maps URL / place types ────────────────────
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

// ── Deduplicate against existing saves (same profile + coords within ~50m) ───
function approxSame(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = dLat * dLat + dLng * dLng * Math.cos(a.lat * Math.PI / 180) ** 2;
  return Math.sqrt(x) * R < 50;
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
  type ParsedPlace = { name: string; lat: number; lng: number; address: string | null; mapsUrl: string | null; notes: string | null };
  const parsed: ParsedPlace[] = [];

  if (fileName.endsWith(".json")) {
    // Google Takeout GeoJSON
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
      });
    }
  } else if (fileName.endsWith(".kml") || fileName.endsWith(".kmz")) {
    // KML (Google My Maps export, or Flokk KML export re-imported)
    const places = parseKml(text);
    for (const p of places) {
      parsed.push({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, mapsUrl: null, notes: p.description });
    }
  } else {
    return NextResponse.json({ error: "Unsupported file type. Upload a .json (Google Takeout) or .kml file." }, { status: 400 });
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

  // Batch create (max 500 at a time to avoid timeouts) ───────────────────────
  const BATCH = 500;
  let totalCreated = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await db.savedItem.createMany({
      data: batch.map(p => ({
        familyProfileId: profileId,
        sourceMethod: "maps_import",
        sourcePlatform: fileName.endsWith(".json") ? "google_maps" : "kml",
        rawTitle: p.name,
        lat: p.lat,
        lng: p.lng,
        websiteUrl: p.mapsUrl ?? null,
        // address goes in rawDescription — SavedItem has no dedicated address column
        rawDescription: [p.address, p.notes].filter(Boolean).join(" · ") || null,
        categoryTags: [inferCategory(p.name, p.mapsUrl ?? undefined)],
        status: "UNORGANIZED",
        extractionStatus: ExtractionStatus.ENRICHED,
        needsPlaceConfirmation: false,
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
