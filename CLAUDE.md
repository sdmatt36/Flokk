# Flokk — Claude Code Session Instructions

Read this entire file before writing a single line of code.

## Non-Negotiable Rules

1. Diagnose before fixing. Grep for exact file and show current code first. Never edit without showing what is there.
2. Grep before assuming file paths. Never guess.
3. One prompt at a time. Never modify files that touch the same feature simultaneously.
4. Every prompt ends with: git add -A && git commit -m "description" && git push

## Code Standards
- No hardcoded user IDs. Fixes must work for ALL users.
- Backfill scripts required when adding fields to existing data.
- Prisma array updates use { set: value }.
- Date/timezone: T12:00:00 approach (Matt is UTC+9).
- Images: always /public/images/ locally. Never construct CDN URLs.

## Permanent Architecture Decisions

### Inngest: PERMANENTLY DISABLED
Signature verification incompatible with Vercel serverless. Do not re-enable.
- Save enrichment: src/app/api/saves/route.ts via src/lib/enrich-save.ts
- Email parsing: synchronous in src/app/api/webhooks/email-inbound/route.ts
- Background jobs: Vercel Cron with CRON_SECRET auth only

### Email Pipeline
CloudMailin → /api/webhooks/email-inbound/route.ts → Claude API → DB
maxDuration = 60. Never route through Inngest. Never route through a queue.

### Airbnb
Airbnb blocks web scraping. Direct fetch returns login walls. ScrapingBee may help
but is not yet implemented for Airbnb URLs.

### Instagram
Instagram CAN be scraped via ScrapingBee (not direct fetch). The enrich-save Instagram
branch uses fetchWithScrapingBee to retrieve og:title (caption), og:description, and
og:image from reel URLs. cdninstagram.com is Instagram's legitimate image CDN — do NOT
null these URLs.

Past issues with "Instagram blocks scraping" referred to direct fetch only. The mobile
share sheet remains the ideal path for in-app iOS/Android saves (better caption access
before Instagram auth walls), but ScrapingBee works for email-forward and URL-paste
pipelines today.

## Tech Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS, Shadcn/ui
- PostgreSQL via Supabase, Prisma ORM
- Clerk auth
- Claude API: claude-sonnet-4-6
- Google Maps Platform (geocoding) + Mapbox (rendering)
- CloudMailin inbound, Resend transactional, Loops.so lifecycle
- Vercel Pro + Supabase hosting

## Key File Paths
src/app/api/saves/route.ts
src/app/api/webhooks/email-inbound/route.ts
src/app/api/trips/[id]/itinerary/[itemId]/route.ts
src/app/api/trips/[id]/budget/route.ts
src/app/api/admin/enrich-all-saves/route.ts
src/app/api/admin/reenrich-instagram/route.ts
src/app/api/saves/[id]/identify/route.ts
src/app/share/[token]/page.tsx
src/lib/enrich-save.ts
src/lib/loops.ts
src/components/features/trips/TripTabContent.tsx
src/components/features/trips/TripMap.tsx
src/components/features/trips/BookingIntelCard.tsx
src/components/features/saves/SavesScreen.tsx
src/components/features/saves/SaveCard.tsx
src/components/features/saves/SaveDetailModal.tsx

## Design System
- Background: #FFFFFF
- Navy body text: #0A1628
- Deep navy headings: #1B3A5C
- Terracotta accent: #C4664A, hover #B85D42
- Conflict warnings: #D97706, background #FFFBEB
- Booking cards: white background, 3px terracotta left border
- Heading font: Playfair Display
- Body font: Inter / Plus Jakarta Sans
- NO icons. NO emojis. Typography-only UI.

## Map Rules — CRITICAL, DO NOT GET WRONG AGAIN

TWO COMPLETELY SEPARATE ARRAYS ALWAYS:

pinsToRender = isValidCoord only → used for marker JSX rendering
pinsForBounds = isValidCoord + isWithinTripRadius → used for fitBounds ONLY

NEVER apply proximity filter to pinsToRender.
NEVER apply ONLY isValidCoord to pinsForBounds.
These must always be separate. Conflating them breaks the map.

isValidCoord: rejects null, zero, out-of-range values
isWithinTripRadius: rejects coords more than 300km from trip anchor

Anchor: trip.accommodation_lat/lng → fuzzy CITY_CENTERS match → Seoul default
City key match: case-insensitive includes scan, never exact match

flyToDay must use getDayAnchor (centroid of day items) not trip anchor.
Day proximity radius: 100km. Trip proximity radius: 300km.

Transit cards: render only if BOTH adjacent items pass isValidCoord
AND haversine distance between them <= 50km.
For TRAIN/FLIGHT items, use arrivalLat/arrivalLng (not departure) 
as the FROM point in transit calculations.

## Instagram Description Cleaning
Always apply cleanDisplayDescription() before rendering descriptions.
Use [\s\S]*? not .* with s flag (ES2017 compat).
Apply in: SaveDetailModal, SaveCard subtitle, TripTabContent day cards.

## Itinerary Sort Weights
Arrival flights: 10, Check-in: 20, Activities: 50, Trains: 70, Check-out: 80, Departure flights: 90

## Email Extraction Rules
Activity/tour bookings: extract activityTitle (specific tour name), 
never platform name (GetYourGuide, Viator, Klook) or operator name.
If activityTitle null, use cleaned email subject. Never "GetYourGuide" as title.

## Current Beta State
3 real users: The Blinks, Santiano, Drewmak
Test profile: Greene family, Seoul Mar 26 trip
IDs for test only, never in app logic:
- profileId: cmmmv15y7000104jvocfz5kt6
- tripId: cmmx6428k000004jlxgel7s86

## Priority Queue
1. ACTIVITY cards tappable (in progress)
2. GetYourGuide title extraction
3. Day map centers on day items
4. Arrival coords for trains (transit Seoul→Busan→hotel)
5. Vault flight missing airport codes
6. Hydration error #418
7. Default time for untimed saves
8. Post-import verification flow (needsVerification flag)
9. Mobile app scaffold (iOS share sheet — unlocks Instagram)
10. Loops email sequences live
11. Booking Portal

## Environment Variables (all in Vercel)
ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
NEXT_PUBLIC_MAPBOX_TOKEN, RESEND_API_KEY, LOOPS_API_KEY,
CLERK_WEBHOOK_SECRET, NEXT_PUBLIC_UNSPLASH_ACCESS_KEY,
CRON_SECRET, DATABASE_URL,
INNGEST_SIGNING_KEY (kept but unused — do not activate)

## Prompt Writing Standard — EXACT CODE REQUIRED

Every prompt must include exact code, not descriptions.
No room for interpretation. No generic instructions.

REQUIRED in every prompt:
1. Exact function signatures with TypeScript types
2. Exact JSX blocks including className strings
3. Exact variable names matching what grep shows in the file
4. Exact condition logic — not "check if valid" but the actual if statement
5. Exact API call with method, headers, body shape
6. Exact Prisma select fields if DB is touched
7. Exact git commit message

NEVER write:
- "Add a check for valid coordinates" → write the exact if statement
- "Update the transit card logic" → write the exact JSX replacement
- "Make sure the type includes X" → write the exact type definition
- "Apply the function at the render point" → show the exact line to replace

If the existing code must be shown first (always), the prompt must say:
"Show lines X-Y of [filename] before making any changes"
or
"Show the output of: grep -n [pattern] [file]"

Claude Code must confirm the grep output matches expectations
before writing a single line of new code.

This standard applies to every prompt.

## Never Guess — Diagnose First, Always

This rule applies to every single prompt without exception.

NEVER write a fix based on assumed code structure.
NEVER write a fix based on what a previous prompt claimed to change.
NEVER assume a previous fix landed correctly.
ALWAYS grep the actual current code before writing any fix.
ALWAYS show the exact lines being changed before changing them.
ALWAYS verify the fix landed by grepping again after the commit.

The pattern for every fix is:
1. grep to find exact file and line
2. Show the exact current code (not what you think it says)
3. Show the exact replacement code
4. Apply the change
5. grep again to confirm the new code is in place
6. Commit and push

If the grep output does not match what you expect, STOP.
Do not proceed. Report what you found and ask for direction.

A fix that cannot be verified by grep output is not a fix.
It is a guess. Guesses are not acceptable.


## Foundation-First Discipline

When building any feature, evaluate whether the foundational layers (trip creation, place identification, data schema, shared components, autocomplete inputs, third-party API integrations) actually capture the data needed for downstream features.

If a downstream feature receives broken data because the foundation is broken, fix the foundation first. Do not work around foundation issues — that compounds the bug rather than resolving it.

A feature ships only when the foundation it depends on is verified working under realistic conditions.

## Trade-off Transparency

For any non-trivial decision (library choice, API parameter, schema relationship, default behavior), surface the trade-off explicitly:
- What was chosen
- What alternatives were considered
- What is accepted as the cost of the choice
- What is the failure mode if the assumption is wrong

Defaults are decisions. Implicit defaults that are not acknowledged become latent bugs.

## Cardinality Awareness

Before using `.find()`, `[0]`, or any "pick first" operator on a collection, verify:
- Is the collection guaranteed to have exactly one item?
- If multiple items can exist, is ordering deterministic?
- Is there a contextual filter that narrows to the right item?

If none apply, either fix the cardinality assumption or document the multi-item handling explicitly. Surface this when generating code that uses these operators.

## Schema Relationship Explicitness

Foreign key relationships ship with explicit onDelete behavior:
- `onDelete: Cascade` — child records deleted with parent
- `onDelete: SetNull` — child records orphaned, become unassigned
- `onDelete: Restrict` — parent deletion blocked while children exist

Choose deliberately. The default may not match user expectations. Surface the choice in the response.

## External API Integration Discipline

Third-party API calls (Google Places, geocoding, payment, auth) ship with documented configuration:
- All required parameters explicitly set (types, components, fields, languages, etc.)
- Response field selection rationale (description vs structured_formatting, terms vs address_components, etc.)
- Failure mode handling (graceful degradation, error surface, rate limit awareness)
- Cost/quota implications

Do not accept library defaults without checking what they imply.

## Shared Component and Shared API Verification

Components or endpoints used across multiple callsites are tested against ALL consuming surfaces. A regression in one is a regression in all. Before changing shared infrastructure, identify all callsites and verify the change works across all of them.

When fixing a shared component, the fix is not complete until verified on every consuming surface. "API fixed" without "UI updated" leaves the user-visible bug intact.

## User-Perception Lens

A feature is not done when tests pass. It is done when:
1. Tests pass (necessary condition)
2. TypeScript compiles cleanly (necessary)
3. Realistic user behavior produces sensible results (necessary)
4. Failure modes degrade gracefully (empty states are honest, errors recoverable)
5. The feature would not be perceived as broken by a typical user

Perceived-broken is real-broken from a product perspective. If a user sees five identical dropdown entries, they perceive the platform as broken regardless of whether the underlying API now returns differentiated data — until the rendering also displays the differentiation.

## Push Back When Foundation Is Shaky

If a request would build on top of a foundation that has not been verified, push back before building. If a request would ship a feature that fails the user-perception test, push back before building. If a request is ambiguous in a way that would let multiple wrong outcomes pass tests, push back before building.

Matt values diligence over speed when the trade-off matters. He has asked Claude Code to flag implicit defaults, surface trade-offs proactively, and pause for foundation verification before adding more layers. This is a feature, not a bug, of how the partnership works.

## Live API Verification

Unit tests with mocks verify your assumptions about an API. They do not verify the API. For any third-party integration:

1. Before writing the adapter, hit the live API once with realistic queries. Document the actual response shape and behavior.
2. Build the adapter against the documented live behavior, not assumed behavior.
3. Run verification against the live API before declaring the integration "working" — mocked tests passing is necessary but not sufficient.
4. If the adapter has known coverage gaps (free tier limitations, regional gaps, time-window limits), document them explicitly in code comments AND in the spec at integration time, not after a user reports the gap.

This happened with TheSportsDB in Chat 40: the live `searchteams.php?t=Chicago` returns 0 results because it searches by team name not city, but tests mocked it returning Chicago Cubs. The adapter shipped, Events tab went live, every user saw empty state. The fix was hiding the tab until a verified adapter ships.

This principle compounds with foundation-first: the adapter is a foundation for Events. Verifying the foundation requires verifying against reality, not against your assumed model of reality.

## Every Fix Must Be Universal

Before writing any fix, answer these three questions:
1. What is the root cause in the shared component or API route?
2. Will this fix apply automatically to ALL users, ALL trips, ALL days?
3. Does existing data need a backfill to match the new behavior?

If the answer to question 2 is "no" or "maybe" — stop.
Do not ship the fix. Redesign it until it is universal.

Never fix a symptom on one trip when the root cause lives 
in a shared component that affects all trips.

Never hardcode trip IDs, user IDs, day numbers, or 
destination names in application logic.

Never ship a fix without asking: "What happens to existing 
data?" If existing records don't match the new behavior, 
write a backfill.

Examples of wrong thinking:
- "This fixes Day 1 on the Seoul trip" — WRONG
- "This works for the Greene family profile" — WRONG
- "We can clean up the other trips later" — WRONG

Examples of right thinking:
- "This fixes TripMap.tsx so all trips on all days work correctly"
- "This fixes /api/saves/route.ts so all users see correct data"
- "The backfill updates all existing records to match"
