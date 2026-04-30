# Flokk Foundations

This document is the source of truth for the platform's primitives, entity model, rendering surfaces, lifecycles, and discipline references. Read at session start. Every product spec moving forward grounds in this document per Discipline 4.14 (Comprehensive Spec Grounding).

Last updated: Chat 42. Built from direct codebase reads + live Supabase queries. No assumptions.

---

## 1. The "Pill" Primitive — What It Actually Is

### Terminology clarification

Matt uses "Pill" to mean entity cards. In the codebase, `src/components/ui/Pill.tsx` is a **filter chip component only** — not an entity card. Its `PillVariant` enum has four values: `filter`, `platform`, `status`, `category`. It renders as a small rounded badge used for category filters and status labels.

**There is no universal entity card primitive.** Cards are surface-specific implementations.

### What does exist as shared primitives

`PlaceActionRow` (`src/components/features/places/PlaceActionRow.tsx`) — the universal **action button row** used across nearly every surface. It renders Flokk It / Add to trip / + Itinerary / Link / Rate / Share / Edit buttons. It does NOT render card layout, image, or title — it is actions only.

`EntityStatusPill` (`src/components/ui/EntityStatusPill.tsx`) — a status badge (colored dot + label) for `on_itinerary`, `booked`, `rated`, `completed` states. Hidden when status is `saved`.

`CardActionButton` (`src/components/ui/CardActionButton.tsx`) — a generic button with `primary`, `secondary`, `disabled` variants. Used for modal CTAs.

### Entity card anatomy (reconstructed from all surfaces)

Every surface-specific card renders some combination of:
1. **Image** — resolved via priority chain (see Section 5)
2. **Title** — entity's primary name field
3. **Location** — city / country / address
4. **Category tags** — from `categoryTags[]` or type string
5. **Status badge** — `EntityStatusPill` when status is not `saved`
6. **Action row** — `PlaceActionRow` or inline buttons

### Card modes across surfaces

| Mode | Description | Owner controls shown |
|---|---|---|
| owner-editable | User owns the trip/save | Delete, Edit, Mark booked, Add to itinerary |
| viewer-read-only | Viewing someone else's trip | Save to Flokk ("Flokk It") only |
| rating | Post-trip capture | Star input (1-5), notes, Would return |
| recommendation | AI-generated suggestions | + Save, + Itinerary, Link |
| public | Unauthenticated share view | Flokk It (→ sign-up if not logged in), Link |

---

## 2. Entity Types

### 2A. SavedItem (`src/prisma/schema.prisma` line 362)

The primary Vault entity. Created by URL paste, email forward, in-app save, or booking co-create.

**All columns:**
- `id`, `familyProfileId`, `tripId` (nullable — unassigned if null)
- `sourceMethod`: `URL_PASTE | EMAIL_FORWARD | IN_APP_SAVE | SHARE_SAVE | MANUAL`
- `sourcePlatform`: `instagram | google_maps | direct | ...`
- `sourceUrl` — original URL from paste/forward
- `rawTitle`, `rawDescription` — original extracted content
- `mediaThumbnailUrl` — Instagram og:image, email attachment
- `placePhotoUrl` — Google Places photo (primary image source)
- `websiteUrl` — canonical URL (enriched via Google Places)
- `affiliateUrl` — unused today
- `lat`, `lng` — coordinates from enrichment
- `destinationCity`, `destinationCountry`
- `categoryTags` — normalized array
- `interestKeys`, `relevanceScore`
- `status`: `UNORGANIZED | TRIP_ASSIGNED | SCHEDULED | ARCHIVED`
- `extractionStatus`: `PENDING | PROCESSING | ENRICHED | FAILED | ENRICHMENT_FAILED`
- `enrichmentAttempts` — retry counter
- `dayIndex` — which trip day assigned to (nullable)
- `notes`, `sortOrder`, `startTime`
- `userRating` — owner's star rating (1-5); written directly on SavedItem, NOT via PlaceRating (Option B architecture)
- `userNote` — owner's private note
- `isBooked`, `bookedAt` — manual booking flag
- `extractedCheckin`, `extractedCheckout` — dates from email parsing
- `needsPlaceConfirmation` — verification flag
- `communitySpotId` — link to CommunitySpot
- `tourId` — link to tour if part of a tour
- `deletedAt` — soft delete
- `eventDateTime`, `eventVenue`, `eventCategory`, `eventTicketUrl`, `eventSourceProvider`, `eventSourceEventId` — events data
- **No `shareToken` column**

**Image source:** `placePhotoUrl` (Google Places lh3.googleusercontent.com URL), with `mediaThumbnailUrl` as fallback. Populated during enrichment via `enrichSavedItem()` → `enrichWithPlaces()`.

**Lifecycle:** PENDING → enrichment → ENRICHED → renders rich card with image

---

### 2B. ItineraryItem (`src/prisma/schema.prisma` line 893)

Structured booking records from email parsing or manual entry.

**All columns (confirmed from live DB schema query):**
- `id`, `tripId` (nullable), `familyProfileId`
- `type`: `FLIGHT | LODGING | TRAIN | ACTIVITY | CAR_RENTAL | RESTAURANT | OTHER`
- `title`, `notes`, `address`
- `scheduledDate`, `departureTime`, `arrivalTime`
- `fromAirport`, `toAirport`, `fromCity`, `toCity`
- `confirmationCode`
- `totalCost`, `currency`
- `passengers` (array)
- `dayIndex`, `sortOrder`
- `latitude`, `longitude` — geocoded on create
- `arrivalLat`, `arrivalLng` — for FLIGHT/TRAIN destination
- `sourceType`: `EMAIL_IMPORT`
- `needsVerification`
- `rooms` (JSON) — lodging room details
- `bookingSource`: `booking.com | airbnb | hotels.com | expedia | marriott | hilton | hyatt | vrbo | direct | unknown`
- `managementUrl` — link to manage reservation (e.g., `https://secure.booking.com/myreservations.html`)
- `venueUrl` — resolved canonical URL (0% populated in production as of Chat 42)
- `createdAt`
- **NO image column of any kind** — confirmed by live DB column list

**Image path:** `getItemImage(title, null, null, type, city)` → falls to `TYPE_IMAGES`:
- `lodging|hotel|resort|inn|hostel` → generic Unsplash hotel
- `flight|airline|airport|aviation` → generic Unsplash plane
- `train|rail|railway|shinkansen` → generic Unsplash train
- `restaurant|food|dining|cafe|bar` → generic Unsplash dining

**URL coverage:** `venueUrl` is 0% populated. `managementUrl` is populated for LODGING items from booking.com/similar. For flights/trains: no link.

**Concrete trace — Moxy Seoul Insadong:**
- ItineraryItem row: `venueUrl: null`, `managementUrl: "https://secure.booking.com/myreservations.html"`, no image
- Parallel SavedItem row: `placePhotoUrl: "https://lh3.googleusercontent.com/places/..."`, `websiteUrl: "https://www.marriott.com/..."`, `extractionStatus: ENRICHED`
- The hotel image the user sees comes from the SavedItem — not the ItineraryItem

---

### 2C. ManualActivity (`src/prisma/schema.prisma` line 742)

User-entered activities not imported from email.

**All columns:**
- `id`, `tripId`, `familyProfileId` (implicit via trip)
- `title`, `venueName`, `address`
- `date`, `time`, `endTime`
- `lat`, `lng`
- `website` — URL field (name differs from SavedItem's `websiteUrl`)
- `price`, `currency`
- `notes`
- `status`: `interested | confirmed | booked`
- `confirmationCode`
- `city`, `type` (default `ACTIVITY`)
- `imageUrl` — explicit image field (populated if entered manually)
- `dayIndex`, `sortOrder`
- `tourId` — link to tour
- `deletedAt`
- **No `shareToken` column**

**Image:** `imageUrl` if populated, otherwise none.

---

### 2D. GeneratedTour + TourStop

**GeneratedTour (`src/prisma/schema.prisma` line 1036):**
- `id`, `title`, `destinationCity`, `destinationCountry`
- `prompt`, `durationLabel`, `transport`
- `familyProfileId`
- `isPublic`, `categoryTags`
- `originalTargetStops`
- `deletedAt`, `createdAt`, `updatedAt`
- **No image column on GeneratedTour itself**
- **No `shareToken` column**

**TourStop (`src/prisma/schema.prisma` line 1061):**
- `id`, `tourId`, `orderIndex` (**NOT `stopOrder`** — critical for query ordering)
- `name`, `address`, `lat`, `lng`
- `durationMin`, `travelTimeMin`
- `why`, `familyNote`
- `imageUrl` — stop-level image from AI generation
- `websiteUrl` — stop-level URL
- `placeId` — Google Places place_id for Maps URL fallback
- `ticketRequired`: `free | ticket-required | advance-booking-recommended | unknown`
- `placeTypes` (array)
- `savedItemId` — optional link to a SavedItem
- `deletedAt`

**Tour rendering:**
- On `/tour` page: rendered via `TourResults.tsx` — has all owner affordances (remove stops, regenerate, save-to-trip modal). **No `readOnly` prop today.**
- On `/trips/[id]` Tours tab: rendered via `ToursContent` (inline function in TripTabContent.tsx line 6601). Does NOT use `TourResults.tsx`. Has its own expand/collapse card layout with per-stop detail modal.

---

### 2E. PlaceRating (`src/prisma/schema.prisma` line 942)

Post-trip ratings. Three entity types can be rated.

**All columns:**
- `id`, `familyProfileId`, `tripId`
- `itineraryItemId` (nullable) — rates an ItineraryItem
- `manualActivityId` (nullable) — rates a ManualActivity
- `savedItemId` (nullable) — rates a SavedItem (but see note below)
- `placeName`, `placeType`
- `destinationCity`, `lat`, `lng`
- `rating` (1-5), `notes`, `wouldReturn`, `kidsRating`
- `createdAt`

**CRITICAL — Two rating architectures:**
- **ItineraryItems and ManualActivities** → rated via `PlaceRating` row (full model above)
- **SavedItems** → rated by writing directly to `SavedItem.userRating` (Option B architecture). PlaceRating rows are NOT created for SavedItems. `savedItemId` on PlaceRating exists in schema but is the legacy path.

**Rating display on cards:**
- `getEntityStatus()` checks `userRating` on SavedItem
- `EntityStatusPill` renders `Rated {n}★` in amber when rated
- Community picks on Discover show `averageRating` from aggregated `SpotContribution` ratings on `CommunitySpot`

---

## 3. Rendering Surfaces

### 3A. /saves (Vault) — owner editable

**Component:** `SavesScreen.tsx` containing `SaveCard` (local function, line 456)

**Entity:** SavedItem

**Image:** `getItemImage(rawTitle, placePhotoUrl, mediaThumbnailUrl, categoryTags[0], destinationCity, destinationCountry)`

**Tabs:** All / Upcoming / Past / Unassigned / Tours (category filter pills across top)

**Actions (via `PlaceActionRow`):** + Itinerary, Link (if websiteUrl), Rate, Share, Edit (if canEdit)

**Status badge:** `EntityStatusPill` for booked/rated/on_itinerary

**Modal:** `SaveDetailModal` on card click

---

### 3B. /trips/[id] tab=Saved — owner editable

**Component:** `TripTabContent.tsx` — renders `SavedDisplayItem` grid

**Entity:** SavedItem (filtered to trip)

**Image:** same `getItemImage()` chain

**Actions:** Share (via `handleShare` → `sharePlace()`), Delete, Email/URL/Day badge, Rated/Day badge

---

### 3C. /trips/[id] tab=Itinerary — owner editable

**Component:** `TripTabContent.tsx` — `ItineraryContent` sub-function

**Entities:** ItineraryItem (LODGING, FLIGHT, TRAIN, ACTIVITY, OTHER), ManualActivity

**Image:** None for ItineraryItem. ManualActivity shows `imageUrl` if set.

**Card style:** Terracotta left border (`border-left: 3px solid #C4664A`), "Booked" badge, pure text layout

**Actions:** Share (via `shareBtn(title)` → `sharePlace()`), Link (venueUrl or managementUrl), Mark booked, Delete, Move

**Sort weights:** Arrival flights: 10, Check-in: 20, Activities: 50, Trains: 70, Check-out: 80, Departure flights: 90

---

### 3D. /trips/[id] tab=Tours — owner editable

**Component:** `ToursContent` (inline in TripTabContent.tsx, line 6601)

**Entity:** GeneratedTour + TourStop

**Image:** TourStop `imageUrl` per stop; tour-level hero from `coverImage` (first stop's image)

**Actions:** Expand/collapse, remove stop (with 8s undo), regenerate, save-to-trip modal

**Note:** Does NOT use `TourResults.tsx`. That component is only on `/tour` page.

---

### 3E. /trips/[id] tab=Recommended — owner view, AI-generated

**Component:** `RecommendedContent` (inline in TripTabContent.tsx, line 5268)

**Entity:** AI recommendation (not a DB model — ephemeral, from `/api/recommendations/ai`)

**Image:** `rec.photoUrl ?? rec.imageUrl ?? getTripCoverImage(destinationCity, destinationCountry)`

**Actions:** + Save (creates SavedItem via `/api/saves`), + Itinerary (creates ManualActivity)

**Status:** `EntityStatusPill` when user has already saved the rec place

**No Share button on Recommended cards**

---

### 3F. /trips/[id] tab=Vault — structural booking data

**NOT a pill grid.** This is the "Imported Bookings" list showing confirmation numbers, costs, addresses. Renders ItineraryItems as a structured data view with totals, not visual cards.

---

### 3G. /trips/[id] tab="How was it?" — post-trip rating

**Component:** `HowWasItContent` (inline in TripTabContent.tsx, line 6157)

**Entities rated:** ItineraryItems (ACTIVITY and LODGING check-in only) + SavedItems (trips-assigned) + ManualActivities

**Rating architecture:**
- ItineraryItem ratings → `PlaceRating` model via `/api/trips/{id}/ratings`
- ManualActivity ratings → `PlaceRating` model via `/api/trips/{id}/ratings`
- SavedItem ratings → `SavedItem.userRating` directly via PATCH `/api/saves/{id}` (Option B — no PlaceRating created)

**Actions:** Star input (1-5), notes text, Would return toggle, "Save" to commit

**Spur prompt:** "Add a place" form at bottom for adding un-tracked places

**Trip-level CTA:** "Copy share link" button (copies `/share/{shareToken}`)

---

### 3H. /discover — Community Spots + Community Picks

**Component:** `/src/app/(app)/discover/page.tsx`

**Entity types:**
- Community Spots (CommunitySpot model) — uses `PlaceActionRow` in `card-compact` variant
- Community Picks (rated SavedItems) — uses `PlaceActionRow` in `card-compact` variant

**Image for Picks:** `act.imageUrl` (populated from the SavedItem's placePhotoUrl at query time)

**Actions (via PlaceActionRow):** Flokk It, + Itinerary, Link (resolveSaveLink chain), Rate, Share

---

### 3I. /share/[token] — existing trip share (public)

**Components:** `page.tsx` (server) + `ShareItineraryView.tsx` (client) + `ShareActivityCard.tsx` + `SaveDayButton.tsx`

**Auth:** Not required. Public access.

**Entity types rendered:**
- SavedItem → `ShareActivityCard`: image from `placePhotoUrl ?? mediaThumbnailUrl`, "Flokk It" CTA
- ItineraryItem → inline in `ShareItineraryView.tsx`: `imageUrl: null` explicitly (line 281 in page.tsx: `// ItineraryItem has no image field in schema`)
- ManualActivity → inline: `imageUrl: ma.imageUrl ?? null`

**Save CTA:** "Flokk It" → calls `/api/saves/from-share` (passes title, city, lat, lng, placePhotoUrl, websiteUrl). Unauthenticated users → redirect to sign-up with `redirect_url` query param.

**"Save day" CTA:** `SaveDayButton` saves all items in a day at once.

---

### 3J. /s/[token] — single-item public share (NEW, Bundle 2)

**Does not exist yet.** No directory, no scaffolding, no `shareToken` columns on entities.

See Section 7 (Open Questions / Known Gaps) for full prerequisite list.

---

### 3K. /home — recent saves + popular widgets

**Component:** `RecentSavesCards.tsx`

**Entity:** SavedItem

**Image:** `getItemImage()` full chain

**Actions:** Opens `SaveDetailModal` on click. Delete button (owner only).

---

## 4. Lifecycles

### 4A. URL Paste save lifecycle

1. User pastes URL in Vault → POST `/api/saves` with `sourceMethod: URL_PASTE`
2. `SavedItem` created with `extractionStatus: PENDING`
3. `enrichSavedItem(id)` called async: fetches URL metadata via ScrapingBee, calls Google Places `enrichWithPlaces(title, city)`, writes `placePhotoUrl` + `websiteUrl` + `lat/lng` + `destinationCity`
4. `extractionStatus` → `ENRICHED` (or `FAILED`)
5. Cron job `/api/cron/enrich-saved-items` catches up on failed items

**Namsam Cable Car trace:** URL_PASTE → `enrichSavedItem` → `placePhotoUrl: lh3.googleusercontent.com/places/...`, `websiteUrl: namsangcablecar.com`, `extractionStatus: ENRICHED`

### 4B. Email forward lifecycle (URL-only emails)

1. Email to trips@ → CloudMailin → POST `/api/webhooks/email-inbound/route.ts`
2. URL extracted → `SavedItem` created → same enrichment as 4A

### 4C. Booking email lifecycle (hotel, flight, train, activity)

1. Booking confirmation email to trips@ → CloudMailin → email-inbound webhook
2. Claude API parses email → extraction JSON (type, title, dates, confirmation code, city, cost, etc.)
3. **For HOTEL:** Two records created:
   a. `ItineraryItem` (LODGING type, check-in + check-out) — has `managementUrl`, geocoded lat/lng, NO image
   b. `SavedItem` via `createBookingSavedItem()` (`src/lib/booking-saved-item.ts`) — initial `placePhotoUrl` from `getVenueImage(hotelName)`, then async `enrichWithPlaces()` fills real Google Places photo
4. **For FLIGHT:** `ItineraryItem` (FLIGHT type) only — no parallel SavedItem
5. **For TRAIN:** `ItineraryItem` (TRAIN type) only — no parallel SavedItem
6. **For ACTIVITY/OTHER:** `ItineraryItem` + parallel `SavedItem` via `createBookingSavedItem()`

**Moxy Seoul Insadong trace:**
- ItineraryItem: LODGING, `managementUrl: booking.com/myreservations`, `venueUrl: null`, no image
- SavedItem: `placePhotoUrl: lh3.googleusercontent.com/places/...`, `websiteUrl: marriott.com`, `extractionStatus: ENRICHED`

**Baymond Hotel trace:**
- SavedItem: `placePhotoUrl: lh3.googleusercontent.com/places/...`, `websiteUrl: baymond.co.kr`, `extractionStatus: ENRICHED`

**DEFINITIVE ANSWER:** All images rendered in Flokk cards come from `SavedItem.placePhotoUrl`. ItineraryItems have no image column and are rendered as text-only cards. Hotel bookings are the only entity type that renders visually rich because they co-create a SavedItem.

### 4D. Rating lifecycle

1. Trip moves to COMPLETED or user manually navigates to "How was it?" tab
2. `HowWasItContent` fetches ItineraryItems + SavedItems + ManualActivities for the trip
3. User rates each item (star input 1-5, notes, Would return)
4. On "Done capturing":
   - ItineraryItem ratings → `PlaceRating` created via POST `/api/trips/{id}/ratings`
   - ManualActivity ratings → `PlaceRating` created via same endpoint
   - SavedItem ratings → `SavedItem.userRating` updated directly via PATCH `/api/saves/{id}` (Option B — no PlaceRating)
5. High-rated SavedItems surface as "Flokker picks" in community Discover if `isPublic` criteria met

### 4E. Tour lifecycle

1. User opens `/tour` page, inputs prompt → POST `/api/tours/generate`
2. `GeneratedTour` + `TourStop[]` created (stops have `imageUrl`, `websiteUrl`, `orderIndex`)
3. User reviews stops in `TourResults.tsx` (owner affordances: remove, regenerate)
4. User clicks "Save to trip" → links `GeneratedTour` to `tripId`
5. Tours tab on trip shows saved tours via `ToursContent` (different component from TourResults)
6. Stops expanded inline in ToursContent — has its own stop card + stop detail modal

---

## 5. Pill Render Decision Tree

### Image priority (by entity type)

**SavedItem:**
1. `placePhotoUrl` (Google Places — lh3.googleusercontent.com)
2. `getVenueImage(rawTitle)` — curated VENUE_IMAGES lookup (Tokyo DisneySea, Gyeongbokgung, etc.)
3. `mediaThumbnailUrl` (Instagram og:image, email attachment)
4. `TYPE_IMAGES[categoryTag keyword match]` — generic Unsplash by category
5. `lookupDestination(city, country)` — destination Unsplash
6. `DEFAULT_COVER` — final fallback

**ItineraryItem:** No image. Falls to `TYPE_IMAGES` on type keyword. Cards render as text-only.

**ManualActivity:** `imageUrl` if set; otherwise no image.

**TourStop:** `imageUrl` from AI generation.

**RecommendedContent (AI rec):** `rec.photoUrl ?? rec.imageUrl ?? getTripCoverImage(city, country)`

### URL priority (by entity type)

**SavedItem (via `resolveSaveLink()`):**
1. `websiteUrl`
2. `sourceUrl`
3. `communitySpotWebsiteUrl` (linked CommunitySpot)
4. Google Maps URL from `lat/lng`
5. Google Maps URL from `name + city`
6. `null`

**ItineraryItem:**
1. `managementUrl` (booking platform management link — populated for LODGING)
2. `venueUrl` (0% populated today — do not rely on)
3. `null` for FLIGHT/TRAIN

**ManualActivity:** `website` field directly

**TourStop:** `websiteUrl` directly, fallback to Google Maps via `placeId`

### Address priority (by entity type)

**SavedItem:** No `address` column. Address for a hotel SavedItem lives on its paired ItineraryItem.

**ItineraryItem (LODGING):**
1. `ItineraryItem.address` — written by email-inbound parser at create/update time (TEXT column, 81% populated)
2. `TripDocument.content.address` — also written at parse time (JSON blob); may be populated when ItineraryItem.address is null if the rows were processed in separate parser runs
3. `null`

**ItineraryItem (FLIGHT/TRAIN/CAR_RENTAL):** No address applicable.

**ManualActivity:** `address` field directly.

**TourStop:** `address` field directly.

**SavedItem (non-lodging):** No address column; address implied by `destinationCity` + map coords.

**Implementation note:** `ItineraryItem.address` and `TripDocument.content.address` can drift when a hotel triggers two separate parser runs (e.g., initial check-in email vs later confirmation). The TripDocument JSON is the backup source for backfills. Diagnostic confirmed in Chat 42: 4 Moxy rows had null `ItineraryItem.address` but non-null `TripDocument.content.address`.

### Share token resolution

Today: only `Trip.shareToken` exists. All share buttons call `sharePlace()` which always falls through to `/share/{Trip.shareToken}` because `SPOT_PAGES_ENABLED = false`.

Bundle 2 will add `shareToken` to SavedItem, ItineraryItem, ManualActivity, GeneratedTour.

### Status display rules (`getEntityStatus()`)

Priority order (first match wins):
1. `userRating != null` → `rated` → `Rated {n}★` amber pill
2. `hasBooking` → `booked` → `Booked` terracotta pill
3. `dayIndex != null || hasItineraryLink` → `on_itinerary` → `On itinerary` green pill
4. default → `saved` → no pill (`showAffordance: true`)

---

## 6. Disciplines

### 4.8 Place Resolution
Geocoding uses Google Places text search for lat/lng. Reverse geocode used for city derivation from coords.

### 4.9 URL Extraction
`resolveSaveLink()` priority chain as documented in Section 5. `stripTrackingParams()` removes utm/fbclid/gclid. ItineraryItem uses `managementUrl` not `venueUrl`.

### 4.10 Universal Edit
Fixes must apply to ALL users and ALL trips. No hardcoded IDs. Existing data needs backfill when schema behavior changes.

### 4.11 Trip Lifecycle
`status: PLANNING | ACTIVE | COMPLETED`. Trip-level completion does NOT cascade to item status. Items carry their own entity status independently.

### 4.12 Multi-User Trip Collaboration
Every trip has a `TripCollaborator` row with `role: OWNER | EDITOR | VIEWER` and `acceptedAt`. Trip creation always atomic: `$transaction` creates Trip + OWNER TripCollaborator together. Eight+ callsites audited and patched in Chat 41.

### 4.13 UX Trace Verification
Every entity type (A-J) must be verified live before commit. Perceived-broken is real-broken.

### 4.14 Comprehensive Spec Grounding (NEW)
Every product spec grounds in this document. Schema column names taken from live DB, not memory. Image/URL chains verified via actual Supabase row data. `orderIndex` not `stopOrder`. `website` not `websiteUrl` on ManualActivity. No guessing.

### 4.15 Universal Consumer Audit
Before claiming a field is "missing", "absent", or "not populated", audit every surface that reads or writes it: (1) search schema across ALL related tables; (2) search ALL API routes for the field in their select clause; (3) verify the read path, not just the schema, for any UI claim; (4) presence on one surface (Vault) and absence on another (share view) means the read path is incomplete — not that the field is absent. Root cause: Chat 42 diagnostic stated "no address column on SavedItem" when address exists on ItineraryItem and was visible in the Vault card. See CLAUDE.md Universal Consumer Audit section for full rule.

---

## 7. Key Architectural Constraints

| Constraint | Detail |
|---|---|
| Inngest: PERMANENTLY DISABLED | Signature verification incompatible with Vercel serverless. Do not re-enable. |
| Background jobs | Vercel Cron with CRON_SECRET auth only |
| Email pipeline | CloudMailin → email-inbound webhook → Claude API → DB. `maxDuration = 60`. |
| Airbnb scraping | Blocked. ScrapingBee not implemented for Airbnb. |
| Instagram scraping | ScrapingBee works; direct fetch does not. `cdninstagram.com` is legitimate CDN — do not null. |
| Date/timezone | Always T12:00:00 pattern. Matt is UTC+9. |
| Prisma array updates | Use `{ set: value }` — not spread/push. |
| Map — two arrays | `pinsToRender` (isValidCoord only) vs `pinsForBounds` (isValidCoord + isWithinTripRadius). Never conflate. |
| TourResults.tsx | Only on `/tour` page. ToursContent on trip tab is a different component. |
| SavedItem.userRating | Option B: direct write, no PlaceRating created. Never create PlaceRating for save-kind items. |

---

## 8. Open Questions / Known Gaps (Bundle 2 prerequisites)

| Gap | Impact | Required fix |
|---|---|---|
| `shareToken` missing on SavedItem, ItineraryItem, ManualActivity, GeneratedTour | No per-entity share URLs | Schema migration + token generation service |
| `SPOT_PAGES_ENABLED = false` in `src/lib/share.ts` | All share buttons route to trip URL regardless of entity | Flip to `true` after `/s/[token]` ships |
| `sharePlace()` receives no entity ID | Cannot construct entity share URL | Refactor all 7 callsites to pass `{ entityType, entityId }` |
| `TourResults.tsx` has no `readOnly` prop | Owner affordances always shown; cannot reuse for share view | Add `readOnly?: boolean` prop |
| `/s/[token]` route does not exist | No share destination | Build from scratch |
| Clerk sign-up has no `returnTo` support | Cannot auto-save after signup | localStorage intent pattern + recovery in post-signup flow |
| `ItineraryItem.venueUrl` 0% populated | Share view cannot link to booking site | `managementUrl` fallback only; accept limitation for now |
| `PlaceActionRow` passes trip-level share token | Single-item share URLs need entity-level tokens | Refactor after schema migration |

---

## 9. Share Button Inventory (current production state)

| Surface | Entity | Share button exists? | Current behavior |
|---|---|---|---|
| Trip Saved tab | SavedItem | Yes (line 1440 TripTabContent) | Copies trip share URL |
| Trip Saved tab (rec panel) | SavedItem | Yes (line 3236) | Copies trip share URL |
| Trip Itinerary — ManualActivity | ManualActivity | Yes (line 3375) | Copies trip share URL |
| Trip Itinerary — ACTIVITY ItineraryItem | ItineraryItem | Yes (line 3483 `shareBtn`) | Copies trip share URL |
| Trip Itinerary — LODGING ItineraryItem | ItineraryItem | Yes (line 3516 `shareBtn`) | Copies trip share URL |
| Trip Itinerary — TRAIN ItineraryItem | ItineraryItem | Yes (line 3549 `shareBtn`) | Copies trip share URL |
| Trip Itinerary — FLIGHT ItineraryItem | ItineraryItem | Yes (line 3575 `shareBtn`) | Copies trip share URL |
| PlaceActionRow (all consumers) | SavedItem / CommunitySpot | Yes (PlaceActionRow line 193) | Copies trip share URL |
| TourResults.tsx | TourStop | No Share button today | Needs adding |
| ToursContent (trip tab) | GeneratedTour/TourStop | No Share button today | Needs adding |

**Key insight for Bundle 2:** Share buttons already exist on nearly every entity type. The destination URL is wrong (always trip-level). Bundle 2 fixes the destination, not the buttons.

---

*Last updated: Chat 42. Source: direct codebase reads (Phases 1–4) + Supabase live queries (Phase 3.5–3.7).*
