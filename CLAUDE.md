# Flokk — Claude Code Session Instructions

**Read this file first at every session start. It points at everything else.**

---

## Critical references — read these too

This file is the dashboard: state, paths, environment. The rules and the schema live elsewhere.

- **FLOKK_DISCIPLINES.md** (repo root) — the constitution. The complete numbered rule set
  (disciplines 4.1 through 4.39) governing all Flokk development. Every "how do I write
  code here" question is answered by a numbered discipline. Read at session start.
- **FLOKK_FOUNDATIONS.md** (docs/) — the encyclopedia. Schema, entity model, lifecycles,
  render surfaces, image and URL priority chains. Every "what is the shape of this data"
  question is answered here. Read at session start.
- **Most recent Flokk_Chat{N}_Handoff.docx** in /mnt/project/ — the active priority queue
  and session-to-session context. Always reference the highest-numbered handoff present.

If a rule, schema fact, or operational decision is not in this file, it is in one of those
three. Do not infer rules from CLAUDE.md silence; check the disciplines doc.

---

## Project orientation

Flokk is an AI-powered family travel planning platform. The thesis: families already save
travel inspiration constantly (Instagram saves, TikTok screenshots, Google Maps stars), but
none of it surfaces where they need it. Flokk rescues that scattered content and makes it
actionable across the trip lifecycle: Save → Plan → Book → Complete → Rate → Discover.

Co-founders: Matt Greene (product, architecture, builds via Claude Code) and Jenifer Dasho
(brand and partnerships, active beta tester).

---

## Tech stack

- Next.js 14 App Router, TypeScript, Tailwind CSS, Shadcn/ui
- PostgreSQL via Supabase (project ID egnvlwgngyrkhhbxtlqa), Prisma ORM
- Clerk auth
- Anthropic Claude API: claude-sonnet-4-6
- Google Maps Platform (geocoding) + Mapbox (rendering)
- CloudMailin inbound, Resend transactional, Loops.so lifecycle
- Vercel Pro hosting, Supabase hosting

---

## Permanent architecture decisions

These are facts about the live system. The rationale and full context live in FLOKK_FOUNDATIONS.md.

- **Inngest: PERMANENTLY DISABLED.** Signature verification incompatible with Vercel
  serverless. Background jobs use Vercel Cron with CRON_SECRET auth only.
- **Email pipeline: synchronous.** CloudMailin → /api/webhooks/email-inbound/route.ts →
  Claude API → DB. maxDuration = 60. Never route through a queue.
- **Airbnb scraping blocked.** Direct fetch returns login walls. ScrapingBee not yet
  implemented for Airbnb URLs.
- **Instagram via ScrapingBee only.** Direct fetch fails; ScrapingBee works for og:title
  (caption), og:description, og:image. cdninstagram.com is the legitimate CDN — do not
  null these URLs.
- **Map rendering uses two separate arrays per Discipline 4.19.** `pinsToRender` (validity
  check only) vs `pinsForBounds` (validity + radius). Never conflate.
- **Itinerary sort weights are fixed per Discipline 4.20.** Arrival flights 10, check-in
  20, activities 50, trains 70, check-out 80, departure flights 90.
- **ItineraryItem.imageUrl is populated at write time per Discipline 4.18.** Sourced from
  parallel SavedItem.placePhotoUrl. Render code reads the column directly; no render-time
  resolution.

---

## Key file paths
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

---

## Design system

- Background: #FFFFFF
- Navy body text: #0A1628
- Deep navy headings: #1B3A5C
- Terracotta accent: #C4664A, hover #B85D42
- Conflict warnings: #D97706, background #FFFBEB
- Booking cards: white background, 3px terracotta left border
- Heading font: Playfair Display
- Body font: Inter / Plus Jakarta Sans
- Lucide icons only for functional UI
- No emojis in product surfaces (permitted in user-generated content)

Brand is locked — do not propose rebranding, color tweaks, or typography changes.

---

## Current beta state (as of May 1, 2026)

42 beta users. Roughly half active — uploading trips, saving content, generating tours.
Beta cohort 2 added approximately 25% of users on April 30, 2026 via the Greene investor
presentation; cohort grew organically through the front door, not via collaborator invite.

Test profile (used in development only, never in app logic):
- Greene family profileId: cmmmv15y7000104jvocfz5kt6
- Greene Seoul trip ID: cmmx6428k000004jlxgel7s86
- Greene Okinawa trip ID: cmmet611o0000yn8nz6ss7yg4
- Greene Scotland (Edinburgh) trip ID: cmnhgp10p000104l4hlof4gjc
- Jenifer Dasho profileId: cmo16p8zb000104jsp8bdxnou
- Jenifer Portugal trip ID: cmobreqqh000004ley8yd74p2

---

## Priority queue

The active priority queue lives in the most recent chat handoff document in /mnt/project/
(file pattern: Flokk_Chat{N}_Handoff.docx). Always reference the highest-numbered handoff
present. Do not maintain a separate queue in this file — it drifts.

---

## Environment variables (all in Vercel)

ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
NEXT_PUBLIC_MAPBOX_TOKEN, RESEND_API_KEY, LOOPS_API_KEY,
CLERK_WEBHOOK_SECRET, NEXT_PUBLIC_UNSPLASH_ACCESS_KEY,
CRON_SECRET, DATABASE_URL,
INNGEST_SIGNING_KEY (kept but unused — do not activate)

---

## Updates and drift

This file changes when state changes — beta count, file paths, environment variables,
architecture decisions. It does NOT change when rules change; rules live in
FLOKK_DISCIPLINES.md. It does NOT change when schema changes; schema lives in
FLOKK_FOUNDATIONS.md.

Anything with a date attached or a number that changes weekly belongs here. Anything that
is a principle or a rule belongs in FLOKK_DISCIPLINES.md. Anything that describes the
shape of data belongs in FLOKK_FOUNDATIONS.md.
