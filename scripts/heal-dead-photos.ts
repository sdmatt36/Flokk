// Heal dead Google CDN photos (lh3.googleusercontent.com/place-photos, which expire on a rolling
// basis) on LIVE rows only (deletedAt IS NULL). Default = dry run; pass --apply to write.
//
// Per dead row:
//   - has a googlePlaceId (SavedItem itself, or ManualActivity via its linked SavedItem):
//     re-fetch a fresh photo by id (authoritative — no name guard needed).
//   - else: text-search by stored name + city, GUARD with nameSimilar (the same guard
//     findPlaceByNameCity uses in production) — accept only a token-matching place.
// HEAL = a matched place with a resolvable photo. On --apply, the fresh photo is persisted via
// toDurableImageUrl (our place-photos storage bucket) and written to imageUrl/placePhotoUrl, and
// the recovered placeId is set on the SavedItem. A persist that does NOT yield a durable
// supabase URL is treated as a skip — a raw/unmatched URL is never written. SKIP rows are left
// on their placeholder.
//
//   npx tsx scripts/heal-dead-photos.ts            # dry run (live set)
//   npx tsx scripts/heal-dead-photos.ts --apply    # write healed photos (live set)

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const KEY = process.env.GOOGLE_MAPS_API_KEY;
const APPLY = process.argv.includes("--apply");
const DEAD_FRAGMENT = "lh3.googleusercontent.com/place-photos";
const DURABLE_FRAGMENT = "supabase.co/storage";

type Outcome = "HEAL" | "SKIP_NO_MATCH" | "SKIP_NO_PHOTO";
type Row = {
  kind: "SavedItem" | "ManualActivity";
  id: string;
  storedName: string;
  city: string | null;
  via: "id" | "name";
  resolvedName: string | null;
  recoveredPlaceId: string | null;
  rawPhotoUrl: string | null;
  matched: boolean;
  photoFound: boolean;
  outcome: Outcome;
};

const trunc = (s: string | null, n: number) => (!s ? "-" : s.length > n ? s.slice(0, n - 1) + "…" : s);
const photoApiUrl = (ref: string) =>
  `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(ref)}&key=${KEY}`;

async function detailsByPlaceId(placeId: string): Promise<{ name: string | null; photoRef: string | null } | null> {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos&key=${KEY}`);
    const data = (await res.json()) as { result?: { name?: string; photos?: { photo_reference: string }[] } };
    if (!data.result) return null;
    return { name: data.result.name ?? null, photoRef: data.result.photos?.[0]?.photo_reference ?? null };
  } catch { return null; }
}

async function textSearchCandidate(query: string): Promise<{ name: string | null; placeId: string | null; photoRef: string | null } | null> {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${KEY}`);
    const data = (await res.json()) as { results?: { name?: string; place_id?: string; photos?: { photo_reference: string }[] }[] };
    const first = data.results?.[0];
    if (!first) return null;
    return { name: first.name ?? null, placeId: first.place_id ?? null, photoRef: first.photos?.[0]?.photo_reference ?? null };
  } catch { return null; }
}

async function plan(kind: Row["kind"], id: string, storedName: string, city: string | null, placeId: string | null): Promise<Row> {
  const { resolveGooglePhotoUrl, nameSimilar, normalizePlaceName } = await import("@/lib/google-places");
  const base = { kind, id, storedName, city } as const;

  if (placeId) {
    const d = await detailsByPlaceId(placeId);
    const rawPhotoUrl = d?.photoRef ? await resolveGooglePhotoUrl(photoApiUrl(d.photoRef)) : null;
    return { ...base, via: "id", resolvedName: d?.name ?? null, recoveredPlaceId: placeId, rawPhotoUrl, matched: true, photoFound: !!rawPhotoUrl, outcome: rawPhotoUrl ? "HEAL" : "SKIP_NO_PHOTO" };
  }

  const query = [storedName, city].filter(Boolean).join(" ").trim();
  const c = query ? await textSearchCandidate(query) : null;
  if (!c || !c.name || !nameSimilar(normalizePlaceName(storedName), c.name)) {
    return { ...base, via: "name", resolvedName: c?.name ?? null, recoveredPlaceId: null, rawPhotoUrl: null, matched: false, photoFound: false, outcome: "SKIP_NO_MATCH" };
  }
  const rawPhotoUrl = c.photoRef ? await resolveGooglePhotoUrl(photoApiUrl(c.photoRef)) : null;
  return { ...base, via: "name", resolvedName: c.name, recoveredPlaceId: c.placeId, rawPhotoUrl, matched: true, photoFound: !!rawPhotoUrl, outcome: rawPhotoUrl ? "HEAL" : "SKIP_NO_PHOTO" };
}

async function main() {
  if (!KEY) { console.error("GOOGLE_MAPS_API_KEY missing"); process.exit(1); }
  const { db } = await import("@/lib/db");
  const { toDurableImageUrl } = await import("@/lib/imageStore");

  // LIVE rows only — soft-deleted rows are excluded entirely (no re-resolve, no Google call, no write).
  const savedItems = await db.savedItem.findMany({
    where: { deletedAt: null, placePhotoUrl: { contains: DEAD_FRAGMENT } },
    select: { id: true, rawTitle: true, destinationCity: true, destinationCountry: true, googlePlaceId: true },
  });
  const manualActivities = await db.manualActivity.findMany({
    where: { deletedAt: null, imageUrl: { contains: DEAD_FRAGMENT } },
    select: {
      id: true, title: true, venueName: true, city: true,
      savedItem: { select: { googlePlaceId: true, rawTitle: true, destinationCity: true } },
    },
  });

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}  |  live dead set: SavedItem=${savedItems.length}, ManualActivity=${manualActivities.length}\n`);

  const rows: Row[] = [];
  for (const s of savedItems) {
    rows.push(await plan("SavedItem", s.id, s.rawTitle ?? "", s.destinationCity ?? s.destinationCountry ?? null, s.googlePlaceId ?? null));
  }
  for (const m of manualActivities) {
    const name = m.venueName || m.title || m.savedItem?.rawTitle || "";
    const city = m.city ?? m.savedItem?.destinationCity ?? null;
    rows.push(await plan("ManualActivity", m.id, name, city, m.savedItem?.googlePlaceId ?? null));
  }

  // Match table
  const header = ["kind", "via", "stored name", "resolved place", "match", "photo", "outcome"];
  const lines = rows.map((r) => [r.kind === "SavedItem" ? "SI" : "MA", r.via, trunc(r.storedName, 26), trunc(r.resolvedName, 26), r.matched ? "yes" : "no", r.photoFound ? "yes" : "no", r.outcome]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmt = (c: string[]) => c.map((x, i) => x.padEnd(widths[i])).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const l of lines) console.log(fmt(l));

  const tally = (rs: Row[]) => ({ total: rs.length, heal: rs.filter((r) => r.outcome === "HEAL").length, noMatch: rs.filter((r) => r.outcome === "SKIP_NO_MATCH").length, noPhoto: rs.filter((r) => r.outcome === "SKIP_NO_PHOTO").length });
  const line = (label: string, t: ReturnType<typeof tally>) => `${label}: total=${t.total}  HEAL=${t.heal}  SKIP_NO_MATCH=${t.noMatch}  SKIP_NO_PHOTO=${t.noPhoto}`;
  console.log("\n" + line("SavedItem", tally(rows.filter((r) => r.kind === "SavedItem"))));
  console.log(line("ManualActivity", tally(rows.filter((r) => r.kind === "ManualActivity"))));
  console.log(line("TOTAL", tally(rows)));

  if (!APPLY) {
    console.log("\nDRY RUN — no rows or storage objects written. Re-run with --apply to write.");
    return;
  }

  // ── APPLY ──
  let updated = 0;
  let persistFailed = 0;
  for (const r of rows) {
    if (r.outcome !== "HEAL" || !r.rawPhotoUrl) continue;
    const durable = await toDurableImageUrl(r.rawPhotoUrl);
    // Guard: only write a true durable supabase URL — never a raw/fallback URL.
    if (!durable || !durable.includes(DURABLE_FRAGMENT)) {
      persistFailed += 1;
      console.warn(`persist-failed (skip, left on placeholder): ${r.kind} ${r.id} "${r.storedName}"`);
      continue;
    }
    if (r.kind === "SavedItem") {
      await db.savedItem.update({
        where: { id: r.id },
        data: { placePhotoUrl: durable, ...(r.recoveredPlaceId ? { googlePlaceId: r.recoveredPlaceId } : {}) },
      });
    } else {
      await db.manualActivity.update({ where: { id: r.id }, data: { imageUrl: durable } });
    }
    updated += 1;
  }

  console.log(`\nAPPLIED: updated=${updated}  persist-failed-skipped=${persistFailed}`);

  // Re-check: live at-risk should now equal only the skip count
  const siLeft = await db.savedItem.count({ where: { deletedAt: null, placePhotoUrl: { contains: DEAD_FRAGMENT } } });
  const maLeft = await db.manualActivity.count({ where: { deletedAt: null, imageUrl: { contains: DEAD_FRAGMENT } } });
  console.log(`Re-check (live at-risk remaining): SavedItem=${siLeft}, ManualActivity=${maLeft}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
