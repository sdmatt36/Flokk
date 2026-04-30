# Time format consistency — LODGING modal + TRAIN/FLIGHT cards + all item type modals

Run date: 2026-04-30

## Files modified
- src/components/features/trips/TripTabContent.tsx (6 render sites)

## Cause
LODGING card (commit 38e84c8) rendered times via formatTime() → "3:00 PM". All modal and
ItineraryItem card time renders still showed raw 24h strings ("15:00", "11:00", "14:30").
Adjacent surfaces inconsistent: users saw "3:00 PM" on card but "15:00" on modal for the
same field. FLIGHT table cards (Flight data) were already correct (formatTime already applied
at lines 3331-3332). Only ItineraryItem-backed renders were raw.

## Fix
Applied `formatTime()` at all raw time render sites. Defensive `|| rawValue` fallback retained
for all modal sites in case formatTime ever returns null for an unexpected format. Card sites
use `?? rawValue` via variable assignment (matching the existing Flight table card pattern).

## Sites fixed

| Line | Context | Field | Before | After |
|---|---|---|---|---|
| 3470 | ItineraryItem FLIGHT card | depTime | `it.departureTime` (raw) | `formatTime(it.departureTime) ?? it.departureTime` |
| 3471 | ItineraryItem FLIGHT card | arrTime | `it.arrivalTime` (raw) | `it.arrivalTime ? (formatTime(...) ?? ...) : null` |
| 3541 | ItineraryItem TRAIN card | depTime | `it.departureTime` (raw) | `formatTime(it.departureTime) ?? it.departureTime` |
| 3542 | ItineraryItem TRAIN card | arrTime | `it.arrivalTime` (raw) | `it.arrivalTime ? (formatTime(...) ?? ...) : null` |
| 4038 | FLIGHT modal | Departs | `{sit.departureTime}` (raw) | `{formatTime(sit.departureTime) \|\| sit.departureTime}` |
| 4039 | FLIGHT modal | Arrives | `{sit.arrivalTime}` (raw) | `{formatTime(sit.arrivalTime) \|\| sit.arrivalTime}` |
| 4104 | LODGING modal | Check-in time | `{sit.arrivalTime}` (raw) | `{formatTime(sit.arrivalTime) \|\| sit.arrivalTime}` |
| 4105 | LODGING modal | Check-out time | `{sit.departureTime}` (raw) | `{formatTime(sit.departureTime) \|\| sit.departureTime}` |
| 4207 | TRAIN modal | Departs | `{sit.departureTime}` (raw) | `{formatTime(sit.departureTime) \|\| sit.departureTime}` |
| 4208 | TRAIN modal | Arrives | `{sit.arrivalTime}` (raw) | `{formatTime(sit.arrivalTime) \|\| sit.arrivalTime}` |
| 4240 | ACTIVITY modal | Time | `{sit.departureTime}` (raw) | `{formatTime(sit.departureTime) \|\| sit.departureTime}` |

**No-op (already correct):** Flight table card (lines 3331-3332) was already using formatTime().

**Bonus fixes:** FLIGHT modal, TRAIN modal, and ACTIVITY modal time renders were raw and not
in the original scope — fixed in the same pass since they're the same file, same pattern.

## Manual verification (Matt to run after hard refresh)
- [ ] Greene Okinawa → tap any LODGING check-in card → modal shows "Check-in time: 3:00 PM" (not "15:00")
- [ ] Same trip → tap a check-out card → modal shows "Check-out time: 11:00 AM" (not "11:00")
- [ ] Any trip with a FLIGHT ItineraryItem → card shows "Departs 2:30 PM" style (not "14:30")
- [ ] Tap a FLIGHT card → modal also shows formatted times
- [ ] Any trip with a TRAIN ItineraryItem → card shows formatted departure/arrival times
- [ ] Any trip with an ACTIVITY ItineraryItem with a time → modal shows formatted "3:30 PM" not "15:30"
- [ ] LODGING card (regression check) — still shows 12h format from 38e84c8
- [ ] Flight TABLE card (regression check) — still shows 12h format (was already correct, should be unchanged)

## Out of scope
- Share view time rendering (three-surface rule deferred — the share view at ShareItemView.tsx
  is a separate pass; time fields there are also rendered raw)
- Date format consistency (separate workstream)

## What I'm watching (Discipline 4.16)

1. **Share view time rendering (three-surface gap)** — ShareItemView.tsx renders ItineraryItem
   data on share pages. Times there are raw. This is the third surface for the three-surface rule.
   Now that card and modal are both 12h, share view is the remaining gap. Should be closed in a
   dedicated share view pass.

2. **Lines 8484–8499 raw renders** — These are in a separate section (likely the flight booking
   or vault area) and were not touched in this pass. They render `sit.departureTime` and
   `sit.arrivalTime` inline in a date string (`at ${sit.departureTime}`). Worth auditing in the
   next share/vault pass.

3. **"Time TBC" fallback preserved** — Card renders for FLIGHT/TRAIN now compute depTime via
   formatTime(). If `it.departureTime = null`, `formatTime(null) = null`, `null ?? null = null`,
   `null ?? "Time TBC"` at render time → "Time TBC" still shows. Preserved correctly.

4. **formatTime() with unexpected format input** — The helper returns null for any string that
   doesn't parse as "HH:MM". If a parser ever stores a non-standard time string (e.g., "2pm",
   "14.30"), the `|| rawValue` fallback shows the raw string rather than empty. Correct behavior.

5. **ACTIVITY departureTime semantics** — The ACTIVITY modal uses `departureTime` to mean "tour
   start time." This is semantically different from a flight departure. The 12h format is still
   correct for display, but the field label ("Time" in the modal) may need a future rename to
   "Start time" for clarity.

## AI surface (Discipline 4.17)

- **A. Extraction** — JAL flights showing "Time TBC" indicate the parser is not extracting
  departure/arrival times from the confirmation email. Common cause: time stored as text after
  parsing (e.g. "10:50 AM" extracted as non-HH:MM string) or genuinely not present in the
  email body. A parser enrichment pass for FLIGHT items with null departureTime/arrivalTime
  using the flight number + date via an airline schedule API (AviationStack, FlightAware) would
  fill these gaps automatically.

- **B. Enrichment** — For confirmed FLIGHT items (with airline + flight number), departure and
  arrival times are enrichable from public schedule data at parse time. This covers emails where
  times were not in the confirmation text.

- **C. Generation** — No generation surface here — time formatting is display-only.

- **D. Inference** — No inference surface.

- **E. Aggregation** — No aggregation surface.

- **F. Curation** — 12h time format everywhere is now a foundational invariant for card + modal
  surfaces. The share view remains the outstanding gap. The three-surface rule (card + modal +
  share view) should be applied as a checklist for every ItineraryItem field going forward.
  A systematic audit of ShareItemView.tsx's ItineraryItemLayout against this checklist is the
  next curation task.
