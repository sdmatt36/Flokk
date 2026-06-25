import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ExtractionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import {
  forwardGeocodeFromText,
  fetchPlaceDetailsById,
  reverseGeocodeCityFromCoords,
} from "@/lib/google-places";
import { mapPlaceTypesToCanonicalSlugs } from "@/lib/categories";
import { toDurableImageUrl } from "@/lib/imageStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Single-pin Google Maps → Imported (maps_import) ingestion.
//
// Companion to the Takeout bulk uploader (src/app/api/saves/import-maps/route.ts).
// Accepts ONE shared Google Maps URL and creates ONE SavedItem that is
// indistinguishable in shape from a Takeout-imported pin — same sourceMethod,
// same sourcePlatform, same city resolution, same fields — so it lands in the
// Imported tab grouped by city.
//
// The city-resolution + category helpers below are intentionally kept
// byte-identical to the private helpers in import-maps/route.ts so the resulting
// cityId/destinationCity match exactly. import-maps is left untouched per scope;
// a future refactor can extract these into a shared lib used by both.
// ─────────────────────────────────────────────────────────────────────────────

// ── @lat,lng / !3d!4d / q=lat,lng coordinate extraction ──────────────────────
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  // Prefer the place marker (!3d<lat>!4d<lng>), then the viewport center (@lat,lng),
  // then a q/query/ll lat,lng pair.
  const marker = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const q = url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  const m = marker ?? at ?? q;
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// ── Place-name extraction from an expanded Google Maps URL ───────────────────
function extractNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // /maps/place/<Place+Name>/@... — the canonical place path segment.
    const placeMatch = u.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      const decoded = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ").trim();
      // Drop a trailing ",<address>" tail if Google included one; keep the name.
      const name = decoded.split(",")[0].trim();
      if (name.length >= 2) return name;
    }
    // /search/?api=1&query=<name|coords> or ?q=<name> — only when not a coord pair.
    const queryParam = u.searchParams.get("query") ?? u.searchParams.get("q");
    if (queryParam && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(queryParam.trim())) {
      const name = queryParam.trim();
      if (name.length >= 2) return name;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Category inference (mirrors import-maps) ─────────────────────────────────
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

// ── Geocode coordinates → city + country (mirrors import-maps geocodeCluster) ─
const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

interface GeoDetail {
  cityName: string;
  adminArea1: string | null; // state / prefecture / province — fallback when locality is a sub-city area
  countryCode: string; // ISO 2-letter
  countryName: string;
}

async function geocodeCity(lat: number, lng: number): Promise<GeoDetail | null> {
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
    let adminArea1: string | null = null;
    let countryCode = "";
    let countryName = "";

    for (const result of data.results) {
      for (const comp of result.address_components) {
        if (!cityName && (comp.types.includes("locality") || comp.types.includes("administrative_area_level_3") || comp.types.includes("administrative_area_level_2"))) {
          cityName = comp.long_name;
        }
        if (!adminArea1 && comp.types.includes("administrative_area_level_1")) {
          adminArea1 = comp.long_name;
        }
        if (comp.types.includes("country")) {
          countryCode = comp.short_name; // ISO 2-letter
          countryName = comp.long_name;
        }
      }
      if (cityName && countryCode) break;
    }

    if (!cityName) return null;
    return { cityName, adminArea1, countryCode, countryName };
  } catch {
    return null;
  }
}

// ── City resolution + auto-creation (mirrors import-maps resolveOrCreateCity) ─
// Returns { id, resolvedName }. resolvedName may differ from geo.cityName when the
// locality is a sub-city area (e.g. "Shinjuku City" → "Tokyo") and the adminArea1
// parent city exists in our City table. Auto-creates a City row only when
// clusterSize >= 3 — so a single shared pin (clusterSize 1) never creates a City,
// exactly like a sub-threshold Takeout pin (cityId stays null, backfill cron fills it).
interface CityResolution { id: string | null; resolvedName: string; }

async function resolveOrCreateCity(geo: GeoDetail, clusterSize: number): Promise<CityResolution> {
  // 1. Try existing City by name (case-insensitive match)
  const existing = await db.city.findFirst({
    where: { name: { equals: geo.cityName, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return { id: existing.id, resolvedName: existing.name };

  // 2. Locality didn't match — try adminArea1 as parent city fallback.
  if (geo.adminArea1) {
    const parentCity = await db.city.findFirst({
      where: { name: { equals: geo.adminArea1, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (parentCity) return { id: parentCity.id, resolvedName: parentCity.name };
  }

  // 3. Below threshold — don't auto-create
  if (clusterSize < 3) return { id: null, resolvedName: geo.cityName };

  // 4. Look up Country by ISO code
  const country = await db.country.findFirst({
    where: { code: geo.countryCode },
    select: { id: true },
  });
  if (!country) return { id: null, resolvedName: geo.cityName };

  // 5. Generate a unique slug
  const baseSlug = geo.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = baseSlug;
  const slugConflict = await db.city.findUnique({ where: { slug } });
  if (slugConflict) {
    slug = `${baseSlug}-${geo.countryCode.toLowerCase()}`;
    const slug2Conflict = await db.city.findUnique({ where: { slug } });
    if (slug2Conflict) slug = `${baseSlug}-${Date.now()}`;
  }

  // 6. Create City (featured: false, priorityRank: 999 — won't surface in Discover)
  try {
    const city = await db.city.create({
      data: { slug, name: geo.cityName, countryId: country.id, featured: false, priorityRank: 999, tags: [] },
      select: { id: true, name: true },
    });
    return { id: city.id, resolvedName: city.name };
  } catch {
    const retry = await db.city.findFirst({
      where: { name: { equals: geo.cityName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    return { id: retry?.id ?? null, resolvedName: retry?.name ?? geo.cityName };
  }
}

// ── URL validation ───────────────────────────────────────────────────────────
function isGoogleMapsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "g.co" ||
      host.endsWith("google.com") ||
      host.endsWith("google.co.uk") ||
      host.startsWith("maps.google.")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const inputUrl = body.url?.trim();
  if (!inputUrl || !isGoogleMapsUrl(inputUrl)) {
    return NextResponse.json({ error: "A valid Google Maps URL is required" }, { status: 400 });
  }

  // 1. Follow short-link redirects (maps.app.goo.gl / goo.gl/maps) to the expanded URL.
  let finalUrl = inputUrl;
  try {
    const res = await fetch(inputUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlokkBot/1.0)" },
    });
    if (res.url) finalUrl = res.url;
  } catch {
    // Network failure following the link — fall back to the raw input below.
  }

  // 2. Pull name + coords out of the expanded URL.
  const nameFromUrl = extractNameFromUrl(finalUrl) ?? extractNameFromUrl(inputUrl);
  const coordsFromUrl = extractCoordsFromUrl(finalUrl) ?? extractCoordsFromUrl(inputUrl);

  if (!nameFromUrl && !coordsFromUrl) {
    return NextResponse.json(
      { error: "Couldn't resolve this Google Maps link to a place. Share a place link that includes a location." },
      { status: 422 },
    );
  }

  // 3. Resolve the authoritative place via the SAME Places machinery import-maps uses.
  //    Prefer a forward-geocode by name (returns placeId → photo/website/types/address),
  //    biased by the city the URL coordinates fall in. Fall back to raw URL coords.
  let name = nameFromUrl ?? "Saved place";
  let lat: number | null = coordsFromUrl?.lat ?? null;
  let lng: number | null = coordsFromUrl?.lng ?? null;
  let address: string | null = null;
  let googlePlaceId: string | null = null;
  let types: string[] = [];

  const cityHint = coordsFromUrl ? await reverseGeocodeCityFromCoords(coordsFromUrl) : null;

  if (nameFromUrl) {
    const query = [nameFromUrl, cityHint].filter(Boolean).join(" ");
    const geo = await forwardGeocodeFromText(query);
    if (geo) {
      name = nameFromUrl;
      lat = geo.lat;
      lng = geo.lng;
      address = geo.formattedAddress;
      googlePlaceId = geo.placeId;
      types = geo.types;
    }
  }

  // City bucketing requires coordinates — never write a null-coord save.
  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "Couldn't resolve a location for this place. Open it in Google Maps and share again." },
      { status: 422 },
    );
  }

  // 4. Details (photo + website) for the resolved place, when we have a placeId.
  const details = googlePlaceId ? await fetchPlaceDetailsById(googlePlaceId) : null;
  const placePhotoUrl = await toDurableImageUrl(details?.photoUrl ?? null);

  // 5. Category tags — Places types when available, else keyword inference (mirrors import-maps).
  const mappedSlugs = types.length > 0 ? mapPlaceTypesToCanonicalSlugs(types) : [];
  const categoryTags = mappedSlugs.length > 0 ? mappedSlugs : [inferCategory(name, finalUrl)];

  // 6. City resolution — identical helper + clusterSize 1 (lone pin) as Takeout.
  const geoDetail = await geocodeCity(lat, lng);
  const cityResolution = geoDetail ? await resolveOrCreateCity(geoDetail, 1) : null;
  const cityId = cityResolution?.id ?? null;
  const destinationCity = cityResolution?.resolvedName ?? null;

  // 7. Idempotency — don't duplicate an existing maps_import for the same place.
  const existing = await db.savedItem.findFirst({
    where: {
      familyProfileId: profileId,
      sourceMethod: "maps_import",
      deletedAt: null,
      OR: [
        ...(googlePlaceId ? [{ googlePlaceId }] : []),
        { mapsUrl: finalUrl },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ save: existing, deduped: true, imported: 0 });
  }

  // 8. Create ONE SavedItem matching the import-maps createMany shape exactly.
  const created = await db.savedItem.create({
    data: {
      familyProfileId: profileId,
      sourceMethod: "maps_import",
      sourcePlatform: "google_maps",
      rawTitle: name,
      lat,
      lng,
      mapsUrl: finalUrl,
      websiteUrl: details?.websiteUrl ?? null,
      placePhotoUrl: placePhotoUrl ?? null,
      googlePlaceId: googlePlaceId ?? null,
      rawDescription: [address].filter(Boolean).join(" · ") || null,
      categoryTags,
      status: "UNORGANIZED",
      extractionStatus: ExtractionStatus.PENDING,
      needsPlaceConfirmation: false,
      cityId,
      destinationCity,
    },
  });

  return NextResponse.json({ save: created, deduped: false, imported: 1 });
}
