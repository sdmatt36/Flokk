# FLOKK_DISCIPLINES

The complete numbered rule set governing Flokk development. Read at session start.

## How to read this document

This file is the constitution. Every numbered discipline (4.1 through the highest current
number) is the law of how Flokk is built. Every prompt to Claude Code should reference the
relevant disciplines by number.

Three companion documents:
- **CLAUDE.md** (repo root) — the dashboard. Project state, file paths, environment variables,
  current beta state. Auto-loaded at session start.
- **FLOKK_FOUNDATIONS.md** (repo root) — the encyclopedia. Schema, entity model, lifecycles,
  render surfaces, image and URL priority chains.
- The most recent **Flokk_Chat{N}_Handoff.docx** in /mnt/project/ — the active priority queue
  and session-to-session context.

## Conventions

**Numbering is append-only.** New disciplines get the next available number. Retired
disciplines keep their number reserved with a "RETIRED" note; the number is never reassigned.

**Provenance is preserved.** Every discipline ends with the chat and date it was established.
Where a triggering incident is documented, it is named.

**Phase notes within disciplines are historical snapshots.** Some disciplines (notably 4.5
Universal URL Rule and 4.6 Universal Entity Status Rule) carry "as of Chat N" audit status
and "COMPLETE Chat N" phase notes from the time they were written. Those notes are preserved
verbatim as historical record. For current state of any audit or phase, read FLOKK_FOUNDATIONS.md.

**Disciplines bind both Claude Code and chat-side Claude.** Some disciplines (4.15, 4.16,
4.17) explicitly apply to chat-side prompt drafting as well as code execution. Where a
discipline is one-sided, it says so.

---

## 4.1 — Conversation Capture Rule

Established Chat 38, April 26 2026.

Every meaningful product decision discussed in chat goes into this spec doc within the same session it's made, regardless of whether code shipped. This rule exists because chat threads get lost between sessions and the cost of re-litigating decisions across threads is high.

### Practical application

- After any product conversation that produces a decision, append to this doc before moving to the next prompt
- Decisions Log section at the bottom serves as the chronological index, but the decision content itself goes into the relevant feature section
- Handoff docs maintain a "Decisions Log" listing what was discussed but not built, so the next chat doesn't re-litigate
- If a decision conflicts with an earlier decision, log both with timestamps — don't overwrite

### Why this matters

Chat threads have practical context limits. Without a canonical doc, every new chat starts from zero on previously settled questions. This compounds badly: a question discussed three chats ago gets relitigated, the new answer drifts from the original answer, and the product fragments. The spec doc is the source of truth for decisions; chat is where they're made.

*Established Chat 38, April 26 2026.*

---

## 4.2 — Schema Change Completeness Rule

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

*Established Chat 38, April 26 2026, after the Okinawa flight Vault duplicate / missing outbound bug surfaced as a legacy migration gap. Tightened further after the Okinawa Day 1 itinerary repair revealed that backfilled rows missing dayIndex were silently filtered out of the UI even though they existed in the DB.*

---

## 4.3 — Spec Reading Discipline

Established Chat 39, April 27 2026, after a chat-wide drift cycle where the Chat 38 Trip Tours Tab self-containment decision (map inline in expand-in-place) was silently reversed by a later Chat 39 prompt that treated offhand reasoning as a settled decision.

### Rule: Spec leads, code follows

Every prompt that proposes a build, fix, or design change MUST open with a SPEC CHECK block that:
1. Quotes the relevant spec section verbatim by heading
2. States explicitly whether the prompt aligns with spec, extends spec, or diverges from spec
3. If divergent: the prompt updates the spec FIRST in the same prompt, then writes the build. Spec edit is a precondition, not a follow-up.

### Rule: Stubs are not specs

"Status: Designed" without behavior detail is not a spec, it is a placeholder. Stubs must be expanded into real specs (rendered behavior, exact fields, exact components) within the same chat the decision is made. Future chats reading "Status: Designed" cannot know what was decided.

### Rule: Reversals must be logged, never silent

If a chat proposes reversing an earlier-chat decision, the reversal goes into the Decisions Log with the original commit hash, the reason for reversal, and the corrected decision. No silent overwrites.

### Rule: User offhand input is not a settled decision

A user comment in chat ("X feels like Y") is input, not a settled product decision. Settled decisions are explicit, written into spec, and acknowledged as architectural commitments. Treating offhand input as an architectural decision is the failure mode that caused the maps-on-mobile drift in Chat 39.

### Rule: Every chat opens with a spec read of the section being touched

The first action in any chat that touches an existing feature is to read the spec section for that feature in full. Not summary, not "I remember the spec said." Read the section. Quote the relevant heading in the first SPEC CHECK block of the chat.

*Established Chat 39, April 27 2026, after a chat-wide drift cycle where the Chat 38 Trip Tours Tab self-containment decision was silently reversed by a later Chat 39 prompt that treated offhand reasoning as a settled decision.*

---

## 4.4 — Modal Pattern Discipline

Established Chat 39, April 27 2026, after a stop detail modal on the Trip Tours tab was rendering cut off by the bottom nav on desktop. Diagnostic surfaced that the codebase has no canonical modal pattern — at least three patterns exist, applied inconsistently across surfaces, with the broken pattern (mobile-only bottom-sheet) being the most common.

### Canonical pattern

Every modal in the product follows this structure:

Outer wrapper:
```
fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50
```

Content panel:
```
w-full sm:w-[480px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto pb-safe
```

Behavior produced:
- Mobile: slides up from bottom as a sheet, rounded top corners only, takes full width
- Desktop (sm+): renders centered, rounded all corners, max-width 480px (or larger if content needs)
- Both breakpoints: scrolls vertically if content exceeds 85vh
- Both breakpoints: pb-safe (or pb-16 if iOS safe areas not configured) prevents content from being masked by fixed bottom nav on mobile
- Sticky footer: when actions need to remain visible regardless of scroll, action row uses `sticky bottom-0 bg-white border-t` inside the scroll container

### What is NOT canonical

- **Bottom-sheet without `sm:` breakpoint adaptation.** The `alignItems: "flex-end"` pattern with no responsive flip is the failure mode. Mobile-native modals that sit pinned to bottom on desktop and get masked by the bottom nav.
- **Centered overlay without `max-h`.** Modals that can grow beyond viewport with no scroll affordance.
- **z-index above 50 used as a fix for stacking conflicts.** If a modal needs z-60 to escape a chrome element, the chrome element's z-index is wrong, not the modal's. z-50 is the canonical ceiling.
- **Inline modal JSX scattered across feature components** when the same pattern is reused 9+ times across the app. Modals that recur should be promoted to a shared component.

### Required affordances per modal

- **Close X button:** top-right of content panel, 32px touch target, lucide X icon, navy or gray, always visible regardless of scroll
- **Tap-outside-to-close:** clicking the bg-black/50 backdrop closes the modal (onClick on outer wrapper, e.stopPropagation on content panel)
- **Escape-key-to-close:** key handler on the content panel
- **Sticky action footer** when actions are required (View on Maps, Save, Cancel, Confirm)

### Migration approach

When modal pattern bugs are found, the fix is the canonical pattern above applied to the affected modal. NOT z-index escalation. NOT padding hacks at the consumer level. Modal infrastructure is fixed at the source, not patched downstream.

Long-term: a shared `Modal` component at `src/components/ui/Modal.tsx` that takes children, `isOpen`, `onClose`, optional sticky footer slot, and optional `sm:max-w` override. New modals use the component. Existing modals migrate incrementally, prioritized by user-visible breakage. The shared component is NOT required for the immediate fix; the canonical pattern is.

*Established Chat 39, April 27 2026, after a stop detail modal on the Trip Tours tab was rendering cut off by the bottom nav on desktop. Diagnostic surfaced that the codebase has no canonical modal pattern.*

---

## 4.5 — Universal URL Rule

Established Chat 39, April 27 2026, after a verification pass on the Trip Tours tab self-containment build surfaced that AI-generated lodging items and tour stops were shipping with null URLs across multiple surfaces, despite the Chat 38 tour-specific spec already requiring URL mandatory. The gap was that "URL mandatory" was scoped to tour stops only; the rule applies product-wide and was not articulated as such.

### The rule

Every Flokk-generated entity that represents a place, venue, or experience MUST resolve the best available URL using the priority chain before it is written to the database. Null is acceptable and preferable when neither P1 nor P2 applies — a null URL suppresses the "Visit website" affordance entirely, which is better than a button pointing at Google search. This applies to ALL of:
- Tour stops (TourStop)
- AI-extracted lodging from email parsing (ItineraryItem.type = LODGING)
- AI-extracted activities from email parsing (ItineraryItem.type = ACTIVITY)
- AI-recommended activities surfaced via Trip Intelligence or Recommendations
- AI-enriched SavedItems written via enrichSavedItem (sourceUrl OR placeUrl populated)
- ManualActivity rows generated via AI (website field populated)
- Any future AI-generated entity surface

The rule does NOT apply to user-pasted content where the user explicitly provided the URL or explicitly opted out (free-text notes, manual entries without URL field).

### Resolver priority chain

URLs are resolved by a single shared helper, `resolveCanonicalUrl()`, with this priority:

1. Google Places `website` field (if Place Details API call returns a website for the venue)
2. Google Places Maps URL fallback (`https://www.google.com/maps/place/?q=place_id:${placeId}`)

Returns `string | null`. Returns null when neither P1 nor P2 applies. Never empty string. Never undefined. P3 (generic search URL fallback) was built and reverted Chat 40 — a Google search URL renders a "Visit website" button that ships the user to Google instead of the actual venue, which is a worse experience than no button at all.

### Why this matters

Users discovering content in Flokk want to investigate. A restaurant recommendation without a URL is an unverifiable suggestion, not an actionable plan. A hotel without a "manage booking" or property URL forces the user to leave Flokk, search elsewhere, and lose context. URL is the bridge between Flokk's recommendation and the user's ability to act on it. Generic OTAs and AI travel apps have failed at this pervasively. Flokk does not.

### Implementation requirements

- A single shared helper `src/lib/url-resolver.ts` exports `resolveCanonicalUrl(input: { website?, placeId?, name, city, country }): string | null`. Returns null when neither P1 nor P2 applies; callers treat null as "no URL available" and suppress the affordance.
- Every AI-generation/extraction code path calls this helper before persistence.
- Schema fields hosting these URLs are NOT marked nullable in new code. Existing nullable fields stay nullable for backwards compatibility but new writes must populate them.
- A database integrity check, run as part of CI or as a periodic cron, audits AI-generated entities for null URLs and reports violations.

### Surfaces that must comply (Chat 39 audit)

Each surface listed below is either currently compliant, partially compliant, or non-compliant. Status as of Chat 39:

- **TourStop.websiteUrl**: PARTIALLY COMPLIANT. websiteUrl populated from Google Places `website` field at generate time (Chat 37 commit referenced in spec); Maps URL fallback specced Chat 38 but enforcement at write time needs verification.
- **ItineraryItem (LODGING)**: NON-COMPLIANT. Lodging items extracted from email parsing have managementUrl (booking platform manage page) but no property/venue URL. Direct hotel emails (28 items per Chat 38 backfill) have bookingSource = "unknown" and no URL of any kind.
- **ItineraryItem (ACTIVITY)**: UNKNOWN. Audit needed.
- **ManualActivity.website**: UNKNOWN. Audit needed.
- **SavedItem.sourceUrl / placeUrl**: PARTIALLY COMPLIANT for AI-enriched items; URL-paste items are user-provided.
- **Trip Intelligence IntelItem**: UNKNOWN. Audit needed.
- **Recommendations**: UNKNOWN. Audit needed.

### Backfill status (REVERTED Chat 40, commit fdc0098)

Chat 40 ran a backfill (commit d4e828c) that populated 89 rows with P3 search URLs. The backfill was reverted in the same session after verification showed that P3 URLs render a "Visit website" button pointing at Google search — a regression vs. null, which suppresses the button entirely. The 89 rows were restored to null via Supabase MCP SQL.

Current state: 12 ManualActivity + 77 ItineraryItem rows have null URLs. This is correct and expected — neither ManualActivity nor ItineraryItem stores `placeId`, so P1 and P2 cannot be applied. The null-URL backfill will remain open until one of:
- `googlePlaceId` is added to ManualActivity schema (enables P2 for ManualActivity rows)
- Forward-path ACTIVITY/LODGING extraction begins storing placeId at write time (enables P2 for ItineraryItem rows)
- An integration with Places API is added to enrich existing rows retroactively (enables P1/P2 for all targets)

Script: `scripts/backfills/2026-04-28-url-rule-backfill.ts` — marked SUPERSEDED in file header. Do not re-run.

### Affordance suppression rule

When `resolveCanonicalUrl()` returns null for an entity, the "Visit website" / "Link" button MUST be suppressed entirely at the surface. Do not render a disabled or grayed button. Do not render a Google search fallback. Null means no button. This is enforced in `PlaceActionRow` and all detail modal link slots via `{place.websiteUrl && ...}` conditional rendering.

*Established Chat 39, April 27 2026, after a verification pass on the Trip Tours tab self-containment build surfaced that AI-generated lodging items and tour stops were shipping with null URLs across multiple surfaces. Code-comment label evidence in src/lib/lodging/detect-source.ts (commit f39ea2b, May 1 2026) confirms the 4.5 designation.*

---

## 4.6 — Universal Entity Status Rule

Established Chat 39, April 27 2026, after a Saves screen verification surfaced that a booked hotel (lodging linked to ItineraryItem) was displaying "+ Itinerary" affordance instead of "On itinerary" status, while an activity in the same trip displayed correctly. Root cause was ad-hoc status derivation per surface — some entities check ItineraryItem linkage, others don't, others use different signals. The rule applies product-wide.

### The rule

Every place-bearing entity surface in Flokk displays a consistent status indicator derived from a single shared helper. Statuses are enumerated, ordered by progression, and rendered with consistent visual treatment across all surfaces (Saves screen, trip Saved tab, Itinerary day view, Vault, Recommendations, Trip Intelligence, Discover, Spots).

### Status enum (ordered by progression)

1. **Saved** — entity exists in user's saves but not yet placed on itinerary. Default state for SavedItem on creation.
2. **On itinerary** — entity is linked to an ItineraryItem on a specific day. Visible on Saves and trip Saved tab as a green-dot pill matching Cape Manzamo's current rendering.
3. **Booked** — entity has a confirmation code from email parsing OR explicit user-confirmed booking. Lodging with bookingSource set, flights with FlightBooking row, activities with confirmation. Supersedes "On itinerary" visually but both states are true; UI shows the higher-progression label.
4. **Completed** — trip end date has passed. Visual: completed marker, available for rating.
5. **Rated** — user has submitted a rating. Visual: star pill with rating value.

These are NOT mutually exclusive at the data layer. A booked hotel that's been rated is also On itinerary, also Saved. The UI displays the highest-progression label that applies, with optional secondary indicators (e.g. "Booked · Rated 5★").

### Single source of truth

A shared helper `src/lib/entity-status.ts` exports:
- `getEntityStatus(entity: { savedItem?, itineraryItem?, booking?, rating?, tripEndDate? }): EntityStatus`
- Returns the highest-progression status that applies
- Used by EVERY surface that renders a status indicator

Surfaces that must comply:
- SavesScreen card grid (Saves screen and trip Saved tab)
- Itinerary day view stop rows
- Vault flight cards, lodging cards, activity cards
- Recommendations cards
- Trip Intelligence IntelItem cards (where applicable)
- Discover Spots browser
- Tour stop cards (when surfaced as standalone, not within tour)

### Status derivation logic

For SavedItem entities:
- Saved: default
- On itinerary: ItineraryItem.savedItemId === SavedItem.id (any matching ItineraryItem on any day of any trip the user owns)
- Booked: SavedItem has linked Booking row OR ItineraryItem has linked FlightBooking/LodgingBooking with confirmationCode
- Completed: parent Trip.status === COMPLETED OR Trip.endDate < today
- Rated: Rating row exists for this SavedItem

For ItineraryItem entities (not linked to a SavedItem):
- On itinerary: default (it IS the itinerary item)
- Booked: as above
- Completed: as above
- Rated: as above

For ManualActivity entities:
- Same logic as SavedItem with appropriate linkage paths

For TourStop entities:
- Status reflects parent GeneratedTour completion state PLUS optional savedItemId linkage to a SavedItem

For IntelItem entities:
- Generally not subject to status — IntelItems are dynamic surfacings, not user-owned content. Exempt from rule unless linked to user content.

### Visual treatment

- Saved: no pill (default state, no indicator needed)
- On itinerary: small pill with green dot, text "On itinerary", color #16A34A
- Booked: small pill with terracotta dot, text "Booked", color #C4664A
- Completed: small pill with gray dot, text "Completed"
- Rated: small star pill with rating value, text "★ {rating}"

When multiple states apply, render the highest-progression as primary pill, lower states as inline secondary indicators only if space allows.

### Why this matters

Users need to know at a glance: "Is this on my plan? Have I booked it? Have I been there?" Without consistent status indicators, every surface forces the user to mentally re-derive what they already know. That's a research burden Flokk should be removing, not adding. Generic OTAs treat every entity as standalone. AI travel apps don't track this state. Flokk's family-first architecture means status compounds across saves → planning → booking → completion → rating; the UI must reflect that compounding consistently.

### Implementation requirements

- `src/lib/entity-status.ts` shared helper with EntityStatus enum + getEntityStatus() function
- Single canonical pill component: `src/components/ui/EntityStatusPill.tsx` consuming EntityStatus and rendering correct color + label
- Migration: every surface listed under "Surfaces that must comply" replaces ad-hoc status logic with the shared helper + pill component
- Database integrity: no new schema fields required (status is derived at read time from existing relational data); a periodic cron may audit consistency

### Surfaces that must comply (Chat 39 audit)

Status as of Chat 39:
- **SavesScreen card grid**: PARTIALLY COMPLIANT. Some entities (activities) show "On itinerary"; lodging entities do not. Inconsistent derivation logic. The Hyatt Regency Seragaki Island case from Chat 39 verification is the bellwether bug.
- **Itinerary day view stop rows**: UNKNOWN. Audit needed.
- **Vault flight/lodging/activity cards**: PARTIALLY COMPLIANT. Surface state but use different vocabulary ("Booked via X", management URL).
- **Recommendations cards**: UNKNOWN. Audit needed.
- **Trip Intelligence cards**: EXEMPT (dynamic surfacings).
- **Discover Spots**: UNKNOWN. Audit needed.
- **Tour stop cards**: UNKNOWN. Audit needed.

### Backfill scope

No data backfill required. Status is derived at read time. The migration is purely code: replace ad-hoc derivation with shared helper across all surfaces.

### Status derivation (locked Chat 40)

Status is derived at API read-time using TripDocument joins, not from SavedItem boolean fields directly. The `/api/saves` GET response includes two derived booleans:

- `hasBooking` — true if EXISTS TripDocument WHERE savedItemId = SavedItem.id AND confirmationCode IS NOT NULL
- `hasItineraryLink` — true if SavedItem.dayIndex IS NOT NULL OR EXISTS TripDocument WHERE savedItemId = SavedItem.id

`SavedItem.isBooked` is deprecated for read paths. It is still written by legacy code for backwards compatibility but read code paths must rely on `hasBooking`. This decision was made because email extraction (`createBookingSavedItem`) never sets `isBooked = true` despite creating valid TripDocument bookings — the join is the only reliable source of truth. Diagnosed Chat 40.

### Affordance suppression rule

When status >= On itinerary, the lower-progression affordance ("+ Itinerary" button or equivalent) MUST be suppressed at the surface. Pill is the only visual indicator. To move or remove an item from itinerary, user navigates to the day view. This pattern already exists on the Trip Saved tab where "✓ Day X" replaces "+ Add to itinerary."

### Duplicate match tiebreaker (locked Chat 40)

When a surface uses string-key matching to look up status (rawTitle|city or equivalent) and the user has multiple SavedItem rows matching the same key, the highest-progression status wins, not the most recent. Run getEntityStatus() on each match and pick the result whose status appears latest in the ENTITY_STATUSES array (rated > completed > booked > on_itinerary > saved). This surfaces the user's richest relationship with the place rather than recency, which can hide a completed or rated state behind a fresh save.

Applies to: Recommendations cards (RecommendedContent), Discover Spots cards. Does not apply to Phase A/B surfaces (SavesScreen, Trip Saved tab) which use direct SavedItem rows, not lookup keys.

### Phase C — Recommendations + Discover Spots (COMPLETE Chat 40)

Phase C scope: client-side status map fetched from /api/saves (no tripId filter) at mount. Map keyed by rawTitle.toLowerCase().trim()|destinationCity.toLowerCase().trim(). Render EntityStatusPill on each card using the highest-progression status if duplicate keys exist. Suppress "+ Save" affordance when status >= saved. Suppress "+ Itinerary" affordance when status >= on_itinerary.

Utility: src/lib/save-status-map.ts exports buildSaveStatusMap() + SaveStatusFields. Tests: src/lib/__tests__/save-status-map.test.ts (8 tests). Duplicate-match tiebreaker using ENTITY_STATUSES index comparison baked into buildSaveStatusMap.

Phase D (Itinerary day view, Vault cards, Tour stop cards) deferred — these surfaces have no current status display; that is net-new feature work, not migration.

### Phase A — SavesScreen (COMPLETE Chat 40, commit 18f4165)

Scope: `src/lib/entity-status.ts`, `src/components/ui/EntityStatusPill.tsx`, `/api/saves` GET response shape, SavesScreen migration.

### Phase B — Trip Saved tab (COMPLETE Chat 40, commit 16f2ffc)

Scope: TripTabContent.tsx SavedHorizCard + SavedGridCard. ApiSavedItem and SavedDisplayItem types extended. apiToDisplayItem passes through all six status fields. Legacy "Booked" badge removed from SavedHorizCard title row. Day label override: `status === "on_itinerary" && dayIndex != null` → `Day ${dayIndex + 1}` (preserves "Day 4" specificity vs generic "On itinerary"). Phase C and beyond deferred.

*Established Chat 39, April 27 2026, after a Saves screen verification surfaced that a booked hotel was displaying "+ Itinerary" affordance instead of "On itinerary" status, while an activity in the same trip displayed correctly.*

---

## 4.7 — Foundation-First Verification

Established Chat 40, April 28 2026, after three compounding foundation bugs were diagnosed in a single session: autocomplete endpoint returning duplicate entries across 8 consuming surfaces, cardinality `.find()` picking the wrong lodging anchor on multi-city trips, and a cascade-delete FK defaulting to SET NULL and creating orphan ItineraryItems. All three bugs "passed tests" at write time but created user-perception-of-broken in real use.

### The discipline

Code that works under simple conditions and fails under realistic ones is not "working." Bugs at the foundation level (data ingestion, place identification, schema relationships, shared components, third-party API integrations) cascade silently into every feature built on top. Users do not perceive these as edge cases — they perceive Flokk as broken.

**The foundational seams that demand explicit verification:**

1. **External API integrations.** Every third-party API call (Google Places autocomplete, geocoding, Place Details, payment, auth, mapping) ships with explicit configuration documentation: types parameter, response field selection, default behavior on missing data, what happens at scale, what happens with malformed input. Defaults are decisions; if a default is accepted, it must be acknowledged as deliberate.

2. **Schema relationships.** Foreign key onDelete behavior is an explicit decision, not a default. SET NULL vs CASCADE has user-facing consequences (orphaned data surfacing, vs silent data loss). Each relationship documents which behavior is intended and why.

3. **Shared components and shared APIs.** Endpoints and components used across multiple surfaces (autocomplete inputs, card renderers, status pills, lookup APIs) carry their own contracts. A bug in one is a bug in all callsites. Changes to shared infrastructure require regression testing against all consuming surfaces.

4. **Cardinality assumptions.** Code patterns like `.find()` over per-entity collections assume cardinality of 1 or pick non-deterministically. Multi-item realities (multi-lodging trips, multi-segment recommendations) break these silently. Any `.find()` or `[0]` over a per-entity collection requires either deterministic ordering or explicit handling of the multi-item case.

5. **User input ambiguity.** When user input is ambiguous (multiple cities with the same name, similar venues with the same title), the system must disambiguate visibly — secondary text in dropdowns, place_id capture for unambiguous reference, structured data not collapsed strings.

### The discipline applied to new feature work

Before building on top of a foundational seam, verify it works correctly under realistic conditions. Examples:

- Before building Events tab on top of trip.destinationCity, verify trip creation captures specific cities (not country names alone)
- Before building proximity badges on top of ItineraryItem coordinates, verify coordinate validation isn't returning placeholder geocodes
- Before building Recommendations on top of LODGING items, verify the lodging anchor selection handles multi-city trips deterministically

If verification reveals foundation gaps, fix the foundation before continuing the feature build. The cost of building on broken foundation compounds; the cost of pausing to fix foundation is bounded.

### Canonical examples (Chat 40, locked)

**Autocomplete duplicates pattern (commits 5b13ba1, 5aafb21).** The `/api/destinations/lookup` endpoint had two compounding bugs that surfaced as 5+ identical "Portland · USA" entries in every place-input dropdown across 8 consuming surfaces (trip creation, Discover search, Travel Intel, lodging entry, etc.). Bug 1: `types` parameter set to `locality|administrative_area_level_3|administrative_area_level_2|administrative_area_level_1` requested the same place at four admin levels, producing duplicates by construction. Bug 2: `countryName` extracted from `terms[last].value` returned abbreviated forms ("USA" not "United States"), masking a latent bug in international sort logic that compared against the full string. Bug 3 (rendering): even after the API fix, the dropdown rendering template displayed only `cityName · countryName`, dropping the correctly-populated `region` field — five distinct Portlands (OR, ME, TX, etc.) still appeared identical. Required two commits to fully resolve. Verification gap: API fix shipped without verifying the user-visible result. Lesson: the foundational verification test isn't "tests pass" — it's "what does a user actually see?"

**Cardinality `.find()` pattern (commit f47f212).** `trip.itineraryItems.find(i => i.type === "LODGING")` returns whichever lodging Prisma orders first. Multi-lodging trips silently picked the wrong anchor; downstream Recommendations referenced the wrong city. Fixed via destinationCity-token-match + longest-stay tiebreak. Pattern likely exists at other callsites; codebase audit queued.

**Implicit cascade pattern (diagnosed Chat 40, fix queued).** `ItineraryItem.tripId` FK defaulted to ON DELETE SET NULL rather than explicit CASCADE. Trip deletion silently creates orphan ItineraryItems with `tripId = null`, surfacing as home-screen "Unassigned bookings." Affects every production user who has ever deleted a trip. Migration to ALTER FK to CASCADE + sweep existing orphans is in backlog.

These three examples represent the class. New code should not exhibit these patterns. Existing code exhibiting these patterns is technical debt to be addressed.

**Mocked-contract-mismatch pattern (TheSportsDB adapter, Chat 40, commit 60b1c73).** Unit tests for the TheSportsDB adapter passed against mocked responses. The mocks returned what the test author assumed `searchteams.php?t={city}` would return — teams in that city. The live API returns teams whose registered names equal the query string. `searchteams.php?t=Chicago` returns 0 results because no team is literally named "Chicago"; the Cubs require `t=Chicago Cubs`. The adapter was never verified against live data before declaring the integration working. Events tab shipped to production; every user saw empty state for every trip. Mitigation: any third-party API integration ships only after live-API verification against realistic queries, not just mock-based test pass.

### The user-perception lens

When evaluating whether a feature is "complete," ask: "Would a typical user reasonably perceive this as broken?" If yes, the feature is not complete regardless of which tests pass. Empty states, misrouted data, ambiguous selections, and silent data loss all create perception of broken-ness regardless of whether the code paths are technically correct.

A feature is done when:
1. Tests pass (necessary)
2. TypeScript compiles cleanly (necessary)
3. Realistic user behavior produces sensible results (necessary)
4. Failure modes degrade gracefully (empty states are honest, errors recoverable, ambiguity disambiguated)
5. The feature would not be perceived as broken by a typical user

Perceived-broken is real-broken from a product perspective.

*Established Chat 40, April 28 2026, after three compounding foundation bugs were diagnosed in a single session: autocomplete endpoint returning duplicates across 8 consuming surfaces, cardinality .find() picking the wrong lodging anchor on multi-city trips, and a cascade-delete FK defaulting to SET NULL and creating orphan ItineraryItems.*

---

## 4.8 — Place Resolution

Geocoding uses Google Places text search for lat/lng. Reverse geocode used for city
derivation from coordinates. Place resolution is foundational to every entity that
renders on a map or carries an address.

*Established as foundational discipline; no specific triggering incident.*

---

## 4.9 — URL Extraction

The `resolveSaveLink()` priority chain governs URL surfacing across entities.
`stripTrackingParams()` removes utm/fbclid/gclid. ItineraryItem uses `managementUrl` not
`venueUrl` because `venueUrl` was 0% populated until Discipline 4.18's write-time fix.
The chain by entity type is documented in FLOKK_FOUNDATIONS.md Section 5.

*Established to address URL surface drift across entity types.*

---

## 4.10 — Universal Edit

Every fix is universal across all users, all trips, all days. No hardcoded IDs.
Backfill scripts required when adding fields to existing data.

Before writing any fix, answer:
1. What is the root cause in the shared component or API route?
2. Will this fix apply automatically to ALL users, ALL trips, ALL days?
3. Does existing data need a backfill to match the new behavior?

If the answer to question 2 is "no" or "maybe" — stop. Do not ship the fix. Redesign it
until it is universal.

Never fix a symptom on one trip when the root cause lives in a shared component that
affects all trips. Never hardcode trip IDs, user IDs, day numbers, or destination names
in application logic. Never ship a fix without asking: "What happens to existing data?"

Examples of wrong thinking:
- "This fixes Day 1 on the Seoul trip" — WRONG
- "This works for the Greene family profile" — WRONG
- "We can clean up the other trips later" — WRONG

Examples of right thinking:
- "This fixes TripMap.tsx so all trips on all days work correctly"
- "This fixes /api/saves/route.ts so all users see correct data"
- "The backfill updates all existing records to match"

*Established after repeated trip-specific patches that left other trips broken. Merged
with the former 4.32 (Every Fix Must Be Universal) in Chat 43 to consolidate the universal-fix
discipline into a single rule.*

---

## 4.11 — Trip Lifecycle

Trip status is `PLANNING | ACTIVE | COMPLETED`. Trip-level completion does NOT cascade to
item status. Items carry their own entity status independently per Discipline 4.6.

*Established after assumption that trip completion would auto-mark items; surfaced when a
completed Seoul trip showed unrated activities still as "saved."*

---

## 4.12 — Multi-User Trip Collaboration

Every trip has a `TripCollaborator` row with `role: OWNER | EDITOR | VIEWER` and `acceptedAt`.
Trip creation is always atomic via `$transaction` creating both Trip and OWNER TripCollaborator
together. Eight callsites audited and patched in Chat 41.

Multi-collaborator read auth follows the explicit TripCollaborator model — no implicit "anyone
with the trip ID can read." Share view is the explicit public path with its own token; everything
else is authenticated against TripCollaborator.

*Established Chat 41 after multi-user diagnostic; non-atomic creation left orphan trips with no
owner row.*

---

## 4.13 — UX Trace Verification

Every entity type must be verified live in browser before commit. Perceived-broken is
real-broken from a product perspective. TypeScript-clean fixes that still render broken UI
are not done.

Verification step in any commit-bound prompt must include: "open the affected UI surface
and confirm the rendered behavior matches expectation" — not just "confirm the change
compiled."

*Established after multiple "build succeeded but feature broken" cycles.*

---

## 4.14 — Comprehensive Spec Grounding

Every product spec grounds in FLOKK_FOUNDATIONS.md. Schema column names taken from live DB
queries, not memory. Image and URL chains verified via actual Supabase row data. Naming
gotchas (`orderIndex` not `stopOrder`, `website` not `websiteUrl` on ManualActivity, `lat/lng`
on ManualActivity vs `latitude/longitude` on ItineraryItem) are tracked in foundations because
memory has failed on them.

*Established Chat 41 after repeated bugs from assumed schema.*

---

## 4.15 — Universal Consumer Audit

Before claiming a field is "missing," "absent," or "not populated," audit every consumer
across the full system: schema column, write paths (parser, manual entry, enrichment),
API routes (read and write), UI render contexts (card, modal, share view), AI prompt context,
geocoding pipelines, backfill scripts, and any cron or background job. A field that appears
empty on one read path with presence on another is surface drift, not missing data.

This discipline applies to chat-side prompt drafting as well as Claude Code execution.
Chat-side prompts that propose defensive layers (validators, filters, normalizers) must
include a live data audit step in the prompt before any code change is specified. The audit
must run against actual production data shapes, not assumed shapes.

*Established Chat 42 after the URL validator regression of commit 8d39632, reverted in
9c21630. The validator rejected URLs without explicit http:// scheme; production data
contained many legitimate URLs without scheme prefix; the validator silently nulled them
across 7 render sites until reverted.*

---

## 4.16 — Proactive Strategic Surface

Every fix, diagnostic, or feature completion ends with an explicit "What I'm watching"
section answering seven questions:

1. UNIVERSALITY — Does this apply to every user, trip, entity, or only the bellwether case?
2. SURFACE DRIFT — What other surfaces consume this same field/entity/behavior? Are any
   still broken? Could any break later because of this change?
3. NULL AND EDGE CASES — What happens when input is null, empty string, very long,
   multi-locale, missing a related row, or stale-cached?
4. FORWARD CHAIN — Does this change correctly feed downstream features (tours, recommendations,
   trip intelligence, sharing, mobile)? Does it enable or block any roadmap item?
5. BACKWARD CHAIN — Is any existing production data now inconsistent with this fix? Backfill
   needed? How many rows?
6. END-STATE ALIGNMENT — Does this move toward the Flokk vision (Save Anywhere / Use Here,
   family-tailored intelligence, mobile-transferable architecture, every user action feeds
   every other) or away from it?
7. WATCH LIST — What should be monitored after this ships that was not a concern before?

If nothing is visible, write "Nothing surfaced." Do not omit the section.

Reactive fixing is the floor; strategic partnership requires surfacing gaps without being
asked. Applies equally to Claude Code execution and chat-side strategic work; neither defers
to the other.

*Established Chat 42 after chat thread time lost to gaps that should have been surfaced one
or two iterations earlier.*

---

## 4.17 — Proactive AI Surface

AI is Flokk's connective tissue, not a feature. Every save, rating, booking, and completed
trip is structured signal that should feed every other part of the system. The mandate is
not to add AI features as separate products — it is to identify where AI can enhance, move,
inspire, or fill what is otherwise empty across every surface.

Every fix completion adds an "AI surface" subsection to the "What I'm watching" section,
answering at minimum:

1. ENRICHMENT GAPS — What fields on this entity are null, weak, or generic that AI could
   populate? (cuisine, price tier, duration, dietary tags, editorial description, address
   cleanup, geocoding fallback, ticket-required detection, family-fit summary)
2. SIGNAL CAPTURE — Does this work capture user signal that should feed downstream AI
   features? (ratings → Best Of rankings; saves → behavioral profile; completed trips →
   Community Spots; manual edits → preference inference)
3. CONNECTIVE TISSUE — Does this entity contribute to or consume from the collective
   ecosystem? (one family's rated activities improving another's recommendations; one
   family's completed itinerary seeding another's tour generator)
4. FAMILY-TAILORED CONTENT — Where is generic content shipping that could be tailored to
   the specific family's preferences, ages, dietary needs, pace, accessibility?
5. PROACTIVE SUGGESTION — Where could the system surface a useful suggestion the user
   hasn't asked for? (suggested trip name from saved content, suggested activity from
   nearby unrated saves, suggested booking based on past family preferences)
6. INSPIRATION GAP — Is there an empty state or weak surface where AI-generated content
   would inspire vs deflate? (a save with no description, a tour with no narrative, a
   trip with no cover image, a recommendation with generic copy)

### Categories of AI work in Flokk

A. EXTRACTION — pulling structured data from unstructured sources (booking emails, Instagram
   posts, TikTok captions, Google Maps URLs, screenshots)
B. ENRICHMENT — filling gaps on existing entities (descriptions, cuisine, price, duration,
   dietary tags, family-fit notes, photos, geocoding)
C. GENERATION — creating new content (tours, recommendations, schedule intelligence, trip
   summaries, share previews, editorial blurbs)
D. INFERENCE — deriving meaning from behavior (preference profile from saves, family pace
   from completed trips, dietary patterns from ratings)
E. AGGREGATION — synthesizing across users (Best Of rankings, Community Spots, popular
   widgets, family-weighted scores)
F. CURATION — choosing what to surface and when (push timing, recommendation ordering,
   discover content selection)

List opportunities by category (A-F) with one-line descriptions and the relevant
entity/surface. If nothing is visible, write "No AI surface visible." Do not omit.

*Established Chat 42 — without explicit AI surfacing at every turn, the platform ships as a
passive saver of user content rather than an active intelligence layer.*

---

## 4.18 — Pre-Resolved Field Principle

Every renderable field is a column on the entity's own row. Write-time resolution. Render
code reads `entity.field` directly. When a field is missing, fix the write path, not the
render. Render-layer priority chains and sister-record traversals are forbidden as primary
resolution paths.

The principle holds across:
- Three render surfaces: card, modal, share view
- Three platforms: web app, mobile web, native mobile (when shipped)
- Two consumer classes: render code (React, native), AI prompt context (recommendations,
  Schedule Intelligence)

When a field renders inconsistently, the bug is at the write path. Render fixes are temporary
scaffolding during migrations.

*Established Chat 43, May 1 2026. Triggering case: Greene Okinawa LODGING and tour cards
rendering blank while parallel SavedItems carried full enrichment.*

---

## 4.19 — Map Rules

The map rendering pipeline uses TWO COMPLETELY SEPARATE ARRAYS at all times. Conflating
them is a recurring failure mode and must not happen.

- `pinsToRender` — passes `isValidCoord` only. Used for marker JSX rendering.
- `pinsForBounds` — passes `isValidCoord` AND `isWithinTripRadius`. Used for `fitBounds` only.

Never apply the proximity filter to `pinsToRender`. Never apply only `isValidCoord` to
`pinsForBounds`. These must always be separate arrays.

`isValidCoord` rejects null, zero, and out-of-range values. `isWithinTripRadius` rejects
coordinates more than 300 km from the trip anchor.

Anchor resolution: `trip.accommodation_lat/lng` → fuzzy CITY_CENTERS match → Seoul default.
City key match is case-insensitive includes-scan, never exact match. The Seoul fallback is a
known limitation pending the Trip.anchorLat/anchorLng workstream that will replace
CITY_CENTERS via 4.18 (Pre-Resolved Field Principle).

`flyToDay` must use `getDayAnchor` (centroid of day items), not the trip anchor. Day
proximity radius is 100 km. Trip proximity radius is 300 km.

Transit cards render only when both adjacent items pass `isValidCoord` AND haversine
distance between them is ≤ 50 km. For TRAIN/FLIGHT items, use `arrivalLat/arrivalLng`
(not departure) as the FROM point in transit calculations.

*Established as a standing rule after repeated map regressions from conflating the two
arrays. Codified with all-caps "DO NOT GET WRONG AGAIN" language in CLAUDE.md before being
formalized as Discipline 4.19 in Chat 43.*

---

## 4.20 — Itinerary Sort Weights

The day-view itinerary sort uses these fixed weights:

- Arrival flights: 10
- Check-in: 20
- Activities: 50
- Trains: 70
- Check-out: 80
- Departure flights: 90

Sort weights are operational law because day-view ordering is user-visible and any drift
produces apparent bugs. New entity types added to the day view get explicit weights chosen
deliberately, not via implicit ordering.

*Established as foundational sort logic; codified as Discipline 4.20 in Chat 43 to prevent
silent drift.*

---

## 4.21 — Email Extraction Rules

For activity and tour bookings, extract `activityTitle` (the specific tour name), never
the platform name (GetYourGuide, Viator, Klook) or the operator name. If `activityTitle`
is null, use the cleaned email subject. Never accept platform name as title.

This rule applies to every activity-extraction code path: email parsing, manual entry
disambiguation, AI-extracted activity surfacing.

*Established after GetYourGuide bookings rendered with the platform name as title. Codified
as Discipline 4.21 in Chat 43.*

---

## 4.22 — Instagram Description Cleaning

Always apply `cleanDisplayDescription()` before rendering descriptions extracted from
Instagram or any other source where raw caption text may include HTML entities, excessive
whitespace, or hashtag-only content.

Use `[\s\S]*?` not `.*` with the `s` flag (ES2017 compatibility).

Apply in: `SaveDetailModal`, `SaveCard` subtitle, `TripTabContent` day cards, and any
future surface that renders user-or-source-provided descriptions.

*Established after raw Instagram caption rendering with HTML entities and excessive whitespace.
Codified as Discipline 4.22 in Chat 43.*

---

## 4.23 — Trade-off Transparency

For any non-trivial decision (library choice, API parameter, schema relationship, default
behavior), surface the trade-off explicitly:

- What was chosen
- What alternatives were considered
- What is accepted as the cost of the choice
- What is the failure mode if the assumption is wrong

Defaults are decisions. Implicit defaults that are not acknowledged become latent bugs.

*Established after silent default choices that surfaced as bugs later when assumptions failed.
Codified as Discipline 4.23 in Chat 43.*

---

## 4.24 — Cardinality Awareness

Before using `.find()`, `[0]`, or any "pick first" operator on a collection, verify:

- Is the collection guaranteed to have exactly one item?
- If multiple items can exist, is ordering deterministic?
- Is there a contextual filter that narrows to the right item?

If none apply, either fix the cardinality assumption or document multi-item handling
explicitly.

*Established after repeated bugs where multi-row data was treated as single-row. The
canonical case (multi-lodging trips with `.find(i => i.type === "LODGING")` picking the
wrong anchor) is documented in Discipline 4.7. Codified as Discipline 4.24 in Chat 43.*

---

## 4.25 — Schema Relationship Explicitness

Foreign key relationships ship with explicit `onDelete` behavior:

- `onDelete: Cascade` — child records deleted with parent
- `onDelete: SetNull` — child records orphaned, become unassigned
- `onDelete: Restrict` — parent deletion blocked while children exist

Choose deliberately. The default may not match user expectations. Surface the choice in
the response.

*Established after data anomalies from accepting Prisma defaults without consideration.
The canonical case (ItineraryItem.tripId defaulting to SET NULL, creating orphan items
when trips were deleted) is documented in Discipline 4.7. Codified as Discipline 4.25 in
Chat 43.*

---

## 4.26 — External API Integration Discipline

Third-party API calls (Google Places, geocoding, payment, auth, mapping) ship with
documented configuration:

- All required parameters explicitly set (types, components, fields, languages, etc.)
- Response field selection rationale (description vs structured_formatting, terms vs
  address_components, etc.)
- Failure mode handling (graceful degradation, error surface, rate limit awareness)
- Cost and quota implications

Library defaults are not accepted without checking what they imply.

*Established after repeated bugs from accepting Google Places defaults that didn't match
Flokk's needs. Codified as Discipline 4.26 in Chat 43. Compounds with 4.30 (Live API
Verification), which enforces verification of assumed behavior against live API responses.*

---

## 4.27 — Shared Component and Shared API Verification

Components or endpoints used across multiple callsites are tested against ALL consuming
surfaces. A regression in one is a regression in all. Before changing shared infrastructure,
identify all callsites and verify the change works across all of them.

When fixing a shared component, the fix is not complete until verified on every consuming
surface. "API fixed" without "UI updated" leaves the user-visible bug intact.

*Established after shared component fixes that broke other consumers silently. The canonical
case (autocomplete endpoint with eight consuming surfaces) is documented in Discipline 4.7.
Codified as Discipline 4.27 in Chat 43.*

---

## 4.28 — User-Perception Lens

A feature is not done when tests pass. It is done when:

1. Tests pass (necessary)
2. TypeScript compiles cleanly (necessary)
3. Realistic user behavior produces sensible results (necessary)
4. Failure modes degrade gracefully (empty states are honest, errors recoverable)
5. The feature would not be perceived as broken by a typical user

Perceived-broken is real-broken from a product perspective. If a user sees five identical
dropdown entries, they perceive the platform as broken regardless of whether the underlying
API now returns differentiated data — until the rendering also displays the differentiation.

*Established after features that passed tests but rendered broken to users. Codified as
Discipline 4.28 in Chat 43. Discipline 4.7 (Foundation-First Verification) carries the same
five conditions in its body as illustrative examples; this discipline elevates them to a
procedural checklist that ends every prompt.*

---

## 4.29 — Push Back When Foundation Is Shaky

If a request would build on top of a foundation that has not been verified, push back before
building. If a request would ship a feature that fails the user-perception test (4.28), push
back before building. If a request is ambiguous in a way that would let multiple wrong outcomes
pass tests, push back before building.

Diligence over speed when the trade-off matters. Matt has explicitly named the partnership
behavior of flagging implicit defaults, surfacing trade-offs proactively, and pausing for
foundation verification before adding more layers.

This discipline applies to chat-side Claude (strategic partner) and Claude Code (execution
agent) equally. Neither defers to the other.

*Established as explicit partnership behavior; codified after rushed builds revealed
foundation gaps. Codified as Discipline 4.29 in Chat 43.*

---

## 4.30 — Live API Verification

Unit tests with mocks verify assumptions about an API; they do not verify the API.

For any third-party integration:

1. Before writing the adapter, hit the live API once with realistic queries. Document the
   actual response shape and behavior.
2. Build the adapter against the documented live behavior, not assumed behavior.
3. Run verification against the live API before declaring the integration "working" — mocked
   tests passing is necessary but not sufficient.
4. If the adapter has known coverage gaps (free tier limitations, regional gaps, time-window
   limits), document them explicitly in code comments AND in the spec at integration time,
   not after a user reports the gap.

This discipline compounds with 4.7 (Foundation-First): the adapter is a foundation for the
features built on top, and verifying a foundation requires verifying against reality, not
against an assumed model of reality.

*Established Chat 40 after the TheSportsDB regression: the live `searchteams.php?t=Chicago`
returns 0 results because it searches by team name, not city; tests mocked it returning
Chicago Cubs. The adapter shipped, Events tab went live, every user saw empty state. The fix
was hiding the tab until a verified adapter ships. Codified as Discipline 4.30 in Chat 43.*

---

## 4.31 — Prompt Writing Standard (Exact Code Required)

Every prompt to Claude Code includes exact code, not descriptions. Required:

1. Exact function signatures with TypeScript types
2. Exact JSX blocks including className strings
3. Exact variable names matching what grep shows in the file
4. Exact condition logic — not "check if valid" but the actual `if` statement
5. Exact API call with method, headers, body shape
6. Exact Prisma `select` fields if DB is touched
7. Exact git commit message

NEVER write:
- "Add a check for valid coordinates" → write the exact `if` statement
- "Update the transit card logic" → write the exact JSX replacement
- "Make sure the type includes X" → write the exact type definition
- "Apply the function at the render point" → show the exact line to replace

If the existing code must be shown first (always), the prompt must say:
"Show lines X-Y of [filename] before making any changes" or "Show the output of:
grep -n [pattern] [file]". Claude Code must confirm the grep output matches expectations
before writing a single line of new code.

This discipline applies to every prompt without exception.

*Established after drift from descriptive prompts produced repeated prompt-vs-implementation
mismatches. Codified as Discipline 4.31 in Chat 43.*

---

## 4.32 — RESERVED

This number was originally drafted as "Every Fix Must Be Universal" before being merged into
4.10 (Universal Edit) during Chat 43 reorganization. The merger consolidated two overlapping
universal-fix disciplines into a single rule. Number 4.32 is reserved to preserve numbering
integrity; do not reassign.

---

## 4.33 — Never Guess — Diagnose First

This rule applies to every prompt without exception.

NEVER write a fix based on assumed code structure.
NEVER write a fix based on what a previous prompt claimed to change.
NEVER assume a previous fix landed correctly.
ALWAYS grep the actual current code before writing any fix.
ALWAYS show the exact lines being changed before changing them.
ALWAYS verify the fix landed by grepping again after the commit.

The pattern for every fix:

1. grep to find exact file and line
2. Show the exact current code (not what you think it says)
3. Show the exact replacement code
4. Apply the change
5. grep again to confirm the new code is in place
6. Commit and push

If the grep output does not match what you expect, STOP. Do not proceed. Report what you
found and ask for direction.

A fix that cannot be verified by grep output is not a fix. It is a guess. Guesses are not
acceptable.

*Established cumulatively after repeated assumption-driven regressions. Codified as
Discipline 4.33 in Chat 43.*

---

## 4.34 — Surgical Revert First

For ambiguous regressions where the cause is unclear and patching forward would risk
compounding the issue, revert is the first response and patch-forward is the second.

Surgical revert means tightly scoped — preserve wins from a partially-bad commit, restore
the regressed surface only. Reverts are cheaper than patch-forward when the regression is
reversible cheaply and no persisted data is corrupted.

If a bad commit had written transformed data to the database, revert becomes more expensive
and proportionally more careful. The default is still revert-first when uncertain;
patch-forward is reserved for cases where the cause is fully understood and the fix is
narrow.

*Established Chat 42 after the URL validator regression: commit 8d39632 bundled three fixes,
one of which (a strict-scheme URL validator) silently nulled legitimate URLs across seven
render sites. Reverted in commit 9c21630, preserving the Edinburgh/Athens/etc. coords additions
and SQL backfill while removing the validator. The revert took less than 60 minutes; a
patch-forward would have required redesigning the validator while users continued seeing
broken URLs. Codified as Discipline 4.34 in Chat 43.*
