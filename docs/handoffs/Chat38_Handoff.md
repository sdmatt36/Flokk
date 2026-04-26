# Flokk Chat 38 Handoff
**Session: April 26, 2026 (4-hour build session)**
**Total commits: 32**

---

## Session Theme

Booking architecture overhaul + Tours quality + cross-cutting product principles. Three operating disciplines established. Multiple feature areas designed and partially built. Schema changes in three model areas (TourStop, ItineraryItem, TripIntelDismissal).

---

## What Shipped (Chronological)

### Booking Architecture (14 commits, morning)

| Hash | Summary |
|------|---------|
| a19a913 | docs: flight schema audit before booking + per-leg unification |
| 002a4f7 | feat: Phase 1 schema — FlightBooking model + backfill script (dry-run) |
| 2ddc0f1 | feat: Phase 1 apply — 18 FlightBookings backfilled, 7 duplicate Flights deleted |
| a37ee1b | feat: Phase 2A — email extractor writes FlightBooking + per-leg Flight, idempotent |
| f6c8580 | fix: Phase 2A.1 — remove obsolete pre-extraction dedup guard for flights |
| 6f55a8e | docs: comprehensive booking system audit before unified Vault rewrite |
| de02655 | feat: Phase Vault — unified synthesizer for Vault read path (FM-1/2/5/6/7 fixed) |
| 80d3f43 | feat: Phase Vault Multi-Leg — leg partitioning by trip date + booking-aware edit modal |
| ddaee6a | fix: Phase Vault Multi-Leg follow-up — remove ManualActivity from Vault scope |
| 06fad7f | fix: extractor hardening — per-leg flight numbers, airport hallucination guardrails |
| 1cdd656 | feat: Phase Multi-Trip Extraction — flight bookings populate all leg-related trips |
| 0abc026 | fix: Phase Multi-Trip refinement — require destination match (excludes Kamakura home base) |
| 7533c7d | fix: delete stale FLIGHT ItineraryItems before re-extraction + cleanup script |
| 6611988 | fix: day view polish — functional Remove on FLIGHT cards, suppress drive/walk between legs |
| c6495a5 | fix: day view polish II — suppress "From [location]" header before cross-destination flights |

### Tours Quality + tripId Flow + Cosmetic Polish

| Hash | Summary |
|------|---------|
| df299a6 | feat: tour quality — under-emission retry, walk retry noop fix, cluster diameter check, hotel anchoring |
| 23e3ce3 | feat: tours cosmetic polish — card redesign, entity decode, Link label, Trip Intel dot |
| f0c4ac0 | fix: add tours key to BookingIntelCard CATEGORY_LABEL map (build fix) |
| 7eb6b36 | fix: contextual button labels on Trip Intelligence cards (Book/Build/Link/View/Add by category) |
| 8395e20 | fix: tour tripId flow + library card matches saved item design + expand-in-place stops |
| b2a750e | feat: tour stop detail standards — ticketRequired field, why text, websiteUrl fallback, stop detail modal |
| f1aa816 | fix: stop detail modal scrollable + strip kid age parentheses from why descriptions |

### Trip Intelligence

| Hash | Summary |
|------|---------|
| e0012c9 | feat: actionType-based CTAs and dismiss UI in BookingIntelCard |
| e00b01d | fix: add actionType to IntelItem type and all route emissions (build fix) |
| b89ee2c | fix: add TripIntelDismissal model to schema (build fix) |

### Okinawa Repair + Lodging Attribution

| Hash | Summary |
|------|---------|
| 93316ed | fix: synthesizer dedup by confCode (universal) + Okinawa outbound repair + legacy audit script |
| e858d50 | fix: set dayIndex=0 on Okinawa outbound ItineraryItem + codify rule in audit script comment |
| b5c38f9 | feat: lodging source attribution — detect booking platform + surface manage URL (68 items backfilled) |

### Spec / Decisions Docs

| Hash | Summary |
|------|---------|
| 81ab833 | docs: Tours public surfacing, attribution, clone notifications, rating loop, decisions log |
| adf0251 | docs: operating disciplines + tour stop standards + Be Helpful + Family-Context + Events |
| 08c93f1 | docs: trip tours tab self-containment — map inline, /tour/[id] becomes public viewer |

---

## Schema Changes

### TourStop
- Added `ticketRequired String?` — values: `"free" | "ticket-required" | "advance-booking-recommended" | "unknown"`
- Populated by `deriveTicketSignal()` in generate route using Google Places `types`, `price_level`, `editorial_summary`
- Legacy stops have `null` (no pill shown in UI — acceptable until ticketRequired becomes a hard filter)

### ItineraryItem
- Added `bookingSource String?` — values: `"booking.com" | "airbnb" | "hotels.com" | "expedia" | "marriott" | "hilton" | "hyatt" | "vrbo" | "direct" | "unknown"`
- Added `managementUrl String?` — generic platform manage-reservation page URL
- Backfilled across all 68 LODGING items: booking.com (32), unknown (28), hyatt (5), hilton (2), airbnb (1)
- Detection: `src/lib/lodging/detect-source.ts` — domain match on contactEmail → platform key

### TripIntelDismissal (new model)
```prisma
model TripIntelDismissal {
  id          String   @id @default(cuid())
  tripId      String
  trip        Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  itemId      String
  dismissedAt DateTime @default(now())
  @@unique([tripId, itemId])
  @@index([tripId])
}
```

---

## Operating Disciplines Established

### 1. Conversation Capture Rule
Every meaningful product decision goes into `FLOKK_PRODUCT_SPEC.md` within the same session it's made, regardless of build status. Handoff docs maintain Decisions Log of what was discussed but not built. Prevents next-chat re-litigation.

### 2. Schema Change Completeness Rule
Every schema-touching prompt MUST address all four: new data path, backfill, read-path compatibility, regression test + UI verification. Backfill scripts MUST populate every field that participates in UI rendering — not just schema-required fields. Verification = open the UI surface and confirm the row renders, not just confirm DB row exists.

Sub-rule: `dayIndex` completeness — any backfilled ItineraryItem must set `dayIndex = Math.round((new Date(scheduledDate) - new Date(tripStartDate)) / 86400000)`. Null dayIndex rows are silently excluded from every day view.

### 3. Prompt Writing Standard
Every prompt must include exact code (exact function signatures, exact JSX, exact variable names, exact condition logic, exact API shape). No room for interpretation. Diagnose before fixing: grep actual file first, show exact current code, show exact replacement, apply, grep again to verify.

---

## Decisions Logged (Designed, Mostly Not Built)

### Trip Tours Tab Self-Containment (QUEUED: Chat 39 opening)
Trip Tours tab IS the owner's tour viewer. No navigation away from trip.

Expand-in-place shows:
- Inline map with numbered stop pins
- Stop list: image, name, ticket pill, why description, duration, walk time, link
- Per-stop tap → stop detail modal (already shipped)

"View tour" button REMOVED from Trip Tours tab cards.

`/tour/[id]` repurposed as PUBLIC VIEWER for shared/cloned tours via Discover/Spots. Owners never need it.

### Tour Stop Detail Standards
- `websiteUrl` mandatory by default — Google Places `website` field OR Maps URL fallback (never null)
- `why` description visible in expand-in-place AND SavedItem modal (for `flokk_tours` source platform items)
- `ticketRequired` signal pill: green "Free", amber "Ticket required" / "Book ahead", null = no pill
- Stops in expand-in-place are clickable — tap opens stop detail modal
- Status: ticketRequired field + derivation + modal all shipped. Legacy stop backfill of ticketRequired deferred (requires re-calling Place Details API per stop).

### Tours Public Surfacing & Community
- Tours go public on save-to-trip (implicit quality vote, Option A)
- Hybrid attribution: anonymous default, opt-in family byline
- Clone-to-account: new GeneratedTour + TourStops in cloning family's account, independent rating history
- Clone notifications gamified ("your tour was saved by N families")
- Cohort-weighted ratings: 5-star from family with kids 5–10 boosts surfacing for similar families only
- Real-time rating prompts: push notification at scheduled item end-time (pending iOS)

### Tours Personalization Layer (Phase 2A — schema queued)
Pure behavioral inference, skip manual tier UI. Three-source weighted blend:
1. Trip prompt keywords (highest weight)
2. Behavioral inference from saves + itineraries + tour history (medium-high)
3. Profile interests (equal-weight fallback)

Schemas designed: `FamilyBehavioralProfile`, `CohortBehavioralProfile` (not yet in Prisma).
Refresh strategy: Haiku nightly cron + Sonnet on-demand when user opens tour builder.
Surfaced as soft prompt injection, not hard filter.

### Be Helpful Cross-Surface Principle
Two concrete pillars:

**Family-Context Awareness:** wiggle breaks, gelato spots, playgrounds surfaced contextually in tours. Four phases: A (tour interstitials), B (Trip Intel cards), C (hotel-anchored recommendations engine), D (shared Family Utility Service resolver). New `IntelItem.category = "family-utility"` needed.

**Time-Bound Events Intelligence:** sports, theatre, concerts, festivals, markets, exhibitions during travel window. AI extraction from public web (no API licensing). Affiliate URL rewrite layer (Ticketmaster, StubHub, Vivid Seats, Eventbrite, Fever, SeatGeek, TodayTix). `Event` schema designed; Trip Intel emits Events card.

---

## Active Legacy Data Items

| Item | Status |
|------|--------|
| **DRP8E8 booking** on trip `cmmycshfj000004jpyadzdp8y` | Identified by audit script as having a missing leg. Same shape as Okinawa repair. Needs SQL repair next session. |
| **28 lodging items with `bookingSource = "unknown"`** | Direct hotel emails (`reservation@hotel.com`). Acceptable as-is — no platform to link to. Could show "Direct hotel" label in future. |
| **Legacy TourStops with `null ticketRequired`** | Will remain null until either: (a) re-generation, or (b) backfill script calling Place Details per stop. Not blocking. |

---

## Chat 39 Opening Queue (Priority Order)

### 1. Trip Tours Map Integration (TOP — 30–45 min)
Move inline map into Trip Tours tab expand-in-place. Remove "View tour" button. `/tour/[id]` repurposed as public viewer. This is the fully designed, fully queued Chat 39 opener. No diagnostic needed — build directly.

Surfaces to touch:
- `src/components/features/trips/TripTabContent.tsx` — ToursContent component (expand-in-place block ~line 5945)
- Map component reference (Mapbox, same pattern as TripMap.tsx but scoped to stop pins only)
- Remove "View tour" `<a>` button from tour card action row

Surfaces NOT to touch:
- `/tour/[id]` page (becomes public viewer — leave routing intact)
- TourMap.tsx if it exists separately

### 2. Phase 2A Schema: FamilyBehavioralProfile + CohortBehavioralProfile (20–30 min)
Schema migration only in Chat 39. Extraction logic deferred to later.

### 3. Small Fixes (P1)
- Cairo/Luxor blank itinerary — diagnostic first (user to provide screenshot when convenient)
- Sri Lanka recommendation save bug — diagnostic first
- Notes edit + formatting preservation
- Documents edit capability in Vault

### 4. Bigger Features (P2–P3, own sessions each)
- Cruises in Vault with stops in itinerary
- Flokk-Claude conversational chat
- Spots page rebuild
- Tour Builder Refine section (neighborhood pills, vibe toggle, rhythm toggle, textarea)
- Discover/Spots Tours surface
- Share/clone infrastructure (shareToken, `/share/tour/[token]`, POST/DELETE endpoints)
- Family-utility cards (Phase A foundational)
- Events extraction (Phase A foundational)

---

## Key Technical Reference

| Item | Value |
|------|-------|
| Greene family profileId | `cmmmv15y7000104jvocfz5kt6` |
| London trip | `cmnhgoflq000004l4403jm4mx` |
| Seoul trip | `cmmx6428k000004jlxgel7s86` |
| Sri Lanka trip | `cmmx09fra000004if78drj98m` |
| Okinawa trip | `cmmet611o0000yn8nz6ss7yg4` (repaired) |
| Supabase project_id | `egnvlwgngyrkhhbxtlqa` |
| dayIndex formula | `Math.round((new Date(scheduledDate) - new Date(tripStartDate)) / 86400000)` |
| Flight test suite | `npx tsx scripts/phase-vault-test.ts` → 26/26 |
| Multi-trip test suite | `npx tsx scripts/phase-multi-trip-test.ts` → 7/7 |
| Audit script | `npx tsx scripts/audit-legacy-flight-bookings.ts` (READ-ONLY) |

---

## Tests Passing at Session End

- **26/26** Phase Vault test (`scripts/phase-vault-test.ts`)
- **7/7** Phase Multi-Trip test (`scripts/phase-multi-trip-test.ts`)

Run both before any commit. Pattern: `npx tsc --noEmit && npx tsx scripts/phase-vault-test.ts && npx tsx scripts/phase-multi-trip-test.ts`

---

## Lessons (Preserve Across Sessions)

- TripDocument as parallel-truth display cache causes real bugs. Synthesizer at read time is the durable architecture.
- AI extraction is non-deterministic — same email can produce NRT vs HND on separate runs. Guardrails in extractor are load-bearing.
- Direct DB queries via Supabase MCP are essential for diagnosis. Never guess at data shape.
- "Surfaces NOT touched" + regression watch list are mandatory in every prompt.
- Idempotent re-write requires `deleteMany` BEFORE write, not after.
- Long-range "trips" (residence periods like Kamakura) need different handling than discrete travel trips. Destination match required in multi-trip extraction.
- Tours card design must match SavedItemCard pattern (full-width hero), NOT Vault booking card pattern.
- Partial commits cause Vercel build failures. Always stage all modified files together (`git add -A`).
- Modal scroll pattern: `max-h-[90vh]` + `display: flex, flexDirection: column, overflow: hidden` on container + `flex: 1, overflowY: auto` on content area + `flexShrink: 0` sticky footer for action buttons.
- `dayIndex = null` rows are silently excluded from every day view. Every backfilled ItineraryItem must have explicit dayIndex.
- Conversation capture rule and Schema Change Completeness Rule are operating disciplines, not suggestions.

---

## Brand / User Context (Matt)

- One prompt at a time, diagnostic-first, single clean copyable code blocks
- No em dashes in copy, casual direct tone, no AI filler phrases
- Design: navy `#1B3A5C`, terracotta `#C4664A`, no emojis, Lucide icons, Playfair Display + DM Sans
- No `Co-Authored-By` in commit messages, plain commit messages only
- ~4 hour session windows, Matt says when done
- Sign off: "Matt and Jen, Co-Founders, Flokk"
