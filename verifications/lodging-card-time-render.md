# LODGING card time render — restore

Run date: 2026-04-30

## Cause
LODGING ItineraryItem cards on day views were missing the check-in/check-out time inline with
the date. The modal display was fixed in e571868. The card surface — primary at-a-glance
scanning context — still showed only "Check-in · Mon May 4" with no time component.

## Fix
Added `lodgingTime` variable using the existing `formatTime()` helper (line 592,
`"HH:MM" → "6:30 PM"`). Appended inline to the existing date string:

  Before: "Check-in · Mon May 4"
  After:  "Check-in · Mon May 4 · 3:00 PM"

Reads `it.arrivalTime` for check-in cards, `it.departureTime` for check-out cards.
Falls back to date-only string when the field is null (defensive — no visual regression
for items without a stored time).

## Files modified
- src/components/features/trips/TripTabContent.tsx (line 3508, 3517)

## Manual verification (Matt to run after hard refresh)
- [ ] Greene Okinawa — any LODGING check-in card shows "Check-in · {date} · 3:00 PM"
- [ ] Greene Okinawa — any LODGING check-out card shows "Check-out · {date} · 11:00 AM"
- [ ] Any other trip's LODGING card shows the time inline
- [ ] Modal still shows correct time (regression check on e571868)
- [ ] LODGING with no stored time shows date alone (no "· null" or "· undefined")

## What I'm watching (Discipline 4.16)

1. **Share view LODGING time** — the card and modal now both render times. The share view
   (`ShareItemView.tsx` ItineraryItemLayout) is the third surface. Needs a separate audit
   to confirm `arrivalTime`/`departureTime` are fetched and displayed in share renders.

2. **FLIGHT card time formatting** — FLIGHT cards show raw `departureTime`/`arrivalTime`
   strings (e.g., "14:30") without 12h conversion. If the design standard is 12h AM/PM
   everywhere, FLIGHT cards have the same format gap. Separate fix.

3. **TRAIN card time formatting** — Same as FLIGHT: `depTime`/`arrTime` shown raw without
   `formatTime()` conversion at lines 3549-3550. Low priority but visually inconsistent.

4. **arrivalTime on check-in cards** — The backfill set `arrivalTime = '15:00'` for all
   existing LODGING check-in items. Any hotel added before the backfill AND after the
   arrivalTime default was added to the parser (commit 815d4b3) should already have the
   time. Items added before 815d4b3 may still have null — those will fall back to date-only
   display silently.

5. **Forward chain: SI-1/SI-2** — Schedule Intelligence conflict detection (hotel check-in
   before flight arrival, check-out after departure flight) now has both the modal and card
   rendering the times users are meant to act on. SI warnings become more meaningful once
   users can see the times without opening the modal.

## AI surface (Discipline 4.17)

- **A. Extraction** — Check-in and check-out times extracted from hotel confirmation emails
  are stored as `arrivalTime`/`departureTime`. Current defaults (15:00/11:00) are fictional
  precision from the backfill. Parser could be upgraded to extract actual stated times from
  confirmation emails (e.g., "Check-in from 3:00 PM" vs. "Check-in from 2:00 PM" for
  boutique hotels) and overwrite the default.

- **B. Enrichment** — For hotels where the confirmation email didn't state a time, the Google
  Places API `opening_hours` or hotel-specific fields could provide the standard check-in
  window. Not available on all Place Detail responses, but feasible for major chains.

- **C. Generation** — When check-in time is 3:00 PM and the flight arrives at 5:00 PM, the
  SI system could generate a suggestion: "You'll have 2 hours to kill before check-in — here
  are saved activities near {hotel city}" drawn from the user's Vault.

- **D. Inference** — Across multiple trips, the user's actual check-in preferences (do they
  always request early check-in? do they consistently arrive before 3:00 PM?) are learnable.
  A preference profile for check-in/check-out patterns feeds hotel booking intelligence.

- **E. Aggregation** — Not applicable at this surface directly.

- **F. Curation** — The three-surface rule (card + modal + share view) is a running curation
  discipline. Every field on an ItineraryItem should be verified against all three surfaces.
  A field that renders in modal but not card, or card but not share, is a silent curation gap.
  `venueUrl` is the next known instance of this: populated 0 times in the DB currently, so
  the gap is upstream (enrichment), not rendering.
