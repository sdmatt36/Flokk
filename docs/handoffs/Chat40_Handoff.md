# Flokk Chat 40 Handoff
**Session: April 28, 2026**
**Total commits: ~33 across four feature arcs + one foundational fix arc**

---

## Executive Summary

Heavy session. Four major arcs completed and one foundational bug saga resolved end-to-end:

- **Workstream 1A.5**: Trip-Aware Multi-Segment Recommendations — rebuild from single-anchor to per-segment Haiku with rich context extraction. Verified working on Greene Seoul-Busan and Okinawa trips.
- **Workstream 1B Phase A**: Local Events tab — end-to-end build complete. TheSportsDB adapter, multi-provider architecture, Haiku enrichment, ticket URL generation, Save Event flow, EventSavedCard rendering.
- **Status Rule completion** (Phase A, B, C): SavesScreen, Trip Saved tab, Recommendations, Discover Spots all migrated to shared `entity-status.ts` helper.
- **URL Rule revert and tightening**: P3 Google search fallback built and reverted (search URL behind "Visit website" is worse UX than no button). Rule tightened: resolver returns string | null only.
- **Foundational autocomplete fix** (commits 5b13ba1, 5aafb21): Three compounding bugs (API types parameter, country name abbreviation, rendering dropped region field) resolved across 8 consuming surfaces.

Three foundation findings surfaced and documented. Operating Discipline #7 added to spec. CLAUDE.md updated with agent operating principles.

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

**Phase A coverage gap**: TheSportsDB free tier doesn't cover sponsor-named teams (Korean Lotte Giants → "Busan Giants" search fails; Japanese SoftBank Hawks → "Fukuoka Hawks" search fails). US and European sports cities work correctly. Phase B web-search-then-Haiku roadmap captured for global non-sports coverage.

### What shipped

- `/api/events` route: multi-segment orchestration, kid-friendly implicit filter (when children under 14 in profile), Haiku enrichment of top 8 with `whyThisFamily` reasoning
- `src/lib/events/ticket-urls.ts`: SeatGeek search slug for sports, Google search fallback for others — ensures every event card has a "View tickets" affordance even before affiliate wiring
- SavedItem schema extension: 6 new nullable fields (eventDateTime, eventVenue, eventCategory, eventTicketUrl, eventSourceProvider, eventSourceEventId) + composite index
- `POST /api/events/save`: auth → resolveProfileId → trip ownership verify → dedup by eventSourceProvider+eventSourceEventId → create SavedItem
- Events tab UI: segment-grouped by `segmentCity`, section headers suppressed for single-segment trips, progressive loading states ("initial" → "checking" → "almost"), honest empty state for Asian cities
- EventCardItem: `+ Save` → `Saving...` → `✓ Saved` transitions, fires `flokk:refresh`
- EventSavedCard: renders in Saved tab when `categoryTags.includes("event")`, 16:9 image header, date badge, venue, category pill, "View tickets →"

### Tests

5 TheSportsDB adapter tests (all passing). 5 ticket-url tests (all passing). 103 total suite passing.

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

**Foundation-First Verification** — codified in `docs/FLOKK_PRODUCT_SPEC.md`. Covers five foundational seams (external APIs, schema relationships, shared components, cardinality, user input ambiguity), the discipline applied to new feature work, three canonical examples from Chat 40 (locked), and the user-perception lens.

---

## CLAUDE.md Updated

Agent operating principles added to repo CLAUDE.md:
- Foundation-first discipline
- Trade-off transparency
- Cardinality awareness
- Schema relationship explicitness
- External API integration discipline
- Shared component verification
- User-perception lens
- Push back when foundation is shaky

---

## Process Lessons

**AI partnership calibration**: Three foundation bugs today (autocomplete defaults, cardinality `.find()`, cascade-delete) are all decisions that were never made — implicit defaults accepted as correctness. Going forward: more proactive trade-off framing at architectural seams. The operating disciplines now embedded in CLAUDE.md encode this expectation explicitly.

**Verification discipline**: The autocomplete saga required two commits because the first fix (API) was shipped without verifying the user-visible output (rendering). Foundation fix is not complete until the user-perception test passes, not just the code test.

---

## Chat 41 Queue (Priority Order)

1. **ItineraryItem cascade-delete migration**: `ALTER TABLE "ItineraryItem" DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE` + Prisma schema update + sweep existing orphans. Structural fix; not blocking but affects every user.

2. **Cardinality `.find()` audit**: Codebase-wide sweep for `.find()` and `[0]` over per-entity collections. Document or fix each. Output is backlog enrichment, may include targeted fixes.

3. **Foundation audit pass** (optional, hour-long): Broader sweep through schema, data flows, and shared components for other latent foundation issues. Goal is surfacing implicit defaults that should be explicit decisions.

4. **Save Event verification**: Real bellwether of 1B Phase A — needs a real US/EU sports trip with active season events to validate end-to-end (save → EventSavedCard → "View tickets" link).

5. **Phase B events (deferred until foundation pass complete)**: Web-search-then-Haiku for live_music/comedy_shows/seasonal_events/family_kids. Asian city sports coverage via `eventsday.php` league path for KBO/NPB/K-League.

**Defer until foundation pass complete:**
- Recommendation detail modal (Workstream 2)
- Trip Intelligence email integration
- SeatGeek Open API affiliate wiring

---

## Bellwethers Verified Clean This Session

- Greene Seoul-Busan Recommendations: segment-aware, correct city scoping
- Greene Okinawa Recommendations: segment-aware, correct city scoping
- Greene Seoul-Busan Events tab: empty state correctly framed (Korean sponsor-named teams Phase A gap acknowledged)
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
7. **Foundation-First Verification** (new, Chat 40)

---

## Brand and Voice (Locked)

Flokk, navy #1B3A5C, terracotta #C4664A, Playfair Display + DM Sans, no emojis, Lucide icons only. No em dashes in product copy. Casual direct tone. Email signoff: "Matt and Jen, Co-Founders, Flokk". No rebranding discussions.
