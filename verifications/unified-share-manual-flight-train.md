# Unified Share Template — ManualActivity + FLIGHT + TRAIN (prompt 2 of 4)

Run date: 2026-04-30

## Files modified
- src/components/share/ShareItemView.tsx (ManualActivityLayout rebuild, FlightLayout new, TrainLayout new, dispatch update, manual_activity attribution block)
- src/lib/share-token.ts (manualActivity resolver: confirmationCode + trip select added)

## Changes summary

### ManualActivityLayout (rebuilt)
Old: bare-bones 5-line render (title, date, notes only).
New: full parity structure — typeLabel tag, Playfair title, locationLine (city only — no country column), formatted date + time range, venueName, address, notes → synthesized description fallback, price, website link.

Schema corrections caught during Step 0 inventory:
- ManualActivity uses `lat`/`lng`, NOT `latitude`/`longitude`
- No `country` column on ManualActivity — locationLine uses `city` only
- No `description` column — `notes` is the description equivalent

### FlightLayout (new)
Replaces ItineraryItemLayout transit branch for FLIGHT. Fields rendered:
- Route: fromAirport → toAirport, fallback fromCity → toCity, fallback item.title
- Formatted date (scheduledDate + T12:00:00)
- Time range (departureTime – arrivalTime)
- Confirmation code
- Notes

### TrainLayout (new)
Same structure as FlightLayout. Route: fromCity → toCity. Label: "TRAIN".

### Dispatch update
Parent itinerary_item dispatch now routes:
- type === "FLIGHT" → FlightLayout
- type === "TRAIN" → TrainLayout
- all others (LODGING, ACTIVITY) → ItineraryItemLayout

### manual_activity attribution block (new)
Mirrors itinerary_item and saved_item blocks:
- trip.title present: "From {trip.title} · Shared on Flokk"
- trip null: "Shared on Flokk"

## Step 6 SQL scope check

**ManualActivity shareTokens (1 row):**
| shareToken | title | type | city | date |
|---|---|---|---|---|
| X4pQ3zSUbBUb | Gyeongbokgung Palace | culture | Seoul | 2026-03-30 |

**FLIGHT shareTokens (1 row):**
| shareToken | title | fromAirport | toAirport | scheduledDate | confirmationCode |
|---|---|---|---|---|---|
| oStUkZYzexNR | HND → OKA | HND | OKA | 2026-05-04 | F344GI |

**TRAIN shareTokens:** 0 rows

TypeScript compile: clean (no errors).

## Manual verification (Matt to run)

- [ ] https://flokktravel.com/s/X4pQ3zSUbBUb — Gyeongbokgung Palace (ManualActivity, culture, Seoul):
  - [ ] "CULTURE" tag (terracotta uppercase)
  - [ ] Title "Gyeongbokgung Palace"
  - [ ] City line "Seoul"
  - [ ] Date "Monday, March 30, 2026"
  - [ ] Notes or synthesized description "Activity in Seoul"
  - [ ] Attribution footer
- [ ] https://flokktravel.com/s/oStUkZYzexNR — HND → OKA (FLIGHT):
  - [ ] "FLIGHT" tag (terracotta uppercase)
  - [ ] Title "HND → OKA"
  - [ ] Date "Monday, May 4, 2026"
  - [ ] Confirmation "F344GI"
  - [ ] No CTA (canSaveItineraryItem returns false for FLIGHT)
  - [ ] Attribution footer ("From {trip.title} · Shared on Flokk")

## What I'm watching (Discipline 4.16)

1. **typeLabel for ManualActivity uses `item.type` directly** — ManualActivity.type is a free-text field set at creation time (e.g., "culture", "food", "activity"). It is not normalized to the LODGING/FOOD/ACTIVITY enum used on ItineraryItem. The share page renders it as-is (uppercased by CSS `text-transform`). Values like "culture", "outdoor", "restaurant" will render correctly. A blank or null type falls back to "ACTIVITY".

2. **No country on ManualActivity** — The locationLine for ManualActivity is city-only ("Seoul", not "Seoul, South Korea"). This is a schema gap. If the user's city field contains "Seoul, South Korea" it will render correctly by coincidence; otherwise only city-level precision is available.

3. **TRAIN has 0 live shareTokens** — TrainLayout is code-complete but untested against a real share URL. The column names (fromCity, toCity, departureTime, arrivalTime, confirmationCode) are confirmed correct from ItineraryItem schema. First real TRAIN share will validate the render.

4. **FlightLayout bypasses parallelSavedItem** — Flights never have a parallel SavedItem (they are not "places"). The new FlightLayout reads directly from ItineraryItem fields, bypassing the three-step resolver. This is correct — flights don't need the resolver chain.

5. **canSaveItineraryItem already correct** — The FLIGHT/TRAIN CTA suppression was already in place before this prompt (lines 169-173). The dispatch update routes to new components without touching the CTA logic.

6. **Forward chain** — OG meta tags (prompt 3) still unset. HND → OKA share pasted into iMessage will produce a blank preview card. The route string and date are available in the resolver for OG population.

## AI surface (Discipline 4.17)

- **A. EXTRACTION** — ManualActivity is user-created, not AI-extracted. `title`, `city`, `type`, `date` are user-supplied. No extraction pipeline applies. The synthesized description fallback ("Activity in Seoul") is the floor.

- **B. ENRICHMENT** — ManualActivity has `lat`/`lng` populated if geocoded. A Places Detail call on coordinates could supply a photo URL and description for the share page — currently `imageUrl` on ManualActivity is null for all items. Medium-effort: geocode → Places Details → `imageUrl` backfill.

- **B. ENRICHMENT (flights)** — FlightLayout has no photo. A destination city photo from Unsplash or Google Places (keyed on `toCity`/`toAirport`) would improve the FLIGHT share card from text-only to visual. Low-effort fetch at share-token resolution time.

- **C. GENERATION** — ManualActivity synthesized description is "Activity in {city}". A Haiku call could replace this: "Write a one-sentence description of {title} in {city}" — especially valuable for cultural/museum activities where the name alone is not descriptive.

- **D. INFERENCE** — `item.type` on ManualActivity is free-text. A normalization pass could map "culture" → "CULTURE", "food" → "FOOD", etc. for consistent typeLabel display. The current render uses `text-transform: uppercase` on whatever string is stored.

- **E. AGGREGATION** — ManualActivity.price is the cost signal for this share type. When present, it feeds community price benchmarking ("Is 12,000 KRW typical for Gyeongbokgung?"). The share page renders price — this is the correct capture point.

- **F. CURATION** — Same opportunity as SavedItem: "Others from this trip also saved…" beneath the CTA. For ManualActivity shares, the trip context (trip.title, trip.destinationCity) is now available via the resolver.

## Out of scope (remaining prompts)
- OG meta tags / generateMetadata (prompt 3)
- TourLayout / Trace G visual polish (prompt 4)
- Schema migration for ManualActivity country field
- TRAIN live share verification (no TRAIN shareTokens exist today)
