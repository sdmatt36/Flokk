# Flokk Product Specification
This document is the source of truth for what Flokk's features are supposed to do.
Implementation state may lag specification — that is expected.
Update this document FIRST whenever a feature is discussed, before any code is written.

---

## Tours

### Tour Generation
- User describes desired tour in natural language
- Inputs: theme/prompt, destination city, duration, transport mode
- AI generates N stops geographically clustered when appropriate
- Each stop includes: name, address, why-relevant, family-specific note, image, website URL
- Route optimized geographically (nearest-neighbor from westernmost anchor)

### Tour Generation Inputs (current vs target)

CURRENT inputs:
- Free-text prompt
- City
- Duration ("How long?")
- Transport ("Getting around?")

TARGET inputs (full set):
- Trip context: "Building for an existing trip? Pick trip + day" — triggers anchor-aware mode
- City (or auto-filled from trip+day's lodging)
- Duration
- Transport
- Family override (default = user's family profile, allow one-off override per tour)
- Pace (relaxed / balanced / packed)
- Time of day (morning / afternoon / evening / full-day)
- Budget context (free or cheap / mid / splurge)
- Specific constraints (stroller-friendly, accessibility, indoor-only / rainy-day, dietary specific to this tour)
- Free-text prompt (theme/vibe)

UX pattern: two-step flow — essentials first (prompt + city + duration + transport), optional refinement second. Trip-context picker at top auto-fills city, lodging, family signals when used.

⚠ NEEDS BUILD: form revamp; AI generation route accepts the expanded input set; per-tour override semantics on top of family profile defaults.

Connecting items:
- Anchor-aware tour generation (lodging / itinerary as start/end)
- Archetype-aware tour generation (neighborhood / regional / scenic route / anchor-and-fillers / transit hop)
- Multi-city trip support (per-day lodging matching)

### Tour Editing
- User can remove any stop via X icon (8s undo window via inline placeholder)
- Removed stops are soft-deleted, recoverable via "Show removed stops" section
- User can regenerate replacement stops to fill gaps via plus-card
- Replacement stops never repeat soft-deleted names
- New stops insert at geographically optimal position, not appended to end

### Tour-Trip Integration
- User can save a tour to a trip via "Save stops to a trip" button
- User selects which day of the trip the tour belongs to
- Tour stops auto-populate as itinerary items on that day
- Each tour stop should produce exactly ONE item on the trip day — a SavedItem with sourcePlatform="flokk_tours"
- ⚠ BUG (confirmed 2026-04-25): save route creates BOTH a SavedItem AND a ManualActivity per stop → duplicates on day view (N stops → 2N items). Root cause: `db.manualActivity.create` call in `/api/tours/save/route.ts` lines 243-258. Fix: remove ManualActivity creation entirely; SavedItem is the correct record.
- Day/trip picker must default-select the trip whose destinationCity matches the tour's destinationCity
- ⚠ BUG (confirmed 2026-04-25): picker fetches all trips (`/api/trips?status=ALL`) with no city filtering or default-selection logic. All trips shown unranked.
- Post-save confirmation state: show "Stops saved!", "View trip →", and "Close" only. No destructive action in this state.
- ⚠ BUG (confirmed 2026-04-25): post-save modal shows "Remove from trip" button immediately after save — UX confusion. Button exists because `saveSuccess.tourId` is truthy. Should be removed from the success state; an undo/remove affordance belongs on the trip day view, not the save confirmation.
- If user removes a saved tour from their account, the corresponding itinerary items must cascade-delete (no orphans on the trip)
- "Delete tour" or "I'm not doing this" action should be one click and clean both the tour and the trip itinerary

### Tour-Trip Context Flow (FIXED — Chat 38, Apr 26 2026)

When a tour is generated from a Trip's Tours tab, the `tripId` must flow through to the generate API so hotel anchor logic fires. Prior to Chat 38 fix, the form sent `tripId: undefined` in all cases.

Fix shipped:
- "Build a tour →" link in `ToursContent` now includes `?tripId=${tripId}` query param
- `/tour/page.tsx` reads `?tripId` from URL on mount, stores in state
- POST body to `/api/tours/generate` now includes `tripId` when present
- Hotel anchor logic in generate route fires when `tripId` is present (looks up LODGING check-in item's lat/lng)

Consequence of missing `tripId` before fix: tours generated from the trip context appeared in the standalone `/tour` library but NOT on the trip's Tours tab (no SavedItem → no `tripId` linkage). Also hotel anchor didn't fire → first stop could be far from lodging.

Users with pre-fix tours must manually "Save stops to a trip" from the standalone `/tour` library to make those tours appear on the trip's Tours tab. Regenerating from the trip context after this fix is recommended to also get hotel anchor.

### Tour Library / Profile View
- All of a user's tours appear in the standalone `/tour` page library (grouped by city pills)
- Trips tab → Tours tab shows tours SAVED to that specific trip (via SavedItem linkage)
- ✓ Partial (Chat 38): Trip Tours tab cards now use full-width 180px hero image design matching RecentSavesCards pattern: title (Playfair Display, navy), MapPin location row, terracotta stop·transport pill, day label, expand-in-place stops, "View tour" terracotta button
- ✓ Partial (Chat 38): `/tour` standalone library popover now shows 40×40 thumbnail + stop count + transport per tour row
- ⚠ STILL NEEDED: standalone `/tour` library should become a grid of full hero cards (not city pills), matching the Trip Tours tab card design. This is the "tour library" spec.
- Click image/title on trip tour card → expands inline to show stop list (name, duration, walk time). "View tour →" button navigates to full tour page.

### Tour Sharing (Three States)
1. Private (default): only author's family can see
2. Shared via token: explicit share action generates token, sets isPublic=true
3. Anonymous community contribution: when parent trip transitions to COMPLETED, tour data feeds the Spots system anonymously (no author attribution)

### Tour URLs
- Each tour has a stable URL with ?id= query param
- URL pushes to history on generation (refresh preserves tour) ✓ shipped
- Public share URLs route through /share/tour/[token] (not /tour?id=)

---

## Tours Personalization & Quality

### Tour Personalization Layer (Designed, Not Built)

Three-layer personalization for tour generation:

1. **Interest tiering**: User's existing FamilyInterest entries get a tier field (most/mid/least, weights 3/2/1). Tour generation uses these weights to bias venue selection. Tier UI lives on the profile and home pages where interests already render.

2. **Behavioral analysis**: AI extraction layer reads the user's saves (SavedItem), trip itineraries (ItineraryItem), and tour history. Identifies patterns ("user has 8 sushi saves in Tokyo, 3 ramen", "user repeatedly saves castle/historical sites in Europe"). Surfaces these patterns into the tour generation prompt as soft preferences.

3. **Proactive nudges**: When the user opens the Tour Builder, the system surfaces underexplored interests via prompts: "I see you've focused on Food and Culture but not Outdoor — want to weave that in?" Doesn't wait for the user to ask.

### Hotel-Anchored Tour Endpoints (Built — Chat 38, Apr 26 2026)

When tour is generated from a trip context (tripId passed in request body), the system looks up the trip's active LODGING check-in item and uses its lat/lng as an anchor. The anchor is injected into the system prompt. Post-generation validation checks first and last stops:
- Walking: first/last stop within 1km of lodging
- Metro/Transit: first stop within 1.5km or a transit station within 800m
- Driving: first/last stop within 5km

If anchor validation fails, `anchorViolation: { distance, threshold }` is returned in the response (no auto-retry — user regenerates via "Start over"). Round-trip-from-base logic. Standalone Tour Builder generations (no tripId) preserve existing unconstrained behavior.

### Default Constraints by Mode + Age (Built — Chat 38, Apr 26 2026)

Walking tour with youngest child:
- Under 5: max 6 min between adjacent stops (~480m), max cluster diameter 1.5km
- 5–10: max 10 min between adjacent stops (~800m), max cluster diameter 3km
- Over 10 or no kids: max 15 min between adjacent stops (~1200m), max cluster diameter 5km

Cluster diameter = max pairwise distance across ALL stops (not just adjacent). Catches geographically incoherent results like Edinburgh Zoo + Gorgie City Farm (2.6km apart) that adjacent-only checks miss. `clusterViolation: { maxDistance, threshold }` returned in response when exceeded; sets `partialTour: true`.

Metro/Transit and Driving: no cluster diameter constraint currently.

### Walk Retry Architecture (Built — Chat 38, Apr 26 2026)

Walk retry (Attempt 2) runs in **dry-run mode**: Claude generates stops, they pass through resolveAgainstPlaces + themeRelevance, but are not written to DB. Original stops survive. Only if retryViolations < walkViolations does the system atomically delete originals and commit the retry. If retry is equal or worse, original stops are kept intact. Previous version had a destructive noop bug where originals were deleted before the retry ran.

### Under-Emission Retry (Built — Chat 38, Apr 26 2026)

Attempt 3 triggers when `completedStops.length < targetStops` after all prior attempts. Sends a separate Claude request asking for exactly the missing N stops, with already-accepted stop names listed as "DO NOT REPEAT." Each new stop goes through the same resolveAgainstPlaces + themeRelevance gates. Appends to (not replaces) existing DB stops.

### themeRelevance Enforcement Fix (Built — Chat 38, Apr 26 2026)

Previous version incremented `rejectedCount` for weak themeRelevance but still wrote the stop to DB and pushed to completedStops. Fixed: weak themeRelevance now correctly skips DB write and stop collection.

### Real-Time Rating Prompts (Spec, Pending iOS)

When the iOS app ships, every itinerary item triggers a push notification at its scheduled end-time (or 30 min after) prompting in-the-moment rating. Web users see in-app prompts at the same trigger. Replaces the post-trip-only rating model. In-the-moment ratings capture the actual experience while fresh. Critical for the rating loop's quality.

### Tour-Save Categorization Pipeline (Open Issue)

Tour-saved items currently get `categoryTags: []`. The save flow sets `extractionStatus: "ENRICHED"` at create time, bypassing `enrichSavedItem()`. Consequence: tour-saved items don't appear in Saves tab category filters, don't feed behavioral profile, don't feed recommendation engine, don't reach Spots community feedback loop.

Fix path: store TourStop.placeType from Place Details API call, map to SavedItem.categoryTags at save-to-trip time.

Status: Designed, will be addressed alongside Phase 2A (FamilyBehavioralProfile) since both touch the same SavedItem write path.

### Tour Builder Form Refinement (Phase E spec — from Chat 37)

Add optional Refine section (collapsible, default closed). Default form stays simple (city, length, transport).

Optional refinement controls:
- **Neighborhood pill suggestions** — sourced from Google Places, presented as soft anchors; user selects one or more. These are soft constraints, not hard: Claude biases toward stops near the neighborhood(s) but can include stops elsewhere if theme warrants.
- **Vibe toggle**: Touristy ↔ Local — "Touristy" biases toward well-known landmarks; "Local" biases toward resident-frequented spots.
- **Rhythm toggle**: Theme-focused ↔ With family breaks — "With family breaks" inserts a rest stop (café, park, gelato) roughly every 2-3 stops. The break stop is labeled as a rest point, not a themed attraction.
- **Open textarea**: Trip-specific context the user can write ("The kids have already seen the Eiffel Tower from our hotel — skip obvious tourist traps").

All refinement inputs flow into the Claude generation prompt as soft preferences in the system message. They don't change the schema.

⚠ NEEDS BUILD: form revamp to add this optional section. UX TBD (accordion vs step 2 modal).

---

## Tours — Public Surfacing & Community

### When tours go public (Decision: Chat 38, April 26 2026)

Tours go public on save-to-trip, NOT on generation. The save-to-trip action is the user's implicit quality vote — they wouldn't save a bad tour. This avoids polluting Discover/Spots with abandoned generations while still aggressively growing community content.

Estimated contribution baseline: 33 families × 5 trips/year × 1 saved tour per trip = 165 community tours per year. Grows with userbase.

### Family attribution (Decision: Chat 38)

Hybrid model. Tours are anonymous by default at the public/Discover layer. Family can opt to attribute themselves explicitly if they want credit. Most won't bother — the value is in the tour content, not the byline. Anonymous baseline keeps privacy floor high.

### Family retains tour in trip history regardless

Even when public, the saving family retains the tour in their trip history and can share it explicitly. Public surfacing is about discovery, not ownership transfer.

### Clone-to-account flow (Decision: Chat 38)

This is the entire point of the platform. A user sees a tour in Discover/Spots → taps it → "Save to my trip" → fresh GeneratedTour + TourStops in their account, on the day they pick. Original creator unchanged. Cloned tour develops its own rating history independently.

The compounding loop:
- Tour goes public on save-to-trip
- Other families clone it
- Each clone gets rated after that family's trip
- Aggregate ratings + cohort-weighted ratings (kids ages, season, transport mode) drive surfacing for future families
- High-quality tours bubble up; low-quality fade

⚠ NEEDS BUILD: clone-to-account API route (`POST /api/tours/[id]/clone`), Discover viewer page, "Save to my trip" CTA from public view.

Note: Trip-level cloning already exists (`/api/trips/clone/route.ts`, `/api/trips/[id]/clone/route.ts`, `Trip.cloneCount` field). Tour-level cloning is a separate, not-yet-built path.

### Clone notifications (gamification, from Chat 37)

Tour creators receive notifications when their tour is cloned. "Your London family ramen tour was saved by 3 families this month." This is part of the broader gamification system (Explorer, Navigator, Pioneer tiers). Specifics of points/tier impact: TBD per Chat 37+ discussions on gamification — defer detailed mechanics to gamification phase.

⚠ NEEDS BUILD: notification system, creator attribution tracking.

### Rating loop feedback (Decision: Chat 37 confirmed Chat 38)

Ratings flow back into tour surfacing. When a tour is rated 5-stars by a family with kids 5-10, the same tour gets boosted in Discover for OTHER families with kids 5-10. Cohort-weighted, not flat-aggregated. A 5-star from a backpacking childless couple boosts surfacing for backpacking childless couples, NOT for families with toddlers. Heterogeneous ratings across cohorts = ambiguous signal = neutral surfacing weight.

This is Phase F per Chat 37. Schema and infrastructure to be designed in dedicated phase. Conceptual agreement: yes, cohort-weighted ratings drive surfacing.

⚠ NEEDS BUILD: cohort rating aggregation, surfacing score field on GeneratedTour, Discover sort logic.

---

## Tours — Discover / Spots Surface (Roadmap, Phase E+)

Public tours surface on a Discover/Spots Tours area:
- Filterable by city, theme, transport mode, kid age band, family composition
- Sorted by aggregate cohort-weighted rating (see Rating Loop above)
- Each tour card shows: hero image (composite of stops), title, city, stop count, transport, rating, "Save to my trip" CTA
- Card click → full tour viewer page (the existing tour detail page becomes the public viewer for anonymous access)
- Save flow: trip picker (existing pattern) → clone-to-account → user is taken to their trip with tour added on selected day

⚠ NEEDS BUILD: public tour viewer page, Discover filtering UI, Spots integration.

---

## Tours — Schema & Plumbing Status

### Already in schema (as of Chat 38)

- `GeneratedTour.isPublic` (Boolean, default false) — flag for public surfacing
- `GeneratedTour.deletedAt` (DateTime?) — soft delete
- `GeneratedTour.originalTargetStops` (Int) — for under-emission tracking
- `GeneratedTour.categoryTags` (String[]) — currently always empty (categorization pipeline open bug)
- `TourStop.imageUrl` (String?) — stop photo
- `TourStop.savedItemId` (String? FK → SavedItem) — nullable; set on save-to-trip
- `Trip.cloneCount` (Int) — trip-level clone counter; exists, used by trip clone routes

### Pending schema additions (per Chat 37)

- `GeneratedTour.shareToken` (String? unique) — for unauthenticated public viewer URLs `/share/tour/[token]`
- `GeneratedTour.contributedToSpots` (Boolean, default false) — separate flag from isPublic; set when trip completes
- `GeneratedTour.contributedAt` (DateTime?)
- `GeneratedTour.surfacingScore` (Float?) — cohort-weighted aggregate rating for Discover sort order

### Pending API routes (per Chat 37)

- `POST /api/tours/[id]/share` — create shareToken, set isPublic=true
- `DELETE /api/tours/[id]/share` — revoke token, set isPublic=false
- `GET /api/tours/share/[token]` — public read (no auth required)
- `POST /api/tours/[id]/clone` — clone tour stops to caller's account
- Public viewer page: `/share/tour/[token]`

### Trigger: contributedToSpots

When `Trip.status` transitions to `COMPLETED`, any GeneratedTours linked to that trip (via SavedItem.tourId + SavedItem.tripId) should have `contributedToSpots = true` and `contributedAt = now()` set. This is the automated community feed trigger. No user action required beyond completing the trip.

⚠ NEEDS BUILD: all items in this section.

---

## Spots Community Feature
- Currently early implementation
- Major rebuild planned: continent → country → city → category nav
- Featured cities landing page exists at /discover/spots
- Anonymous tours from completed trips feed into Spots data
- Family-weighted ratings filter what each viewer sees
- Detailed redesign spec exists in earlier session handoffs (TBD: collect into this doc)

---

## Trips

### Trip Data Model
- `destinationCity`: must contain a CITY name (Edinburgh, Tokyo, Colombo) — NOT a country or region
- `destinationCountry`: contains the country (UK, Japan, Sri Lanka)
- `title`: free-form ("Scotland - July 2026" is acceptable as a title)
- `destinationCity` is the field used for tour city-match suggestions, save deduplication, and Spots filtering — it MUST be city-level for those features to work

### Trip Creation
- ⚠ CURRENT STATE: trip creation flow does not validate or enforce city-level `destinationCity`. Some trips have country/region names in `destinationCity` (e.g., "Scotland" instead of "Edinburgh", "Ireland" instead of "Dublin"). This breaks tour city-match suggestions.
- NEEDS BUILD: trip creation form should geocode the user input or constrain to city-level when storing `destinationCity`. Country and region trips need a different model (multi-city or "regional" trip type).

---

## Saves
[to be filled in as we discuss]

## Family Profile
[to be filled in as we discuss]

## Email Pipeline
[to be filled in as we discuss]

## Booking Portal
[to be filled in as we discuss]

## Mobile / Companion Vision (Future)
- Native iOS app with chat-based companion
- "We're between stop 3 and 4, kids are tired, what's nearby?" use case
- Real-time location-aware suggestions
- AI grounded in family profile + community ratings + current trip context
- This is the long-term product thesis (see business plan v3.1 in flight)

---

## Open Questions / TBD
- Tour-trip cascade behavior on tour deletion: NEEDS BUILD (unlink-from-trip currently does NOT cascade-delete ItineraryItems)
- Tour image card treatment for standalone /tour library: NEEDS DESIGN (spec = full hero cards, current = city pill popovers)
- Spots rebuild full spec: NEEDS COLLECTION FROM PRIOR HANDOFFS
- Gamification tier specifics (Explorer / Navigator / Pioneer): TBD in dedicated phase

---

## Decisions Log

Conversation capture rule (set Chat 38, April 26 2026): Every meaningful product decision discussed in chat goes into this spec doc within the same session, regardless of whether code shipped. This prevents next-chat re-litigation of decisions already made.

### April 26, 2026 — Chat 38

**Booking architecture (12 commits shipped)**
- FlightBooking schema + Flight leg model + synthesizer-backed Vault read
- Leg partitioning, multi-trip extraction, ItineraryItem cleanup (deleteMany before writes)
- Day view polish: FLIGHT Remove button color, layover duration widget, suppress "From hotel" header before cross-destination departures
- stale flight ItineraryItem cleanup script (deleted 9 rows in prod)

**Tours quality — Track 1 (commit df299a6, shipped)**
- Under-emission retry (Attempt 3 fills missing stops, DO NOT REPEAT list)
- Walk retry noop bug fix (dry-run pattern preserves originals until retry is confirmed better)
- Clustering hint rewrite (removes "fewer stops" escape hatch — Claude must return target count)
- Cluster diameter check (O(n²) pairwise Haversine, age-based thresholds: 1.5km/3km/5km)
- Hotel anchor logic: tripId → LODGING check-in lookup → inject lat/lng into system prompt → post-generation proximity validation

**Tours tripId flow — fixed (commit 8395e20)**
- "Build a tour →" link now passes `?tripId=` query param
- `/tour/page.tsx` reads param, includes in POST body
- Generates from trip context now correctly trigger hotel anchor and link to trip's Tours tab

**Tours personalization — Track 2 (designed, not built)**
- Pure behavioral inference approach (skip manual tier UI)
- Three-source weighted blend: saves (SavedItem) + itineraries (ItineraryItem) + tour history
- FamilyBehavioralProfile + CohortBehavioralProfile schemas (not yet in Prisma)
- Haiku nightly batch refresh + Sonnet on-demand refresh when user opens tour builder
- Surfaced as prompt injection (soft preferences), not hard filter

**Tours public surfacing decisions**
- Tours go public on save-to-trip, NOT on generation (save = implicit quality vote)
- Attribution: anonymous by default, opt-in for family byline
- Clone-to-account: new GeneratedTour + TourStops in cloning family's account, independent rating history
- Clone notifications: yes, gamified ("your tour was saved by N families") — defer mechanics to gamification phase
- Rating loop: cohort-weighted (5-star from family with kids 5-10 boosts surfacing for similar families only)
- Real-time rating prompts: push notification at scheduled item end-time (pending iOS)

**Tours cosmetic polish (commits 23e3ce3, f0c4ac0, 7eb6b36)**
- Trip Tours tab: full-width hero card matching RecentSavesCards pattern + expand-in-place stops
- "Visit website" → "Link" on stop cards
- HTML entity decode helper applied to all tour/stop name and why renders
- BookingIntelCard: tours category added + contextual button labels (Build/Manage/Link/Book by category)

**Conversation capture rule established**: every product decision goes into spec within same session.

### Prior — Chat 37 (reconstructed from codebase + handoff references)

Note: Chat 37 handoff docx at `/mnt/project/Flokk_Chat37_Handoff.docx` was inaccessible in Chat 38 session. The following is reconstructed from codebase evidence and session summary references. Full retrieval deferred.

- Tour phase roadmap: Phase C (per-stop remove + regenerate-missing-stops) — shipped; Phase D (interest tiering) — designed; Phase E (save-without-trip polish + Discover surfacing) — specced; Phase F (rating loop) — conceptually agreed
- Clone notifications: agreed in principle, mechanics deferred to gamification phase
- Cohort-weighted ratings: agreed — heterogeneous cohort ratings carry neutral surfacing weight
- Tour Builder form refinement: neighborhood pills (soft anchors), vibe toggle (Touristy ↔ Local), rhythm toggle (Theme-focused ↔ With family breaks), open textarea — all to go in collapsible "Refine" section
- Tour public share schema: shareToken (String? unique), contributedToSpots (Boolean), contributedAt (DateTime?) — not yet in schema as of Chat 38
- contributedToSpots trigger: Trip.status → COMPLETED fires the flag
- `/share/tour/[token]` public viewer page: specced, not built

---

## How To Use This Document
1. Read this document FIRST when starting any new chat or prompt sequence
2. When a new feature behavior is discussed, add it here BEFORE writing code
3. When implementation differs from spec, mark it ⚠ in the spec — do not delete the spec
4. Future chat handoffs should reference this doc, not duplicate its content
5. This doc should NEVER be summarized away by chat compaction — it lives in the repo
