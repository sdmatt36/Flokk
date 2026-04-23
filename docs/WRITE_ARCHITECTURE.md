# Flokk Write Architecture

## Purpose

This document captures the write-path architecture for Flokk's core data models — the invariants that must hold, the patterns for extending writes safely, and a snapshot of current write paths. It exists because Chat 34 discovered four distinct drift patterns where two tables that should always be in sync had quietly diverged in production, each invisible until it caused a user-facing bug. The remediation was ~6 hours of diagnostic + backfill work across 15 commits. This doc is how we prevent the fifth pattern.

Scope: Write paths (POST/PATCH/DELETE endpoints, webhook handlers, background jobs, migration scripts). Out of scope: query paths, read models, UI rendering, extraction prompts.

Audience: Anyone touching `src/app/api/`, `prisma/schema.prisma`, `scripts/`, or anywhere that creates/updates core data.

---

## Invariants

These are rules that must hold across the entire DB. Each has a rule statement, a rationale, and a verification method.

### I1. Every saveable booking has exactly one SavedItem twin.

Rule: A TripDocument with type `booking` where content.type ∈ {hotel, activity, restaurant} or (car_rental + driver-keyword label) MUST have `TripDocument.savedItemId` populated, pointing to the SavedItem representing that place.

Rationale: TripDocument holds booking-specific data (confirmation, dates, cost). SavedItem is the canonical "place the user saved" record. Community Picks reads SavedItem. If a booking doesn't have a twin, the user's Hilton booking never appears in Community Picks — even if they rated it.

Exceptions: Bookings where vendorName exactly matches the aggregator skip-list (`Booking.com`, `Expedia`, `Airbnb`, `Viator`, `GetYourGuide`, `Agoda`) are intentionally not given SavedItem twins. These names carry no place-identity signal — "Booking.com" is not a hotel, it's a booking platform. Until extraction improves to surface the actual venue name, these bookings are excluded from the twin-creation invariant. See `src/lib/booking-saved-item.ts` for the canonical saveability rules.

Verification: `scripts/audit-drift.ts` section A.

Chat 34 discovery: pre-Arc-2 state, 31 booking TripDocuments had no savedItemId. Arc 2 backfilled them (commits 9077117, 4edcff4, 803e854).

---

### I2. Every userRating has a PlaceRating twin.

Rule: A SavedItem with `userRating != null` MUST have at least one PlaceRating row with matching `savedItemId` and `rating`. Conversely, when `userRating` is cleared (set to null), all PlaceRating rows for that `savedItemId` MUST be deleted.

Rationale: `userRating` is the user's private self-rating (shown as "You rated:" on cards). `PlaceRating` is the public community-facing record that Community Picks aggregates via INNER JOIN. If these diverge, the user's rating is invisible to Community Picks even though it renders on Spots.

Exceptions: SavedItems whose categoryTags include `train`, `flight`, `bus`, `transit`, `car_rental`, or `rental` are intentionally excluded from the userRating-to-PlaceRating invariant. Transit and logistics rows are not "places" in the Community Picks sense, so rating them doesn't imply a community-surfaceable record. See `scripts/chat34-rating-drift-fix.ts` TRANSIT_TAGS for the canonical list.

Verification: `scripts/audit-drift.ts` section B (or rerun `scripts/chat34-rating-drift-audit.ts`).

Chat 34 discovery: 117 SavedItems had `userRating` but no PlaceRating. Backfill inserted missing rows (commit dcf087e). Spots rating write-path was fixed in commits c186a49 (PATCH) and 683b9b6 (POST).

Known weak link: The invariant "one SavedItem → at most one PlaceRating" is convention-only, not DB-enforced. Future work: add unique constraint on `PlaceRating.savedItemId` once confirmed no existing data violates it.

---

### I3. Edit Booking modal writes propagate to all three layers.

Rule: When a user edits a TripDocument via the Edit Booking modal, the edited fields (vendorName, URL, etc.) MUST propagate to (a) `TripDocument.content`, (b) `SavedItem.rawTitle` + `SavedItem.websiteUrl` via the `savedItemId` FK, (c) `ItineraryItem.title` via the existing client-side mirror.

Rationale: Without triple-write, edits on the booking card don't flow to Community Picks surfaces, and the user sees the updated name in vault but the old name in Discover.

Verification: manual — edit a hotel vault card, confirm Community Picks reflects the new name.

Chat 34 discovery: Hilton rename ("Hilton Hotels & Resorts" → "Hilton Dubai Jumeirah") didn't propagate. Arc 1 added FK and triple-write on the PATCH endpoint at `src/app/api/trips/[id]/vault/documents/[documentId]/route.ts`.

---

### I4. Orphan migration preserves user-intent data fully.

Rule: When a backfill or cleanup script deletes a SavedItem that is being "replaced" by a new SavedItem (e.g., the Arc 2 pattern where a URL_PASTE orphan is replaced by a booking-created twin), ALL user-intent fields MUST migrate to the new record before deletion: `userRating`, `userNote`, `notes`, `categoryTags`, `placePhotoUrl`, `mediaThumbnailUrl`, `communitySpotId` inheritance, and PlaceRating FK re-pointing.

Rationale: Silent data loss is the worst outcome. If a user rated a place 5 stars and wrote a note, that data must survive any internal schema cleanup.

Verification: `scripts/audit-drift.ts` doesn't check this directly (post-cleanup state is identical to no-drift state). Enforcement is at script-design time.

Chat 34 discovery: first Arc 2 run lost `placePhotoUrl` and `communitySpotId` on Hilton. Fixed in subsequent commits (803e854, 4edcff4).

---

### I5. Attribution lives on containers, not atoms.

Rule: Individual saved spots (atoms) MUST NOT display family-name attribution on their cards. Containers — Trips with `isAnonymous=false`, and future Spot Packages — CAN display family attribution if the user opted in.

Rationale: Product-level rule. Attribution on every atom creates privacy creep and visual noise at scale. Attribution on containers (Trip/Package) gives users control over when their name is publicly linked to content.

Verification: visual — no Community Picks card displays a family name.

Chat 34 discovery: Community Picks cards displayed "Greene Family" on every pick. Removed in commit c431456.

---

### I6. Every SavedItem older than 1 hour has a non-null placePhotoUrl.

Rule: Any SavedItem with `savedAt` older than 1 hour MUST have `placePhotoUrl` populated (Google Places photo, curated venue image, or destination-scenic fallback). Fresh-cut-off is 1 hour to allow async enrichment (`enrichWithPlaces` fire-and-forget in webhook, cron catchup) to complete.

Rationale: Null placePhotoUrl forces the client-side `getItemImage()` chain to fall through to `TYPE_IMAGES[categoryTags[0]]` — a single static Unsplash URL per type. If multiple rows of the same type have null photos, every card renders the same identical stock image. This is visually broken and defeats the product-level "saved places should feel like a personal, varied collection" intent. Chat 34 discovered this: 5 lodging rows all rendered the wooden resort pool image.

Verification: `scripts/audit-drift.ts` section I6.

Exceptions: None today. The long-term goal is zero violations. Rows that violate I6 should either (a) be enriched via smarter resolver logic (planned Chat 35 work), (b) get destination-scenic fallback written to placePhotoUrl, or (c) surface the specific failure so we can improve the resolver.

Chat 34 discovery: post-Arc-2, 11 booking-created SavedItems had null placePhotoUrl. Backfill (commit 1fe84d7) recovered 15/17 via Google Places. Remaining 2 rows (F H Tourism, Acropolis View 2BD Apt) are known gaps — Places can't match contractor-named tours or Airbnb listings. Flagged for Chat 35 "multi-source image resolver" work.

---

## Playbook

Patterns for common write-path extensions. Each scenario lays out: the situation, required writes, required checks, required tests.

### P1. Adding a new booking type to the email webhook.

Situation: Claude's extraction prompt returns a new `extracted.type` value (e.g., "event_ticket"). The webhook must decide whether to co-create a SavedItem and whether to link via `TripDocument.savedItemId`.

Required decisions:
1. Is this type saveable? A "place" the user would want in Saves/Community Picks — yes for hotels, activities, restaurants, driver-services. No for flights, trains, pure car rentals, insurance.
2. If yes: extend `src/lib/booking-saved-item.ts` `SAVEABLE_TYPES` set or `DRIVER_KEYWORDS` regex.
3. If the classification is ambiguous at the extraction layer (like driver-services misclassified as `car_rental` today), decide whether to fix the extraction prompt (preferred) or apply a label-keyword shim at the webhook (pragmatic).

Required writes:
- If saveable: call `createBookingSavedItem(db, {...})` before creating the TripDocument, then pass `savedItemId` on the `tripDocument.create`.
- If not saveable: do not create SavedItem. `TripDocument.savedItemId` remains null. ItineraryItem is still created per existing pattern.

Required checks:
- Global `confirmationCode` dedup (line ~976 of email-inbound route) must fire BEFORE the SavedItem create to prevent re-forward duplicates.
- For null-confirmation emails, extend the title-dedup logic to also skip SavedItem creation on dup.

Required tests:
- Forward a real confirmation email of the new type. Verify (a) TripDocument created, (b) SavedItem created if saveable, (c) `savedItemId` populated, (d) re-forwarding the same email does NOT create duplicates.

---

### P2. Adding a new rating UI surface.

Situation: A new component lets users rate a SavedItem (e.g., a map pin popover, a recap screen, a bulk import flow).

Required writes:
- `userRating` on SavedItem (scalar, private).
- PlaceRating upsert or create (public, aggregation source).
- Optional: CommunitySpot/SpotContribution write-through if the surface is community-visible.

Required pattern: hit the existing `PATCH /api/saves/[id]` endpoint. Don't roll a new endpoint that only writes `userRating` — the endpoint is the invariant enforcer. If a new endpoint is genuinely needed, it MUST include the same write-through block (`src/app/api/saves/[id]/route.ts` lines 81–117, commit c186a49).

Required tests:
- Rate a save via the new UI. Immediately check Community Picks — the save should appear with the correct star count.
- Clear the rating. Check that the PlaceRating is gone (Community Picks no longer shows that save with an aggregate rating).

---

### P3. Adding a new edit flow for a TripDocument.

Situation: A new form/modal lets users edit `TripDocument.content` fields.

Required writes:
- `TripDocument.content` (update existing fields).
- If `TripDocument.savedItemId` is populated: mirror relevant fields to the linked SavedItem (`rawTitle` from vendorName, `websiteUrl` from URL field, etc). Use the triple-write pattern in `src/app/api/trips/[id]/vault/documents/[documentId]/route.ts` as template.
- `ItineraryItem.title` mirror, if the edit touches vendorName.

Required tests:
- Edit a field via the new surface. Refresh. Verify the edit persisted on TripDocument AND on SavedItem (if linked) AND on ItineraryItem (if the field mirrors).

---

### P4. Adding a new SavedItem creation path.

Situation: New code creates a SavedItem (via API, webhook, migration, etc.).

Required writes:
- `SavedItem.create` with required fields (see `src/lib/booking-saved-item.ts` `createBookingSavedItem` as canonical example).
- If `userRating` is set at create time: also create the matching PlaceRating row (see commit 683b9b6 pattern in `src/app/api/saves/route.ts` POST handler, lines 250–264).
- If the save is replacing or migrating from an older record: follow I4 (migrate all user-intent fields before delete).

Required checks:
- `categoryTags` MUST go through `normalizeAndDedupeCategoryTags` (`src/lib/category-tags.ts`). This invariant was established in Chat 34 commit 965d491 after 55 rows were found with duplicate tags.

---

### P5. Adding a new schema FK.

Situation: You're extending `prisma/schema.prisma` with a new foreign-key relation.

Required decisions:
- `onDelete` behavior: `SetNull` (soft link, survivor outlives deletion — e.g., `TripDocument.savedItemId`), `Cascade` (hard ownership — e.g., Trip → TripDocument), or `Restrict` (prevent deletion — e.g., ratings anchoring a SavedItem).
- Nullability: `null` for optional relations, required only if the parent cannot exist without the child.
- Uniqueness: `@unique` on the FK only if the relation is strictly 1:1 or 0..1:1.

Required process:
- Generate migration via `npx prisma migrate dev --name <descriptive_name>`.
- Confirm `prisma/migrations/` is NOT in `.gitignore` (was a bug in Chat 34, caught in commit e491896).
- Confirm the build script applies migrations on deploy. Current state is `prisma generate && next build` — migrations do NOT auto-run on Vercel. They must be applied manually via Supabase MCP or the build script must be extended to `prisma migrate deploy && prisma generate && next build`. Flag for a future infra pass.

---

## Appendix: Current Write Paths (Snapshot — Chat 34, April 2026)

This is a snapshot. Re-audit whenever a write path is added, changed, or removed. Re-generation via `grep -rn "savedItem.create\|savedItem.update" src/app/api` is faster than hand-editing.

### SavedItem

| File | Line(s) | Operation | Trigger | Also writes | Status |
|---|---|---|---|---|---|
| `src/app/api/saves/route.ts` | 82 | create | Manual save POST (`sourceMethod: URL_PASTE`, manual form) | nothing | OK |
| `src/app/api/saves/route.ts` | 106, 115 | update | Post-create Places enrichment (photo + websiteUrl) | nothing | OK |
| `src/app/api/saves/route.ts` | 204 | create | URL-paste save POST | PlaceRating (line 250) if userRating set; CommunitySpot if city+rating set | OK |
| `src/app/api/saves/route.ts` | 279, 295 | update | Post-create Places enrichment (URL-paste path) | nothing | OK |
| `src/app/api/saves/[id]/route.ts` | 79 | update | Spots-screen PATCH (rating, notes, tags, title, tripId, etc.) | PlaceRating (lines 87–113) if userRating changed; CommunitySpot (lines 118–200) if rating/notes changed | OK |
| `src/app/api/saves/activity/route.ts` | 37 | create | Activity save POST (Discover → Save action) | nothing | OK — no rating at create |
| `src/app/api/saves/from-share/route.ts` | 72 | create | Share-link import POST | nothing | OK — no rating at create |
| `src/app/api/saves/[id]/identify/route.ts` | 43 | update | Place-identification PATCH (lat, lng, googlePlaceId, etc.) | nothing | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 567 | create | Email-inbound: link/itinerary item parse path | nothing | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 615, 631, 646 | update | Post-create enrichment + trip-assign in email path | nothing | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1442 | create | Email-inbound: non-booking hotel auxiliary SavedItem | nothing | OK |
| `src/app/api/trips/steal-to-new/route.ts` | 134 | createMany | Trip steal-to-new (bulk clone SavedItems to new trip) | nothing | OK — bulk copy, no ratings |
| `src/app/api/trips/clone/route.ts` | 66 | createMany | Trip clone | nothing | OK — bulk copy, no ratings |
| `src/app/api/trips/[id]/steal/route.ts` | 127 | createMany | Trip steal | nothing | OK — bulk copy, no ratings |
| `src/app/api/trips/[id]/clone/route.ts` | 63 | createMany | Trip clone (alternate path) | nothing | OK — bulk copy, no ratings |
| `src/app/api/trips/[id]/itinerary/route.ts` | 92 | create | Itinerary item → SavedItem creation | nothing | OK — no rating at create |
| `src/app/api/trips/[id]/route.ts` | 113 | updateMany | Trip delete — unlinks all SavedItems (`tripId → null`) | PlaceRating (line 116): also nulls out tripId | OK |
| `src/app/api/tours/save/route.ts` | 165, 170 | update / create | Tour stop SavedItem creation or update | nothing | OK — no rating |
| `src/app/api/admin/` (multiple) | various | update | Admin bulk operations (geocode, photo fill, title fix, etc.) | nothing | OK — none touch userRating |

### PlaceRating

| File | Line(s) | Operation | Trigger | Notes | Status |
|---|---|---|---|---|---|
| `src/app/api/saves/[id]/route.ts` | 87 | deleteMany | PATCH clears `userRating` (set to null) | Enforces I2 clear-side | OK |
| `src/app/api/saves/[id]/route.ts` | 89, 96 | findFirst + update | PATCH sets `userRating` (existing row) | Enforces I2 set-side | OK |
| `src/app/api/saves/[id]/route.ts` | 98 | create | PATCH sets `userRating` (no existing row) | Enforces I2 set-side | OK |
| `src/app/api/saves/route.ts` | 250 | create | POST creates SavedItem with `userRating` set | Enforces I2 at create | OK |
| `src/app/api/places/save/route.ts` | 68 | create | Save ManualActivity with rating | PlaceRating for ManualActivity (not SavedItem) — correct, different model | OK |
| `src/app/api/trips/[id]/ratings/route.ts` | 63 | create | Post-trip rating flow (itinerary/manual activity) | Primary rating flow for itinerary items | OK |
| `src/app/api/trips/[id]/ratings/[ratingId]/route.ts` | 26 | update | Edit existing PlaceRating (post-trip recap) | CommunitySpot write-through on line 86 | OK |
| `src/app/api/trips/[id]/route.ts` | 116 | updateMany | Trip delete — nulls `tripId` on PlaceRating rows | Keeps rows alive; just unlinks from trip | OK |

### TripDocument

| File | Line(s) | Operation | Trigger | Also writes | Status |
|---|---|---|---|---|---|
| `src/app/api/webhooks/email-inbound/route.ts` | 940 | create | Plan/itinerary email parse | ItineraryItem | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1262 | create | Flight booking email | ItineraryItem (per leg) | OK — flight: no SavedItem twin (I1) |
| `src/app/api/webhooks/email-inbound/route.ts` | 1394 | create | Hotel booking email | SavedItem (via `createBookingSavedItem`), ItineraryItem (check-in + check-out) | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1559 | create | Catch-all booking email | SavedItem (via `createBookingSavedItem`, if saveable type) | OK |
| `src/app/api/trips/[id]/vault/documents/[documentId]/route.ts` | 13 | update | Edit Booking modal PATCH | SavedItem.rawTitle + websiteUrl (triple-write, lines 21–46) if `savedItemId` set | OK |
| `src/app/api/trips/[id]/vault/documents/route.ts` | 28 | create | Manual vault document creation | nothing | OK |

### CommunitySpot / SpotContribution

| File | Line(s) | Operation | Trigger | Notes | Status |
|---|---|---|---|---|---|
| `src/app/api/saves/[id]/route.ts` | 144, 162, 193 | communitySpot create/find + spotContribution upsert + communitySpot update (aggregates) | PATCH updates `userRating` or `notes` on SavedItem | Full write-through with aggregate recompute | OK |
| `src/app/api/saves/route.ts` | 230 | `writeThroughCommunitySpot()` | POST creates SavedItem with `userRating` or `notes` set and `destinationCity` present | Abstracted in `src/lib/community-write-through.ts` | OK |
| `src/app/api/places/save/route.ts` | 82 | `writeThroughCommunitySpot()` | Save ManualActivity with rating | Same abstraction | OK |
| `src/app/api/trips/[id]/ratings/route.ts` | 132 | `writeThroughCommunitySpot()` | Post-trip rating for itinerary/manual item | Only fires for non-flight, non-train types | OK |
| `src/app/api/trips/[id]/ratings/[ratingId]/route.ts` | 86 | `writeThroughCommunitySpot()` | Edit existing PlaceRating | Same abstraction | OK |
| `src/app/api/community-spots/[id]/route.ts` | 69 | communitySpot update | Admin/curator spot edit | Direct field update | OK |
| `src/app/api/community-spots/[id]/fetch-photo/route.ts` | 50 | communitySpot update | Photo fetch job | `photoUrl` only | OK |
| `src/app/api/community-spots/[id]/resolve-image/route.ts` | 69 | communitySpot update | Image resolution job | `photoUrl` only | OK |

### ItineraryItem

(Subset focused on paths that interact with SavedItem or TripDocument.)

| File | Line(s) | Operation | Trigger | SavedItem / TripDocument interaction | Status |
|---|---|---|---|---|---|
| `src/app/api/webhooks/email-inbound/route.ts` | 892, 921 | create | Plan/itinerary email parse | Associated TripDocument created at line 940 | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1193, 1197 | update / create (upsert) | Flight leg processing | Associated TripDocument at line 1262 | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1319, 1338 | create | Hotel check-in / check-out items | Associated TripDocument at line 1394; SavedItem via savedItemId FK | OK |
| `src/app/api/webhooks/email-inbound/route.ts` | 1526, 1530 | update / create | Catch-all booking item | Associated TripDocument at line 1559; SavedItem via savedItemId if saveable | OK |
| `src/app/api/trips/[id]/itinerary/route.ts` | 92 | create | Manual itinerary item creation | Also creates SavedItem as twin | OK |
| `src/app/api/admin/fix-activity-titles/route.ts` | 40, 47 | update | Admin title fix | Touches title only; no SavedItem propagation | OK — admin-only path |
| `src/app/api/itinerary/unassigned/route.ts` | 48 | update | Assign unassigned item to trip | No SavedItem write | OK |

---

## Drift History

Append-only log of drift patterns discovered and fixed.

### Chat 34 (April 2026)

1. **Category tag duplication** (commits b3b7bd5, af22f6b, 965d491). 55 SavedItems had duplicate entries in `categoryTags` array due to 18 write paths that didn't normalize. Fixed by adding `normalizeAndDedupeCategoryTags()` and wrapping all 18 sites.

2. **Community Picks URL resolution** (commits de1d2c3, 0bc1fd7, 403bffb, 5af3491). Link buttons on cards resolved inconsistently across surfaces — some used `sourceUrl`, others `websiteUrl`, some ended up null. Fixed with unified `resolveSaveLink` + 5-tier fallback + tracking-param strip at render time.

3. **TripDocument ↔ SavedItem decoupling** (Arc 1 commit d6ff135, Arc 2 commits 9077117, 4edcff4, 803e854). Bookings and saves were designed as mutually exclusive systems. Discovered when user edits on booking cards didn't propagate to Community Picks. Fixed by adding `TripDocument.savedItemId` FK, co-creation at webhook, and backfill of 31 existing bookings + 2 orphan migrations.

4. **userRating without PlaceRating twin** (backfill dcf087e, forward-fix c186a49 + 683b9b6). 117 SavedItems had `userRating` but no corresponding PlaceRating, making them invisible to Community Picks' INNER JOIN. Root cause: `PATCH /api/saves/[id]` and `POST /api/saves` wrote `userRating` without PlaceRating. Fixed by adding dual-write in both endpoints and backfilling all 117 rows.

   Follow-up (Arc 3 part 4): I1 and I2 refined with explicit aggregator + transit exceptions to match product-level skip logic. Audit-drift.ts updated to apply same filters. Commit: 2bb3972

5. **Booking-created SavedItems with null placePhotoUrl** (tactical fix commit 1fe84d7, enforcement commit b2f8a0bbd040ce90aa2464fff7868412d8648de0). 11 Arc 2 booking SavedItems had null placePhotoUrl, causing 5+ homepage cards to render the same Unsplash stock image. Root cause: `createBookingSavedItem` never set image fields. Tactical fix: added `getVenueImage` to the helper + fire-and-forget `enrichWithPlaces` post-create in webhook + backfilled 15/17 rows via Google Places. Structural fix (prompt 2): added I6 invariant + audit check. Remaining gaps (F H Tourism, Acropolis View 2BD) surfaced by audit-drift as known violations pending multi-source resolver work in Chat 35.

---

## How to Update This Doc

- **Invariants (Section 2):** Add when a new schema-level rule is established. Do not remove; invariants are forever. Strengthening an invariant (e.g., moving from convention-only to DB-enforced) is an update in place, not a removal.
- **Playbook (Section 3):** Add a new P-section when a new scenario pattern emerges. Revise existing scenarios when the right-way-to-do-X changes (e.g., if the Spots rating write path moves to a new endpoint).
- **Appendix (Section 4):** Re-audit when a write path is added, changed, or removed. Regeneration via grep is faster than hand-editing.
- **Drift History (Section 5):** Append-only. Add an entry every time a class of drift is fixed. Link commit SHAs so future debuggers can trace the fix.
- **This section (Section 6):** Update rarely. It exists to keep the doc honest about its own lifecycle.

---

End of doc.
