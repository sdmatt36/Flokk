# Bookings Full Audit
**Version:** 2026-04-26 (updated Phase Vault Multi-Leg)
**Supersedes:** docs/FLIGHT_SCHEMA_AUDIT.md  
**Status:** Source of truth for booking architecture, data flow, and known gaps.

---

## Phase Vault Multi-Leg (shipped 2026-04-26)

### Leg partitioning rule

When synthesizing a flight Vault card, the orchestrator queries `Trip.startDate` / `Trip.endDate` and passes them (as `YYYY-MM-DD` strings) to `synthesizeFlightVaultDocument`. The flight synthesizer filters `FlightBooking.flights` to legs that belong to this trip:

```
leg belongs if:
  (leg.departureDate >= tripStartDate AND leg.departureDate <= tripEndDate)
  OR
  (leg.arrivalDate >= tripStartDate AND leg.arrivalDate <= tripEndDate)
```

Dates are compared as YYYY-MM-DD strings (lexical ISO comparison is correct for full date strings).

**Defensive fallback:** if no legs survive the filter (trip dates unavailable or all legs out of range), all legs are included so the card is never empty.

**Example — FHMI74 shared across two trips:**
- Sri Lanka (Jun 28–Jul 4): legs HND→SIN (Jun 28), SIN→CMB (Jun 28), CMB→LHR (Jul 4) — all 3 in range → card shows 3-leg route HND → SIN → CMB → LHR
- London (Jul 4–Jul 7): only the CMB→LHR leg (Jul 4) is in range → London card shows 1 leg

### `_flightBookingId` field

`synthesizeFlightVaultDocument` now includes `_flightBookingId: flightBooking.id` in the synthesized content JSON. The frontend `handleVaultEdit` function reads this field and, when present, opens the booking-aware `EditFlightModal` (booking mode) instead of the legacy single-leg modal.

### New API endpoint

`/api/trips/[id]/flight-bookings/[bookingId]` (GET + PATCH) returns and updates a `FlightBooking` with all its `Flight` legs. The PATCH body accepts booking-level fields (`airline`, `cabinClass`, `confirmationCode`) and an optional `legs[]` array for per-leg edits.

### Frontend multi-leg card

The Vault booking card for flight type now:
- Shows the full multi-stop route in the header: `HND → SIN → CMB → LHR` (built from `booking.legs[]`)
- Renders a per-leg block below the metadata grid: each leg shows `from → to`, `flightNumber`, departure date/time, arrival time
- Suppresses redundant Route/Departure/Arrival from the metadata rows when legs are present
- Adds Airline and Cabin rows (from booking-level fields) when legs are present

---

## How to read this document

Each booking type has a section covering its full lifecycle: schema → email write → typed-model write → read surfaces → edit → delete → dedup behavior. The document ends with a production failure mode inventory and a recommended fix order.

**Correction from prior audit (FLIGHT_SCHEMA_AUDIT.md):**  
The previous audit stated the Vault card reads from `/api/trips/[id]/flights → db.flight.findMany`. This was incorrect. The Vault card reads from `/api/trips/[id]/vault/documents → db.tripDocument.findMany`. The Flight API exists and returns correct per-leg data, but the Vault UI never calls it for display. This gap was discovered when the Sri Lanka FHMI74 card continued showing collapsed HND→LHR after the Flight table held 3 correct per-leg rows. The corrected data path is documented fully in Section 3 (FLIGHT) and Section 10 (Vault read coupling).

---

## Section 1: Production Data Inventory

### Model row counts (as of 2026-04-26)

| Model | Row count |
|---|---|
| Flight | 23 |
| FlightBooking | 20 |
| ManualActivity | 132 |
| ItineraryItem | 120 |
| TripDocument | 69 |
| TripContact | 28 |
| TripKeyInfo | 50 |
| SavedItem | 472 |

**Note:** No Hotel, Lodging, HotelBooking, ActivityBooking, Reservation, or Booking typed models exist in the schema. The only typed booking models are Flight and FlightBooking (added Phase 1, 2026-04-25).

### ItineraryItem breakdown by type

| type | row_count |
|---|---|
| LODGING | 67 |
| FLIGHT | 23 |
| ACTIVITY | 16 |
| TRAIN | 6 |
| CAR_RENTAL | 6 |
| RESTAURANT | 1 |
| UNKNOWN | 1 |

### TripDocument breakdown by type

| type | row_count |
|---|---|
| booking | 67 |
| operator_plan | 1 |
| note | 1 |

**Key observation:** Every `booking`-type TripDocument (67) has a corresponding ItineraryItem (120 total, ~67 check-in + check-out pairs for hotels and one-per-booking for others). The counts do not align perfectly because LODGING generates two ItineraryItems per TripDocument (check-in + check-out) and FLIGHT generates N ItineraryItems per TripDocument (one per leg). 23 FLIGHT ItineraryItems / 3 TripDocuments ≈ 7.7 — the 3 flight TripDocuments cover multi-leg bookings, which is correct.

### ExtractionLog outcomes

| extractedType | outcome | count |
|---|---|---|
| hotel | success | 5 |
| unknown | dropped | 3 |
| flight | success | 3 |
| activity | success | 2 |
| car_rental | success | 2 |
| hotel | dropped | 2 |
| flight | dropped | 1 |
| activity | partial | 1 |
| null | error | 1 |

---

## Section 2: Schema Inventory

### Model: FlightBooking (prisma/schema.prisma lines 625-641)

**Fields:**
- `id` String @id @default(cuid())
- `tripId` String (FK → Trip, CASCADE delete)
- `confirmationCode` String? (nullable)
- `airline` String? (nullable)
- `cabinClass` String @default("economy")
- `seatNumbers` String? (nullable)
- `notes` String? (nullable)
- `status` String @default("saved")
- `sortOrder` Int @default(0)
- `createdAt` DateTime @default(now())
- `flights` Flight[] (one-to-many)

**Constraints:** `@@unique([tripId, confirmationCode], name: "unique_trip_confirmation")`, `@@index([tripId])`

**Phase added:** Phase 1, 2026-04-25

---

### Model: Flight (prisma/schema.prisma lines 643-669)

**Fields:**
- `id` String @id @default(cuid())
- `tripId` String (FK → Trip, CASCADE delete)
- `type` String @default("outbound")
- `airline` String (non-nullable, empty string allowed)
- `flightNumber` String (non-nullable, empty string allowed)
- `fromAirport` String (non-nullable, empty string allowed)
- `fromCity` String (non-nullable, empty string allowed)
- `toAirport` String (non-nullable, empty string allowed)
- `toCity` String (non-nullable, empty string allowed)
- `departureDate` String (non-nullable, empty string allowed)
- `departureTime` String (non-nullable, empty string allowed)
- `arrivalDate` String? (nullable)
- `arrivalTime` String? (nullable)
- `duration` String? (nullable)
- `cabinClass` String @default("economy")
- `confirmationCode` String? (denormalized from FlightBooking — legacy read support)
- `seatNumbers` String? (nullable)
- `notes` String? (nullable)
- `dayIndex` Int? (nullable)
- `sortOrder` Int @default(0)
- `status` String @default("saved")
- `createdAt` DateTime @default(now())
- `flightBookingId` String? (FK → FlightBooking, CASCADE delete, nullable — required post-Phase 4)
- `flightBooking` FlightBooking? (relation)

**No additional constraints beyond FK.**

---

### Model: ManualActivity (prisma/schema.prisma lines 675-704)

**Fields:**
- `id`, `tripId` (FK→Trip CASCADE), `title`, `date` (String), `time` String?, `endTime` String?, `venueName` String?, `address` String?, `lat` Float?, `lng` Float?, `website` String?, `price` Float?, `currency` String?, `notes` String?, `status` String @default("saved"), `confirmationCode` String?, `city` String?, `type` String @default("activity"), `imageUrl` String?, `dayIndex` Int?, `sortOrder` Int @default(0), `tourId` String? (FK→GeneratedTour CASCADE), `deletedAt` DateTime?, `createdAt` DateTime

**Constraints:** `@@index([tourId])`, `@@index([deletedAt])`

**Note:** ManualActivity is the typed model for user-entered activities and tour-saved stops. Email-imported activities do NOT write to ManualActivity — they write to ItineraryItem(type=ACTIVITY) and TripDocument(type=booking). This creates two activity write paths with different typed models.

---

### Model: ItineraryItem (prisma/schema.prisma lines 823-853)

**Fields:**
- `id`, `tripId` String? (FK→Trip SetNull), `familyProfileId` String, `type` String (FLIGHT | LODGING | TRAIN | ACTIVITY | CAR_RENTAL | RESTAURANT | OTHER), `title` String, `scheduledDate` String?, `departureTime` String?, `arrivalTime` String?, `fromAirport` String?, `toAirport` String?, `fromCity` String?, `toCity` String?, `confirmationCode` String?, `notes` String?, `address` String?, `totalCost` Float?, `currency` String?, `passengers` String[] (array), `dayIndex` Int?, `latitude` Float?, `longitude` Float?, `arrivalLat` Float?, `arrivalLng` Float?, `sourceType` String @default("EMAIL_IMPORT"), `sortOrder` Int @default(0), `needsVerification` Boolean @default(false), `rooms` Json?, `createdAt` DateTime

**No @@unique constraints.** Upsert in email-inbound uses `findFirst` + conditional create/update (not Prisma upsert).

---

### Model: TripDocument (prisma/schema.prisma lines 737-750)

**Fields:**
- `id`, `tripId` (FK→Trip CASCADE), `label` String, `type` String @default("link"), `url` String?, `content` String? (JSON blob), `createdAt` DateTime, `savedItemId` String? (FK→SavedItem SetNull)

**Constraints:** `@@index([savedItemId])`

**Used as:** (a) email-imported booking archive (type="booking"), (b) operator plan archive (type="operator_plan"), (c) user-entered notes/links (type="note", "link").

---

### Model: TripContact (lines 724-735)
Fields: id, tripId (FK), name, role, phone, whatsapp, email, notes, createdAt.  
Written by hotel email extractor when contactPhone/contactEmail present.

### Model: TripKeyInfo (lines 752-759)
Fields: id, tripId (FK), label, value, createdAt.  
Written by hotel and activity/train/car_rental email extractors for confirmationCode storage.

---

## Section 3: FLIGHT Booking Lifecycle

### A. Schema
- FlightBooking: one row per booking (ticket purchase), holds: airline, cabinClass, confirmationCode, status, seatNumbers, notes, sortOrder
- Flight: one row per leg, holds: fromAirport, toAirport, departureDate/Time, arrivalDate/Time, flightNumber, airline (per-leg), dayIndex, confirmationCode (denormalized)
- ItineraryItem (type=FLIGHT): one row per leg, holds: fromAirport, toAirport, fromCity, toCity, scheduledDate, departureTime, arrivalTime, confirmationCode, totalCost (first leg only), geocoded arrival lat/lng
- TripDocument (type=booking): one row per booking, content=JSON blob with booking-level fields + legs[] array from original AI extraction

### B. Write — email extractor

**File:** `src/app/api/webhooks/email-inbound/route.ts`  
**Flight branch:** lines 1016–1309  
**Pre-branch dedup guard:** lines 982–998 — NOW BYPASSED for flights (Phase 2A.1, `extracted.type !== "flight"` condition)

**Step 1 — ItineraryItem upsert (lines 1136–1228):**
- Iterates `flightLegs[]` (mapped from AI `extracted.legs[]`, or synthesized from scalar fields)
- Each leg: `findFirst` on (tripId + confirmationCode + scheduledDate + fromAirport + toAirport), then update or create
- Geocodes arrival airport: `{IATA} airport {city}` query via Google Maps Geocoding API
- dayIndex computed per-leg from trip.startDate

**Step 2 — FlightBooking + Flight write via writeFlightFromEmail (lines 1252–1275):**
- Calls `src/lib/flights/extract-and-write.ts:writeFlightFromEmail()`
- Dedup on FlightBooking: `findUnique({ where: { unique_trip_confirmation: { tripId, confirmationCode } } })`
- If found: delete all existing Flight rows, update FlightBooking metadata, recreate Flight rows (Option 1 re-extraction)
- If not found: create new FlightBooking + Flight rows
- Null-code bookings: always create new FlightBooking (no dedup possible)
- Transaction timeout: 30,000ms

**Step 3 — TripDocument create (lines 1283–1303):**
- Checks for existing TripDocument with matching `label` (`findFirst`): skip if duplicate
- Creates with label="{fromAirport} → {toAirport}" or airline + flightNumber fallback
- Content JSON keys: `type, vendorName, flightNumber, airline, fromAirport, toAirport, fromCity, toCity, departureDate, departureTime, arrivalDate, arrivalTime, confirmationCode, totalCost, currency, guestNames, returnDepartureDate, legs, bookingUrl`
- **Content is written ONCE at initial email forward and NEVER updated on re-forward.** On re-forward, writeFlightFromEmail replaces Flight rows but the TripDocument label-dedup guard prevents a new document being written. The stale blob persists.

**TripDocument content shape (production sample):**
```json
{
  "type": "flight",
  "vendorName": "SriLankan Airlines",
  "flightNumber": "UL3335",
  "airline": "SriLankan Airlines",
  "fromAirport": "HND",
  "toAirport": "LHR",
  "fromCity": "Tokyo",
  "toCity": "London",
  "departureDate": "2026-06-28",
  "departureTime": "00:05",
  "arrivalDate": "2026-07-04",
  "arrivalTime": "20:00",
  "confirmationCode": "FHMI74",
  "totalCost": 206390,
  "currency": "JPY",
  "guestNames": ["Greene Matthew"],
  "returnDepartureDate": null,
  "legs": [{"from": "HND", "to": "SIN", ...}, ...]
}
```
**Note:** This is the ORIGINAL collapsed form (HND→LHR) from the first email forward. The legs[] array contains the correct 3-leg data from the AI extraction, but the top-level fields reflect the first-leg-to-final-destination shape that is displayed in the Vault card. The TripDocument has never been updated.

### C. Read (display) — Vault card

**Data source: TripDocument.content (parsed JSON blob)**  
**Endpoint:** `GET /api/trips/[id]/vault/documents` → `db.tripDocument.findMany({ where: { tripId } })`  
**Consumer:** TripTabContent.tsx Vault tab render, lines 6667–6853  

**Fields consumed from content for display:**
- `booking.type` → rendered as "FLIGHT" type badge
- `booking.fromCity` + `booking.toCity` → "Route" row (preferred)
- `booking.fromAirport` + `booking.toAirport` → "Route" row (fallback if no city)
- `booking.departureDate` + `booking.departureTime` → "Departure" row
- `booking.arrivalDate` + `booking.arrivalTime` → "Arrival" row
- `booking.confirmationCode` → "Confirmation" row
- `booking.totalCost` + `booking.currency` → "Total" row
- `booking.guestNames` → "Guests" row
- `booking.legs[]` — **NOT displayed in Vault card render** (present in blob, ignored by renderer)

**Note:** The `flights[]` array (fetched from `/api/trips/[id]/flights`) is used ONLY to match a TripDocument to a Flight record for the edit modal flow (line 6702: `flights.find(f => f.flightNumber === booking.flightNumber)`). It does not drive any display output.

**Correction from FLIGHT_SCHEMA_AUDIT.md:** The audit stated the Vault card reads from `/api/trips/[id]/flights`. This is incorrect. The Vault card reads from `/api/trips/[id]/vault/documents`, which returns TripDocument rows. The flights endpoint is used only for edit-modal matching, not display.

### D. Read (display) — Itinerary day view

**Data source: ItineraryItem (type=FLIGHT)**  
**No TripDocument read on day view.**  
Day view reads ItineraryItem fields: fromAirport, toAirport, fromCity, toCity, scheduledDate, departureTime, arrivalTime, confirmationCode, passengers, dayIndex, latitude, longitude.

### E. Read (display) — Booking Intel card

**Data source: Flight model via Trip.flights relation**  
**Endpoint:** `GET /api/trips/[id]/booking-intel` (lines 114: `flights: { select: { id, type, status } }`)  
Reads only `status` field from Flight rows. Shows "Flights: N confirmed" based on `status === "booked"` count. Does not read FlightBooking or TripDocument.

### F. Read (display) — Public share viewer

**Data source: ItineraryItem (type=FLIGHT)**  
**No TripDocument read.**  
`src/app/share/[token]/page.tsx` includes `itineraryItems` in the trip query. Renders FLIGHT ItineraryItems showing fromAirport → toAirport, departureTime, arrivalTime.

### G. Write (manual add/edit/delete)

**Manual add:** `POST /api/trips/[id]/flights/route.ts`  
- Creates Flight row ONLY (no FlightBooking created, no TripDocument created, no ItineraryItem created)
- Required fields: flightNumber, fromAirport, toAirport, departureDate, departureTime
- **Gap:** Manual adds have no FlightBooking parent. `flightBookingId` remains null. This violates the Phase 1 design goal.

**Manual edit:** `PATCH /api/trips/[id]/flights/[flightId]/route.ts`  
- Updates Flight row ONLY
- If editing from Vault, ALSO patches TripDocument via `PATCH /api/trips/[id]/vault/documents/{editingFlightVaultDocId}`

**Manual delete:** `DELETE /api/trips/[id]/flights/[flightId]/route.ts`  
- Deletes Flight row ONLY. Does not delete FlightBooking or TripDocument.

### H. Dedup behavior

| Scenario | Behavior (post-Phase 2A.1) |
|---|---|
| Same email forwarded twice (with confirmationCode) | Pre-extraction guard bypassed; writeFlightFromEmail finds FlightBooking by tripId+confirmationCode, deletes existing Flight legs, recreates from new legs[] — idempotent |
| Same email forwarded twice (no confirmationCode) | Creates duplicate FlightBooking and duplicate Flight rows each time |
| TripDocument re-creation on re-forward | Blocked by label-dedup guard in extractor — stale blob persists |

### I. Architecture type: Type A — Typed model + TripDocument blob
Both exist. Vault card reads blob (stale after re-forward). Flight/ItineraryItem data is current. Gap: Vault display is decoupled from typed model.

---

## Section 4: HOTEL/LODGING Booking Lifecycle

### A. Schema
No Hotel or Lodging typed model exists. All hotel data lives in:
- ItineraryItem (type=LODGING): two rows per hotel stay (check-in + check-out)
- TripDocument (type=booking): one row per hotel booking (the archive blob)
- TripContact: created if contactPhone or contactEmail present in email
- TripKeyInfo: created if confirmationCode present
- SavedItem: created via createBookingSavedItem() for the hotel as a saved place

### B. Write — email extractor

**File:** `src/app/api/webhooks/email-inbound/route.ts`  
**Hotel branch:** lines 1312–1461  
**Pre-branch dedup guard:** lines 982–998 — still ACTIVE for hotels (`extracted.type !== "flight"` condition leaves hotel check in place)

**Step 1 — ItineraryItem upsert (check-in, lines 1334–1352):**
- `findFirst` on (tripId + confirmationCode + type=LODGING + title startsWith "Check-in:")
- Creates or updates with: type=LODGING, title="Check-in: {hotelName}", scheduledDate=checkInDate, address, totalCost, currency, passengers, dayIndex, rooms (JSON)

**Step 2 — ItineraryItem upsert (check-out, lines 1354–1379):**
- Only if `checkOutDate` present
- `findFirst` on (tripId + confirmationCode + type=LODGING + title startsWith "Check-out:")
- Creates or updates with: type=LODGING, title="Check-out: {hotelName}", scheduledDate=checkOutDate, departureTime="11:00"

**Step 3 — TripContact create (lines 1382–1391):**
- If matchedTrip AND (contactPhone OR contactEmail): creates TripContact with name=hotelName, role="Hotel"

**Step 4 — TripKeyInfo create (lines 1393–1401):**
- If matchedTrip AND confirmationCode: creates TripKeyInfo (label="{hotelName} confirmation", value=confirmationCode)

**Step 5 — SavedItem create (lines 1403–1414):**
- Via `createBookingSavedItem()`: creates SavedItem linked to this hotel for the family profile + trip

**Step 6 — TripDocument create (lines 1415–1433):**
- Creates with label=hotelName, type="booking", savedItemId linked to SavedItem
- Content JSON keys: `type, vendorName, checkIn, checkOut, address, city, country, confirmationCode, totalCost, currency, contactPhone, contactEmail, guestNames, rooms, bookingUrl`

**TripDocument content shape (production sample):**
```json
{
  "type": "hotel",
  "vendorName": "Airbnb",
  "checkIn": "2025-02-13",
  "checkOut": "2025-02-15",
  "address": null,
  "city": null,
  "country": "Morocco",
  "confirmationCode": "HMN8HY4XQE",
  "totalCost": null,
  "currency": null,
  "contactPhone": "619.251.4575",
  "contactEmail": null,
  "guestNames": ["Greene Matt"],
  "rooms": {},
  "bookingUrl": "https://www.airbnb.com/trips/v1/..."
}
```

### C. Read (display) — Vault card

**Data source: TripDocument.content (parsed JSON blob)**  
**Same endpoint as flight:** `GET /api/trips/[id]/vault/documents`

**Fields consumed from content for display:**
- `booking.type` → "HOTEL" badge
- `booking.checkIn` → "Check-in" row (formatted date)
- `booking.checkOut` → "Check-out" row (formatted date)
- `booking.address` → "Address" row with Google Maps link
- `booking.confirmationCode` → "Confirmation" row
- `booking.totalCost` + `booking.currency` → "Total" row
- `booking.contactPhone` → "Phone" row
- `booking.guestNames` → "Guests" row
- `booking.rooms[]` — NOT displayed in current Vault render (present in blob, ignored)

**Edit behavior:** Vault PATCH updates TripDocument.content (and syncs SavedItem.rawTitle if savedItemId set). No ItineraryItem update on vault edit.

**Delete behavior (vault/documents/[documentId] DELETE):**
- Deletes TripDocument
- Cascades: deletes ALL ItineraryItems with matching confirmationCode for this trip
- Does NOT delete: TripContact, TripKeyInfo, SavedItem

### D. Read (display) — Itinerary day view

**Data source: ItineraryItem (type=LODGING)**  
**No TripDocument read.**  
Displays "Check-in: {hotelName}" and "Check-out: {hotelName}" cards on respective days.

### E. Read (display) — Booking Intel card

**Data source: SavedItem (categoryTags matching HOTEL_RE) + ItineraryItem (type matching HOTEL_RE)**  
- `itineraryLodging = itineraryItems.filter(i => HOTEL_RE.test(i.type))` — but `i.type` is "LODGING" and HOTEL_RE is `/lodg|hotel|hostel|.../i` — "LODGING" matches "lodg" so this works
- Booked SavedItems (isBooked=true) also counted
- Shows "N places confirmed" based on combined count

### F. Read (display) — Public share viewer

**Data source: ItineraryItem (type=LODGING)**  
Check-out entries filtered: "Skip LODGING check-out entries — hotel shows once on arrival day" (line 164).

### G. Write (manual add/edit/delete)

**No dedicated hotel POST/PATCH/DELETE route.** Hotels can only be:
- Added via email forwarding (extractor)
- Edited via PATCH /api/trips/[id]/vault/documents/{id} (updates TripDocument only, not ItineraryItem)
- Deleted via DELETE /api/trips/[id]/vault/documents/{id} (cascades ItineraryItem deletion)

### H. Dedup behavior

Pre-extraction guard (line 988–998) fires for hotels when confirmationCode matches any ItineraryItem across ALL trips for this profile. Re-forwarding a hotel email → dropped.

### I. Architecture type: Type B — ItineraryItem + TripDocument blob (no dedicated typed model)

---

## Section 5: ACTIVITY / TRAIN / CAR_RENTAL / RESTAURANT Booking Lifecycle

### A. Schema
No typed model for any of these. All data lives in:
- ItineraryItem (type matching the booking type): one row per booking
- TripDocument (type=booking): one row per booking (the archive blob)
- TripKeyInfo: created if confirmationCode present
- SavedItem: created if isSaveableBooking(extracted.type) is true

### B. Write — email extractor

**File:** `src/app/api/webhooks/email-inbound/route.ts`  
**Catch-all branch:** lines 1463–1665  
**Pre-branch dedup guard:** active for all non-flight types

**Non-booking low-confidence path (lines 1477–1535):**
- If confidence < 0.8 AND no confirmationCode AND no checkIn AND no totalCost: creates SavedItem only, no ItineraryItem, no TripDocument, returns early

**Confirmed booking path:**

**Step 1 — ItineraryItem upsert (lines 1567–1574):**
- `findFirst` on (tripId + confirmationCode + type=extracted.type.toUpperCase())
- For null-code items: title-based dedup using first 3 significant words (lines 1543–1565)
- Creates or updates with: type, title (activityName || vendorName || subject), scheduledDate, departureTime, arrivalTime, fromCity, toCity, confirmationCode, notes (synthesized route info), address, totalCost, currency, passengers, dayIndex

**Step 2 — TripKeyInfo create (lines 1576–1584):**
- If matchedTrip AND confirmationCode: creates TripKeyInfo

**Step 3 — SavedItem create (lines 1586–1600):**
- If isSaveableBooking(extracted.type): creates SavedItem

**Step 4 — TripDocument create (lines 1601–1620):**
- Creates with type="booking", savedItemId if SavedItem created
- Content JSON keys: `type, vendorName, activityName, fromCity, toCity, departureDate, departureTime, arrivalDate, arrivalTime, confirmationCode, totalCost, currency, contactPhone, contactEmail, guestNames, address, bookingUrl`

**TripDocument content shapes (production samples):**

Activity:
```json
{
  "type": "activity",
  "vendorName": "Norway's Best AS",
  "activityName": "Viking Valley entrance ticket, Fjord Cruise Nærøyfjord, ...",
  "fromCity": "Aurland",
  "toCity": "Flåm",
  "departureDate": "2026-07-12",
  "departureTime": "09:55",
  "arrivalDate": "2026-07-12",
  "arrivalTime": "15:35",
  "confirmationCode": "NEQE09",
  "totalCost": 5435,
  "currency": "NOK",
  "contactPhone": "+47 57 63 14 00",
  "contactEmail": "info@norwaysbest.com",
  "guestNames": ["Weiner Caroline"],
  "address": null
}
```

Train:
```json
{
  "type": "train",
  "vendorName": "Vy",
  "activityName": null,
  "fromCity": "Myrdal",
  "toCity": "Myrdal",
  "departureDate": "2026-07-11",
  "departureTime": "14:41",
  "arrivalDate": null,
  "arrivalTime": null,
  "confirmationCode": "QCX-ULE-ESE",
  "totalCost": null,
  "currency": null,
  "contactPhone": null,
  "contactEmail": "no.reply@vy.no",
  "guestNames": [],
  "address": null
}
```

### C. Read (display) — Vault card

**Data source: TripDocument.content (parsed JSON blob)**  
**Endpoint:** same `/api/trips/[id]/vault/documents`

**Fields consumed for display:**
- `booking.activityName` → "Activity" row (for activity type)
- `booking.fromCity` + `booking.toCity` → "Route" row (for train type)
- `booking.departureDate` + `booking.departureTime` → "Departure" row
- `booking.arrivalDate` + `booking.arrivalTime` → "Arrival" row
- `booking.address` → "Address" row
- `booking.confirmationCode` → "Confirmation" row
- `booking.totalCost` + `booking.currency` → "Total" row
- `booking.contactPhone` → "Phone" row
- `booking.guestNames` → "Guests" row

**Activity-specific Vault behavior:**
- Editable inline input for activityName (TripTabContent lines 6790–6807)
- Tapping opens ItineraryItemLocal modal synthesized from TripDocument.content fields
- Edit: PATCH TripDocument with updated content (does NOT update ItineraryItem)

**Train-specific Vault behavior:**
- Tapping opens ItineraryItemLocal modal synthesized from TripDocument.content fields

### D. Read (display) — Itinerary day view

**Data source: ItineraryItem**  
No TripDocument read.

### E. Read (display) — Booking Intel

**Activities:** reads ManualActivity.status and SavedItem.categoryTags/isBooked  
**Note:** email-imported ACTIVITY ItineraryItems are NOT counted in booking intel's activity tally. The intel reads ManualActivity + SavedItem, not ItineraryItem(type=ACTIVITY).

### F. Write (manual add/edit/delete)

**Activities:** ManualActivity model via `/api/trips/[id]/activities/[activityId]/route.ts`  
- PATCH: updates ManualActivity, recalculates dayIndex, geocodes if address/venueName present
- DELETE: deletes ManualActivity row
- Email-imported ACTIVITY ItineraryItems have NO dedicated PATCH/DELETE route — edit/delete goes through vault/documents endpoint

**Trains / Car rental / Restaurant:** No manual add UI. Only reachable via email forwarding.

### G. Dedup behavior

Pre-extraction guard (line 988–998) active. Re-forward → dropped if confirmationCode matches any ItineraryItem for this profile across all trips.

### H. Architecture type: Type C — TripDocument blob + ItineraryItem (no dedicated typed model)

---

## Section 6: MANUAL ACTIVITY Lifecycle

### A. Schema
ManualActivity: typed model, distinct from email-imported ItineraryItem(type=ACTIVITY).  
132 rows in production.

### B. Write (manual add)

Source: Tour-saved stops (via `/api/tours/save/route.ts`) OR user entry.  
Actually: tour save creates ManualActivity via `db.manualActivity.create` for each stop. Email-extracted activities do NOT write to ManualActivity — this is a critical split between two activity paths.

**Note per FLOKK_PRODUCT_SPEC.md:** Tour save ALSO creates a SavedItem, producing duplicate entries. The ManualActivity creation in `/api/tours/save/route.ts` is documented as a bug to be removed (spec lines 56–60).

### C. Read surfaces

- Booking Intel: ManualActivity.status used to count booked activities
- Public share viewer: manualActivities included directly
- Itinerary day view: ManualActivity rendered alongside ItineraryItems on day cards (merged by dayIndex)
- Vault: ManualActivity rows NOT displayed in Vault

### D. Architecture type: Type D — typed model only, no TripDocument, no ItineraryItem

---

## Section 7: Vault Read Coupling — Full Inventory

### What TripDocument.content fields drive each booking type's Vault display

**FLIGHT:**
| Content key | Display purpose | Fresh after re-forward? |
|---|---|---|
| fromCity, toCity | Route row | NO — stale, written once |
| fromAirport, toAirport | Route row fallback | NO — stale, written once |
| departureDate, departureTime | Departure row | NO — stale, written once |
| arrivalDate, arrivalTime | Arrival row | NO — stale, written once |
| confirmationCode | Confirmation row | YES — doesn't change |
| totalCost, currency | Total row | NO — stale, written once |
| guestNames | Guests row | NO — stale, written once |
| legs[] | NOT rendered | N/A — present but ignored |
| flightNumber | NOT rendered (used only for edit-modal Flight match) | NO |

**HOTEL:**
| Content key | Display purpose | Fresh? |
|---|---|---|
| checkIn, checkOut | Check-in/out rows | NO — stale |
| address | Address row | NO — stale |
| confirmationCode | Confirmation row | YES |
| totalCost, currency | Total row | NO — stale |
| contactPhone | Phone row | NO — stale |
| guestNames | Guests row | NO — stale |
| rooms[] | NOT rendered | N/A |

**ACTIVITY / TRAIN / CAR_RENTAL:**
| Content key | Display purpose | Fresh? |
|---|---|---|
| activityName | Activity row (activity type only) | Editable inline in Vault |
| fromCity, toCity | Route row (train type only) | NO — stale |
| departureDate, departureTime | Departure row | NO — stale |
| arrivalDate, arrivalTime | Arrival row | NO — stale |
| confirmationCode | Confirmation row | YES |
| totalCost, currency | Total row | NO — stale |
| address | Address row | NO — stale |

### Delete cascade

When a booking TripDocument is deleted via `DELETE /api/trips/[id]/vault/documents/{id}`:
1. Parses TripDocument.content for confirmationCode
2. Deletes ALL ItineraryItems with that confirmationCode on that trip
3. Deletes the TripDocument
4. Does NOT delete: FlightBooking, Flight, TripContact, TripKeyInfo, SavedItem

This means: deleting a flight booking from the Vault leaves orphaned FlightBooking + Flight rows that are never displayed (they have no Vault entry) but also never cleaned up.

---

## Section 8: Cross-Cutting Concerns

### 8.1 Pre-extraction dedup guard (email-inbound/route.ts line 982–998)

Current condition after Phase 2A.1:
```typescript
if (incomingConfCode && extracted.type !== "flight") {
  // check ItineraryItem.confirmationCode across all trips for this profile
}
```

**Applies to:** hotel, activity, train, car_rental, restaurant (all non-flight types)  
**Does NOT apply to:** flight (handled at write layer in writeFlightFromEmail)  
**Scope:** Global profile-level — a code found on ANY trip for this profile blocks re-forward  
**Risk:** If a booking was matched to the wrong trip on initial import, re-forwarding to the correct trip is permanently blocked

### 8.2 Public share viewer (/share/[token]/page.tsx)

**Sources read:**
- Trip (with itineraryItems, manualActivities, savedItems, placeRatings)
- ItineraryItem: all types — FLIGHT, LODGING, TRAIN, ACTIVITY, etc.
- ManualActivity
- SavedItem (filtered to dayIndex > 0, excluding tags matching flight/airfare/hotel/lodging)

**Does NOT read:** TripDocument, Flight, FlightBooking, TripKeyInfo, TripContact

**Stale-cache risk:** None for the share viewer. It reads ItineraryItem and ManualActivity directly, which are always current. The share viewer is unaffected by the TripDocument staleness issue.

**Note:** LODGING check-out ItineraryItems are filtered out (show hotel only once on check-in day).

### 8.3 Trip clone (/api/trips/clone/route.ts)

**Sources copied:**
- Trip metadata (title, cities, country, hero image)
- SavedItem rows (with dayIndex > 0 only, if importActivities=true)

**Does NOT copy:** ItineraryItem, ManualActivity, Flight, FlightBooking, TripDocument, TripContact, TripKeyInfo

**Note:** Clone creates a blank trip from an existing trip's metadata + optionally its saved places. No booking data carries over. Only applies to PUBLIC source trips.

### 8.4 Trip steal (steal-to-new/route.ts)

**Sources copied:**
- Trip metadata
- ItineraryItem rows → converted to SavedItem rows for the new trip owner
- ManualActivity rows → converted to SavedItem rows for the new trip owner

**Does NOT copy:** Flight, FlightBooking, TripDocument, TripContact, TripKeyInfo

**Note:** Steal converts itinerary entries to saved-place suggestions in the new owner's trip. No booking confirmation data carries over. Source authorization: shareToken.

### 8.5 Cron jobs

All 5 cron jobs (enrich-saved-items, nudge-users, trip-lifecycle, enrich-manual-activities, pre-trip-reminder) were checked via grep for Flight, FlightBooking, TripDocument, ItineraryItem, ManualActivity references. **No matches found.** Cron jobs do not touch booking models.

- `enrich-saved-items`: enriches SavedItem records (venue images, geocoding)
- `enrich-manual-activities`: enriches ManualActivity geocoding
- `nudge-users`: lifecycle nudge emails
- `trip-lifecycle`: trip status transitions
- `pre-trip-reminder`: reads Trip + FamilyProfile/User for email send only; no booking model reads

### 8.6 Booking Intel card (/api/trips/[id]/booking-intel/route.ts)

**Sources read:**
- `flights: { select: { id, type, status } }` — Flight model, status field only
- `savedItems: { select: { categoryTags, isBooked } }` — SavedItem, for hotel and activity intel
- `manualActivities: { select: { status } }` — ManualActivity, for activity intel
- `itineraryItems: { select: { type } }` — ItineraryItem, for lodging count only
- `keyInfo: { select: { label, value } }` — TripKeyInfo, for insurance/visa detection
- `documents: { select: { label } }` — TripDocument label only (insurance/visa label detection)
- FamilyMember.passportExpiryDate, citizenshipCountry, passportCountry, visaNotes

**Does NOT read:** FlightBooking, TripDocument.content, ItineraryItem(ACTIVITY) for activity count

**Gap:** Email-imported ACTIVITY ItineraryItems are not counted in the activity intel tally. The intel reads ManualActivity + SavedItem for activities. A user who forwarded 5 activity confirmation emails would show 0 booked activities in the intel card.

---

## Section 9: Architecture Classification

| Booking type | Typed model | ItineraryItem | TripDocument | Architecture |
|---|---|---|---|---|
| Flight (email-imported) | FlightBooking + Flight ✓ | FLIGHT (per-leg) ✓ | blob (stale) | Type A |
| Hotel/Lodging (email-imported) | None | LODGING (check-in + check-out) ✓ | blob (stale) | Type B |
| Activity (email-imported) | None | ACTIVITY ✓ | blob (stale) | Type C |
| Train (email-imported) | None | TRAIN ✓ | blob (stale) | Type C |
| Car rental (email-imported) | None | CAR_RENTAL ✓ | blob (stale) | Type C |
| Restaurant (email-imported) | None | RESTAURANT ✓ | blob (stale) | Type C |
| Manual activity | ManualActivity ✓ | None | None | Type D |
| Operator plan | None | ACTIVITY + LODGING ✓ | operator_plan blob ✓ | Type B variant |

### Ideal architecture (for reference — fix design in chat, not here)

| Booking type | Current | Gap |
|---|---|---|
| Flight | Type A (both exist, Vault reads stale blob) | Vault should read from FlightBooking+Flight instead of blob |
| Hotel | Type B (no typed model, ItineraryItem exists, Vault reads stale blob) | Needs HotelBooking typed model OR Vault synthesizes from ItineraryItem |
| Activity | Type C (no typed model, ItineraryItem exists, Vault reads stale blob) | Vault synthesizes from ItineraryItem OR typed model |
| Train | Type C | Same as activity |
| Car rental | Type C | Same as activity |
| Manual activity | Type D (ManualActivity only) | Should appear in Vault; currently invisible |
| Operator plan | Type B variant | TripDocument read is appropriate here (no ItineraryItem field holds all plan metadata) |

---

## Section 10: Failure Modes Currently in Production

### FM-1: Vault card shows stale data after re-forward (HIGH)
**Booking types affected:** FLIGHT, HOTEL, ACTIVITY, TRAIN, CAR_RENTAL  
**Root cause:** TripDocument is written once on initial import and never updated. Re-forwarding replaces ItineraryItem and Flight rows correctly but TripDocument persists with original AI extraction data.  
**Observed:** Sri Lanka FHMI74 Vault card shows HND→LHR after Flight table holds HND→SIN→CMB→LHR.  
**Severity:** High — primary user-facing booking display is wrong.

### FM-2: Vault delete leaves orphaned FlightBooking + Flight rows (HIGH)
**Booking types affected:** FLIGHT  
**Root cause:** Vault delete (`DELETE /vault/documents/{id}`) cascades to ItineraryItem but does not touch FlightBooking or Flight. Rows remain in DB with no Vault entry.  
**Severity:** High — data accumulates, no cleanup path.

### FM-3: Manual flight add creates Flight row with null flightBookingId (MEDIUM)
**Booking types affected:** FLIGHT  
**Root cause:** `POST /api/trips/[id]/flights` creates a Flight row without a FlightBooking parent. This violates the Phase 1 design (flightBookingId should be required after Phase 4).  
**Severity:** Medium — orphaned Flight rows, breaks invariants.

### FM-4: Booking Intel undercounts activities for email-imported bookings (MEDIUM)
**Booking types affected:** ACTIVITY  
**Root cause:** `/api/trips/[id]/booking-intel` reads ManualActivity + SavedItem for activity count. Email-imported ACTIVITY ItineraryItems are not counted.  
**Severity:** Medium — users who forward activity emails see "missing" activity status despite confirmed bookings.

### FM-5: Hotel edit (Vault PATCH) updates TripDocument but not ItineraryItem (MEDIUM)
**Booking types affected:** HOTEL  
**Root cause:** `PATCH /vault/documents/{id}` updates TripDocument.content and SavedItem but does not propagate changes to ItineraryItem(type=LODGING). Edit on the Vault is not reflected on day view.  
**Severity:** Medium — Vault and day view show different hotel data after edit.

### FM-6: Activity edit (Vault inline activityName) updates TripDocument but not ItineraryItem (LOW)
**Booking types affected:** ACTIVITY  
**Root cause:** Same as FM-5. Inline activityName edit PATCHes TripDocument only.  
**Severity:** Low — activityName is mainly cosmetic; other fields (date, time) not editable inline.

### FM-7: Re-forward permanently blocked for hotels/activities if wrong-trip match (MEDIUM)
**Booking types affected:** HOTEL, ACTIVITY, TRAIN, CAR_RENTAL, RESTAURANT  
**Root cause:** Pre-extraction dedup guard checks ItineraryItem.confirmationCode across ALL trips for profile. If initial import matched to wrong trip, re-forwarding to correct trip returns `dropped`.  
**Severity:** Medium — user data stuck on wrong trip, no self-serve recovery path.

### FM-8: DOAL4Z (empty airports) flight never surfaces correctly (LOW)
**Booking types affected:** FLIGHT  
**Root cause:** Flight row has empty fromAirport/toAirport strings. ItineraryItem has no FLIGHT entries for this booking. Booking Intel counts it as a booked flight (status=booked). Vault card shows empty route.  
**Severity:** Low — one known row; resolution requires re-forward after Phase 4 AI prompt improvement.

### FM-9: Operator plan TripDocument label differs from booking TripDocument label — different render paths (LOW)
**Booking types affected:** Operator plan only  
**Root cause:** operator_plan type documents are NOT filtered into the "Imported Bookings" section (which filters `type === "booking"` only). They render in the "Documents & Links" section. This is currently correct behavior but the distinction between `operator_plan` and `booking` is invisible to users.  
**Severity:** Low — cosmetic inconsistency, not a data bug.

### FM-10: TripDocument.savedItemId is null for all email-imported flight TripDocuments (LOW)
**Booking types affected:** FLIGHT  
**Root cause:** The email extractor's flight branch does not call `createBookingSavedItem()` — only hotel and activity branches do. Flight TripDocuments have no associated SavedItem.  
**Severity:** Low — flights are not a use-case for saved-place semantics; this is expected but undocumented.

---

## Section 11: Recommended Fix Order

### Phase 2A.2 — Fix Vault flight card to read from typed model (effort: S)
**Dependency:** Phase 2A complete ✓  
**Scope:** Change `GET /api/trips/[id]/vault/documents` to synthesize flight booking data from `FlightBooking` + `Flight` rows instead of TripDocument.content for type="flight" documents. OR: Change Vault render in TripTabContent to call a separate endpoint for flight bookings.  
**Fixes:** FM-1 (flight only)  
**Risk:** Low — isolated to Vault read path for flights

### Phase 2B — Manual add/edit creates FlightBooking parent (effort: M)
**Dependency:** Phase 2A.2  
**Scope:** Update `POST /api/trips/[id]/flights` to create a FlightBooking with no confirmationCode, then create the Flight linked to it. Update `DELETE /api/trips/[id]/flights/[flightId]` to also delete FlightBooking if it has no other Flight children.  
**Fixes:** FM-3  

### Phase 2C — Vault delete cascades to FlightBooking + Flight (effort: S)
**Dependency:** Phase 2A.2  
**Scope:** In `DELETE /api/trips/[id]/vault/documents/{id}`, add: for type="flight" documents, also delete FlightBooking rows where tripId matches and confirmationCode matches.  
**Fixes:** FM-2  

### Phase 3 — Vault reads ItineraryItem for hotel/activity/train (effort: M)
**Dependency:** Phase 2A.2 design validated  
**Scope:** For hotel/activity/train/car_rental TripDocuments, Vault display synthesizes from ItineraryItem instead of TripDocument.content. TripDocument becomes an archive-only record.  
**Fixes:** FM-1 (hotel, activity, train, car_rental), FM-5, FM-6  
**Note:** Hotel has two ItineraryItems (check-in + check-out). Synthesis must reconstruct single booking view from pair.

### Phase 4 — Enforce FlightBooking invariant, add source column (effort: M)
**Dependency:** Phase 2B  
**Scope:** Add `source` column on Flight (enum: email | manual). Enforce `flightBookingId` non-null. Clean up orphaned F5/F6 test rows.  
**Fixes:** FM-3 cleanup, enables future re-import-without-manual-edit-loss design

### Phase 5 — Fix non-flight dedup guard for wrong-trip re-forwards (effort: M)
**Dependency:** None  
**Scope:** Replace global ItineraryItem.confirmationCode dedup check with trip-scoped check for hotel/activity. Allow re-forward to a different trip if code doesn't exist on THAT trip.  
**Fixes:** FM-7  

### Phase 6 — Booking Intel counts email-imported activities (effort: S)
**Dependency:** None  
**Scope:** Add ItineraryItem(type=ACTIVITY) count to the booking intel activity tally.  
**Fixes:** FM-4  

### Phase 7 — HotelBooking typed model (effort: L)
**Dependency:** Phase 3  
**Scope:** Add HotelBooking schema (hotel name, checkIn, checkOut, confirmationCode, address, status). Migrate existing LODGING ItineraryItems. Update extractor to write HotelBooking. Vault reads from HotelBooking.  
**Fixes:** Closes Type B architecture gap for hotels; enables proper dedup at write layer  
**Note:** This is a Phase 1-equivalent migration for hotels.

---

*End of audit. Fix design decisions to be made in chat before any code changes.*
