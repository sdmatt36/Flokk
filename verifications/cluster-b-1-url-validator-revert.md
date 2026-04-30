# Cluster B-1 URL validator revert

Run date: 2026-04-30
Reverted from commit 8d39632 (Cluster B-1)

## Symptom
After commit 8d39632 deployed, Hyatt Regency Seragaki, Blue Cave Snorkel, and other items lost
their Visit website / Link buttons in modals and on share views. The regression was universal:
every URL render site that received a URL without an explicit http:// or https:// scheme silently
produced no link.

## Root cause
`src/lib/url-validator.ts` `safeUrl()` required `https?://` scheme. Production URL data contains
legitimate URLs without scheme prefixes (e.g. "hyatt.com/...", "//maps.google.com/...",
booking-platform manage URLs). These were nulled at render time with no fallback and no error.

The validator design was correct in intent — defensive against truly malformed strings — but was
applied before auditing what URL shapes actually exist in production data.

## What was reverted
- `src/lib/url-validator.ts` deleted
- 4 `safeUrl()` wrappings removed from `ShareItemView.tsx` (import + 3 visitUrl derivations + TourLayout stop link)
- 3 `safeUrl()` wrappings removed from `TripTabContent.tsx` (import + activity detail Link + activity list Link + Trip Intelligence rec Link)
- `setUrlInput(localWebsiteUrl ?? "")` → `setUrlInput(localWebsiteUrl)` (narrowing fix was only needed because of safeUrl condition; `{localWebsiteUrl && ...}` narrows to string inside the branch)

## What was preserved
- `destination-coords.ts` entries (Edinburgh, Glasgow, Dublin, Belfast, Athens, San Diego, Kamakura, etc.) — working correctly, untouched
- SQL backfill of LODGING arrivalTime = '15:00' / departureTime = '11:00' — already in DB, not reversible via git
- `BookingIntelCard.tsx` `useState(true)` — collapsed default, working correctly, untouched

## TypeScript compile
Clean after revert (no errors).

## Manual verification (Matt to run after hard refresh)
- [ ] Greene Okinawa trip — open Hyatt Regency Seragaki Itinerary modal — Manage booking link present
- [ ] Greene Okinawa trip — open Blue Cave Snorkel ACTIVITY modal — website link present
- [ ] Any share view with a populated websiteUrl — Visit website button renders
- [ ] Greene Scotland trip — Edinburgh map still loads correctly (destination-coords fix held)
- [ ] Any LODGING — check-in shows 3:00 PM, check-out 11:00 AM (backfill held)

## Discipline 4.15 violation — Universal Consumer Audit
This regression was caused by skipping the required URL data audit before designing the validator.
Before rebuilding: run a SQL query to inventory all distinct URL shapes in production across
`SavedItem.websiteUrl`, `SavedItem.sourceUrl`, `ItineraryItem.venueUrl`, and `ManualActivity.website`.
Categorize by scheme presence, subdomain patterns, and known-bad patterns. Design the validator
against the actual data, not assumed data.

## What I'm watching (4.16)
1. **URL data audit is now a prerequisite** — validator rebuild is blocked on the audit. Without it,
   any scheme or pattern check will produce another false-negative regression.
2. **Backfill fictional precision still stands** — 74 + 40 hotels have uniform 15:00 / 11:00 defaults.
   No change to this from the revert.
3. **Edinburgh / Athens / San Diego now resolving correctly** — verified coords entries present
   after revert.
4. **B-2 (Booking.com URL detection) still queued** — the URL data audit required before validator
   rebuild naturally feeds B-2 as well.

## AI surface (4.17)
- **B. Enrichment** — Once the URL data audit is complete, the validator can normalize (prepend
  `https://` where a bare hostname is stored) rather than reject. This is higher-value than rejection:
  a normalized URL is a working link; a rejected URL is a missing link.
- **D. Inference** — URL shape variation by source (Booking.com, Hyatt, Marriott, user-pasted,
  email-extracted) is learnable. A classifier could apply source-specific normalization transforms
  rather than a single global rule.

## Out of scope for this revert
- Validator rebuild (requires data audit — separate prompt)
- Booking.com URL pattern detection (B-2 — separate prompt)
- Investigation of other URL-related gaps
