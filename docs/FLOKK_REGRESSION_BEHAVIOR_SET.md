# Flokk Regression Behavior Set

Per Discipline 9.52, this is the per-surface behavior registry Code reads before any UI commit. For each modified surface, listed behaviors MUST continue to work post-fix. Each behavior has a test step (curl, click, SQL, or visual).

If Code is about to commit code that might break any behavior listed for a touched surface, Code HALTS and reports to strategic chat before proceeding.

This file is appended to (not rewritten) as new behaviors are verified. The header for each surface section identifies the surface; rows are individual behaviors. Update the verified date on each subsequent session that re-confirms.

---

## Surface: Share page (`/share/[token]`)

Last verified: Chat 55 (May 25, 2026) — demo URL `/share/_Dvp_C2r3eIx`

| Behavior | How to test |
| --- | --- |
| Page returns 200 OK on valid token | `curl -I https://www.flokktravel.com/share/_Dvp_C2r3eIx` |
| No TDZ ReferenceError in browser console | Open devtools, load page, confirm no "Cannot access X before initialization" |
| Per-day cards render with correct dayIndex | Click expand on any day; verify items match ItineraryItem rows |
| Day 8 Snorkeling renders 1 card not 2 (dedup) | Visual check on demo URL |
| Contacts block renders with LODGING hotel synthesis | Verify hotel-source rows synthesize as Contacts cards (5 cards on demo URL: Pickalbatros, Abdallah, Booking.com, Jolie Ville, King Khafren) |
| Notes block renders with h2 heading | Inspect rendered HTML for h2 element on Notes section |
| Inline per-day notes render on expand | Expand a day with TripNote rows; notes appear inline within the day card |
| @property.booking.com privacy gate | TripContact rows with that domain are scrubbed from Contacts display |

## Surface: Trip detail (`/trips/[id]`)

Last verified: Chat 55 (May 25, 2026)

| Behavior | How to test |
| --- | --- |
| Drag-drop reorder syncs dayIndex AND scheduledDate | Drag an item across days; verify DB row's dayIndex and scheduledDate both update |
| Edit mode opens for Lodging URL field | Click edit on a Lodging row; URL field becomes editable |
| Dedup 409 returns confirm dialog | Save a duplicate item; dialog appears asking to confirm or cancel |
| DELETE cascade removes ItineraryItem AND TripDocument | Delete a cancelled booking; verify both tables show the row removed (CL-10) |

## Surface: TourResults card grid

Last verified: Chat 55 (May 25, 2026)

| Behavior | How to test |
| --- | --- |
| 2-col mobile grid, 3-col sm+ breakpoint | Resize browser; verify column count switches at sm breakpoint |
| Why and familyNote ≤120 chars render inline in full | Tour with short why; full text shows without toggle |
| Why and familyNote >120 chars clamp to 2 lines + Show more | Tour with long why; "Show more" appears, expands inline on click |
| FamilyNote retains italic + terracotta (#C4664A) | Inspect rendered CSS on familyNote element |
| Mapbox scrollZoom is false | Wheel events over the map scroll the page, do not zoom the map |
| Map zoom still works via +/- controls and pinch | Click zoom controls; verify map zooms |

## Surface: TourShareView (`/s/[token]`)

Last verified: KNOWN GAP per BL-17 (Chat 55)

| Behavior | How to test |
| --- | --- |
| Page returns 200 OK on valid token | `curl -I https://www.flokktravel.com/s/[token]` |
| Expand toggle for why/familyNote propagates to readOnly view | KNOWN GAP per BL-17 — verify before any tour-share demo |
| "Tokyo, Japan, Japan" duplicate is fixed | Visual check of any Tokyo tour share view (reportedly fixed ~Chat 50; do not re-raise without evidence) |

## Surface: EmailImportAlerts card (trip detail)

Last verified: PENDING SPOT-CHECK per BL-20 (Chat 55)

| Behavior | How to test |
| --- | --- |
| All Chat 55 extractions surface (Southwest schedule-change via 7e46128, Egypt confirmations) | Open trip detail; verify EmailImportAlerts card lists expected extractions |

---

## How to add a surface

When code modifies a surface not listed above, add a section with the surface path, current date as "Last verified", and a table of behaviors with test steps. Update the verified date on each subsequent session that re-confirms.

When a behavior is discovered to have regressed, file a BL-N entry in the Foundation §7 backlog AND mark the row here with a `REGRESSED [date]` prefix until fixed.
