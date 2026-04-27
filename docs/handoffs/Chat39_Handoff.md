# Flokk Chat 39 Handoff
**Session: April 27, 2026**
**Total commits: 29**

---

## Session Theme

Tour quality, operating discipline hardening, and multi-city data integrity. Three new Operating Disciplines established (Spec Reading, Modal Pattern, Universal URL Rule, Universal Entity Status Rule). Trip Tours tab fully self-contained. Modal system unified across 19 surfaces. Multi-city community spot mis-attribution root cause fixed both forward and backward.

---

## What Shipped (Chronological)

### Trip Cover Images + Lodging Routing Repair (session openers)

| Hash | Summary |
|------|---------|
| d73b89a | fix: lodging routing — prevent multi-word country false-positive (United/Kingdom) + no date-overlap keyword fallback (Mash Tun Scotland bug) |
| 860e907 | fix: trip cover images — Chiang Mai pointing to KL photo, missing Edinburgh + San Diego entries, prevent default cover from being stored on creation |
| 50d299b | fix: revert San Diego + Chiang Mai URLs to verified working images, audit all destination URLs |
| eaa1b07 | fix: replace 13 broken Unsplash URLs (Okinawa, Sri Lanka, Kamakura, Tokyo venues, Vienna, Dubrovnik, Taipei, Nara, Cambodia, Atlas, Majorelle, teamLab) — all verified 200 OK |
| 7e2c27f | feat: trip cover photos via Google Places textSearchPhoto fallback at creation, backfill 16 null trips (9 map, 6 Places, 1 miss) |

### Tour Categorization Pipeline

| Hash | Summary |
|------|---------|
| ba61d88 | feat: tour categorization forward path — TourStop.placeTypes capture at generate time, canonical mapper, save flow writes categoryTags |
| 0ff77ae | feat: tour categorization backfill — 13 legacy SavedItems repopulated, 0 manual-review items |

### Spec Hardening + Trip Tours Tab Self-Containment

| Hash | Summary |
|------|---------|
| 79d22f8 | docs: spec — three-state sharing model, backlog reconciled (32 items from Chat 37+38) |
| 4af98e8 | docs: spec hardening — reverse maps-deferred reversal error, expand Trip Tours self-containment, Spec Reading Discipline |
| 82c004d | feat: Trip Tours tab self-containment — TourMapBlock lifted to reusable component, map + familyNote + per-stop Link inline in expand-in-place, "View tour" removed |

### Modal System Unification

| Hash | Summary |
|------|---------|
| 536eec1 | docs: Modal Pattern Discipline — canonical pattern defined, migration approach |
| 9b1674c | feat: modal migration — 19 modals across 10 files, MODAL_OVERLAY/PANEL/STICKY_FOOTER constants, BottomNav z-40 (root cause fix) |

### Operating Disciplines Established (Spec Only)

| Hash | Summary |
|------|---------|
| 5c8851d | docs: Universal URL Rule Operating Discipline |
| b7fc2c2 | docs: Tour Anchoring system specced (save-anchored generation, locked CTA copy) |
| 9100f9e | docs: Universal Entity Status Rule Operating Discipline |

### Universal URL Rule — Build

| Hash | Summary |
|------|---------|
| a030523 | feat: Universal URL Rule — src/lib/url-resolver.ts, schema migration (TourStop.websiteUrl NOT NULL), forward-path integration |

### Destination Autocomplete + Tour-Day Rendering Fixes

| Hash | Summary |
|------|---------|
| 5b25c85 | fix: destination autocomplete types — added administrative_area_level_1/2 so Scotland, Hokkaido, Tuscany resolve |
| ce326e2 | docs: spec — four tour-day rendering + stop affordance issues from Scotland verification |
| aceb98e | fix: day-view tour + lodging interleaving + "From X" header (Chat 39 Scotland verification) |
| ad44676 | feat: stop detail modal Maps + Website split affordances + per-stop X delete on Trip Tours expand-in-place |

### Multi-City Community Spot Attribution (Phases 1 + 2)

| Hash | Summary |
|------|---------|
| 0ac4a05 | fix: populate ManualActivity.city at creation time via reverse-geocode or LODGING anchor (Phase 1 — forward path) |
| 7ec8f9b | fix: backfill 7 wrong-city Seoul CommunitySpots merged into Busan (Phase 2 — targeted backfill) |

---

## Schema Changes

### TourStop
- `websiteUrl` changed from `String?` to `String` (NOT NULL) via migration
- `placeTypes String[]` — Google Places `types` array captured at generate time; used by save flow to derive `SavedItem.categoryTags`
- Pre-existing `ticketRequired String?` unchanged

### ManualActivity
- `city String?` — existed in schema but was never populated at creation. Now populated via three-path resolution in `POST /api/trips/[id]/activities` (reverse-geocode from lat/lng → LODGING check-in `toCity` anchor → null). No schema migration required.

### New files
- `src/lib/modal-classes.ts` — MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES, MODAL_STICKY_FOOTER_CLASSES constants
- `src/lib/url-resolver.ts` — resolveCanonicalUrl(placeId?, website?, name, city) → string; priority: Places website → Google Maps place URL → generic search URL
- `src/components/tours/TourMapBlock.tsx` — shared map component (Tour Results + Trip Tours expand-in-place)
- `src/lib/google-places.ts` — added `reverseGeocodeCityFromCoords({ lat, lng })` export
- `src/lib/__tests__/reverse-geocode.test.ts` — 6 vitest tests (all passing)
- `scripts/backfill-busan-spot-merge.ts` — idempotent Phase 2 merge script

---

## Operating Disciplines Established

### 4. Spec Reading Discipline
Five rules added at top of `FLOKK_PRODUCT_SPEC.md` after maps-on-mobile drift:
1. Read the relevant spec section before any code prompt.
2. Proposed reversals require explicit acknowledgment of what is being reversed and why.
3. A user comment ("X feels like Y") is input, not a settled decision.
4. Settled decisions are explicit, written into spec, acknowledged as architectural commitments.
5. Reversals go into Decisions Log with original commit hash, reason, and corrected decision.

### 5. Modal Pattern Discipline
Canonical modal pattern defined after stop detail modal was clipped by bottom nav on desktop:
- Outer wrapper: `items-end sm:items-center`
- Panel: `rounded-t-2xl sm:rounded-2xl`
- Scroll container: `pb-safe`
- Root cause fix: BottomNav z-index lowered 80→40 (was masking all bottom-sheet modals on desktop)

### 6. Universal URL Rule
All AI-generated/extracted entities must have a non-null URL. Priority chain:
1. Google Places `website` field
2. `https://www.google.com/maps/place/?q=place_id:{placeId}`
3. Generic search URL (`https://www.google.com/search?q=...`)

Resolver: `resolveCanonicalUrl()` in `src/lib/url-resolver.ts`.

### 7. Universal Entity Status Rule
Status derivation must be consistent across all surfaces. Five-state enum:
`Saved` → `On itinerary` → `Booked` → `Completed` → `Rated`
- Build pending: `src/lib/entity-status.ts` shared helper + `EntityStatusPill` component + migration across SavesScreen, trip Saved tab, Itinerary, Vault, Recommendations, Discover Spots, tour stop cards.

---

## Multi-City Attribution Fix Summary

**Root cause:** `ManualActivity.city` was null for all activities. When the user rated an activity, `POST /api/trips/[id]/ratings` called `writeThroughCommunitySpot` with `city = ma.city ?? trip.destinationCity`. For the Korea trip, `trip.destinationCity = "Seoul"` even for Busan-leg activities. The `(name, city)` dedup key missed the existing Busan-tagged CommunitySpot rows (created from URL-paste saves), producing 7 duplicate Seoul-tagged CommunitySpot rows for Busan landmarks.

**Phase 1 (commit 0ac4a05):** `POST /api/trips/[id]/activities` now resolves city via:
1. Reverse-geocode from `lat`/`lng` via `reverseGeocodeCityFromCoords()` (new helper in google-places.ts)
2. Most recent LODGING `ItineraryItem.toCity` on or before the activity date (direct query — NOT `getCityForDay`, which re-introduces the `trip.destinationCity` fallback)
3. Leave null (pre-existing fallback behavior preserved)

**Phase 2 (commit 7ec8f9b):** `scripts/backfill-busan-spot-merge.ts` merged 7 wrong-city pairs:

| Wrong (Seoul) | Correct (Busan) | Name |
|---|---|---|
| cmo531cwl... | cmo45nu5c... | Lotte Giants Baseball Game |
| cmo531gfq... | cmo45nwbm... | Haeundae Traditional Market |
| cmo531oql... | cmo45o4ve... | Cloud Mipo |
| cmo531sj7... | cmo45o69u... | Sam Ryan's South Korea |
| cmo5327ya... | cmo45ods2... | Gamcheon Culture Village |
| cmo532awh... | cmo45obnp... | Busan X The Sky |
| cmo532drz... | cmo45ofwp... | Haeundae Beach |

All 7 pairs: CONFLICT resolution (Busan already had contribution from same family) → Seoul duplicate contributions deleted → SavedItem.communitySpotId redirected → Busan aggregates recomputed → Seoul stubs deleted. Post-merge: 0 Seoul-tagged Busan landmarks, 0 orphan contributions, 0 orphan saves.

**Manual verification still pending:** Open Discover Spots in production, filter "Busan" → confirm 7 venues appear once each, no duplicates. Filter "Seoul" → confirm none of the 7 Busan landmarks appear.

---

## Pending Legacy Data Items

| Item | Status |
|------|--------|
| **DRP8E8 booking** on trip `cmmycshfj000004jpyadzdp8y` | Missing leg. Same shape as Okinawa repair. Needs SQL repair. |
| **28 lodging items with `bookingSource = "unknown"`** | Direct hotel emails. Acceptable — no platform to link to. |
| **Legacy TourStops with `null ticketRequired`** | Remains null until re-generation or Place Details backfill. Not blocking. |
| **SaveDetailModal slide-up migration** | `src/components/features/saves/SaveDetailModal.tsx` uses transform-based pattern — not a className swap. Structural refactor still pending. |

---

## Chat 40 Opening Queue (Priority Order)

### 1. Discover Spots UI Verification (5 min — manual, user does this)
Open production Discover Spots. Filter "Busan" — confirm 7 venues, no duplicates. Filter "Seoul" — confirm 0 Busan landmarks. If anything is wrong, report before building anything else.

### 2. Universal Entity Status Rule Build (P0 — 45–60 min)
Build `src/lib/entity-status.ts` + `EntityStatusPill` + migrate all surfaces. Bellwether bug: Hyatt Regency Seragaki Island showing "+ Itinerary" instead of "On itinerary".

Surfaces: SavesScreen card grid, trip Saved tab, Itinerary day view, Vault cards, Recommendations, Discover Spots, tour stop cards.

### 3. Universal URL Rule — Audit + Backfill (P0/P1 — 30–45 min)
`resolveCanonicalUrl()` is in place. Six surfaces still need audit SQL + idempotent backfill:
- TourStop (websiteUrl NOT NULL migration done; verify no empty-string rows)
- ItineraryItem LODGING
- ItineraryItem ACTIVITY
- ManualActivity
- IntelItem
- Recommendations

### 4. ManualActivity.googlePlaceId Structural Improvement (P1 — 20–30 min)
Store `googlePlaceId` on `ManualActivity` at creation time. Allows `writeThroughCommunitySpot` to dedup by `placeId` (priority 1) instead of `(name, city)` tuple, eliminating multi-city dedup ambiguity entirely.

### 5. Tour Anchoring Build (P1 — own session)
API: `POST /api/tours/generate` accepts `anchorSavedItemIds`. AI prompt handles anchor+fill, check-in-day (lodging as end anchor), check-out-day (lodging as start anchor), regular-day cases. UI: Tour Builder "Include your saved spots" section + Saves tab ambient prompt with locked CTA "Turn your trip saves into a Flokkin tour". Lodging-as-start-of-day anchor already shipped Chat 38.

### 6. /tour/[id] Public Viewer (P2 — own session)
Repurpose `/tour/[id]` as the public viewer for Discover/Spots-surfaced and shared tours. Non-owner, magazine-quality layout. Flokk identity present, "Save to my trip" / "Sign up" CTA. Full design pass before frontend code.

### 7. Schedule Intelligence Bugs SI-1/SI-2/SI-3 (P1 — queued from memory)
- SI-1: check-in default time
- SI-2: check-out default time
- SI-3: drive directions vs train/flight routing

---

## Tests Passing at Session End

- **19/19** vitest unit tests (`npx vitest run`): 13 place-type mapper tests + 6 reverse-geocode tests
- TypeScript build: `npx tsc --noEmit` — clean

Run before any commit: `npx tsc --noEmit && npx vitest run`

---

## Key Technical Reference

| Item | Value |
|------|-------|
| Greene family profileId | `cmmmv15y7000104jvocfz5kt6` |
| Seoul trip | `cmmx6428k000004jlxgel7s86` |
| London trip | `cmnhgoflq000004l4403jm4mx` |
| Sri Lanka trip | `cmmx09fra000004if78drj98m` |
| Okinawa trip | `cmmet611o0000yn8nz6ss7yg4` |
| Supabase project_id | `egnvlwgngyrkhhbxtlqa` |
| dayIndex formula | `Math.round((new Date(scheduledDate) - new Date(tripStartDate)) / 86400000)` |
| reverseGeocodeCityFromCoords | `src/lib/google-places.ts` |
| url-resolver | `src/lib/url-resolver.ts` |
| modal-classes | `src/lib/modal-classes.ts` |
| TourMapBlock | `src/components/tours/TourMapBlock.tsx` |

---

## Lessons (Preserve Across Sessions)

- `ManualActivity` has NO `savedItemId` field — the "inherit city from linked SavedItem" path is impossible. Always grep before writing spec steps that assume cross-model relationships.
- `getCityForDay` falls back to `trip.destinationCity` — do NOT use it in city-attribution code paths. The LODGING anchor query must be written directly.
- Phase 2 conflict detection: `SpotContribution` has a unique constraint on `(communitySpotId, familyProfileId)`. Simple `updateMany` fails if the target spot already has a contribution from the same family. Always pre-check per-contribution and either delete (if conflict) or reassign (if not).
- Backfill scripts must use `dotenv.config({ path: ".env.local" })` + `Pool({ connectionString: DATABASE_URL })` + `PrismaPg(pool)` + `PrismaClient({ adapter })` — plain `new PrismaClient()` without the adapter fails with initialization error.
- BottomNav z-index was the root cause of modal masking across the entire app. It was z-80; lowered to z-40 in Chat 39. Any future modal clipping issues — check BottomNav z-index first.
- TourMapBlock is now the shared map component for both TourResults and ToursContent. Do not inline new map logic into either consumer — extend TourMapBlock.
- `TourStop.websiteUrl` is now NOT NULL (schema-enforced). Forward path for new stops uses `resolveCanonicalUrl()`. Any direct insert/upsert of TourStop rows must supply a non-null websiteUrl.
- Spec Reading Discipline: offhand user input ("X feels like Y") is NOT a product decision. Do not reverse existing spec sections based on chat context alone. Always cross-reference FLOKK_PRODUCT_SPEC.md before any architectural change.
- All prior session lessons from Chat 38 still apply.

---

## Brand / User Context (Matt)

- One prompt at a time, diagnostic-first, single clean copyable code blocks
- No em dashes in copy, casual direct tone, no AI filler phrases
- Design: navy `#1B3A5C`, terracotta `#C4664A`, no emojis, Lucide icons, Playfair Display + DM Sans
- No `Co-Authored-By` in commit messages, plain commit messages only
- ~4 hour session windows, Matt says when done
- Sign off: "Matt and Jen, Co-Founders, Flokk"
