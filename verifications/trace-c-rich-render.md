# Bundle 2 Trace C — LODGING share rich render (commit)

Run date: 2026-04-30

## Files modified
- src/components/share/ShareItemView.tsx
- src/lib/share-token.ts

## Scope (rendered fields newly populated on LODGING share)
- Visit website button (`ps.websiteUrl` fallback to `item.venueUrl`)
- userRating star block (terracotta `#C4664A`)
- city/country line (`ps.destinationCity`, `ps.destinationCountry`)
- attribution footer ("From [trip title] · Shared on Flokk")
- formatted scheduledDate ("Check-in · Sunday, March 29, 2026")
- synthesized description fallback ("Lodging in Seoul, South Korea")
- title prefix strip when ps is null (Check-in: / Check-out: stripped from item.title fallback)

### share-token.ts changes (resolver)
- `trip: { title, destinationCity }` added to ItineraryItem Prisma select
- `destinationCity` and `destinationCountry` added to `parallelSavedItem` select on both Step 1 (TripDocument path) and Step 2 (rawTitle match path)
- `ResolvedShareEntity` interface updated to reflect both additions

### ShareItemView.tsx changes (template)
- `strippedItemTitle`: strips `^(check-in|check-out):\s*/i` from `item.title` when used as h1 fallback (ps null case)
- `visitUrl = ps?.websiteUrl ?? item.venueUrl ?? null` — previously only `item.venueUrl` (0% populated); now resolves from parallel SavedItem websiteUrl
- `locationLine`: city/country rendered as `<p>` below `<h1>`
- `formattedDate`: `new Date(scheduledDate + "T12:00:00").toLocaleDateString(...)` — human-readable for LODGING; raw ISO kept for transit
- `checkPrefix`: "Check-in" vs "Check-out" derived from `item.title` regex — used in formatted date line
- `synthesizedDescription`: "Lodging in [city], [country]" when `ps.rawDescription` null
- Star block: active color `#f59e0b` → `#C4664A` (terracotta)
- Attribution block: "From [trip.title] · Shared on Flokk" rendered in parent ShareItemView

## Universal scope check (SQL Step 3)

Query: LODGING ItineraryItems with `shareToken IS NOT NULL`, left-joined to parallel SavedItem and Trip.

Result: 1 row (Moxy Seoul Insadong, shareToken `46DWFQykCaY6`).

| shareToken | title | rawTitle | has_website | userRating | destinationCity | has_address | trip_title |
|---|---|---|---|---|---|---|---|
| 46DWFQykCaY6 | Check-in: Moxy Seoul Insadong | Moxy Seoul Insadong | true | 4 | Seoul | true | Seoul & Busan, South Korea - March 2026 |

**Note:** Only 1 LODGING item has ever had its share link tapped (Moxy). Share tokens are lazy — generated on first share button tap. As other LODGING items are shared by users, they will receive tokens and the rich-render code path will apply to them identically. Universality is code-level, not data-level at this snapshot.

## Manual verification (Matt to run)

- [ ] https://flokktravel.com/s/46DWFQykCaY6 — Moxy Seoul Insadong
  - [ ] Hero photo
  - [ ] LODGING tag
  - [ ] Title "Moxy Seoul Insadong" (no Check-in prefix)
  - [ ] City line "Seoul, South Korea"
  - [ ] 4-star rating row in terracotta (#C4664A)
  - [ ] Synthesized description "Lodging in Seoul, South Korea"
  - [ ] "Check-in · [formatted date]" (not raw ISO)
  - [ ] Address "37, Donhwamun-ro 11-gil..."
  - [ ] Visit website button → Marriott URL
  - [ ] Save to my Flokk button works
  - [ ] Footer "From Seoul & Busan, South Korea - March 2026 · Shared on Flokk"
- [ ] Share a second LODGING item from any trip to generate its token, then verify rich render applies there too
- [ ] Share a manually-added LODGING item (no parallel SavedItem) — confirm title shows without Check-in prefix, no rating/website/city shown (acceptable), no JS error

## Out of scope (separate prompts)
- Email parser hardening to prevent address drift on new imports (Workstream 3)
- Places editorial enrichment for rawDescription (separate workstream — 100% null across all parallel SavedItems today)
- 9 manually-added LODGING items with no parallel SavedItem and no email source

## What I'm watching (Discipline 4.16)

1. **rawDescription is 100% null across all parallel SavedItems** — The `synthesizedDescription` fallback fires for every LODGING share today. Real descriptions require either: (a) enrichWithPlaces updating rawDescription (currently does not), or (b) Places API calls in the booking-saved-item.ts creation path. Neither writes rawDescription today. This is the single biggest visual gap remaining.

2. **Only 1 of 68 LODGING rows has a shareToken** — The rich render will not be stress-tested across multiple hotels until users tap share on other lodging cards. The first multi-hotel share (e.g., Baymond Hotel in Busan) will be the real universal test.

3. **SavedItemLayout star color still uses #f59e0b (amber)** — Per-spec, it was out of scope. But the two layouts now have inconsistent star colors (SavedItem: amber, ItineraryItem/LODGING: terracotta). Worth aligning in a future design pass.

4. **Open Graph / OG meta tags not set for share pages** — `/s/[token]` has `generateMetadata` returning only `title`. No `og:image`, `og:description`, or Twitter card. When this URL is pasted into Slack/iMessage/social, it will show a blank preview card. The rich data now exists in the resolver to populate these — trip title, city, photo URL from `ps.placePhotoUrl`. Not needed to ship this fix but is the next logical step for the share growth loop.

5. **Attribution "From [trip title]" only shows for itinerary_item shares** — SavedItem shares, ManualActivity shares, and GeneratedTour shares show no attribution. If trip title is ever missing (null), the footer is silently hidden. Acceptable for now.

6. **No CDN caching concern** — `/s/[token]` is `force-dynamic`. Vercel will not cache it. Old thin renders are not at risk of serving from cache.
