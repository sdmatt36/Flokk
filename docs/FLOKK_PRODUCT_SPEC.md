# Flokk Product Specification
This document is the source of truth for what Flokk's features are supposed to do.
Implementation state may lag specification — that is expected.
Update this document FIRST whenever a feature is discussed, before any code is written.

---

## Conversation Capture Rule (Operating Discipline)

Established Chat 38, April 26 2026.

Every meaningful product decision discussed in chat goes into this spec doc within the same session it's made, regardless of whether code shipped. This rule exists because chat threads get lost between sessions and the cost of re-litigating decisions across threads is high.

### Practical application

- After any product conversation that produces a decision, append to this doc before moving to the next prompt
- Decisions Log section at the bottom serves as the chronological index, but the decision content itself goes into the relevant feature section
- Handoff docs maintain a "Decisions Log" listing what was discussed but not built, so the next chat doesn't re-litigate
- If a decision conflicts with an earlier decision, log both with timestamps — don't overwrite

### Why this matters

Chat threads have practical context limits. Without a canonical doc, every new chat starts from zero on previously settled questions. This compounds badly: a question discussed three chats ago gets relitigated, the new answer drifts from the original answer, and the product fragments. The spec doc is the source of truth for decisions; chat is where they're made.

---

## Schema Change Completeness Rule (Operating Discipline)

Established Chat 38, April 26 2026, after the Okinawa flight Vault duplicate / missing outbound bug surfaced as a legacy migration gap. Tightened further after the Okinawa Day 1 itinerary repair revealed that backfilled rows missing dayIndex were silently filtered out of the UI even though they existed in the DB.

### Core principle

Schema migrations and write-architecture changes are NOT done when the new code path works for new data. They are done when ALL existing data has been migrated to the new shape AND legacy code paths have been removed.

Every prompt that touches a Prisma model, adds a new write path, or changes how data is structured MUST explicitly address all four of:

1. **New data path** — new writes produce new-shape data, with tests
2. **Existing data backfill** — audit query showing legacy row count, idempotent backfill script, executed and spot-checked before "shipped"
3. **Read-path compatibility** — reads handle both shapes during transition window, OR legacy shape is fully migrated and legacy reads removed in same prompt
4. **Legacy-data regression test** — added to the test suite using old-shape data, verifying correct output after migration

If any of these four are missing from a schema-change prompt, the prompt is incomplete.

### Backfill data shape completeness

Backfill scripts and one-time data repairs MUST set every field that participates in any UI filter, sort, grouping, or rendering decision. Not just the fields that look "required" in the schema — the fields that the READING code uses to decide whether to display the row at all.

Concrete example: ItineraryItem.dayIndex is nullable in the schema but is the primary filter key for the day view. A repaired row with dayIndex: null exists in the DB but never renders. Backfills must derive dayIndex from scheduledDate relative to trip startDate, populate it explicitly, and verify the row appears in the rendered surface.

Verification step in repair prompts must include: "open the affected UI surface and confirm the repaired row renders" — not just "confirm the row exists in DB."

### Why this matters

Without this discipline, every schema change creates a permanent dual-state: some users have old-shape data, others have new-shape data. Code paths drift apart. Bugs surface at runtime, not in tests, because tests only cover the shape the developer remembered to set up. The Okinawa Vault bug today (April 7 extractor created TripDocument-per-leg; April 25 extractor created FlightBooking-with-Flights; old data was never migrated; synthesizer rendered duplicates and itinerary missed legs) is the canonical example of this failure mode. The follow-on dayIndex repair gap (DB row existed but wasn't rendered) is the second-order example.

### Working rule

When drafting prompts for schema changes, the prompt body must include:

- "PART X — Audit existing data" (count and inspect rows of old shape)
- "PART X — Backfill script" (idempotent migration with rollback safety, sets every field that participates in UI rendering)
- "PART X — Read-path compatibility OR legacy removal" (explicit choice, not implicit)
- "PART X — Regression test for old-shape data" (added to existing test suite)
- "PART X — UI verification" (confirm repaired/migrated rows actually render in their target surface)

When reviewing prompts mid-session, both Matt and Claude should check for these parts. If missing, the prompt is rewritten before firing.

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

### Trip Tours Tab Self-Containment (Decision: Chat 38, April 26 2026)

The Trip's Tours tab IS the tour viewer for the trip's owner. The user does NOT navigate away from their trip to view their own tour. When the user taps a tour card on the Trip Tours tab, the expand-in-place experience surfaces:

- Map with numbered stops (1–5 pins)
- Stop list with image, name, ticket pill, why description, duration, walk time, Link
- Per-stop tap opens stop detail modal (already shipped)

The "View tour" button on the Trip Tours tab card is REMOVED — it's redundant when expansion shows everything. Owner stays in trip context.

The full `/tour/[id]` page becomes the PUBLIC VIEWER for shared/cloned tours surfaced via Discover/Spots. Anonymous strangers tapping a public tour see this page; owners never need to.

Status: Designed. Build queued for Chat 39 opening prompt.

#### Inline Map Deferred to Mobile (Chat 39, April 27 2026)

The Chat 38 decision included moving the map from /tour/[id] inline into the Trip Tours tab expand-in-place block. Chat 39 reversed this.

Reasoning: Desktop is the planning surface. Owners assess, edit, decide. Maps are execution-surface tooling. "Where am I, where's the next stop, how do I get there." Inline map adds vertical height and visual weight on desktop for value that doesn't materialize until users are walking around the destination. The cluster diameter check shipped Chat 38 already enforces spatial coherence server-side, so users don't need to eyeball a map to validate a tour.

Decision:
- /tour/[id] keeps its map (existing behavior preserved)
- Trip Tours tab expand-in-place stays focused on stops list, why descriptions, ticket pills, durations, links. No inline map.
- Inline tour map becomes a mobile app feature where in-trip context makes the map essential
- "View tour" button on the Trip Tours tab card becomes the affordance that opens /tour/[id] for owners who want the map view

### Tour Sharing — Three-State Model

Decision: Chat 39, April 27 2026.

Tours have three orthogonal states. They are NOT a single state machine. Any combination is valid: a tour can be Shared and Public, just one, or neither.

#### State 1: Private (default)

Only the owning family can view. No tokens generated. Not surfaced anywhere outside the owner's account. Every tour starts here.

#### State 2: Shared (link-based)

Owner explicitly generates a share link via Share button on the tour. A unique tokenized URL is created. Anyone with the link can view the tour via the public viewer page; no auth required. Owner can revoke at any time, which clears the token. Tour does NOT surface in Spots while Shared. Family attribution defaults to anonymous; owner can opt in to family byline.

#### State 3: Public (Spots-published)

Owner explicitly opts in via Publish to Spots action. An anonymized version of the tour flows into the Spots community browse, organized by location. Cohort-weighted ratings drive surfacing. Owner can unpublish at any time, which removes the Spots record. Family attribution stays anonymous by default at the Spots layer regardless of owner's Shared-link attribution preference.

#### Schema fields on GeneratedTour

- isPublic: Boolean, default false. Toggled by Publish to Spots action.
- shareToken: String? unique. Generated on first share-link action. Null when never shared or after revoke.
- publishedToSpotsAt: DateTime? Set when isPublic flips true.
- attribution: String? default "anonymous". Values: "anonymous" or "family-byline".

#### Forward-looking data capture

TourStop.neighborhood (String?) populated at generation time from Google Places address_components.sublocality_level_1. Null-safe everywhere. No UI consumer in v1; data accumulates for future neighborhood-level Spots browse.

#### Spots organization (v1)

Country, then City. Neighborhood-level browse deferred until data coverage exceeds 70% globally. Field captured now, surface later.

#### Shared viewer is high-leverage organic acquisition

When a Flokk owner sends a share link to a friend via WhatsApp, iMessage, or email, the recipient lands on the public viewer with zero prior Flokk exposure. The shared viewer is the single highest-leverage organic acquisition surface in the product. Design intent: magazine-quality presentation of the city and tour, Flokk identity quietly present, clear "Save to my trip" or "Sign up to save" CTA depending on auth state. NOT a render-the-data-cleanly job. Proper design pass required before frontend code lands.

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

### Tour Categorization Pipeline (Forward Path Shipped Chat 39)

Tour stops created via tour generation now persist Google Places `types` to `TourStop.placeTypes`. When a tour is saved to a trip via /api/tours/save, the save flow maps placeTypes through `mapPlaceTypesToCanonicalSlugs()` (src/lib/categories.ts) and writes the resulting canonical category slug to SavedItem.categoryTags. This closes the historical bypass where tour-saved items shipped with empty categoryTags and were excluded from Saved tab filters, behavioral profile signals, recommendations, and Spots community surfacing.

Mapper emits canonical slugs (food_and_drink, culture, kids_and_family, etc.), not legacy values (food, outdoor). The 12-slug taxonomy in CATEGORIES is the source of truth.

Backfill of 57 legacy tour-saved SavedItems with empty categoryTags pending separate Prompt 1B (Places re-fetch + mapper).

NOT changed: src/lib/enrich-save.ts PLACE_TYPE_MAP. Its legacy emissions ("food" instead of "food_and_drink", etc.) require their own audit. Tracked in Backlog as "PLACE_TYPE_MAP legacy emissions audit."

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
- `TourStop.placeTypes` (String[], default []) — Google Places `types` array, captured at generate time, used by save flow to derive SavedItem.categoryTags [C39]
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

## Tour Stop Detail Standards

### Core principle (Decision: Chat 38, April 26 2026)

Tours that don't expose URLs and ticket info push planning work back onto the user. They have to Google every stop separately. Tours that DO expose this become the planning artifact itself — the user opens the tour card, sees everything they need, and decides whether to proceed. This is the difference between a "list of places" and a "plan."

### URL is mandatory

Every tour stop and every AI/Flokk-generated recommendation has a URL by default. Source: Google Places Place Details API (the `website` field for businesses, the venue's official website for landmarks). If Places returns no website, URL falls back to the Place's Google Maps URL so the user can at least navigate to the venue. NEVER ship a tour stop or recommendation with a null URL — that's a generation defect, not a permitted state.

Persistence:
- TourStop.url (String?) — nullable in schema for backward compatibility, treated as required for new generations
- SavedItem.url — copied from TourStop.url at save-to-trip time (already exists)

### Stop description ("why") is mandatory and visible

Tour generation already captures a `why` field per stop ("Free public access to 360-degree London views...") describing why this stop fits the theme and family. This text:

- Persists on TourStop.why (already exists)
- Copies to SavedItem.notes at save-to-trip time
- Is VISIBLE in the tour card's expand-in-place view (not just stop name + duration)
- Is VISIBLE in the SavedItem modal when opened from itinerary

Current bug (Chat 38): expand-in-place view shows only "20 min · 3 min walk" with no `why`. The Sky Garden modal shows generic "Saved based on your family's interests" instead of the original tour-generated `why`. Both surfaces should display the actual generated rationale.

### Ticket / booking-ahead signal

Tour stops expose a `ticketRequired` signal:
- "free" — no ticket, walk-in (Borough Market, public parks)
- "ticket-required" — need to buy ticket on arrival or in advance (Tower of London, paid museums)
- "advance-booking-recommended" — free or paid but reservations recommended (Sky Garden, popular restaurants)
- "unknown" — fallback when Google Places doesn't return enough signal

Source: Google Places Place Details API + heuristic on category. Available signals:
- `priceLevel` field (free venues are 0/null)
- `editorialSummary` field (often mentions "advance booking" / "tickets required")
- Category `museum` + `priceLevel >= 1` → ticket-required
- Category `tourist_attraction` + popularity → advance-booking-recommended

Surface in expand-in-place card view as small pill next to duration: "Free · 20 min" or "Tickets · 20 min" or "Book ahead · 20 min".

Surface in SavedItem modal as a banner: "Tickets required — book in advance to skip the line" with a CTA linking to ticket URL if available.

### Tour stops in expand-in-place view must be clickable

Each stop in the expanded tour card view (40×40 thumbnail + name + duration) is currently read-only. Should be tappable — opens the same SavedItem-style modal pattern used in itinerary. Modal shows: hero image, title, location, why description, URL, ticket signal, rating affordance, notes.

Implementation: tour stops in expand-in-place fetch from /api/tours/[id] (already does), but the tap interaction needs a click handler that opens a modal pre-populated with TourStop fields. If user has saved the tour to a trip (so SavedItem exists), the modal can be the SavedItem modal directly. If tour isn't saved yet, the modal is a read-only TourStop modal with "Save to trip →" CTA.

Status: Designed, not yet built. Phase: queued for next session.

---

## "Be Helpful" Principle (Cross-Surface)

Flokk's planning surface is built around one organizing question: how can we be genuinely helpful to a family planning a trip? Not "what's the most popular thing to do" but "what does this specific family, on this specific trip, actually need to know?"

This principle is a core differentiator against generic OTAs and AI travel apps. It drives two distinct (but related) feature areas:

1. **Family-Context Awareness** — surfacing family-utility spots (playgrounds, gelato, rest stops) that match the family's rhythm
2. **Time-Bound Events Intelligence** — surfacing what's happening at the destination DURING the user's specific travel window (sports, shows, festivals, concerts)

Both share infrastructure: AI extraction layer, cohort-weighted surfacing, Trip Intelligence cards, Recommendations integration, future conversational chat. Both are core differentiators.

---

## Family-Context Awareness

### Core principle (Decision: Chat 38, April 26 2026)

Flokk plans for the family rhythm, not just the itinerary. Most travel apps surface "what to do." Flokk surfaces "what to do AND when the kids will need a break AND where to grab gelato AND where the bathroom is." This is the family-traveler reality that travel content has historically ignored.

### Why this matters

Tours and itineraries that don't account for family rhythm push the burden onto parents to mentally interleave wiggle breaks, snack stops, and rest points around the formal stops. Most parents do this work invisibly while traveling. When Flokk does it for them — surfacing the playground 3 blocks away, the gelato spot near the museum, the public restroom on the route — we save real time and reduce travel friction. This is the kind of "plan a trip with us" promise that compounds: families who feel taken care of return, recommend, and rate.

### Surfaces

#### 1. Tour-level family interstitials

Between themed tour stops, generation surfaces nearby family-utility spots as inline interstitials:

- Wiggle breaks: playgrounds, plazas, squares, parks, fountains
- Snack/coffee spots: cafés, gelato, ice cream, bakeries, kid-friendly quick bites
- Rest spots: shaded benches, viewpoints, public restrooms, water refill
- Photo stops: scenic moments families want to capture

Visual treatment: distinct from formal tour stops. Lighter card, smaller image, labeled "Wiggle break" or "Snack stop." User can tap, dismiss, or save.

Generation logic:
- Inserted between formal stops based on rhythm (every 2-3 stops or after long-distance walks)
- Pulled from Google Places nearby search keyed to family-friendly category list
- Filtered by Flokk family ratings when available (cohort-weighted)
- Matched to youngest child age — playgrounds for under 8, cafés/photo stops for older

#### 2. Trip Intelligence family-utility cards

When a trip is created, Trip Intelligence proactively surfaces family-utility intel for that destination, alongside existing booking-focused intel:

- "Playground 3 blocks from your hotel — great for jet-lag day"
- "Gelato spot 200m from the Colosseum has been a hit with 12 Flokk families"
- "This piazza is a perfect after-lunch wiggle break for kids 5-8"
- "Public restrooms can be hard to find in [neighborhood] — these 3 spots are reliable"
- "Stroller-friendly route from hotel to [attraction]"

Cards appear as IntelItem entries with category `family-utility` (new category to add to IntelItem.category union). actionType varies: `link` for informational, `view` for surfaced Flokk-rated spots, `add` for "add to itinerary."

#### 3. AI Recommendations on Trip page

Currently random/generic. Should be:
- Hotel-anchored (proximity to lodging)
- Family-utility weighted
- Cohort-informed (validated by similar Flokk families)
- Real and actionable (URLs, hours, age range labels)
- Family-rhythm aware (no three back-to-back museums for toddlers)

### Data sources

- Google Places API: nearby search by family-friendly categories (playground, café, public_restroom, ice_cream_shop, park, plaza)
- Flokk family ratings: cohort-weighted aggregate from completed trips
- Behavioral profile (Phase 2A): youngest child age, pace preference, geographic pattern
- Trip context: hotel coords (anchor), transport mode, day of trip (jet-lag day vs Day 5 reset)

### Cross-surface consistency

Family-utility spots surface consistently across:
- Tour generation (interstitials)
- Trip Intelligence (proactive cards)
- Recommendations tab
- Future: Flokk-Claude conversational chat ("we're at X, where's the closest playground?")

A shared Family Utility Service aggregates the queries. Both tour generator and trip intelligence call one resolver, not duplicate Places logic.

### Phasing

**Phase A (foundational)**:
- New `IntelItem.category = "family-utility"`
- Trip Intelligence emits proactive family-utility cards on trip creation
- Cards include URL, hours, age range, why-this-fits-your-family

**Phase B (tour integration)**:
- Tour generation injects interstitials between formal stops
- Visual treatment distinct from formal stops
- User can dismiss, save, or reorder

**Phase C (recommendations engine)**:
- Recommendations tab becomes hotel-anchored + family-utility-weighted
- Replaces current random/generic surface
- Integrates behavioral profile + cohort signals (Phase 2A consumer)

**Phase D (cross-surface Family Utility Service)**:
- Shared backend resolver for all family-utility queries
- Cohort-rating cache for Flokk-validated spots
- Powers conversational chat when shipped

### Schema additions needed

- `IntelItem.category` enum extended with `"family-utility"`
- New table or schema field for cached cohort-rated family-utility spots
- Possibly: `FamilyUtilitySpot` model (placeId, name, lat, lng, category, cohortRatings, lastVerified)

---

## Time-Bound Events Intelligence

### Core principle (Decision: Chat 38, April 26 2026)

Most travel apps surface "things to do" — places that exist year-round. They miss the time-sensitive window of "what's happening WHILE you're there." For sports fans, theatre lovers, concert-goers, festival hunters — this matters more than another museum recommendation. Catching a Premier League match in London or a Broadway show in New York can BE the trip highlight.

Flokk extracts and surfaces local events that fall within the user's travel dates: sports matches, concerts, theatre/Broadway/West End shows, festivals, art exhibitions, seasonal markets, cultural events, parades.

### Approach: AI extraction, not API licensing

Events are extracted by AI from public web sources, NOT pulled from licensed structured APIs (Sportradar, Ticketmaster Discovery, Songkick, etc). The AI extraction layer:

1. Identifies relevant sources for the destination (team sites, venue sites, ticketing aggregators, city tourism pages, local culture blogs)
2. Scrapes/fetches public pages for events in the user's date range
3. Extracts structured event data: title, date, time, venue, ticket URL
4. Caches results per-destination per-date-range with provenance (source URL + extraction timestamp)
5. Surfaces ticket URLs as outbound links — affiliate codes layered on over time as partnerships are established

This is cheaper than API licensing, more flexible (web has more coverage than any single API), and naturally compatible with affiliate monetization.

### Categories surfaced

- **Sports**: home games for local teams (NFL, NBA, MLB, NHL, Premier League, La Liga, Serie A, Bundesliga, MLS, NPB, KBO, cricket, rugby, tennis tournaments, golf majors, F1)
- **Theatre & shows**: Broadway, West End, regional theatre, touring productions
- **Concerts**: arena/stadium tours, club shows, classical/symphony, jazz festivals
- **Festivals**: seasonal (Cherry Blossom, Oktoberfest, Carnival, Diwali), cultural, food, music
- **Markets**: Christmas markets, weekly farmers markets, night markets, antique fairs
- **Exhibitions**: special museum exhibits with limited runs
- **Live experiences**: parades, fireworks, light shows, free public events

### Affiliate path (parallel work, not blocking)

Major event/ticket platforms with affiliate programs to onboard:
- Ticketmaster Affiliate Program
- StubHub
- Vivid Seats
- Eventbrite
- Fever (events/experiences aggregator)
- SeatGeek
- TodayTix (last-minute theatre)

When AI extraction returns a ticket URL pointing to one of these platforms, the affiliate enrichment layer rewrites the URL with the appropriate tracking code at surface time. Same pattern as existing GetYourGuide (partner_id: 9ZETRF4) and Booking.com (CJ Affiliate) integrations.

If extraction returns a URL pointing to a platform we don't have affiliate access to, surface as-is (no rewrite). Building affiliate relationships is parallel work — not a blocker for shipping events extraction.

### Surfaces

#### 1. Trip Intelligence Events card

When a trip is created, Trip Intelligence runs an events extraction pass for the destination + date range. Returns a structured list:

- "Tottenham vs Arsenal — Saturday July 5, 2pm at Tottenham Hotspur Stadium" (URL to tickets)
- "Hamilton at Victoria Palace Theatre — running through your visit" (URL to tickets)
- "Sunday market at Borough Market — Sundays 10am-4pm, your visit covers 1 Sunday"
- "Edinburgh Fringe Festival — your visit overlaps with peak week"

Card type: IntelItem with category `events`. Each event entry: title, date/time, venue, ticket URL, "your visit covers [N] performances" if recurring.

#### 2. Recommendations tab Events section

Dedicated Events section on the trip's Recommendations tab. Filterable by category (sports / shows / festivals / markets). Sortable by date. Each event card: title, venue, date/time, ticket link, "Save to itinerary" CTA.

#### 3. Tour generation awareness (deferred)

Future: tour generator considers events as fixed schedule anchors. If user is going to a 7pm match, daytime tour ends near the stadium.

### Schema

Single cached Event model. Provenance fields support affiliate enrichment and quality auditing.

```prisma
model Event {
  id                String   @id @default(cuid())
  category          String   // "sports" | "theatre" | "concert" | "festival" | "market" | "exhibition" | "live"
  subCategory       String?  // "premier_league" | "broadway" | "music_festival" | etc
  title             String
  description       String?
  venueName         String
  venueCity         String
  venueCountry      String
  venueLat          Float?
  venueLng          Float?
  startDate         DateTime
  endDate           DateTime?
  isRecurring       Boolean  @default(false)
  recurrencePattern String?
  ticketUrl         String?
  imageUrl          String?
  sourceUrl         String
  extractedAt       DateTime @default(now())
  extractionModel   String
  affiliatePartner  String?
  expiresAt         DateTime

  @@index([venueCity, startDate])
  @@index([category, venueCity, startDate])
}
```

API route: `GET /api/events?city=London&startDate=2026-07-04&endDate=2026-07-07` returns cached Events. If no cache hit OR cache expired, triggers extraction job (Sonnet for first hit, Haiku for refresh).

### Personalization

User's Family Profile interests drive prioritization:
- Profile interest "sports" → events in sports category surface first
- Profile interest "theatre" → shows surface first
- No interest match → all categories shown, sorted by date

Behavioral profile (Phase 2A): family historical save patterns boost matching event categories.

### Phasing

**Phase A (foundational)**:
- Event schema + cache layer
- AI extraction service (sports + theatre as initial categories)
- Trip Intelligence emits Events card on trip creation
- Surface ticket URLs as outbound links (no affiliate rewrites yet)

**Phase B (expansion)**:
- Concerts, festivals, markets, exhibitions
- Recommendations tab Events section with filtering and save-to-itinerary

**Phase C (affiliate enrichment)**:
- Affiliate URL rewrite layer
- Onboard Ticketmaster, StubHub, Vivid Seats, Eventbrite affiliate programs
- Track click-through and conversion via affiliate dashboards

**Phase D (Tour integration)**:
- Tour generator considers events as schedule anchors

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
- Tour stop ticket signal heuristic — needs validation at scale (Google Places editorialSummary parsing reliability)
- Family-utility category taxonomy — full list needs to be defined (playground, plaza, café, gelato, restroom, water_refill, viewpoint, photo_stop, etc.)
- AI events extraction prompt design — confidence scoring, source authority weighting, extraction quality auditing
- Affiliate partnership timeline — which event/ticket platforms to onboard first (Ticketmaster vs Eventbrite vs StubHub priority)
- Scraping resilience — Ticketmaster, StubHub aggressively block bots; ScrapingBee proxy or alternative needed for protected sources
- Cohort-rating storage for family-utility spots — separate model vs reusing existing rating tables
- Legacy data systematic repair — booking DRP8E8 on trip cmmycshfj000004jpyadzdp8y still has missing leg per audit script; needs review next session
- Tour viewer redesign — Trip Tours tab should host map inline; `/tour/[id]` becomes public viewer for shared/cloned tours (queued for Chat 39)

---

## Backlog

Source-of-truth for product items not yet built. Reconciled Chat 39 from Chat 37 + Chat 38 handoffs after multiple items dropped between sessions despite the Conversation Capture Rule. Items removed only when shipped (with commit hash logged in Decisions Log) or explicitly killed (with reason logged).

Source tags: [C37] surfaced Chat 37; [C38] surfaced Chat 38; [C39] surfaced Chat 39.

### Top of queue (P0/P1)

- Phase 2A schema migration: FamilyBehavioralProfile + CohortBehavioralProfile [C38]
- Tour categorization pipeline gap [C37]: COMPLETE. Forward path Chat 39 commit ba61d88. Backfill of 13 legacy items Chat 39 commit 0ff77ae. 0 manual-review items.
- Visual tour cards on profile/trips library: replace dropdown-by-city pills with image cards [C37]
- Tour share token + viewer + clone-to-account full build [C37, refined C39]
- Anchor-aware tour generation: lodging/itinerary as start/end node, foundation of companion thesis [C37]
- /tour/[id] as public viewer for non-owners [C38, refined C39]

### Family-utility and events (Be Helpful pillars)

- Family-utility cards build, Phase A foundational [C38]
- Events extraction build, Phase A foundational [C38]

### Bug fixes and small repairs

- Cairo/Luxor blank itinerary diagnostic [C38]
- Sri Lanka recommendation save bug [C38]
- Notes edit + formatting preservation [C38]
- Documents edit capability [C38]
- Booking DRP8E8 missing leg SQL repair [C38]
- Tours with null ticketRequired: backfill when ticketRequired becomes hard filter [C38]
- 28 lodging items with bookingSource unknown: decide on "Direct hotel" UI label [C38]

### Architecture and trip types

- Trip type architecture: city / multi-city / touring [C37]
- Multi-city + touring trip support, paired with anchor-aware generation [C37]
- Audit other write paths for the enrichment-bypass pattern that affected tour saves [C37]

### Bigger features for dedicated sessions

- Spots page rebuild [C37, C38]
- Tour Builder Refine section: neighborhood pills, vibe toggle, rhythm toggle, textarea [C38]
- Discover/Spots Tours surface [C38]
- Tour generation form revamp: family override, pace, time of day, budget, constraints [C37]
- Archetype-aware tour generation: neighborhood crawl, regional, scenic, anchor-and-fillers, transit hop, country tour [C37]
- Multi-modal route suggestions: transit hops mid-walk, walk segments mid-drive [C37]
- Cruises in Vault with stops in itinerary [C38]
- Flokk-Claude conversational chat: in-trip companion [C37, C38]
- Home Page Recommended Trips intelligence, Phase 2A consumer [C38]

### P3 fragility cleanup

- PLACE_TYPE_MAP legacy emissions audit: enrich-save.ts emits "food", "outdoor", etc. instead of canonical slugs. Read-time normalization status unknown. Audit + fix + backfill all legacy-tagged SavedItems [C39]
- Walking-retry should rollback DB writes from discarded attempts [C37]
- audit-drift script N+1 hang on I2c [C37]
- Inngest full removal: imported in 6+ files but disabled [C37]
- Trip.budgetSpent deprecated, field still exists [C37]
- /continents/[continent] and /c/[city] live dead links return 404 [C37]

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

**Small Fix B — Trip Intelligence (commits e00b01d, b89ee2c)**
- Explicit `actionType` field added to `IntelItem` type: `"book" | "link" | "build" | "view" | "manage" | "add" | null`
- All `items.push()` calls in booking-intel route now set actionType explicitly (no inference)
- `TripIntelDismissal` model added to schema; migration applied via Supabase MCP
- Per-item dismiss UI in `BookingIntelCard`: X button → inline confirm → optimistic remove → POST to `/api/trips/${tripId}/intel-dismissals`
- "Show N dismissed items" toggle + restore affordance → DELETE to `/api/trips/${tripId}/intel-dismissals/${itemId}`
- Redundant `toursCount` secondary fetch removed; tours now surface as a proper IntelItem

**Conversation Capture Rule** elevated to top-level operating discipline (this section)

**Schema Change Completeness Rule** established (4-part checklist: new data path, backfill, read-path compatibility, regression test) plus Backfill Data Shape Completeness sub-rule (must populate all UI-rendering fields, must verify in UI not just DB)

**Tour Stop Detail Standards** specced: URL mandatory by default (Google Places website field, fallback to Maps URL), `why` description visible in expand-in-place and SavedItem modal, ticket signal (free / ticket-required / advance-booking-recommended / unknown), expand-in-place stops tappable — designed, not yet built

**"Be Helpful" cross-surface principle** established as product differentiator against OTAs — umbrella for Family-Context Awareness and Time-Bound Events Intelligence

**Family-Context Awareness** specced (Phases A–D): family-utility interstitials in tours, Trip Intelligence family-utility IntelItem cards, hotel-anchored recommendations engine, shared Family Utility Service backend resolver; new `IntelItem.category = "family-utility"` needed

**Time-Bound Events Intelligence** specced (Phases A–D): AI extraction from public web (not API licensing), sports + theatre + concerts + festivals + markets + exhibitions; affiliate URL rewrite layer (Ticketmaster, StubHub, Vivid Seats, Eventbrite, Fever, SeatGeek, TodayTix); Event schema designed; Trip Intelligence emits Events card; Recommendations tab Events section

**Okinawa flight Vault repair shipped** (commit 93316ed): universal synthesizer dedup by confCode (prevents two old-era per-leg TripDocuments from rendering duplicate Vault cards) + Okinawa SQL data repair (inserted missing HND→OKA Flight row + ItineraryItem) + legacy audit script; audit identified 1 other user (booking DRP8E8, trip cmmycshfj000004jpyadzdp8y) with missing leg

**Okinawa Day 1 dayIndex repair**: follow-up UPDATE set `dayIndex = 0` on the inserted ItineraryItem; dayIndex completeness requirement now codified in Schema Change Completeness Rule

**Trip Tours tab self-containment**: Trip Tours tab redesigned to be self-contained — map + stops inline in expand-in-place, "View tour" button removed. Full `/tour/[id]` page repurposed as public viewer for shared/cloned tours surfaced via Discover/Spots.

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
