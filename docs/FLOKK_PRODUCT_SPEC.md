# Flokk Product Specification
This document is the source of truth for what Flokk's features are supposed to do.
Implementation state may lag specification — that is expected.
Update this document FIRST whenever a feature is discussed, before any code is written.

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

### Tour Library / Profile View
- All of a user's tours should appear on their profile or trips page
- Display style: image card with tour title (NOT current dropdown-by-city list)
- Click image card → opens tour view
- Visual treatment matches the rest of Flokk's editorial design (not utilitarian)
- ⚠ CURRENT STATE: dropdown-by-city pills with identical titles (placeholder, not the spec)

### Tour Sharing (Three States)
1. Private (default): only author's family can see
2. Shared via token: explicit share action generates token, sets isPublic=true
3. Anonymous community contribution: when parent trip transitions to COMPLETED, tour data feeds the Spots system anonymously (no author attribution)

### Tour URLs
- Each tour has a stable URL with ?id= query param
- URL pushes to history on generation (refresh preserves tour) ✓ shipped
- Public share URLs route through /share/tour/[token] (not /tour?id=)

## Spots Community Feature
- Currently early implementation
- Major rebuild planned: continent → country → city → category nav
- Featured cities landing page exists at /discover/spots
- Anonymous tours from completed trips feed into Spots data
- Family-weighted ratings filter what each viewer sees
- Detailed redesign spec exists in earlier session handoffs (TBD: collect into this doc)

## Trips

### Trip Data Model
- `destinationCity`: must contain a CITY name (Edinburgh, Tokyo, Colombo) — NOT a country or region
- `destinationCountry`: contains the country (UK, Japan, Sri Lanka)
- `title`: free-form ("Scotland - July 2026" is acceptable as a title)
- `destinationCity` is the field used for tour city-match suggestions, save deduplication, and Spots filtering — it MUST be city-level for those features to work

### Trip Creation
- ⚠ CURRENT STATE: trip creation flow does not validate or enforce city-level `destinationCity`. Some trips have country/region names in `destinationCity` (e.g., "Scotland" instead of "Edinburgh", "Ireland" instead of "Dublin"). This breaks tour city-match suggestions.
- NEEDS BUILD: trip creation form should geocode the user input or constrain to city-level when storing `destinationCity`. Country and region trips need a different model (multi-city or "regional" trip type).

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

Status: Designed, will be addressed alongside Track 2 (personalization layer) since both touch the same SavedItem write path.

### Decisions Log

Conversation capture rule (set Chat 38, April 26 2026): Every meaningful product decision discussed in chat goes into this spec doc within the same session, regardless of whether code shipped. Handoff docs maintain a "Decisions Log" listing what was discussed but not built. This prevents next-chat re-litigation of decisions already made.

---

## Open Questions / TBD
- Tour-trip cascade behavior on tour deletion: NEEDS BUILD
- Tour image card treatment for profile/trips page: NEEDS DESIGN
- Spots rebuild full spec: NEEDS COLLECTION FROM PRIOR HANDOFFS

---

## How To Use This Document
1. Read this document FIRST when starting any new chat or prompt sequence
2. When a new feature behavior is discussed, add it here BEFORE writing code
3. When implementation differs from spec, mark it ⚠ in the spec — do not delete the spec
4. Future chat handoffs should reference this doc, not duplicate its content
5. This doc should NEVER be summarized away by chat compaction — it lives in the repo
