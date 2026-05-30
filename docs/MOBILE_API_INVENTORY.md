# Mobile API Contract and Auth Inventory

Phase 0 read-only diagnostic. No source files were modified.
Generated: 2026-05-30. Covers the four core flows targeted for the Expo/React Native app MVP.

---

## Section 1: Auth Findings

### 1.1 Clerk Packages and Versions

```
@clerk/nextjs: ^7.0.1
```

No other Clerk packages are present in package.json. The codebase is on the Clerk v5+ generation SDK (v7 resolves under the v5+ API surface).

### 1.2 Middleware Configuration

File: `src/middleware.ts` (no `src/proxy.ts`).

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)", "/sign-up(.*)",
  "/about(.*)", "/pricing(.*)", "/blog(.*)", "/help(.*)", "/contact(.*)",
  "/privacy(.*)", "/terms(.*)", "/careers(.*)", "/press(.*)",
  "/community(.*)", "/cookies(.*)",
  "/cities(.*)", "/continents(.*)", "/countries(.*)",
  "/spots(.*)", "/share(.*)", "/s(.*)",
  "/discover(.*)", "/travel-intel(.*)",
  "/features(.*)", "/how-it-works(.*)", "/community-info(.*)",
  "/explore(.*)", "/destination(.*)", "/trip/(.*)/preview",
  "/api/img(.*)", "/api/webhooks(.*)", "/api/cron(.*)",
  "/api/destinations(.*)", "/api/search(.*)", "/api/travel-intel(.*)",
  "/api/admin/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

Matcher covers all routes including `/(api|trpc)(.*)`. No `authorizedParties` option is set. No `domain` restriction is set.

Notable public API routes (no auth enforcement at middleware level):
- `/api/search/(.*)` -- universal search
- `/api/destinations/(.*)` -- destination lookup
- `/api/admin/(.*)` -- admin endpoints (separate internal guards per route)

### 1.3 Route Auth Pattern

Every protected API route uses the same pattern from `@clerk/nextjs/server`:

```ts
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

`currentUser()` is used secondarily in a small number of routes (trips, saves, onboarding, ratings) solely to fetch email/name for Loops.so lifecycle calls after the primary auth guard has already passed. It is not used as an auth gate.

`clerkClient` appears only in the nudge-users cron route for admin lookups. Not used in auth gating.

### 1.4 Bearer Token Viability

Clerk SDK v5+ (which v7 belongs to) changed `clerkMiddleware` and `auth()` to natively read the session token from both the `__session` cookie and the `Authorization: Bearer <session_token>` header. No configuration change is required to enable Bearer support -- it is on by default.

Because no `authorizedParties` is configured in the middleware, there is no origin allowlist. Any valid Clerk session token sent as a Bearer header will be accepted regardless of the origin it was issued from.

Mobile implementation: use `@clerk/clerk-expo` on the Expo side. Call `getToken()` from the `useAuth()` hook to obtain the session JWT, then pass it as `Authorization: Bearer <token>` on every API request. Token refresh is managed automatically by the Expo SDK.

**Bearer-token reuse viable: YES**

No code change is required in the web repo to accept mobile Bearer requests. The `@clerk/clerk-expo` package handles token lifecycle on the mobile side.

### 1.5 CORS

No CORS headers exist anywhere in `src/`. No middleware sets `Access-Control-Allow-Origin` or any related header. No CORS library is imported.

For native HTTP clients (Expo `fetch`, Axios in React Native, etc.), this is not a problem. Browser CORS enforcement does not apply to native app network stacks. A native app calling `https://flokktravel.com/api/trips` with a Bearer header will not be blocked.

If the mobile app ever uses a WebView to render any authenticated surface that makes API calls via browser `fetch`, CORS headers will be needed at that point. That is not a day-one concern for native API calls.

---

## Section 2: Core-Flow API Contract Inventory

### Flow A: Vault

The Vault stores trip-level private data: contacts, uploaded documents, key info (PIN codes, reservation numbers, etc.), and booked flight records. All routes are under `/api/trips/[id]/vault/` or `/api/trips/[id]/flights`.

| Route | Method | Auth required | Response shape summary | Web renderer file |
|-------|--------|--------------|------------------------|-------------------|
| `/api/trips/[id]/vault/contacts` | GET | Yes | Array of `{id, name, role, phone, whatsapp, notes, createdAt}` | `src/components/features/trips/TripTabContent.tsx` |
| `/api/trips/[id]/vault/contacts` | POST | Yes | Created contact record (201) | same |
| `/api/trips/[id]/vault/contacts/[contactId]` | PATCH | Yes | Updated contact record | same |
| `/api/trips/[id]/vault/contacts/[contactId]` | DELETE | Yes | `{success: true}` | same |
| `/api/trips/[id]/vault/documents` | GET | Yes | Array of document records `{id, label, fileUrl, createdAt}` | same |
| `/api/trips/[id]/vault/documents` | POST | Yes | Created document record (201) | same |
| `/api/trips/[id]/vault/documents/[documentId]` | PATCH | Yes | Updated document record | same |
| `/api/trips/[id]/vault/documents/[documentId]` | DELETE | Yes | `{success: true}` | same |
| `/api/trips/[id]/vault/keyinfo` | GET | Yes | Array of `{id, label, value, createdAt}` | same |
| `/api/trips/[id]/vault/keyinfo` | POST | Yes | Created key info record (201) | same |
| `/api/trips/[id]/vault/keyinfo/[keyInfoId]` | PATCH | Yes | Updated key info record | same |
| `/api/trips/[id]/vault/keyinfo/[keyInfoId]` | DELETE | Yes | `{success: true}` | same |
| `/api/trips/[id]/flights` | GET | Yes | Array of flight records `{id, airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, confirmationCode, passengers, totalCost, currency, dayIndex}` | same |
| `/api/trips/[id]/flights` | POST | Yes | Created flight record (201) | same |
| `/api/trips/[id]/flights/[flightId]` | PATCH | Yes | Updated flight record | same |
| `/api/trips/[id]/flights/[flightId]` | DELETE | Yes | `{success: true}` | same |

Note: The vault tab in `TripTabContent.tsx` is activated by the `?tab=vault` query param on the trip page (`/trips/[id]`).

### Flow B: Itinerary

Two separate data sources are merged to build a day view. `itinerary-items` are email-imported booking confirmations (structured: flights, lodging, trains). `itinerary` returns SavedItem records the user has manually assigned to days.

| Route | Method | Auth required | Response shape summary | Web renderer file |
|-------|--------|--------------|------------------------|-------------------|
| `/api/trips/[id]/itinerary-items` | GET | Yes | `{items: ItineraryItem[]}` -- each item: `{id, type, title, scheduledDate, departureTime, arrivalTime, fromAirport, toAirport, fromCity, toCity, confirmationCode, notes, address, totalCost, currency, passengers, dayIndex, latitude, longitude, arrivalLat, arrivalLng, sortOrder, needsVerification, bookingSource, managementUrl, imageUrl, status, lodgingType, cancelledAt, cancelledBy, cancellationReason, cruiseBookingId}` | `src/components/features/trips/TripTabContent.tsx` |
| `/api/trips/[id]/itinerary` | GET | Yes | `{items: SavedItem[]}` -- each item: `{id, rawTitle, rawDescription, mediaThumbnailUrl, placePhotoUrl, destinationCity, destinationCountry, dayIndex, sortOrder, lat, lng, isBooked, startTime, categoryTags, tourId}` | same |
| `/api/trips/[id]/itinerary` | POST | Yes | `{item: {id, dayIndex}}` -- body: `{title, location?, imageUrl?, dayIndex, lat?, lng?, categoryTags?}` | same |
| `/api/trips/[id]/itinerary/[itemId]` | PATCH | Yes | `{item: ItineraryItem}` -- patches ItineraryItem fields: `{dayIndex?, sortOrder?, title?, departureTime?, arrivalTime?, scheduledDate?, notes?, lodgingType?}` | same |
| `/api/trips/[id]/itinerary/[itemId]` | DELETE | Yes | `{success: true}` | same |
| `/api/trips/[id]` | PATCH | Yes | `{trip: Trip}` -- patches trip metadata: `{title?, startDate?, endDate?, cities?, countries?, privacy?, isAnonymous?, isPublic?, tripType?, budgetRange?}` | same |
| `/api/saves/[id]` | PATCH | Yes | `{savedItem: SavedItem}` -- edits a SavedItem (title, dayIndex, notes, isBooked, categoryTags, etc.) | same |

The trip list for the home screen:

| Route | Method | Auth required | Response shape summary | Web renderer file |
|-------|--------|--------------|------------------------|-------------------|
| `/api/trips` | GET | Yes | `{trips: [{id, title, destinationCity, destinationCountry, cities, country, countries, startDate, endDate, status, isPlacesLibrary}]}` -- query param `?status=ALL|PLANNING|ACTIVE|COMPLETED` | `src/app/(app)/home/page.tsx` |
| `/api/trips` | POST | Yes | `{tripId: string}` -- creates a new trip | same |

### Flow C: Discover Lite

The continent/country/city browse is currently implemented as server-rendered Next.js pages with direct DB access. There are no JSON API routes for that navigation layer. Mobile will need new routes built for: continent list, country list by continent, and city list by country.

What does have API routes:

| Route | Method | Auth required | Response shape summary | Web renderer file |
|-------|--------|--------------|------------------------|-------------------|
| `/api/trips/public` | GET | No | Array of `{id, title, destinationCity, destinationCountry, startDate, endDate, heroImageUrl, isAnonymous, shareToken, _count.{savedItems, placeRatings}, familyProfile.{familyName, homeCity}}` -- query param `?limit=N` (max 50) | `src/app/(app)/discover/page.tsx` |
| `/api/search/universal` | GET | No (auth() called but userId unused, no 401) | `{cities, countries, continents, picks, trips, tours}` -- query param `?q=<string>&scope=<city|country>&scopeId=<id>&includeFallback=true` | `src/app/(app)/discover/page.tsx` (search bar) |
| `/api/places/featured-cities` | GET | Yes | `{cities: FeaturedCity[], mode: "trending"|"fallback"}` where `FeaturedCity = {city, country, continent, spotCount, contributorCount, heroPhotoUrl, isFallback}` | `src/app/(app)/discover/spots/page.tsx` |
| `/api/places/community` | GET | Yes | `{places: CommunitySpot[], cities: string[], total: number}` -- query params: `?q=<string>&city=<string>` | `src/app/(app)/discover/spots/page.tsx` |

Missing API routes for mobile (must be built before mobile Discover Lite can ship):
- Continent list (currently at `src/app/(app)/continents/page.tsx`, DB-only)
- Country list by continent (currently at `src/app/(app)/continents/[slug]/page.tsx`)
- City list by country (currently at `src/app/(app)/countries/[slug]/page.tsx`)
- City detail with Flokk Picks rail (currently at `src/app/(app)/cities/[slug]/page.tsx`, queries DB directly)

### Flow D: Sharing

The trip share page at `/share/[token]` is a server-rendered Next.js page. It queries the database directly -- there is no JSON API route that returns the share payload. A native app cannot call `/share/[token]` and receive structured data.

Token generation:

| Route | Method | Auth required | Response shape summary | Web renderer file |
|-------|--------|--------------|------------------------|-------------------|
| `/api/share/token` | POST | Yes | `{token: string}` -- body: `{entityType: "saved_item"|"itinerary_item"|"manual_activity"|"generated_tour", entityId: string}` -- generates or retrieves share token for individual items (not trip-level) | `src/components/share/ShareItemView.tsx` |
| `/api/saves/city-share` | POST | Yes | `{token: string}` -- body: `{citySlug: string, scope: "imports"|"all"}` -- creates a CityShare record for sharing all saves in a city | `src/app/share/city/[token]/page.tsx` |
| `/api/trips/[id]/share` | POST | Yes | `{success: true}` -- sends a share email via Resend to a Flokk user or arbitrary email address; requires `trip.shareToken` to already exist on the record | `src/components/features/trips/TripTabContent.tsx` |

Trip-level `shareToken`: stored directly on the `Trip` record. The token appears to be set at trip creation time (via `buildTripFromExtraction`) or lazily. The share URL format is `https://www.flokktravel.com/share/{trip.shareToken}`.

Missing API route for mobile (must be built before sharing flow can ship natively):
- `GET /api/share/trip/[token]` -- a new JSON endpoint that returns the full trip share payload (trip metadata, itinerary items, saved items by day, contacts, ratings, curator name). Currently this data is fetched server-side in `src/app/share/[token]/page.tsx` using a large `db.trip.findUnique` with `include` covering `savedItems`, `itineraryItems`, `manualActivities`, `familyProfile`, `placeRatings`, `contacts`, and `tripNotes`. Mobile can also open the existing `/share/[token]` URL in a WebView as an interim approach before the native view is built.

---

## Summary: What Works As-Is vs. What Needs New Routes

| Flow | Reuses web routes as-is | Needs new routes |
|------|------------------------|-----------------|
| Vault | Yes -- all 14 routes are JSON APIs with Bearer support | No |
| Itinerary view/edit | Yes -- all routes are JSON APIs with Bearer support | No |
| Discover Lite | Partial -- public trips and search work; featured cities and community spots work with auth | Continent, country, city browse and Flokk Picks rail have no JSON API routes |
| Sharing | Partial -- token generation and email sending work; city share token works | Trip share data has no JSON API route; must build `GET /api/share/trip/[token]` or use WebView |
