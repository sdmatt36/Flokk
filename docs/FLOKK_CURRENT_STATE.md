# Flokk Current State Inventory
[date: 2026-04-25]

See `docs/FLOKK_PRODUCT_SPEC.md` for intended behavior. This document maps what actually
exists in the codebase today. Divergences from spec are marked ⚠.

## How to Use
This is a navigation snapshot, not documentation. Every section lists real file paths
you can jump to. When behavior here contradicts the spec, the spec wins — this file
just tells you where the current code lives so you can fix it.

---

## Tours Subsystem

### Frontend Pages
- `src/app/(app)/tour/page.tsx` — Tour generator UI. Prompt input, vibe chips, city
  autocomplete, duration/transport selectors, saved-tour library (grouped by city as
  collapsible pills). Calls `/api/tours/generate`, `/api/tours/my-tours`, `/api/tours/[id]`.

### Components
- `src/components/TourResults.tsx` — Renders stop list with images, remove/undo, "add stop"
  plus-card, save-to-trip button.
- `src/components/tours/TourActionMenu.tsx` — Per-tour kebab menu (delete, unlink from trip).

### Key API Endpoints
| Route | Method | Purpose |
|---|---|---|
| `/api/tours/generate` | POST | Claude generates stops, resolves via Google Places, nearest-neighbor route optimization, persists GeneratedTour + TourStops. maxDuration=120. |
| `/api/tours/[id]` | GET | Returns tour with active + soft-deleted stops. |
| `/api/tours/[id]/regenerate` | POST | Adds replacement stops for gaps; inserts at optimal route position. maxDuration=60. |
| `/api/tours/[id]/stops/[stopId]` | PATCH/DELETE | Update or soft-delete individual stop. |
| `/api/tours/[id]/stops/[stopId]/restore` | POST | Restore soft-deleted stop. |
| `/api/tours/save` | POST | Converts tour stops into SavedItems linked to a trip day. Uses `PLATFORM_FLOKK_TOURS` source type. |
| `/api/tours/[id]/unlink-from-trip` | POST | Removes trip association from tour (does NOT cascade-delete itinerary items yet). |
| `/api/tours/my-tours` | GET | Returns all non-deleted GeneratedTours for the profile, grouped by destination city. |

### Lib
- `src/lib/tour-route-optimization.ts` — `optimizeRouteOrder()`: nearest-neighbor from
  westernmost stop. `findBestInsertionIndex()`: inserts new stop at lowest-cost position.

### Schema Models
**GeneratedTour**: id (cuid), title, destinationCity, destinationCountry, prompt,
durationLabel, transport, familyProfileId, isPublic, categoryTags[], originalTargetStops,
deletedAt, deletedBy, createdAt, updatedAt.

**TourStop**: id, tourId, orderIndex, name, address, lat, lng, durationMin, travelTimeMin,
why, familyNote, imageUrl, websiteUrl, savedItemId (nullable FK to SavedItem), deletedAt.

### Gaps vs Spec
- ⚠ Tour library renders as dropdown-by-city pills, not image cards per spec.
- ⚠ `unlink-from-trip` does NOT cascade-delete corresponding ItineraryItems — orphans
  remain on the trip.
- ⚠ Public share URL spec (`/share/tour/[token]`) — route does not exist; tours have
  `isPublic` field but no share token mechanism is implemented.
- ⚠ Completed-trip → anonymous Spots feed pipeline not implemented.
- Helpers in `generate/route.ts` and `regenerate/route.ts` are duplicated; comment in
  regenerate says "refactor deferred."

---

## Trips Subsystem

### Frontend Pages
- `src/app/(app)/trips/page.tsx` — Upcoming trips list.
- `src/app/(app)/trips/[id]/page.tsx` — Trip detail. Tabs: saved, itinerary, recommended,
  packing, notes, vault. Supports both authenticated owner view and community view.
- `src/app/(app)/trips/new/page.tsx` — New trip form.
- `src/app/(app)/trips/past/page.tsx` — Past trips list.
- `src/app/(app)/trips/past/new/page.tsx` — Add a past trip.
- `src/app/(app)/trip-detail/page.tsx` — Legacy redirect shim; prefer `trips/[id]`.

### Key API Endpoints
| Route | Method | Purpose |
|---|---|---|
| `/api/trips` | GET/POST | List or create trips for profile. |
| `/api/trips/[id]` | GET/PATCH/DELETE | Fetch, update, or delete a trip. |
| `/api/trips/[id]/itinerary` | GET/POST | SavedItems with dayIndex (in-app adds). |
| `/api/trips/[id]/itinerary/[itemId]` | GET/PATCH/DELETE | CRUD individual SavedItem. |
| `/api/trips/[id]/itinerary/[itemId]/verify` | POST | Mark item verified. |
| `/api/trips/[id]/itinerary-items` | GET | ItineraryItems (email-imported bookings). |
| `/api/trips/[id]/activities` | GET/POST | ManualActivity CRUD. |
| `/api/trips/[id]/activities/[activityId]` | PATCH/DELETE | Update/delete activity. |
| `/api/trips/[id]/activities/[activityId]/geocode` | POST | Geocode activity address. |
| `/api/trips/[id]/flights` | GET/POST | Flight records on trip. |
| `/api/trips/[id]/flights/[flightId]` | PATCH/DELETE | Update/delete flight. |
| `/api/trips/[id]/budget` | GET | Computed budget: sums ItineraryItem.totalCost + ManualActivity.price; deduplicates LODGING pairs. |
| `/api/trips/[id]/packing` | GET/POST | PackingItem list + add. |
| `/api/trips/[id]/packing/[itemId]` | PATCH/DELETE | Update/delete packing item. |
| `/api/trips/[id]/packing/generate` | POST | Claude-generated packing list. |
| `/api/trips/[id]/notes` | GET/POST | TripNotes. |
| `/api/trips/[id]/notes/[noteId]` | PATCH/DELETE | Update/delete note. |
| `/api/trips/[id]/tips` | GET/POST | TripTips. |
| `/api/trips/[id]/tips/[tipId]` | PATCH/DELETE | Update/delete tip. |
| `/api/trips/[id]/services` | GET/POST | TripServices. |
| `/api/trips/[id]/services/[serviceId]` | PATCH/DELETE | Update/delete service. |
| `/api/trips/[id]/vault/documents` | GET/POST | Document attachments. |
| `/api/trips/[id]/vault/documents/[documentId]` | PATCH/DELETE | |
| `/api/trips/[id]/vault/contacts` | GET/POST | Emergency/travel contacts. |
| `/api/trips/[id]/vault/keyinfo` | GET/POST | Key info entries. |
| `/api/trips/[id]/vault/upload` | POST | File upload for vault. |
| `/api/trips/[id]/ratings` | GET/POST | PlaceRating for trip items. |
| `/api/trips/[id]/ratings/[ratingId]` | PATCH/DELETE | |
| `/api/trips/[id]/review` | POST | Post-trip review flow trigger. |
| `/api/trips/[id]/booking-intel` | GET | Booking urgency analysis (now/soon/when-ready) for flights, hotels, activities within 180-day window. |
| `/api/trips/[id]/share` | POST | Generate shareToken, set isPublic. |
| `/api/trips/[id]/steal` | POST | Clone another user's trip into the current user's profile. |
| `/api/trips/[id]/clone` | POST | Clone own trip. |
| `/api/trips/[id]/post-trip-status` | PATCH | Update post-trip capture flags. |
| `/api/trips/clone` | POST | (Top-level) trip cloning. |
| `/api/trips/steal-to-new` | POST | Steal public trip to a new trip. |
| `/api/trips/search` | GET | Search trips by query. |
| `/api/trips/public` | GET | List public trips for community browsing. |
| `/api/trips/match-by-city` | GET | Match trips by destination city. |
| `/api/trips/cities-geo` | GET | Cities with geo coords for map views. |

### Schema Models
**Trip**: id, familyProfileId, title, destinationCity, destinationCountry, startDate,
endDate, status (PLANNING/ACTIVE/COMPLETED), privacy (PUBLIC/NETWORK/PRIVATE),
accommodationLat/Lng, heroImageUrl, tripType, viewCount, cloneCount, completionScore,
bookingIntelCache (Json), budgetTotal, budgetCurrency, budgetSpent (DEPRECATED — computed
from ItineraryItem.totalCost now), shareToken, isPublic, isAnonymous, cities[], countries[],
isPlacesLibrary, postTripCapture flags.

**ItineraryItem**: id, tripId, familyProfileId, type (FLIGHT/LODGING/TRAIN/ACTIVITY/
CAR_RENTAL/RESTAURANT/OTHER), title, scheduledDate, departureTime, arrivalTime,
fromAirport/toAirport, fromCity/toCity, confirmationCode, notes, address, totalCost,
currency, passengers[], dayIndex, latitude/longitude, arrivalLat/arrivalLng,
sourceType (default EMAIL_IMPORT), sortOrder, needsVerification, rooms (Json).

### Gaps vs Spec
- ⚠ `budgetSpent` field deprecated in schema but not removed; comment says do not write.
- ⚠ `needsVerification` flag exists on ItineraryItem; verification UI and post-import flow
  incomplete per CLAUDE.md priority queue item 8.

---

## Saves Subsystem

### Frontend Pages
- `src/app/(app)/saves/page.tsx` — SavesScreen. List of all saved items.
- `src/app/(app)/saves/[id]/page.tsx` — Individual save detail.
- `src/app/(app)/saves-new/page.tsx` — In-progress saves redesign (parallel build).

### Key API Endpoints
| Route | Method | Purpose |
|---|---|---|
| `/api/saves` | GET/POST | List or create SavedItems. POST triggers `enrichSavedItem()`. |
| `/api/saves/[id]` | GET/PATCH/DELETE | CRUD individual save. |
| `/api/saves/[id]/identify` | POST | Re-run enrichment/identification on a save. |
| `/api/saves/activity` | POST | Save a manual activity directly. |
| `/api/saves/from-share` | POST | Save from shared trip/tour token. |

### Email Pipeline
`CloudMailin → POST /api/webhooks/email-inbound/route.ts → Claude API → DB`

Key behavior:
- `maxDuration = 60`. Synchronous, no queue.
- Confidence threshold 0.5 to proceed; drops below that.
- Trip match requires confidence >= 0.8.
- Auto-create trip when no match, confidence >= 0.85, type is flight/hotel, destination known.
- Operator plan path (`looksLikeOperatorPlan()`): confidence >= 0.8 and >= 2 days triggers
  `buildTripFromExtraction()`.
- Non-booking low confidence (< 0.8) falls through to SavedItem.
- Sends confirmation email via Resend after save.
- Logs every extraction to `ExtractionLog` model via `src/lib/extraction-log.ts`.
- Sender email verification: profiles have `senderEmails[]` and `SenderEmailVerification`
  records; unverified senders are matched via `resolveProfileByEmail()`.

### Lib
- `src/lib/enrich-save.ts` — `enrichSavedItem()`: OG extraction, Google Places enrichment,
  category tag normalization, community write-through.
- `src/lib/enrich-with-places.ts` — Google Places lookup for coordinates + photo.
- `src/lib/operator-plan-extractor.ts` — Claude tool-use to detect multi-day operator plans.
- `src/lib/trip-builder.ts` — Builds Trip + ItineraryItems from operator plan extraction.
- `src/lib/find-matching-trip.ts` — Fuzzy city/country match to existing trips.
- `src/lib/booking-saved-item.ts` — `isSaveableBooking()` / `createBookingSavedItem()`.

### Schema Models
**SavedItem**: id, familyProfileId, tripId, sourceMethod, sourcePlatform, sourceUrl,
rawTitle, rawDescription, mediaThumbnailUrl, placePhotoUrl, savedAt, destinationCity,
destinationCountry, lat/lng, categoryTags[], interestKeys[], relevanceScore, status
(UNORGANIZED/etc), extractionStatus (PENDING/etc), enrichmentAttempts, dayIndex, notes,
affiliateUrl, websiteUrl, extractedCheckin/Checkout, isBooked, userRating, userNote,
sortOrder, startTime, needsPlaceConfirmation, communitySpotId, tourStops relation.

### Gaps vs Spec
- ⚠ `defaultTimeForUntimedSaves` not implemented (CLAUDE.md priority queue item 7).
- ⚠ Airbnb URLs return login wall; ScrapingBee not yet configured for Airbnb path.
- Instagram: ScrapingBee path works for email-forward and URL-paste; mobile share sheet
  (iOS) not yet built.

---

## Family Profile

### Frontend Pages
- `src/app/(app)/family/page.tsx` — Family members list and travel docs.
- `src/app/(app)/profile/page.tsx` — Profile settings (home city, currency, preferences).
- `src/app/(app)/profile/interests/page.tsx` — Declared interests.
- `src/app/(app)/onboarding/page.tsx` — Onboarding wizard.

### Key API Endpoints
- `/api/family/members/[id]` — PATCH/DELETE individual family member.
- `/api/family/` — GET/POST family member list.
- `/api/profile/` — GET/PATCH profile settings.
- `/api/onboarding/` — POST onboarding completion.

### Schema Models
**FamilyProfile**: id, userId, familyName, homeCity, state, homeCountry, homeCurrency,
favoriteAirports, travelFrequency, budgetRange, travelStyle, pace, planningStyle,
nudgeSentAt, members[], interests[], senderEmails[], points, tier (EXPLORER/NAVIGATOR/
PIONEER), communityProfile relation, loyaltyPrograms[], paymentCards[].

**FamilyMember**: id, familyProfileId, name, role (ADULT/CHILD), birthDate,
dietaryRequirements[], mobilityNotes, passportCountry/Number, citizenshipCountry,
passportIssue/ExpiryDate, globalEntry, nexus, redress, ktn, visaNotes, foodAllergies[],
allergyNotes.

**ProfileMember**: Multi-user access — maps a clerkUserId to a familyProfileId with a role.
Enables families where both adults share one profile.

---

## Community / Spots

### Frontend Pages
- `src/app/(app)/discover/page.tsx` — Discover landing. Hardcoded destination recommendations
  (Kyoto, Lisbon, Amalfi, etc.) with region filter chips. Also hosts Community Spots inline.
- `src/app/(app)/discover/spots/page.tsx` — Spots hub. Featured cities grid (live data from
  DB), continent strip (browse by continent links), disabled search bar placeholder.
- `src/app/(app)/admin/spots/page.tsx` — Admin spot management.
- `src/app/places/[id]/page.tsx` — Individual place/spot detail page.

### Key API Endpoints
| Route | Method | Purpose |
|---|---|---|
| `/api/community-spots` | GET (admin only) | List spots, filterable by needsUrlReview. |
| `/api/community-spots/[id]` | GET/PATCH/DELETE | CRUD individual spot. |
| `/api/community-spots/[id]/fetch-photo` | POST | Fetch photo for a spot. |
| `/api/community-spots/[id]/resolve-image` | POST | Resolve/update spot image URL. |
| `/api/community-spots/[id]/suggest-category` | POST | AI-suggest category for spot. |
| `/api/places/featured-cities` | GET | Same logic as `getFeaturedCities()` lib fn. |
| `/api/places/cities` | GET | List cities with spot counts. |
| `/api/places/community` | GET | Community spots for a given city. |
| `/api/places/[id]` | GET | Individual place details. |
| `/api/places/search` | GET | Search places. |
| `/api/places/save` | POST | Save a place to user's saves. |
| `/api/community/user-ratings` | GET | User's PlaceRating records. |

### Lib
- `src/lib/continents.ts` — `COUNTRY_TO_CONTINENT` lookup (comprehensive, judgment calls:
  Russia → Europe, Turkey → Europe, Egypt → Africa). `listContinents()` returns sorted list.
  Continent is computed at render time; NOT stored on CommunitySpot.
- `src/lib/featured-cities.ts` — `getFeaturedCities()`: queries DB for top cities by
  contributor count. Falls back to hardcoded list when insufficient data. Returns
  `mode: "trending" | "fallback"`.
- `src/lib/community-write-through.ts` — Writes save data through to CommunitySpot records.
- `src/lib/categories.ts` — `CATEGORIES` array used for filter chips and spot categorization.

### Schema Models
**CommunitySpot**: id, name, city, country, category, googlePlaceId (unique), address,
lat/lng, photoUrl, websiteUrl, description, averageRating, ratingCount, contributionCount,
authorProfileId, needsUrlReview, createdAt, updatedAt. Indexed on city, category, city+category.

**SpotContribution**: id, communitySpotId, familyProfileId, rating, note, createdAt,
updatedAt. Unique on [communitySpotId, familyProfileId] — one contribution per family per spot.

### Gaps vs Spec
- ⚠ Continent nav routes (`/continents/[continent]`) linked from Spots page but page file
  does not exist — will 404.
- ⚠ City detail routes (`/c/[city]`) linked from CityHeroCard but page file does not exist.
- ⚠ Search bar on /discover/spots is disabled with `cursor-not-allowed` and comment
  "wiring comes in full redesign."
- ⚠ Anonymous tour-to-Spots pipeline (completed trip feeds community data) not implemented.
- ⚠ Continent → country → city → category nav from spec not yet built.

---

## Cron / Background Jobs

All crons authenticated via `Authorization: Bearer $CRON_SECRET`. Defined in `vercel.json`.

| Schedule (UTC) | Path | Purpose |
|---|---|---|
| 0 9 * * * (daily 9am) | `/api/cron/nudge-users` | Find profiles >48h old with zero saves and no prior nudge; send Loops transactional nudge email. |
| 0 1 * * * (daily 1am) | `/api/cron/pre-trip-reminder` | Send 7-day and 1-day pre-trip reminder emails via Loops to trips starting in those windows. |
| 0 2 * * * (daily 2am) | `/api/cron/trip-lifecycle` | Flip PLANNING/ACTIVE trips to COMPLETED when endDate has passed (adjusted -9h for JST). Sends `sendTripCompletedEvent` to Loops. |
| 0 3 * * * (daily 3am) | `/api/cron/enrich-manual-activities` | Enriches ManualActivity records that lack geocoordinates via Google Places. |
| 0 4 * * * (daily 4am) | `/api/cron/enrich-saved-items` | Re-enriches SavedItems with PENDING or failed extractionStatus. |

All cron routes: `src/app/api/cron/[name]/route.ts`.

---

## Auth + Infrastructure

### Auth
- **Clerk** — Auth provider. JWT via `auth()` from `@clerk/nextjs/server`.
- `src/app/api/webhooks/clerk/route.ts` — Handles `user.created` / `user.updated` events;
  creates User + FamilyProfile records.
- **Multi-user profiles** via `ProfileMember` model — one Clerk userId can access a shared
  FamilyProfile (secondary planner).

### Email
- **CloudMailin** → `POST /api/webhooks/email-inbound/route.ts` — Inbound booking parsing.
- **Resend** — Transactional outbound (save confirmations, etc.) via `src/lib/resend` calls
  inside email-inbound.
- **Loops.so** — Lifecycle emails. `src/lib/loops.ts` exports: `createLoopsContact`,
  `sendTransactional`, `sendTripCompletedEvent`, `sendPreTripReminderEvent`,
  `sendSaveMilestoneEvent`, `sendTripStolenEvent`, `sendTripMadePublicEvent`,
  `sendRatingsCompleteEvent`, `updateLoopsContact`.

### Maps
- **Google Maps Platform** — Geocoding, Places text search, Places details, Place Photos.
  Used in tour generation, save enrichment, activity geocoding.
- **Mapbox** — Map tile rendering in `TripMap.tsx` and `TourResults.tsx`.

### Inngest
- `src/app/api/webhooks/inngest/route.ts` — File exists but Inngest is **permanently
  disabled** (CLAUDE.md). Signature verification incompatible with Vercel serverless.
  Do not re-enable.
- `src/app/api/debug-inngest/` — Debug route; dead code, do not use.

### Admin Routes
`src/app/api/admin/` contains one-off backfill and enrichment scripts:
backfill-arrival-coords, backfill-public-trips, backfill-youtube, clean-flight-saves,
decode-saves, enrich-all-saves, fix-activity-titles, geocode-activities, geocode-saves,
photos/bulk-fill, reenrich-instagram, regeocode-kyoto, revalidate-images, send-beta-invite,
trigger-enrich, content CRUD. Not wired to cron — invoked manually via admin UI or direct
HTTP.

### Hosting
- Vercel Pro (functions, cron, edge).
- Supabase PostgreSQL. Prisma ORM.
- `src/lib/db/` — Prisma client singleton.

---

## Booking Portal

Not yet built. Listed as CLAUDE.md priority queue item 11 ("Booking Portal"). No page files,
no API routes, and no schema models specific to booking portal exist. `booking-intel` endpoint
(see Trips section) computes urgency signals that would feed a booking portal dashboard —
that data layer is ready, but the UI and booking-link pass-through are not implemented.

---

## Travel Intel

- `src/app/(app)/travel-intel/page.tsx` — Articles, videos, guides feed. Filter by type
  (All/Articles/Videos/Guides) and topic tags. Queries `/api/travel-intel/feed`.
- `src/app/api/travel-intel/route.ts` + `articles`, `videos`, `guides`, `feed` sub-routes.
- Content managed via admin at `src/app/(app)/admin/content/page.tsx` and
  `src/app/api/admin/content/`.

---

## Known Divergences (Spec vs Reality)

Collected from all sections above:

1. ⚠ Tour library: spec = image cards; current = dropdown-by-city pill list.
2. ⚠ `unlink-from-trip` does not cascade-delete ItineraryItems — leaves orphans.
3. ⚠ Tour public share URLs (`/share/tour/[token]`) not implemented.
4. ⚠ Completed-trip → anonymous Spots feed pipeline not implemented.
5. ⚠ Continent route `/continents/[continent]` linked but page file missing (will 404).
6. ⚠ City detail route `/c/[city]` linked but page file missing (will 404).
7. ⚠ Spots search bar disabled with hardcoded `cursor-not-allowed`.
8. ⚠ Continent → country → city → category nav not built.
9. ⚠ `needsVerification` flag exists on ItineraryItem; post-import verification UI not built.
10. ⚠ Default time for untimed saves not implemented.
11. ⚠ Airbnb URL scraping not implemented (ScrapingBee path missing for Airbnb).
12. ⚠ Booking Portal: zero implementation beyond booking-intel urgency signals.
13. ⚠ `budgetSpent` on Trip model is deprecated; comment says do not write, but field
    remains in schema — cleanup deferred.
14. ⚠ Tour stop generation helpers duplicated between `generate/route.ts` and
    `regenerate/route.ts` — refactor comment in code says deferred.
15. ⚠ Mobile iOS app / share sheet not built — blocks best Instagram save path.
16. ⚠ `FLOKK_PRODUCT_SPEC.md` Trips, Saves, Family Profile, Email Pipeline sections are
    stubs ("[to be filled in as we discuss]") — spec is incomplete for those subsystems.
