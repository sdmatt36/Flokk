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

### Instagram/Airbnb
Both block web scraping. Never fetch cdninstagram.com, fbcdn.net, scontent.
Null them via sanitizeThumbnailUrl(). Mobile share sheet is the permanent fix.

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
