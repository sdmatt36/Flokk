// Trust harness for the social-saves enrichment path.
//
// This drives the REAL production code — NOT an inline copy of the pre-pass. Each input runs:
//   extractOgMetadata
//     -> create SavedItem (URL_PASTE, inferred platform)
//     -> resolvePlaceForSave()  [THE shared route pre-pass — src/lib/saves/resolve-place.ts]
//     -> apply its update map (mirrors the route's db.savedItem.update)
//     -> enrichSavedItem()      [the deferred pipeline]
//     -> read final state
//     -> assert the invariant
//     -> HARD DELETE.
//
// Invariant (per input): the final row EITHER resolves to a real place (coords + a city) with
// needsPlaceConfirmation=false, OR is flagged needsPlaceConfirmation=true with NO coords.
// FAIL = coords/placeId written for an unresolved/generic title (the junk-geocode class), or a
// flagged row that still carries coords, or an orphan with neither coords nor flag.
//
// Seeds: representative REAL recent SavedItem.sourceUrl values pulled from the DB across source
// types, plus the known-hard cleaned Airbnb listing. Override with one URL arg to test a single
// input. Each row is tagged __ENRICH_HARNESS__ and hard-deleted; a final sweep reports strays.
//
//   npx tsx scripts/enrich-harness.ts                 # full matrix (DB-seeded)
//   npx tsx scripts/enrich-harness.ts <url>           # single input
//   npx tsx scripts/enrich-harness.ts --limit=6       # cap matrix size

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";
const TAG = "__ENRICH_HARNESS__";
const ARGS = process.argv.slice(2);
const SINGLE_URL = ARGS.find((a) => !a.startsWith("--"));
const LIMIT = Number((ARGS.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1]) || 0;

// Known-hard case: an Airbnb listing whose generic OG title geocodes to a coincidental pin
// (the Airbnb->Maryland junk class). Must end flagged with NO coords.
const HARD_AIRBNB = "https://www.airbnb.com/rooms/1225289811725056376";

type Seed = { url: string; label: string; expectCity?: string };

type Row = {
  url: string;
  label: string;
  sourcePlatform: string;
  rawTitle: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  needsConfirm: boolean;
  resolved: boolean;
  pass: boolean;
  reason: string;
};

const norm = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cityFuzzy = (a: string | null, b: string): boolean => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSeeds(db: any): Promise<Seed[]> {
  if (SINGLE_URL) return [{ url: SINGLE_URL, label: "cli" }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = async (label: string, where: any, n: number): Promise<Seed[]> => {
    const rows = await db.savedItem.findMany({
      where: { sourceUrl: { not: null }, ...where },
      select: { sourceUrl: true },
      orderBy: { savedAt: "desc" },
      take: n,
    });
    return rows.map((r: { sourceUrl: string }) => ({ url: r.sourceUrl, label }));
  };

  const groups = await Promise.all([
    pick("instagram", { sourcePlatform: "instagram" }, 2),
    pick("tiktok", { sourcePlatform: "tiktok" }, 1),
    pick("airbnb", { sourceUrl: { contains: "airbnb.", mode: "insensitive" } }, 1),
    pick("booking", { sourceUrl: { contains: "booking.com", mode: "insensitive" } }, 1),
    pick("expedia", { sourceUrl: { contains: "expedia.", mode: "insensitive" } }, 1),
    pick("direct_website", { sourcePlatform: "direct_website" }, 1),
    pick("google_maps_pin", {
      OR: [{ sourceUrl: { contains: "maps.app.goo.gl" } }, { sourceUrl: { contains: "google.com/maps/place" } }],
    }, 1),
    pick("maps_placelist", { sourceUrl: { contains: "/placelists/" } }, 1),
  ]);

  const seeds: Seed[] = [{ url: HARD_AIRBNB, label: "airbnb_hard" }, ...groups.flat()];

  // Dedupe by URL, preserve order, cap if requested.
  const seen = new Set<string>();
  const deduped = seeds.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  return LIMIT > 0 ? deduped.slice(0, LIMIT) : deduped;
}

function classify(seed: Seed, r: { city: string | null; lat: number | null; lng: number | null; placeId: string | null; needsConfirm: boolean }): { resolved: boolean; pass: boolean; reason: string } {
  const hasCoords = r.lat !== null && r.lng !== null;
  const resolved = hasCoords && !r.needsConfirm;

  // Structural invariant: coords XOR needsConfirm, and a resolved place must carry a city.
  if (hasCoords && r.needsConfirm) return { resolved, pass: false, reason: "coords written AND needsConfirm (junk pin still flagged)" };
  if (!hasCoords && !r.needsConfirm) return { resolved, pass: false, reason: "no coords AND not flagged (orphan — neither resolved nor confirmable)" };
  if (hasCoords && !r.city) return { resolved, pass: false, reason: "coords without a city (geocode-only junk)" };

  // City oracle (only when a known expected city is supplied): catches the wrong-city junk class.
  if (resolved && seed.expectCity && !cityFuzzy(r.city, seed.expectCity)) {
    return { resolved, pass: false, reason: `resolved to "${r.city}" but expected "${seed.expectCity}"` };
  }
  return { resolved, pass: true, reason: resolved ? "resolved (coords + city)" : "flagged needsPlaceConfirmation, no coords" };
}

async function runOne(deps: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  extractOgMetadata: (u: string) => Promise<{ title?: string | null }>;
  resolvePlaceForSave: (i: { url: string; rawTitle: string | null; sourcePlatform: string; destinationCity?: string | null; existing?: Record<string, unknown> }) => Promise<{ update: Record<string, unknown> }>;
  enrichSavedItem: (id: string) => Promise<void>;
  inferPlatformFromUrl: (u: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  he: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sel: any;
}, seed: Seed): Promise<Row> {
  const { db, extractOgMetadata, resolvePlaceForSave, enrichSavedItem, inferPlatformFromUrl, he, sel } = deps;
  const cleanText = (s: string | null | undefined): string | null =>
    s ? (he.decode(s.replace(/&#x[0-9a-fA-F]+;/gi, "").trim()) || null) : null;

  console.log(`\n========== [${seed.label}] ${seed.url} ==========`);
  let createdId: string | null = null;
  try {
    const meta = await extractOgMetadata(seed.url);
    const rawTitle = cleanText(meta.title);
    const sourcePlatform = inferPlatformFromUrl(seed.url);
    console.log(`rawTitle=${JSON.stringify(rawTitle)} platform=${sourcePlatform}`);

    const created = await db.savedItem.create({
      data: {
        familyProfileId: PROFILE_ID,
        sourceMethod: "URL_PASTE",
        sourcePlatform,
        sourceUrl: seed.url,
        rawTitle,
        notes: TAG,
        extractionStatus: "PENDING",
        status: "UNORGANIZED",
      },
      select: sel,
    });
    createdId = created.id;

    // THE shared route pre-pass — identical code path as POST /api/saves.
    const place = await resolvePlaceForSave({ url: seed.url, rawTitle, sourcePlatform, destinationCity: created.destinationCity ?? null, existing: created });
    if (Object.keys(place.update).length > 0) {
      await db.savedItem.update({ where: { id: created.id }, data: place.update });
    }
    const afterSync = await db.savedItem.findUnique({ where: { id: created.id }, select: sel });
    console.log(`after pre-pass : lat=${afterSync?.lat} lng=${afterSync?.lng} placeId=${afterSync?.googlePlaceId} city=${JSON.stringify(afterSync?.destinationCity)}`);

    await enrichSavedItem(created.id);

    const f = await db.savedItem.findUnique({ where: { id: created.id }, select: sel });
    const state = {
      city: f?.destinationCity ?? null,
      lat: f?.lat ?? null,
      lng: f?.lng ?? null,
      placeId: f?.googlePlaceId ?? null,
      needsConfirm: f?.needsPlaceConfirmation === true,
    };
    const { resolved, pass, reason } = classify(seed, state);
    console.log(`final          : lat=${state.lat} lng=${state.lng} placeId=${state.placeId} city=${JSON.stringify(state.city)} needsConfirm=${state.needsConfirm} => ${pass ? "PASS" : "FAIL"} (${reason})`);
    if (f?.tripId) console.log(`!! auto-attached to trip ${f.tripId} (removed by hard-delete)`);

    return { url: seed.url, label: seed.label, sourcePlatform, rawTitle, ...state, resolved, pass, reason };
  } finally {
    if (createdId) {
      const ok = await db.savedItem.delete({ where: { id: createdId } }).then(() => true).catch(() => false);
      console.log(`hard-deleted ${createdId}: ${ok ? "OK" : "FAILED"}`);
    }
  }
}

async function main() {
  const { db } = await import("@/lib/db");
  const { extractOgMetadata } = await import("@/lib/og-extract");
  const { enrichSavedItem } = await import("@/lib/enrich-save");
  const { inferPlatformFromUrl } = await import("@/lib/saved-item-types");
  const { resolvePlaceForSave } = await import("@/lib/saves/resolve-place");
  const he = (await import("he")).default;

  const sel = {
    id: true, rawTitle: true, destinationCity: true, destinationCountry: true,
    lat: true, lng: true, googlePlaceId: true, needsPlaceConfirmation: true,
    extractionStatus: true, sourcePlatform: true, tripId: true,
  } as const;

  const seeds = await buildSeeds(db);
  console.log(`Matrix: ${seeds.length} input(s)`);

  const results: Row[] = [];
  for (const seed of seeds) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results.push(await runOne({ db, extractOgMetadata: extractOgMetadata as any, resolvePlaceForSave: resolvePlaceForSave as any, enrichSavedItem, inferPlatformFromUrl, he, sel }, seed));
    } catch (e) {
      console.error(`[harness] ${seed.label} ${seed.url} threw:`, e);
      results.push({ url: seed.url, label: seed.label, sourcePlatform: "?", rawTitle: null, city: null, lat: null, lng: null, placeId: null, needsConfirm: false, resolved: false, pass: false, reason: `threw: ${(e as Error).message}` });
    }
  }

  // ── Matrix table ────────────────────────────────────────────────────────────
  console.log(`\n\n================= MATRIX =================`);
  const header = ["input", "source", "resolved?", "city", "coords", "needsConfirm", "result"];
  const lines = results.map((r) => [
    trunc(r.url, 44),
    r.label,
    r.resolved ? "yes" : "no",
    trunc(r.city ?? "-", 18),
    r.lat !== null && r.lng !== null ? `${r.lat!.toFixed(3)},${r.lng!.toFixed(3)}` : "-",
    String(r.needsConfirm),
    r.pass ? "PASS" : "FAIL",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const l of lines) console.log(fmt(l));

  // ── Failure list ──────────────────────────────────────────────────────────────
  const failures = results.filter((r) => !r.pass);
  console.log(`\n${failures.length} FAILING input(s) of ${results.length}:`);
  for (const f of failures) {
    console.log(`  - [${f.label}] ${f.url}`);
    console.log(`      title=${JSON.stringify(f.rawTitle)} reason=${f.reason}`);
  }
  if (failures.length === 0) console.log("  (none)");

  // ── Cleanup sweep ──────────────────────────────────────────────────────────────
  const remaining = await db.savedItem.count({ where: { familyProfileId: PROFILE_ID, notes: TAG, deletedAt: null } });
  console.log(`\nRemaining ${TAG} rows: ${remaining}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
