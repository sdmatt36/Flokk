# Rating Write-Path Audit — Chat 27 Prompt 1

Generated: 2026-04-19T00:00:00+09:00
Read-only audit. No production code modified.

## Summary

- Total rating write surfaces found: 7
- With write-through to CommunitySpot + SpotContribution: 3
- Missing or partial write-through (P0): POST /api/saves, POST /api/places/save, POST /api/community/rate
- Legacy/dead endpoints still present in codebase: POST /api/saves/[id]/rate
- Multi-city city-derivation bugs confirmed or suspected: POST /api/trips/[id]/ratings, PATCH /api/trips/[id]/ratings/[ratingId] (ItineraryItem path only)
- Server-action or direct-Prisma bypass surfaces: none

---

## Endpoint Inventory

| Path | Verb | Writes to | Write-through | Verbs covered | City derivation | Status |
|------|------|-----------|---------------|---------------|-----------------|--------|
| /api/saves | POST | SavedItem.userRating | NO | create only | SavedItem.destinationCity set at create-time; write-through absent | P0 |
| /api/saves/[id] | PATCH | SavedItem.userRating, SavedItem.notes | YES | update ✓ | updated.destinationCity (item-specific) — CORRECT | OK |
| /api/saves/[id]/rate | POST | PlaceRating (create), SavedItem.userRating | NO | create only | savedItem.destinationCity — moot, no write-through | P0 legacy |
| /api/trips/[id]/ratings | POST | PlaceRating (create) | YES | create ✓ | ManualActivity: ma.city ?? trip.destinationCity ✓; ItineraryItem: trip.destinationCity only — P1 multi-city BUG | OK (P1 city) |
| /api/trips/[id]/ratings/[ratingId] | PATCH | PlaceRating (update) | YES | update ✓ | Same as POST above — P1 multi-city BUG for ItineraryItem path | OK (P1 city) |
| /api/places/save | POST | ManualActivity (create) + PlaceRating (create, conditional) | NO | create only | activity.city from user input — CORRECT; but no write-through | P0 |
| /api/community/rate | POST | PlaceRating (create, orphaned — no FK to trip/item) | NO | create only | body.destinationCity — moot, no write-through | P0 |

---

## Frontend Call-Site Inventory

| UI Surface | Component file | Endpoint called | Verb | Rating UI type | Status |
|------------|----------------|-----------------|------|----------------|--------|
| Saves tab rating modal | SavesScreen.tsx:1393 | PATCH /api/saves/[id] | PATCH | 5-star modal | OK |
| SaveDetailModal inline stars | SaveDetailModal.tsx:579 | PATCH /api/saves/[id] | PATCH | 5-star inline (rating only, no notes passed) | OK |
| How Was It — save-kind bulk save | TripTabContent.tsx:5370 | PATCH /api/saves/[id] | PATCH | 5-star + notes textarea | OK |
| How Was It — itinerary/manual bulk save | TripTabContent.tsx:5377 | POST /api/trips/[id]/ratings | POST | 5-star + notes textarea | OK |
| How Was It — edit existing rating | TripTabContent.tsx:5435 | PATCH /api/trips/[id]/ratings/[ratingId] | PATCH | 5-star + notes textarea | OK |
| Discover community rating modal (Trips tab) | discover/page.tsx:1927 | POST /api/community/rate | POST | 5-star modal | P0 |
| Discover "Add a Spot" modal (with rating) | discover/page.tsx:943 | POST /api/places/save | POST | 5-star inline | P0 |
| Past-trip import link rating | trips/past/new/page.tsx:450 | POST /api/saves | POST | 5-star inline | P0 |

---

## Identified Gaps

### P0 — POST /api/community/rate: no write-through
- **Where:** `src/app/api/community/rate/route.ts:62`
- **What:** Creates a `PlaceRating` row directly. No `CommunitySpot` or `SpotContribution` written. The PlaceRating is also structurally orphaned — `tripId`, `itineraryItemId`, `manualActivityId`, and `savedItemId` are all null (the route has a `savedItemId` body field but it is never sent by the caller).
- **Impact:** Every rating submitted from the Discover page community rating modal (Trips tab → activity cards → "Rate" button) is permanently lost to the community layer. The spot's `averageRating`, `ratingCount`, and `contributionCount` never update. Users see a `PlaceRating` in their personal history but it has zero effect on community scores.
- **Additional note:** The route's guardian (`savedItem.findFirst` check) requires the user to have saved the place before rating it. For activities sourced from ManualActivity (not SavedItem), this check will always fail with 403. This means most Discover tab ratings silently fail without feedback even before the write-through gap matters. Needs investigation in Prompt 2.

### P0 — POST /api/places/save: no write-through on conditional PlaceRating create
- **Where:** `src/app/api/places/save/route.ts:62-76`
- **What:** When a user adds a spot from Discover with a rating (`body.rating >= 1`), a `PlaceRating` row is created linked to the newly-created `ManualActivity`. No `CommunitySpot` or `SpotContribution` write-through fires.
- **Impact:** Any rating submitted with a new spot via "Add a Spot" (Discover page) with a rating pre-filled is lost to the community layer. The ManualActivity has `city`, `lat`, `lng`, `type` — all data needed for the write-through is present.

### P0 — POST /api/saves: no write-through at creation time when userRating supplied
- **Where:** `src/app/api/saves/route.ts:226`
- **What:** The POST handler accepts `userRating` in the Zod schema and stores it on `SavedItem`. No `CommunitySpot`/`SpotContribution` write-through fires. Called by: past-trip import (`trips/past/new/page.tsx:450`) with `userRating: link.rating`.
- **Impact:** All ratings submitted during past-trip import are lost to the community layer at creation time. They would only become visible if the user re-opens the item in SaveDetailModal or Saves tab and clicks a star again — triggering the PATCH write-through. First-write data loss.

### P0 legacy — POST /api/saves/[id]/rate: dead code with no write-through
- **Where:** `src/app/api/saves/[id]/rate/route.ts`
- **What:** Creates a `PlaceRating` and also updates `SavedItem.userRating`. No write-through. No frontend call sites found (`grep -rn "/api/saves/.*/rate"` returns zero results).
- **Impact:** Currently not reachable from the frontend. Risk: if any future frontend code ever calls this path (e.g., a re-introduced feature or third-party client), it will silently create dual writes (`PlaceRating` + `SavedItem.userRating`) without community write-through. Should be deleted.

### P1 — Multi-city city derivation for ItineraryItem ratings
- **Where:** `src/app/api/trips/[id]/ratings/route.ts:127-133` and `src/app/api/trips/[id]/ratings/[ratingId]/route.ts:79-88`
- **What:** When the source is an `ItineraryItem`, city is always `trip.destinationCity`. `ItineraryItem` has no `city` field — city must be inferred from the trip. For multi-city trips (e.g., Tokyo → Kyoto → Osaka stored as a single trip with `destinationCity = "Tokyo"`), Kyoto and Osaka activities will be attributed to Tokyo in the community layer.
- **Impact:** Community spot records will have incorrect city attribution for multi-city trip activity ratings. Affects aggregation queries, `getFeaturedCities`, and city page display. Currently affects only the itinerary-item path; the ManualActivity path correctly uses `ma.city`.

### Observation — SaveDetailModal star click sends no notes
- **Where:** `src/components/features/saves/SaveDetailModal.tsx:579`
- **What:** The inline star click handler sends `{ userRating: newRating }` only — no `notes`. The notes textarea is separate and fires its own PATCH on a debounce timer. Two separate PATCH calls means two independent write-through triggers. This is correct behavior (both trigger write-through) but the SpotContribution upsert from the star-only PATCH will overwrite `note` with whatever `updated.notes` currently is, potentially with stale data if notes and rating are changed in rapid succession.
- **Impact:** Minor race condition at high write frequency. Low priority.

### Observation — POST /api/community/rate creates structurally orphaned PlaceRating rows
- **Where:** `src/app/api/community/rate/route.ts:62-73`
- **What:** `tripId`, `itineraryItemId`, `manualActivityId` are all null. `savedItemId` is in the body type but never sent by the caller. These rows have no foreign key to any trip or item — they float in `PlaceRating` with only `familyProfileId`, `placeName`, and `destinationCity` for context.
- **Impact:** Even after Prompt 2 adds write-through, these PlaceRating rows cannot be reliably queried back (no FK joins). Acceptable as a known architectural trade-off for community-sourced ratings, but worth documenting.

---

## Recommended Prompt 2 Scope

1. **Add write-through to `POST /api/community/rate`** — Highest user-facing impact (Discover tab rating modal). City is in `body.destinationCity`. Write-through: `findFirst` CommunitySpot by cleaned name+city → create if missing → `spotContribution.upsert` → recompute aggregates. Also investigate and fix or document the savedItem guardian that may be causing silent 403s. — *15–20 min*

2. **Add write-through to `POST /api/places/save`** — Fires when "Add a Spot" includes a rating. ManualActivity is already created, so `manualActivityId` is available. Pattern identical to POST trips/ratings. Runs only inside the `if (body.rating && body.rating >= 1)` block. — *10–15 min*

3. **Add write-through to `POST /api/saves`** — Past-trip import path. Fires only when `userRating != null` after `savedItem` create. Same pattern as PATCH saves/[id] write-through. Requires `savedItem.destinationCity` to be set at create time (it is, from enrichment). — *15–20 min*

4. **Delete `POST /api/saves/[id]/rate`** — Dead code. No frontend calls. Removes dual-write risk. — *5 min*

5. **P1: Multi-city ItineraryItem city derivation** — Low priority until multi-city trip support is a stated product goal. Options: (a) accept current behavior and document; (b) add a `city` field to `ItineraryItem`; (c) infer city from nearest CITY_CENTERS centroid using lat/lng. Needs separate architecture discussion. — *30–60 min*

---

## Raw Grep Output (Appendix)

### Step 2 — Prisma write calls

```
=== userRating references (all) ===
src/app/(app)/trips/past/new/page.tsx:443:        userRating: link.rating ?? undefined,
src/app/api/saves/route.ts:60:  userRating: z.number().int().min(1).max(5).optional().nullable(),
src/app/api/saves/route.ts:139:    const { url, tripId, title, description, thumbnailUrl, tags, lat, lng, dayIndex, extractedCheckin, extractedCheckout, userRating, notes } = SaveSchema.parse(body);
src/app/api/saves/route.ts:226:        userRating: userRating ?? null,
src/app/api/saves/[id]/rate/route.ts:43:    data: { userRating: body.rating },
src/app/api/saves/[id]/route.ts:61:  if (typeof body.userRating === "number") updateData.userRating = body.userRating;
src/app/api/saves/[id]/route.ts:88:    // Community layer write-through — fires when userRating or notes updated.
src/app/api/saves/[id]/route.ts:90:    const triggersCommunity = updateData.userRating !== undefined || updateData.notes !== undefined;
src/app/api/saves/[id]/route.ts:96:        } else if (updated.userRating == null && !updated.notes) {
src/app/api/saves/[id]/route.ts:142:                rating: updated.userRating ?? null,
src/app/api/saves/[id]/route.ts:146:                rating: updated.userRating ?? null,
src/app/api/travel-intel/route.ts:123:    if (item.userRating != null) g._ratings.push(item.userRating);
src/components/features/saves/SavesScreen.tsx:32:  userRating?: number | null;
src/components/features/saves/SavesScreen.tsx:424:            {ratedItemId === save.id || save.userRating ? (
src/components/features/saves/SavesScreen.tsx:1396:                    body: JSON.stringify({ userRating: ratingValue, notes: ratingNotes.trim() || undefined }),
src/components/features/saves/SaveDetailModal.tsx:28:  userRating: number | null;
src/components/features/saves/SaveDetailModal.tsx:579:                          body: JSON.stringify({ userRating: newRating }),
src/components/features/trips/TripTabContent.tsx:5319:      // Save-kind ratings live exclusively in SavedItem.userRating (Option B architecture)
src/components/features/trips/TripTabContent.tsx:5374:              body: JSON.stringify({ userRating: it.rating, notes: it.notes || undefined }),
src/components/features/trips/TripTabContent.tsx:5427:        body: JSON.stringify({ userRating: item.rating, notes: item.notes || undefined }),

=== PlaceRating Prisma write calls ===
src/app/api/places/save/route.ts:63:    await db.placeRating.create({
src/app/api/saves/[id]/rate/route.ts:28:  const newRating = await db.placeRating.create({
src/app/api/community/rate/route.ts:62:  const newRating = await db.placeRating.create({
src/app/api/trips/[id]/ratings/[ratingId]/route.ts:34:  const updated = await db.placeRating.update({
src/app/api/trips/[id]/ratings/route.ts:71:  const rating = await db.placeRating.create({

=== CommunitySpot Prisma write calls ===
src/app/api/saves/[id]/route.ts:114:              spot = await tx.communitySpot.create({
src/app/api/saves/[id]/route.ts:163:            await tx.communitySpot.update({
src/app/api/trips/[id]/ratings/[ratingId]/route.ts:103:              spot = await tx.communitySpot.create({
src/app/api/trips/[id]/ratings/[ratingId]/route.ts:149:            await tx.communitySpot.update({
src/app/api/trips/[id]/ratings/route.ts:151:            spot = await tx.communitySpot.create({
src/app/api/trips/[id]/ratings/route.ts:199:          await tx.communitySpot.update({

=== SpotContribution Prisma write calls ===
src/app/api/saves/[id]/route.ts:132:            await tx.spotContribution.upsert({
src/app/api/trips/[id]/ratings/[ratingId]/route.ts:119:            await tx.spotContribution.upsert({
src/app/api/trips/[id]/ratings/route.ts:168:          await tx.spotContribution.upsert({

=== savedItem update/upsert calls (rating-relevant only) ===
src/app/api/saves/[id]/rate/route.ts:41:  await db.savedItem.update({ where: { id }, data: { userRating: body.rating } });
src/app/api/saves/[id]/route.ts:86:    const updated = await db.savedItem.update({ where: { id }, data: updateData });
```

### Step 3 — API file enumeration

```
=== API files that reference rating tables ===
src/app/api/discover/activities/route.ts
src/app/api/saves/[id]/rate/route.ts
src/app/api/saves/[id]/route.ts
src/app/api/saves/route.ts
src/app/api/tours/generate/route.ts
src/app/api/travel-intel/route.ts
src/app/api/trips/[id]/ratings/route.ts

=== All saves endpoints ===
src/app/api/saves/activity/route.ts
src/app/api/saves/route.ts
src/app/api/saves/from-share/route.ts
src/app/api/saves/[id]/identify/route.ts
src/app/api/saves/[id]/rate/route.ts
src/app/api/saves/[id]/route.ts

=== All trips ratings endpoints ===
src/app/api/trips/[id]/ratings/[ratingId]/route.ts
src/app/api/trips/[id]/ratings/route.ts

=== All spots/discover endpoints ===
src/app/api/places/cities/route.ts
src/app/api/places/community/route.ts
src/app/api/saves/[id]/route.ts
src/app/api/trips/[id]/ratings/[ratingId]/route.ts
src/app/api/trips/[id]/ratings/route.ts
```

### Step 4 — Frontend rating call sites

```
=== Fetches to /api/saves/ with rating payload ===
src/components/features/saves/SavesScreen.tsx:1393: fetch(`/api/saves/${ratingModal.id}`, { method: "PATCH" ... })
src/components/features/saves/SaveDetailModal.tsx:579: fetch(`/api/saves/${itemId}`, { method: "PATCH", body: JSON.stringify({ userRating: newRating }) })
src/components/features/trips/TripTabContent.tsx:5374: fetch(`/api/saves/${it.savedItemId}`, { method: "PATCH", body: JSON.stringify({ userRating, notes }) })
src/components/features/trips/TripTabContent.tsx:5427: fetch(`/api/saves/${item.savedItemId}`, { method: "PATCH", body: JSON.stringify({ userRating, notes }) })

=== Fetches to /api/trips/.../ratings ===
src/components/features/trips/TripTabContent.tsx:5286:  fetch(`/api/trips/${tripId}/ratings`)   [GET — load]
src/components/features/trips/TripTabContent.tsx:5377:  fetch(`/api/trips/${tripId}/ratings`, { method: "POST" ... })
src/components/features/trips/TripTabContent.tsx:5435:  fetch(`/api/trips/${tripId}/ratings/${item.ratingId}`, { method: "PATCH" ... })

=== Any calls to the legacy /rate endpoint ===
(none)

=== Components with rating in the filename ===
(none)

=== Star icons in components (rating UI likely) ===
src/components/features/discover/TravelIntelSection.tsx:7: Star (display only)
src/components/features/profile/StatsSection.tsx:485: Star (badge icon, display only)
src/components/features/trips/TripTabContent.tsx:68: Star (used in How Was It UI)
src/app/(app)/trips/past/new/page.tsx:6: Star (used in import link rating UI)
```

### Step 6 — Discover rating UI

```
=== Discover community rating modal submit ===
discover/page.tsx:1927: fetch("/api/community/rate", { method: "POST", body: JSON.stringify({ placeName, destinationCity, rating, notes }) })

=== Discover "Add a Spot" modal submit ===
discover/page.tsx:943: fetch("/api/places/save", { method: "POST", body: JSON.stringify({ name, city, type, rating, ratingNote, ... }) })
```

### Step 7 — Server actions / direct Prisma bypass

```
=== Server actions in app code ===
(none)

=== Prisma imports outside /api/ ===
src/app/(app)/home/page.tsx         — read-only (no rating writes)
src/app/(app)/family/page.tsx       — read-only (no rating writes)
src/app/(app)/saves/[id]/page.tsx   — read-only (no rating writes)
src/app/(app)/trips/[id]/page.tsx   — read-only (no rating writes)
src/app/(app)/trips/page.tsx        — read-only (no rating writes)
src/app/share/[token]/page.tsx      — read-only (placeRatings SELECT only)
```
