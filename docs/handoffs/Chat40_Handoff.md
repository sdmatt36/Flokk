# Flokk Chat 40 Handoff
**Session: April 28, 2026**
**Total commits: ~36 across four feature arcs + one foundational fix arc + evening rollback**

---

## Executive Summary

Heavy session. Four major arcs completed and one foundational bug saga resolved end-to-end:

- **Workstream 1A.5**: Trip-Aware Multi-Segment Recommendations — rebuild from single-anchor to per-segment Haiku with rich context extraction. Verified working on Greene Seoul-Busan and Okinawa trips.
- **Workstream 1B Phase A**: Local Events tab — code complete, then rolled back. TheSportsDB adapter built end-to-end (adapter, UI, save flow, EventSavedCard) but live API diagnostic revealed fundamental mismatch: `searchteams.php?t={city}` is team-name search, not city-location search — returns 0 results for every major US market. Tab hidden via `SHOW_EVENTS_TAB = false` flag; code preserved. Phase B requires new adapter design.
- **Status Rule completion** (Phase A, B, C): SavesScreen, Trip Saved tab, Recommendations, Discover Spots all migrated to shared `entity-status.ts` helper.
- **URL Rule revert and tightening**: P3 Google search fallback built and reverted (search URL behind "Visit website" is worse UX than no button). Rule tightened: resolver returns string | null only.
- **Foundational autocomplete fix** (commits 5b13ba1, 5aafb21): Three compounding bugs (API types parameter, country name abbreviation, rendering dropped region field) resolved across 8 consuming surfaces.

Four foundation findings surfaced and documented. Operating Discipline #7 (Foundation-First Verification) + Live API Verification principle added. CLAUDE.md updated with 9 agent operating principles. Mocked-contract-mismatch pattern named and canonicalized.

---

## Commits Shipped (Chronological by Arc)

### Workstream 1A.5 — Multi-Segment Recommendations

| Hash | Summary |
|------|---------|
| f47f212 | feat: rich trip context extraction with segment derivation (deriveSegments, allocateRecCounts, assignActivityToSegment) |
| 235101x | feat: multi-segment Haiku prompt with rich context, taste-pattern inference framing, segmentCity in response |
| 2d98920 | feat: per-rec segment-aware proximity badges, activities scoped to segment |
| 9049f5a | fix: lodging anchor selection (destinationCity-token-match + longest-stay tiebreak) + activity-proximity placeholder coord filtering |

### Workstream 1B Phase A — Local Events Tab

| Hash | Summary |
|------|---------|
| be48bea | feat: TheSportsDB adapter — Phase A sports-only |
| 34f9f61 | feat: /api/events endpoint with multi-segment orchestration, kid-friendly filter, Haiku enrichment of top 8 |
| d61f786 | feat: Events tab UI — segment grouping, headline, progressive loading, honest empty state |
| 07e57de | feat: server-side ticket URL generation (SeatGeek search for sports, Google fallback for others) |
| de05003 | feat: Save Event schema extension + POST /api/events/save endpoint |
| 386cf4f | feat: Save Event handler + Saved tab EventSavedCard rendering |
| fe92753 | fix: replace broken lookup_all_teams chain with searchteams city discovery |

### Status Rule — Phase A, B, C Completion

| Hash | Summary |
|------|---------|
| 18f4165 | feat: entity-status.ts + EntityStatusPill + SavesScreen Phase A migration |
| 16f2ffc | feat: Trip Saved tab Phase B migration — SavedHorizCard/SavedGridCard, hasBooking/hasItineraryLink |
| (various) | feat: Phase C — save-status-map.ts, Recommendations + Discover Spots status display |

### URL Rule Revert + Tightening

| Hash | Summary |
|------|---------|
| (revert) | revert: P3 Google search fallback removed — search URL behind "Visit website" is worse UX than no button |

### Foundation — Autocomplete Fix

| Hash | Summary |
|------|---------|
| 5b13ba1 | fix: destination autocomplete — cities-only type + full country name from address_components |
| 5aafb21 | fix: destination autocomplete dropdown — render region in suggestion display when populated |

### Documentation

| Hash | Summary |
|------|---------|
| 99718bc | spec: foundation-first operating discipline — codifies Chat 40 findings |
| bef2ceb | docs: CLAUDE.md operating principles — foundation-first, trade-off transparency, cardinality awareness, user-perception lens |

### Evening Rollback — Events Tab + Foundation Finding #4

| Hash | Summary |
|------|---------|
| 60b1c73 | fix: hide Events tab — SHOW_EVENTS_TAB = false, TheSportsDB live API returns 0 for all US cities |
| f7c6af5 | spec: Events Phase A status correction + mocked-contract-mismatch as canonical example |
| a2f86b5 | docs: CLAUDE.md live API verification principle — TheSportsDB incident as named example |

---

## Workstream 1A.5: Trip-Aware Multi-Segment Recommendations

### What changed

Rebuilt Recommendations from single-anchor (trip.destinationCity) to per-segment architecture. Every recommendation is now scoped to its segment's city and lodging anchor.

**deriveSegments**: Pairs LODGING check-in/check-out rows by stripped name, computes dayStart/dayEnd span, derives city via toCity → same-day transit toCity → comma-parse → last word. Hamilton method (`allocateRecCounts`) distributes rec quota across segments (e.g. Seoul-Busan trip → 8 Seoul + 4 Busan).

**Haiku prompt rewrite**: Rich trip context now includes all segments with lodging, dates, nights, rec allocation; transit items with cities; planned activities per segment; saved items grouped by city; family profile with child ages, pace, travelStyle, interests, dietary, mobility, homeCountry; loved places (top 8 of N) and broader save history. Taste-pattern instruction: past loved places are TASTE SIGNALS not menu items. Haiku infers preference patterns (walkable urban, food markets, family-scale energy) and applies them to each segment city.

**Per-rec proximity**: Each recommendation scoped to its segment's lodging anchor (not global trip anchor). Catches the Seoul-Busan case where Busan recs were being proximity-tested against Seoul lodging.

### Bellwethers verified

- Greene Seoul-Busan: ~8 Seoul recs + ~4 Busan recs, correct segment scoping
- Greene Okinawa: ~3 Naha + ~9 Onna, correct segment derivation from transit (HND→OKA) and hotel name parsing
- User confirmed: "all worked great"

---

## Workstream 1B Phase A: Local Events Tab

### Architecture

Multi-provider, single interface. `RawEvent` abstraction lets providers be swapped without changing downstream code. `affiliateProvider` field reserved for future SeatGeek/StubHub affiliate wiring.

**Phase A active provider**: TheSportsDB (free tier). Searches teams by city name (`searchteams.php?t={city}`), then fetches upcoming events per team (`eventsnext.php?id={teamId}`). Filters by `SPORTS_FILTER` set (Soccer, Baseball, Basketball, Ice Hockey, Cricket, Rugby). Parallel team lookups with post-hoc dedup by `idEvent`.

**Phase A coverage gap (original assessment — incorrect)**: Pre-rollback assumption was that US/EU cities worked and only Asian sponsor-named teams failed. This was based on mocked tests, not live API behavior.

### What shipped

- `/api/events` route: multi-segment orchestration, kid-friendly implicit filter (when children under 14 in profile), Haiku enrichment of top 8 with `whyThisFamily` reasoning
- `src/lib/events/ticket-urls.ts`: SeatGeek search slug for sports, Google search fallback for others — ensures every event card has a "View tickets" affordance even before affiliate wiring
- SavedItem schema extension: 6 new nullable fields (eventDateTime, eventVenue, eventCategory, eventTicketUrl, eventSourceProvider, eventSourceEventId) + composite index
- `POST /api/events/save`: auth → resolveProfileId → trip ownership verify → dedup by eventSourceProvider+eventSourceEventId → create SavedItem
- Events tab UI: segment-grouped by `segmentCity`, section headers suppressed for single-segment trips, progressive loading states ("initial" → "checking" → "almost"), honest empty state for Asian cities
- EventCardItem: `+ Save` → `Saving...` → `✓ Saved` transitions, fires `flokk:refresh`
- EventSavedCard: renders in Saved tab when `categoryTags.includes("event")`, 16:9 image header, date badge, venue, category pill, "View tickets →"

### Tests

5 TheSportsDB adapter tests (all passing against mocks). 5 ticket-url tests (all passing). 103 total suite passing.

**Tests passed, feature broken.** All adapter tests mocked `searchteams.php` to return a team when queried by city name. The live API does not behave this way. This is the mocked-contract-mismatch pattern — tests verify assumptions about the API, not actual API behavior. See Foundation Finding #4.

---

## Workstream 1B Phase A: Status Correction (April 28 evening)

### What was discovered

San Diego August trip returned empty Events tab in production. Live diagnostic against TheSportsDB free tier revealed two fundamental mismatches vs. mocked assumptions:

1. **`searchteams.php?t={city}` is a team-name search, not a city search.** `t=Chicago` → 0 results. `t=San Diego` → 2 defunct teams (San Diego Chargers, San Diego Padres — both relocated/renamed). `t=New York` → 0. `t=Los Angeles` → 0. The endpoint name `searchteams` means search for teams by name, not teams in a city.

2. **`eventsnext.php` returns only 1-2 near-term events.** No date-range parameter supported on free tier. A trip three weeks out would find nothing even if team discovery worked.

Every Events tab in production was showing empty state for every user and every trip since Phase A shipped.

### What was rolled back

`SHOW_EVENTS_TAB = false` constant added to `TripTabContent.tsx` at line 157 (commit 60b1c73). Tab hidden from all users. Code intact — adapter, UI, save flow, EventSavedCard all remain in the file. Re-enable in one line when Phase B ships a verified adapter.

### Honest accounting

Phase A shipped with tests passing but the core integration assumption was wrong. The adapter was designed around a city-search mental model that the TheSportsDB free tier does not support. The tests confirmed that the code correctly called the endpoint — they could not confirm that the endpoint returned useful results, because the test data was fabricated.

This is now canonical example #4 in Operating Discipline #7 (mocked-contract-mismatch).

---

## Foundation Findings

### 1. Autocomplete Bug — Fixed (commits 5b13ba1, 5aafb21)

**Root cause**: `/api/destinations/lookup` had three compounding bugs:
1. `types=locality|administrative_area_level_3|administrative_area_level_2|administrative_area_level_1` requested the same place at four admin levels → duplicates by construction
2. `countryName = terms[last].value` → returned "USA" not "United States", also breaking the international sort logic that compared against the full name
3. Dropdown rendering template `{cityName} · {countryName}` dropped the `region` field — five distinct Portlands (OR, ME, TX, etc.) all appeared identical even after API fix

**Fix**: (1) Changed to `types=(cities)`. (2) Extracted countryName from `address_components.country.long_name` in the existing Place Details call. (3) Updated all 6 dropdown consumers (10 render locations) to display `{cityName}, {region} · {countryName}` when region is populated.

**Scope**: 8 consuming surfaces — AddTripModal, trips/new, trips/past/new, discover/page (3 dropdowns), TravelIntelSection (2 dropdowns), SavesScreen (2 dropdowns).

**Verification gap lesson**: API fix shipped without verifying user-visible result. "Portland · United States" duplicates persisted because rendering wasn't updated in the same commit. The foundational verification test is not "tests pass" — it is "what does a user actually see?"

### 2. Cardinality `.find()` — Fixed in 1A.5, Audit Queued

`itineraryItems.find(i => i.type === "LODGING")` returns Prisma's non-deterministic first result. Multi-lodging trips silently got the wrong city anchor for Recommendations. Fixed via destinationCity-token-match + longest-stay tiebreak (commit f47f212).

Pattern likely exists at other callsites. Codebase audit for `.find()` and `[0]` over per-entity collections is queued as a Chat 41 task.

### 3. ItineraryItem Cascade-Delete — Diagnosed, Fix Queued

`ItineraryItem.tripId` FK uses `ON DELETE SET NULL` (Prisma default). Trip deletion leaves orphan ItineraryItems with `tripId = null`, which surface as "Unassigned bookings" on every user's home screen who has ever deleted a trip.

Diagnosed via two Chicago test items (`test_chicago_item_checkin`, `test_chicago_item_checkout`) found with `tripId = null`. Cleaned via direct SQL in this session. The structural migration (ALTER FK to CASCADE + prisma schema update + orphan sweep) is queued for Chat 41.

---

## Operating Discipline #7 Added

**Foundation-First Verification** — codified in `docs/FLOKK_PRODUCT_SPEC.md`. Covers five foundational seams (external APIs, schema relationships, shared components, cardinality, user input ambiguity), the discipline applied to new feature work, four canonical examples from Chat 40 (locked), and the user-perception lens.

Four canonical examples locked in spec:
1. Autocomplete types-parameter duplicates
2. Cardinality `.find()` wrong lodging anchor
3. ItineraryItem cascade-delete orphans
4. **Mocked-contract-mismatch** (TheSportsDB) — new, added evening rollback

---

## CLAUDE.md Updated

Nine agent operating principles added to repo CLAUDE.md across two commits:

**Commit bef2ceb** (8 principles):
- Foundation-first discipline
- Trade-off transparency
- Cardinality awareness
- Schema relationship explicitness
- External API integration discipline
- Shared component verification
- User-perception lens
- Push back when foundation is shaky

**Commit a2f86b5** (1 principle added):
- Live API verification — mocked tests verify assumptions, not the API. Third-party integrations require a live-API verification gate before shipping. TheSportsDB incident named as the canonical example.

---

## Process Lessons

**AI partnership calibration**: Three foundation bugs today (autocomplete defaults, cardinality `.find()`, cascade-delete) are all decisions that were never made — implicit defaults accepted as correctness. Going forward: more proactive trade-off framing at architectural seams. The operating disciplines now embedded in CLAUDE.md encode this expectation explicitly.

**Verification discipline**: The autocomplete saga required two commits because the first fix (API) was shipped without verifying the user-visible output (rendering). Foundation fix is not complete until the user-perception test passes, not just the code test.

**Mocked-contract-mismatch**: Tests that mock third-party API behavior verify code structure, not integration correctness. The TheSportsDB adapter had 10 passing tests and a broken production feature. Live API verification is now a required gate before any third-party integration ships.

---

## Chat 41 Strategic Queue (April 29)

### Morning block — Foundation fixes (structural, no design decisions)

**1. ItineraryItem cascade-delete migration**
`ItineraryItem.tripId` FK is `ON DELETE SET NULL`. Trip deletion leaves orphan rows surfacing as "Unassigned bookings" for every user who has deleted a trip. Fix: `ALTER TABLE "ItineraryItem" DROP CONSTRAINT [fk_name] ADD CONSTRAINT ... ON DELETE CASCADE` + Prisma schema update + sweep existing orphans.
- Structural fix, affects all users, no design decision required
- Two Chicago orphan items already cleaned via direct SQL this session

**2. Cardinality `.find()` audit**
Codebase-wide sweep for `.find()` and `[0]` over per-entity collections. The lodging anchor bug was fixed in 1A.5 but the pattern likely exists elsewhere. Output: backlog entries per callsite with severity. May include targeted fixes where root cause is clear.

### Mid-day block — Spots arc kickoff

**3. Spots arc — Phase 1 spec and skeleton**
The Discover Spots tab exists but is placeholder. This is the next major feature arc after foundation pass. Phase 1 scope: define the Spots data model (what is a Spot vs a Recommendation vs a Save?), design the community contribution flow (who creates Spots, how are they curated?), and sketch the UI pattern. Chat 41 goal: written spec, not code. No implementation until the data model is agreed.

Key questions to answer in spec:
- Is a Spot user-generated or editorially curated?
- Does a Spot have an owner (the user who created it) or is it community-owned?
- How does a Spot relate to a SavedItem? (Same entity? Different?)
- What is the Phase 1 MVP surface — Discover tab only, or also trip context?

### Afternoon block — Events Phase B (research only, no code)

**4. Events Phase B — adapter research**
TheSportsDB free tier is not usable. Before writing any code, answer:
- What does a city-aware sports event API look like at free/low-cost tier? (Ticketmaster Discovery API, SeatGeek Open API, PredictHQ)
- Is web-search-then-Haiku a viable fallback for event discovery? What would the prompt look like?
- What is the minimum viable adapter that could pass a live-API verification gate for a US city in active sports season?

Output: recommendation memo, no code. Phase B implementation is a separate session.

### Full backlog (not Chat 41)

- Recommendation detail modal (Workstream 2)
- Trip Intelligence email integration
- SeatGeek Open API affiliate wiring (after Phase B adapter decision)
- Mobile app scaffold (iOS share sheet — unlocks Instagram)
- Loops email sequences live
- Booking Portal
- Post-import verification flow (needsVerification flag)
- GetYourGuide title extraction
- Hydration error #418
- Default time for untimed saves

---

## Bellwethers Verified Clean This Session

- Greene Seoul-Busan Recommendations: segment-aware, correct city scoping
- Greene Okinawa Recommendations: segment-aware, correct city scoping
- Greene Seoul-Busan Events tab: empty state rendered correctly (tab now hidden for all users — Phase A rolled back)
- Autocomplete on trip creation: London disambiguation (London, England vs London, Ohio vs London, Ontario)
- Autocomplete on Discover: Portland disambiguation (Oregon / Maine / Texas etc.)

---

## Operating Disciplines (Full List as of Chat 40)

1. Conversation Capture Rule
2. Schema Change Completeness Rule
3. Spec Reading Discipline
4. Modal Pattern Discipline
5. Universal URL Rule
6. Universal Entity Status Rule
7. **Foundation-First Verification** (new, Chat 40) — includes Live API Verification as sub-principle (added evening rollback)

---

## Brand and Voice (Locked)

Flokk, navy #1B3A5C, terracotta #C4664A, Playfair Display + DM Sans, no emojis, Lucide icons only. No em dashes in product copy. Casual direct tone. Email signoff: "Matt and Jen, Co-Founders, Flokk". No rebranding discussions.
