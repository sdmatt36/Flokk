# Flight Schema Audit
**Purpose:** Pre-migration inventory of every code path that reads or writes Flight rows.
**Context:** We are preparing a schema split — `FlightBooking` (one row per ticket purchase) + `Flight` (one row per leg). The current flat `Flight` table stores first-leg departure and last-leg arrival, collapsing multi-segment bookings into a single record. `ItineraryItem` rows were already migrated to per-leg in commit `9df896b`. The Flight table layer was never addressed. This document maps every surface before we touch the schema.

**Audited:** 2026-04-26

---

## Schema Definition

**File:** `prisma/schema.prisma` lines 624–648

```prisma
model Flight {
  id                String   @id @default(cuid())
  tripId            String
  trip              Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  type              String   @default("outbound")
  airline           String
  flightNumber      String
  fromAirport       String
  fromCity          String
  toAirport         String
  toCity            String
  departureDate     String
  departureTime     String
  arrivalDate       String?
  arrivalTime       String?
  duration          String?
  cabinClass        String   @default("economy")
  confirmationCode  String?
  seatNumbers       String?
  notes             String?
  dayIndex          Int?
  sortOrder         Int      @default(0)
  status            String   @default("saved")
  createdAt         DateTime @default(now())
}
```

Key schema observations:
- No unique constraints anywhere on the model
- No explicit indexes (only implicit PK and FK)
- `airline`, `fromAirport`, `toAirport`, `flightNumber` are non-nullable Strings but accept empty string `""`
- `departureTime`/`arrivalTime` are plain Strings, no time format enforcement
- Sole relation: `Flight → Trip` (many-to-one, cascade delete on Trip delete)
- No table has a FK pointing back TO Flight

---

## READ paths (display surfaces)

### 1. Vault flight cards
**File:** `src/app/api/trips/[id]/flights/route.ts` — line 14
**Method:** `db.flight.findMany({ where: { tripId }, orderBy: [...] })`
**Surface:** Trip Vault "Imported Bookings" section — the primary flight card visible to the user.
**Renders:** `flight.fromAirport → flight.toAirport`, departure date/time, arrival date/time, airline, flightNumber, cabinClass, confirmationCode, seatNumbers, notes, status badge.
**Migration impact:** YES. After split, this endpoint must return per-leg rows (from the new `Flight` leg table) OR per-booking rows (from `FlightBooking`). The Vault card design must be decided: one card per booking (collapsible legs) or one card per leg.

**File:** `src/components/features/trips/TripTabContent.tsx` — lines 5195–5254
**Method:** Client-side render of `Flight[]` fetched from the above endpoint.
**Renders:** JSX flight card — `flight.fromAirport`, `flight.toAirport`, `flight.fromCity`, `flight.toCity`, `flight.departureDate`, `flight.departureTime`, `flight.arrivalDate`, `flight.arrivalTime`, `flight.airline`, `flight.flightNumber`, `flight.cabinClass`, `flight.confirmationCode`, `flight.seatNumbers`, `flight.duration`, `flight.notes`, `flight.status`.
**Migration impact:** YES. The client-side `Flight` type definition (lines 91–112) maps directly to the flat schema. Must be updated to match whatever the new API returns.

### 2. Booking Intel checklist
**File:** `src/app/api/trips/[id]/booking-intel/route.ts` — line 114
**Method:** `trip.flights` included via Prisma relation — `select: { id: true, type: true, status: true }`
**Surface:** Trip Intelligence panel — shows flight booking status (booked / unconfirmed / missing).
**Logic:** Counts `flights.filter(f => f.status === "booked")` vs `!== "booked"`. Zero flights → "missing" state.
**Migration impact:** PROBABLY. If `FlightBooking` becomes the booking-level model, `status` should live there. The count logic (1 booking = 1 card shown as "confirmed") is correct only if we count bookings, not legs.

### 3. Day view sort order
**File:** `src/components/features/trips/TripTabContent.tsx` — lines 1973–1977
**Method:** Client-side sort computation over unified items array.
**Logic:** `item.itemType === "flight" && item.flight` — reads `f.type`, `f.arrivalTime`, `f.departureTime` for sort key. Flights of type `"outbound"` sort by arrival time (sort weight ~10); return flights sort by departure time + 1440 (sort weight ~90).
**Migration impact:** YES. This code merges `Flight` rows and `ItineraryItem` FLIGHT rows into one unified list (with dedup logic at lines 2045–2054). After migration the unified list logic needs revisiting.

### 4. Day view itinerary — flight inline card
**File:** `src/components/features/trips/TripTabContent.tsx` — lines 3037–3048, lines 3663–3666
**Surface:** Day view itinerary row for a `Flight`-type item (not ItineraryItem). Renders: `f.fromAirport → f.toAirport · f.airline f.flightNumber`.
**Migration impact:** YES. After migration per-leg rows render separately; the aggregate booking display needs rethinking.

### 5. Edit Flight modal
**File:** `src/components/flights/EditFlightModal.tsx` — lines 84–103
**Method:** Client-side PATCH to `/api/trips/[id]/flights/[flightId]`.
**Surface:** "Edit flight" modal — all flat fields pre-filled from the Flight row.
**Migration impact:** YES. If a leg lives under a FlightBooking, the edit modal must know which level it's editing — booking-level fields (airline, confirmationCode, cabinClass) vs leg-level fields (fromAirport, toAirport, departureDate, departureTime, arrivalTime).

### 6. Public share trip viewer
**File:** `src/app/share/[token]/page.tsx` — lines 144, 248–275
**File:** `src/app/share/[token]/ShareItineraryView.tsx` — line 64
**Method:** Does NOT fetch Flight model rows. Reads `trip.itineraryItems` (type = `"FLIGHT"`) only.
**Surface:** Shared trip view — FLIGHT ItineraryItems shown with type label "FLT", colored badge (#EEF4FF / #3B82F6).
**Note:** Flight model data is entirely absent from the public share path. This was already the correct per-leg representation from commit `9df896b`.
**Migration impact:** NO. Share view already uses ItineraryItems.

### 7. Trip AI Review
**File:** `src/app/api/trips/[id]/review/route.ts` — lines 26–30, 47–62
**Method:** `include: { itineraryItems: ..., manualActivities: ... }` — Flight model is NOT included.
**Surface:** AI trip review — Claude receives itineraryItems (which include FLIGHT type) and manualActivities. The word "flight" appears only in the system prompt as an example domain ("before early flight").
**Note:** Flight model data does not enter the Claude prompt. ItineraryItem FLIGHT rows do, via `it.type`, `it.departureTime`, `it.arrivalTime`, `it.title`.
**Migration impact:** NO for Flight model. If ItineraryItem FLIGHT data is expanded, the review prompt may benefit from richer leg context.

### 8. Data repair script
**File:** `scripts/fix-ana-flight.ts` — line 47
**Method:** `db.flight.findFirst({ where: { confirmationCode, tripId }, select: { fromAirport, toAirport, ... } })`
**Purpose:** One-time repair for ANA NH867 — reads Flight record to copy airport/time data to a mismatched ItineraryItem. Already run; not a recurring path.
**Migration impact:** NO (one-off, already executed).

---

## WRITE paths (data creation/mutation)

### 1. Email inbound extractor (primary active write path)
**File:** `src/app/api/webhooks/email-inbound/route.ts` — line ~1234
**Method:** `db.flight.create({ data: { tripId, type: "outbound", airline, flightNumber, fromAirport, toAirport, fromCity, toCity, departureDate, departureTime, arrivalDate, arrivalTime, confirmationCode, status: "booked", dayIndex } })`
**Source:** CloudMailin → email-inbound webhook → Claude API extraction → Flight row.
**Behavior:** Creates exactly ONE Flight row per booking. For multi-segment bookings, `fromAirport` = first leg departure, `toAirport` = "outboundDestinationAirport" (by prompt instruction), but in practice often resolves to last-leg airport due to fallback logic at lines 325–339. Separately creates one ItineraryItem per leg via `legs[]` array (line 1063). Also writes a TripDocument vault record.
**No dedup guard:** No unique constraint, no check for existing confirmationCode before insert → causes duplicate Flight rows on re-forwarded emails (see: Sri Lanka trip has 6 identical rows).
**Migration impact:** YES. This is the highest-priority write path. After split: create one `FlightBooking` row + N `Flight` leg rows. Dedup guard needed on FlightBooking by (tripId, confirmationCode) or (tripId, fromAirport, toAirport, departureDate).

### 2. Manual add UI
**File:** `src/app/api/trips/[id]/flights/route.ts` — line 71
**Method:** `db.flight.create({ data: { ... full field set ... } })`
**Source:** AddFlightModal (`src/components/flights/AddFlightModal.tsx` lines 71–113) → POST /api/trips/[id]/flights.
**Behavior:** Creates one row per submit. For round-trips, creates a second row with `type: "return"` if `returnDate` is provided.
**Note:** No trip ownership check — any authenticated user can write flights to any trip by tripId.
**Migration impact:** YES. After split, the manual add form must decide: does the user enter one booking or individual legs? Most likely: one FlightBooking per form submit, UI expands to support entering multiple legs within that booking.

### 3. Flight edit
**File:** `src/app/api/trips/[id]/flights/[flightId]/route.ts` — line 15
**Method:** `db.flight.update({ where: { id: flightId }, data: body })`
**Source:** EditFlightModal PATCH.
**Note:** Accepts arbitrary `body` — no field validation, no ownership check.
**Migration impact:** YES. After split, PATCH must route booking-level fields to `FlightBooking` and leg-level fields to `Flight`.

### 4. Flight delete
**File:** `src/app/api/trips/[id]/flights/[flightId]/route.ts` — line 32
**Method:** `db.flight.delete({ where: { id: flightId } })`
**Source:** UI delete action (handleDeleteFlight in TripTabContent, line 6111).
**Migration impact:** YES. After split, deleting a leg should check whether the parent FlightBooking still has other legs; deleting a booking should cascade to its legs.

### 5. Inngest parser (PERMANENTLY DISABLED)
**File:** `src/lib/inngest/functions/parse-booking-email.ts` — lines 308, 367
**Method:** `db.flight.create(...)` × 2 (outbound + return).
**Status:** Inngest is permanently disabled per CLAUDE.md. This code path is dead. Both creates are structured identically to the email-inbound creates.
**Migration impact:** LOW. Dead code. Should be removed or migrated if Inngest is ever re-enabled.

---

## CRON / BACKGROUND paths

No cron jobs touch the `Flight` model directly.

Reviewed files with no Flight hits:
- `src/app/api/cron/nudge-users/route.ts`
- `src/app/api/cron/enrich-manual-activities/route.ts`
- `src/app/api/cron/trip-lifecycle/route.ts`
- `src/app/api/cron/pre-trip-reminder/route.ts`
- `src/app/api/cron/enrich-saved-items/route.ts`

**Note:** `src/app/api/admin/backfill-arrival-coords/route.ts` touches `ItineraryItem` rows with `type: "FLIGHT"` (geocodes arrival coordinates) but does NOT touch the `Flight` model.

---

## AI / LLM context paths

### Trip review (Claude via Anthropic SDK)
**File:** `src/app/api/trips/[id]/review/route.ts`
**Flight model included in prompt:** NO. The `db.trip.findFirst` include does not include `flights`. Claude receives `itineraryItems` (type discriminators including FLIGHT) and `manualActivities` only.
**Migration impact:** NO for the Flight model. The review route is already working off the correct per-leg ItineraryItems.

### Email extraction (Claude via Anthropic SDK)
**File:** `src/app/api/webhooks/email-inbound/route.ts`
**Role of Flight model:** Claude is prompted to extract flight fields into JSON; the result is then written to `db.flight.create`. Claude does not read existing Flight rows — it produces the data that creates them.
**Migration impact:** YES. The extraction prompt must be updated to produce a `legs[]` array as the primary structure, which maps to per-leg `Flight` rows under a `FlightBooking` parent.

No other Claude/LLM paths reference Flight model data.

---

## CLONE / IMPORT paths

### Trip clone
**File:** `src/app/api/trips/[id]/clone/route.ts`
**Flight model:** No hits. Flight rows are NOT copied when cloning a trip.
**Migration impact:** NO.

### Trip steal (steal days from another trip)
**File:** `src/app/api/trips/[id]/steal/route.ts` — line 51
**Method:** `type: { notIn: ["FLIGHT", "LODGING"] }` — explicitly excludes FLIGHT ItineraryItems from the steal.
**Note:** Does not touch Flight model at all, only ItineraryItem exclusions.
**Migration impact:** NO.

### Trip steal-to-new
**File:** `src/app/api/trips/steal-to-new/route.ts` — line 91
**Method:** `if (item.type === "FLIGHT" || item.type === "LODGING") continue;` — skips FLIGHT ItineraryItems.
**Migration impact:** NO.

### Seed scripts
Reviewed `scripts/seed-trip.ts` and `scripts/seed-template-trips.ts` — no Flight model references. Flight data is not seeded.

---

## TEST coverage

**Project test files:** None. No `.test.ts` files exist in `src/` or `scripts/`.
**Risk:** Zero automated regression coverage. All verification after migration is manual.

---

## Surface Impact Map

Every user-visible surface that needs re-verification after migration ships:

| Surface | Current data source | Migration impact |
|---------|-------------------|-----------------|
| Vault flight card render | `Flight` model, flat row | Must show per-leg or per-booking view — design decision required |
| Day view itinerary flight items | Unified list: `Flight` rows + `ItineraryItem` FLIGHT rows, with dedup at lines 2045–2054 | Dedup logic must be rewritten; unified list assembly changes |
| Edit Flight modal | Flat `Flight` row — all fields in one form | Must split into booking-level vs leg-level fields |
| Delete flight | `db.flight.delete` single row | Leg delete must propagate to parent FlightBooking if all legs removed |
| Booking Intel flight panel | `trip.flights` relation, counts rows | Should count FlightBookings not legs; "1 flight confirmed" must mean 1 booking |
| Public share trip viewer | ItineraryItem FLIGHT rows (already per-leg) | No change needed |
| Trip AI review | ItineraryItem FLIGHT rows | No change needed |
| Manual add flight UI | AddFlightModal → POST `/api/trips/[id]/flights` | UI must support multi-leg entry or multi-step booking creation |
| Admin backfill-arrival-coords | ItineraryItem FLIGHT rows | No change needed |

---

## Schema Migration Risk Map

### Foreign keys TO Flight
None. No other table has a FK pointing at Flight. The migration does not need to update any referencing table.

### Foreign keys FROM Flight
- `Flight.tripId → Trip.id` (onDelete: Cascade)
- After split: `FlightBooking.tripId → Trip.id` should carry this FK. `Flight.flightBookingId → FlightBooking.id` (new FK, also cascade).

### Unique constraints
None currently exist. Need to ADD:
- `FlightBooking`: unique on `(tripId, confirmationCode)` where confirmationCode is non-null — prevents duplicate imports of the same email.
- Consider also: unique on `(tripId, fromAirport, toAirport, departureDate)` as a fallback dedup key when confirmationCode is absent.

### Status field
`Flight.status` ("saved" / "booked") is booking-level semantics, not leg-level. Should live on `FlightBooking`, not on `Flight` leg rows. The Booking Intel checklist reads `status` — must be updated to read from `FlightBooking.status`.

### dayIndex field
`Flight.dayIndex` is the trip day of the outbound departure. Stays relevant on the leg row (each leg has its own dayIndex). Carry forward to `Flight` leg model unchanged.

### sortOrder field
`Flight.sortOrder` (default 0) — used in sort logic in TripTabContent. Carry forward to `Flight` leg model; `FlightBooking` does not need this field.

---

## Recommended Migration Order

**Principle:** Write paths before read paths. Dual-write during transition. Never break the Vault card while migrating.

### Phase 1 — Schema (migration + backfill, no UI changes)
1. Add `FlightBooking` model: `id, tripId, airline, flightNumber, confirmationCode, cabinClass, seatNumbers, notes, status, sortOrder, createdAt`. FK: `tripId → Trip.id` cascade.
2. Add `flightBookingId` (optional, nullable) to existing `Flight` model.
3. Add unique index to `FlightBooking(tripId, confirmationCode)` where confirmationCode non-null.
4. Backfill: for each existing `Flight` row, create a `FlightBooking` and set `Flight.flightBookingId`.

### Phase 2 — Write paths (email extractor + manual add)
5. Update `email-inbound/route.ts`: create `FlightBooking` first, then one `Flight` leg row per entry in `legs[]`. Set `Flight.flightBookingId`. Dedup on `FlightBooking(tripId, confirmationCode)` before creating.
6. Update `POST /api/trips/[id]/flights`: create `FlightBooking` + one `Flight` leg. Return booking id.
7. Update `PATCH /api/trips/[id]/flights/[flightId]`: route booking-level fields to `FlightBooking`, leg-level fields to `Flight`.
8. Update `DELETE /api/trips/[id]/flights/[flightId]`: delete leg; if no legs remain under parent `FlightBooking`, delete the booking too.

### Phase 3 — Read paths (API + Vault UI)
9. Update `GET /api/trips/[id]/flights`: return `FlightBooking[]` with nested `legs: Flight[]`. Update client `Flight` type.
10. Update Vault flight card to render booking-level header + expandable per-leg rows.
11. Update day view unified list + dedup logic (currently matches `Flight.fromAirport` vs `ItineraryItem.fromAirport` — after migration, legs match legs naturally).
12. Update Booking Intel route: count `FlightBookings` not `Flight` legs for status check.
13. Update AddFlightModal and EditFlightModal for new booking+legs structure.

### Phase 4 — Cleanup
14. Remove dead Inngest `parse-booking-email.ts` Flight creates (or migrate them to match new structure).
15. Drop legacy `flightBookingId` nullable period — make it required once all rows are migrated.
16. Add dedup guard (unique index backfill verification) and confirm Sri Lanka trip has 1 `FlightBooking` + 3 `Flight` legs instead of 6 duplicate flat rows.

### Deferred
- Public share view: already using ItineraryItems, no change.
- Trip AI review: already using ItineraryItems, no change.
- Clone/steal routes: do not copy flights, no change needed.
