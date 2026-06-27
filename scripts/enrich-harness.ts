// Full-path enrichment harness for ONE URL. Mirrors the live POST /api/saves
// (url branch) exactly:
//   extractOgMetadata -> create SavedItem (URL_PASTE, inferred platform) ->
//   SYNC enrichWithPlaces pre-pass (route.ts:298-311) -> deferred enrichSavedItem ->
//   read -> HARD DELETE.
//
// Creates ONE test row tagged __ENRICH_HARNESS__ and hard-deletes it at the end.
// enrichSavedItem's own console.logs (caption, LLM city, geocode) surface the
// per-stage social diagnostics.
//
//   npx tsx scripts/enrich-harness.ts <url>

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";
const TEST_URL = process.argv.slice(2).find((a) => !a.startsWith("--"));
const TAG = "__ENRICH_HARNESS__";

async function main() {
  if (!TEST_URL) {
    console.error("Usage: npx tsx scripts/enrich-harness.ts <url>");
    process.exit(1);
  }

  const { db } = await import("@/lib/db");
  const { extractOgMetadata } = await import("@/lib/og-extract");
  const { enrichWithPlaces } = await import("@/lib/enrich-with-places");
  const { enrichSavedItem } = await import("@/lib/enrich-save");
  const { inferPlatformFromUrl } = await import("@/lib/saved-item-types");
  const { SOCIAL_PLATFORMS } = await import("@/lib/enrich-save");
  const he = (await import("he")).default;

  const cleanText = (s: string | null | undefined): string | null =>
    s ? (he.decode(s.replace(/&#x[0-9a-fA-F]+;/gi, "").trim()) || null) : null;

  const sel = {
    id: true, rawTitle: true, destinationCity: true, destinationCountry: true,
    lat: true, lng: true, googlePlaceId: true, needsPlaceConfirmation: true,
    extractionStatus: true, sourceMethod: true, sourcePlatform: true, tripId: true,
  } as const;

  let createdId: string | null = null;
  try {
    console.log(`\n========== URL: ${TEST_URL} ==========`);

    const meta = await extractOgMetadata(TEST_URL);
    const rawTitle = cleanText(meta.title);
    const sourcePlatform = inferPlatformFromUrl(TEST_URL);
    console.log(`Scraped rawTitle : ${JSON.stringify(rawTitle)}`);
    console.log(`sourcePlatform   : ${sourcePlatform}`);

    const created = await db.savedItem.create({
      data: {
        familyProfileId: PROFILE_ID,
        sourceMethod: "URL_PASTE",
        sourcePlatform,
        sourceUrl: TEST_URL,
        rawTitle,
        notes: TAG,
        extractionStatus: "PENDING",
        status: "UNORGANIZED",
      },
      select: sel,
    });
    createdId = created.id;
    console.log(`Created test row : ${created.id}`);

    // SYNC pre-pass — replicate the coord-writing portion of route.ts:298-311,
    // including the P1 gate that skips it for social-platform saves.
    const isSocialSave = (SOCIAL_PLATFORMS as readonly string[]).includes(sourcePlatform);
    if (rawTitle && !isSocialSave && !created.googlePlaceId) {
      const enriched = await enrichWithPlaces(rawTitle, created.destinationCity ?? "");
      const placesUpdate: Record<string, unknown> = {};
      if (enriched.country && !created.destinationCountry) placesUpdate.destinationCountry = enriched.country;
      if (enriched.placeId) placesUpdate.googlePlaceId = enriched.placeId;
      if (enriched.formattedAddress) placesUpdate.address = enriched.formattedAddress;
      if (enriched.lat !== null && !created.lat) placesUpdate.lat = enriched.lat;
      if (enriched.lng !== null && !created.lng) placesUpdate.lng = enriched.lng;
      if (Object.keys(placesUpdate).length > 0) {
        await db.savedItem.update({ where: { id: created.id }, data: placesUpdate });
      }
    }

    const afterSync = await db.savedItem.findUnique({ where: { id: created.id }, select: sel });
    console.log(`AFTER sync pre-pass: lat=${afterSync?.lat} lng=${afterSync?.lng} city=${JSON.stringify(afterSync?.destinationCity)} placeId=${afterSync?.googlePlaceId}`);

    await enrichSavedItem(created.id);

    const after = await db.savedItem.findUnique({ where: { id: created.id }, select: sel });
    console.log(`=== AFTER enrichSavedItem ===\n${JSON.stringify(after, null, 2)}`);
    if (after?.tripId) console.log(`!! WARNING: auto-attached to trip ${after.tripId} — will be removed by hard-delete`);
  } finally {
    if (createdId) {
      const del = await (await import("@/lib/db")).db.savedItem.delete({ where: { id: createdId } }).then(() => 1).catch(() => 0);
      console.log(`Hard-deleted ${createdId}: ${del === 1 ? "OK" : "FAILED"}`);
    }
    const remaining = await (await import("@/lib/db")).db.savedItem.count({
      where: { familyProfileId: PROFILE_ID, notes: TAG, deletedAt: null },
    });
    console.log(`Remaining __ENRICH_HARNESS__ rows: ${remaining}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
