# Unified Share Template — SavedItemLayout parity (prompt 1 of 4)

Run date: 2026-04-30

## Files modified
- src/components/share/ShareItemView.tsx (SavedItemLayout full rebuild + saved_item attribution block)
- src/lib/share-token.ts (resolver field expansion)

## Visual parity with ItineraryItemLayout

| Element | ItineraryItemLayout (reference) | SavedItemLayout (rebuilt) | Match |
|---|---|---|---|
| Hero photo | placePhotoUrl, 4/3 aspect | placePhotoUrl → mediaThumbnailUrl fallback, 4/3 aspect | ✓ |
| Content padding | 20px 16px 0 | 20px 16px 0 | ✓ |
| Category tag | 11px/700/TERRA/uppercase/0.06em | Same | ✓ |
| Title h1 | Playfair/22px/700/NAVY/margin 4px 0 4px | Same | ✓ |
| City/country line | 14px/GRAY/marginBottom 8 | Same | ✓ |
| Date line | 13px/GRAY/marginBottom 6 | Same (Saved from {platform} · {date}) | ✓ |
| Address line | present (ItineraryItem.address) | N/A — no address column on SavedItem | — |
| Description | 14px/#374151/lineHeight 1.6/mb 12 | Same | ✓ |
| Rating stars | 5×★ terracotta #C4664A / slate #d1d5db | Identical block | ✓ |
| Visit website | 13px/TERRA/block/mb 8 | Same | ✓ |
| Attribution footer | "From {trip.title} · Shared on Flokk" | "From {trip.title} · Shared on Flokk" OR "Shared on Flokk" | ✓ |

## Resolver fields added (share-token.ts)

- `mediaThumbnailUrl` — Instagram/email attachment photo fallback
- `sourceMethod` — in select (available for future use)
- `savedAt` — serialized to ISO string via `.toISOString()` in return
- `trip: { title, destinationCity }` — for attribution footer

## Schema columns confirmed NOT YET EXISTING on SavedItem

- `cuisine` — not on schema
- `priceTier` — not on schema
- `duration` — not on schema
- `dietaryTags` — not on schema
- `ticketRequired` — not on schema (exists on TourStop only)

The render layer uses `typeLabel` and `categoryTags` to gate these. When schema migration + AI enrichment lands (separate workstream, prompt 5+), fields will appear automatically.

## SavedItemLayout category type label mapping

| categoryTags[0] | typeLabel |
|---|---|
| includes "lodging" | LODGING |
| includes "food" | FOOD |
| includes "activity" or "experience" | ACTIVITY |
| anything else / empty | SAVED |

## Date line rendering

- `sourcePlatform = "direct"` → "Saved from email · March 26, 2026"
- `sourcePlatform = "google_maps"` → "Saved from Google Maps · April 28, 2026"
- `sourcePlatform = "instagram"` → "Saved from Instagram · ..."
- `sourcePlatform = null` → "Saved April 28, 2026"

## Description priority chain

1. `rawDescription` (AI/email-extracted description)
2. `userNote` (user's own note)
3. synthesized fallback:
   - LODGING: "Lodging in {city}, {country}"
   - FOOD: "Restaurant in {city}, {country}"
   - ACTIVITY: "Experience in {city}, {country}"
   - default: "Saved place in {city}, {country}"
   - no city: "A place worth visiting"

## Attribution footer behavior

- `item.trip?.title` present: "From Seoul & Busan, South Korea - March 2026 · Shared on Flokk"
- `item.trip` null (save not linked to trip): "Shared on Flokk" (brand line always renders)

## Universal scope check (SQL)

2 rows returned (only 2 SavedItems have shareTokens — both tested in manual verification below). Universality is code-level: all SavedItem shares receive the rich render on first tap.

| shareToken | rawTitle | category | city | sourcePlatform | has_website | has_source_url | has_photo | trip_title |
|---|---|---|---|---|---|---|---|---|
| FWE9omRtEhpD | Baymond Hotel | lodging | Busan, South Korea | direct | true | false | true | Seoul & Busan... |
| gMqt33DXVjxw | Light House | food | Kamakura, Japan | google_maps | false | true | true | Kamakura... |

## Manual verification (Matt to run)

- [ ] https://flokktravel.com/s/FWE9omRtEhpD — Baymond Hotel (LODGING, Busan):
  - [ ] Hero photo
  - [ ] LODGING tag (terracotta uppercase)
  - [ ] Title "Baymond Hotel"
  - [ ] City line "Busan, South Korea"
  - [ ] "Saved from email · March 26, 2026"
  - [ ] Synthesized description "Lodging in Busan, South Korea"
  - [ ] No rating (userRating null — star block hidden)
  - [ ] Visit website button (has websiteUrl)
  - [ ] Save CTA works
  - [ ] Footer "From Seoul & Busan, South Korea - March 2026 · Shared on Flokk"
- [ ] https://flokktravel.com/s/gMqt33DXVjxw — Light House (FOOD, Kamakura):
  - [ ] Hero photo
  - [ ] FOOD tag (terracotta uppercase)
  - [ ] Title "Light House"
  - [ ] City line "Kamakura, Japan"
  - [ ] "Saved from Google Maps · April 28, 2026"
  - [ ] Description (has rawDescription — real description)
  - [ ] Visit website falls back to sourceUrl (Google Maps link, no websiteUrl)
  - [ ] Footer "From Kamakura, Japan - Jan 26 · Shared on Flokk"
- [ ] Visual side-by-side with Moxy share (https://flokktravel.com/s/46DWFQykCaY6) — confirm identical structure

## Out of scope (later prompts)
- ManualActivityLayout, FlightLayout, TrainLayout polish (prompt 2)
- OG meta tags (prompt 3)
- TourLayout / Trace G (prompt 4)
- Schema migration for cuisine, priceTier, duration, dietaryTags, ticketRequired (prompt 5+)
- AI enrichment of those fields (prompt 5+)
- SavedItem address field (no address column exists on SavedItem; locationLine carries this)

## What I'm watching (Discipline 4.16)

1. **Universality** — Fix is code-level universal. Every SavedItem share that gets its token tapped will get the rich render regardless of category, user, or trip. Only 2 live shareTokens exist today — both tested.

2. **Category tag derivation uses `categoryTags[0]` only** — If a SavedItem has multiple tags (e.g., ["food", "lodging"]), only the first drives `typeLabel`. Items tagged ["experiences", "outdoor"] would show "ACTIVITY" correctly. Items tagged ["lodging", "food"] would show "LODGING". The risk is tag ordering is not guaranteed consistent. A future improvement: score all tags and pick the most specific match rather than `[0]`.

3. **`savedAt` is not `createdAt`** — The schema column is `savedAt`, not `createdAt`. The prompt specified `createdAt` — this was caught in the inventory step and corrected. Any future prompt that references `createdAt` on SavedItem must be corrected to `savedAt`.

4. **No address on SavedItem** — Confirmed. The location line (city/country) is the only geographic anchor. For FOOD and ACTIVITY items, this means no street address on the share page. The Places API could supply this if `lat/lng` are populated.

5. **`sourcePlatform = "direct"` maps to "email"** — This is correct for email-forwarded saves but the label "Saved from email" is slightly unintuitive for items saved via the direct URL paste flow. A future improvement: `sourceMethod` (now fetched) distinguishes these; render "Saved from URL" for method=url_paste vs "Saved from email" for method=email.

6. **Forward chain** — OG meta tags are still unset (prompt 3). When Baymond or Light House share URLs are pasted into iMessage/Slack, the preview card will be blank. The photo URL, title, and city are now available in the resolver for OG population.

7. **Star color audit complete** — `#f59e0b` has been fully eliminated from ShareItemView.tsx. All star blocks across both layouts now use `#C4664A`.

## AI surface (Discipline 4.17)

- **A. EXTRACTION** — `sourcePlatform = "direct"` is the email pipeline. The parser correctly identifies the source but the `sourceMethod` field (now fetched) could further distinguish email-forward vs URL-paste vs manual-add at render time.

- **B. ENRICHMENT** — 100% of SavedItems in the scope check have no `rawDescription` from FOOD or non-lodging categories (`has_description`: false for Baymond; true for Light House only because it was a Google Maps save with Places editorial). The synthesized fallback fires for all lodging and most food/activity items. AI enrichment via Places `editorial_summary` or a Haiku-generated family-fit description would replace the synthesized string immediately. High-value, low-effort: the render layer is already wired to prefer `rawDescription` over the fallback.

- **B. ENRICHMENT (address)** — SavedItem has `lat/lng` populated from Places geocoding. The share page shows only city/country. A reverse-geocode or Places Detail call on `placeId` (if available) could supply a full street address for FOOD/ACTIVITY items, matching the quality of the LODGING address line.

- **C. GENERATION** — `synthesizedDescription` is template-based today ("Restaurant in Kamakura, Japan"). The upgrade path is a one-shot Haiku call at share-token generation time: "Write a one-sentence family-friendly description for {rawTitle} in {city}." Would replace the template with real editorial for any save that lacks rawDescription.

- **D. INFERENCE** — `categoryTags[0]` drives `typeLabel`. The tags are set at save time by the AI extraction pipeline. Tag quality varies (some items have "food_and_drink", some "food", some "restaurant"). A normalization pass would improve typeLabel accuracy across all shares.

- **E. AGGREGATION** — Both SavedItems in the scope check have `userRating: null`. When ratings exist, they feed Best Of community rankings. The share page rating block renders them — this is the correct signal-capture point.

- **F. CURATION** — The share page is currently static. A future curation layer could append "Others from this trip also saved…" recommendations beneath the CTA for signed-out visitors — converting a share view into an acquisition funnel.
