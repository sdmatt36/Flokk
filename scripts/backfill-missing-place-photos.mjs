// One-off backfill: ENRICHED saves with lat/lng but no placePhotoUrl.
// Looks up Google Places using location bias (lat/lng) rather than city-name text
// so it works when destinationCity is null or spelled differently from Places data.
// Does NOT modify the live enrichment path.
// Usage: node scripts/backfill-missing-place-photos.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mirrors the normalisation in enrich-with-places.ts
function norm(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameSimilar(a, b) {
  const wordsA = new Set(norm(a).split(" ").filter(w => w.length > 2));
  const wordsB = norm(b).split(" ").filter(w => w.length > 2);
  const overlap = wordsB.filter(w => wordsA.has(w)).length;
  return overlap > 0 || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

// Mirrors extractSearchableTitle.ts: strip parentheticals, try raw.
function extractCandidates(rawTitle) {
  const candidates = [];
  const withoutParen = rawTitle.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (withoutParen && withoutParen !== rawTitle) candidates.push(withoutParen);
  const parenMatch = rawTitle.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (inner.length > 2 && !candidates.includes(inner)) candidates.push(inner);
  }
  if (!candidates.includes(rawTitle)) candidates.push(rawTitle);
  return candidates;
}

async function resolvePhotoUrl(photoRef) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url, { redirect: "follow" });
  const finalUrl = res.url;
  if (finalUrl && !finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
    return finalUrl;
  }
  return null;
}

// Text search with lat/lng location bias, then place details.
// Tries each candidate name in order, returns on first valid match.
async function lookupByLatLng(rawTitle, lat, lng) {
  const candidates = extractCandidates(rawTitle);

  for (const candidate of candidates) {
    const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    searchUrl.searchParams.set("query", candidate.trim());
    searchUrl.searchParams.set("location", `${lat},${lng}`);
    searchUrl.searchParams.set("radius", "5000");
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const searchRes = await fetch(searchUrl.toString());
    const searchData = await searchRes.json();
    const placeId = searchData.results?.[0]?.place_id ?? null;
    if (!placeId) continue;

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,photos&language=en&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsRes.json();
    const result = detailsData.result;
    if (!result) continue;

    const placesName = result.name ?? "";
    if (placesName && !nameSimilar(candidate, placesName)) {
      console.log(`  [name-mismatch] "${candidate}" -> "${placesName}" — trying next candidate`);
      continue;
    }

    const photoRef = result.photos?.[0]?.photo_reference ?? null;
    let photoUrl = null;
    if (photoRef) {
      photoUrl = await resolvePhotoUrl(photoRef);
    }

    return {
      placeId,
      website: result.website ?? null,
      photoUrl,
      placesName,
      candidateUsed: candidate,
    };
  }

  return null;
}

async function main() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  const saves = await prisma.savedItem.findMany({
    where: {
      deletedAt: null,
      extractionStatus: "ENRICHED",
      placePhotoUrl: null,
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
      lat: true,
      lng: true,
      googlePlaceId: true,
      websiteUrl: true,
      familyProfileId: true,
    },
    orderBy: { savedAt: "asc" },
  });

  console.log(`Scope: ${saves.length} saves\n`);

  const resolved = [];
  const unresolved = [];

  for (const save of saves) {
    const name = save.rawTitle ?? "";
    if (!name.trim()) {
      console.log(`${save.id}  (no title)  -> SKIP (no name)`);
      unresolved.push({ ...save, reason: "no name" });
      continue;
    }

    let match = null;
    try {
      match = await lookupByLatLng(name, save.lat, save.lng);
    } catch (e) {
      console.log(`${save.id}  "${name}"  -> ERROR: ${e.message}`);
      unresolved.push({ ...save, reason: String(e.message) });
      await sleep(300);
      continue;
    }

    await sleep(250);

    if (!match) {
      console.log(`${save.id}  "${name}"  matched=no  -> UNRESOLVED (no Places match)`);
      unresolved.push({ ...save, reason: "no Places match" });
      continue;
    }

    if (!match.photoUrl) {
      console.log(`${save.id}  "${name}"  matched=yes (${match.placesName})  photo=no  -> UNRESOLVED (no photo)`);
      unresolved.push({ ...save, reason: "matched but no photo" });
      continue;
    }

    // Build update — only overwrite null fields
    const data = { placePhotoUrl: match.photoUrl };
    const fieldsSet = ["placePhotoUrl"];

    if (save.googlePlaceId === null) {
      data.googlePlaceId = match.placeId;
      fieldsSet.push("googlePlaceId");
    }
    if (save.websiteUrl === null && match.website) {
      data.websiteUrl = match.website;
      fieldsSet.push("websiteUrl");
    }

    await prisma.savedItem.update({ where: { id: save.id }, data });

    console.log(`${save.id}  "${name}"  matched=yes  photo=yes  set=${fieldsSet.join(",")}`);
    console.log(`  places:"${match.placesName}"  candidate:"${match.candidateUsed}"`);
    console.log(`  photo: ${match.photoUrl.slice(0, 100)}`);
    resolved.push(save);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Resolved:   ${resolved.length}`);
  console.log(`Unresolved: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log("\nUnresolved detail:");
    for (const u of unresolved) {
      console.log(`  ${u.id}  "${u.rawTitle}"  reason: ${u.reason}`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
