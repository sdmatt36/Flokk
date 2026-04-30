# Cluster B-1 — Edinburgh + default-times backfill + URL validator

Run date: 2026-04-30

## Files modified
- src/lib/destination-coords.ts (Fix 1: 12 new entries + 2 existing entries updated)
- src/lib/url-validator.ts (NEW — Fix 3)
- src/components/share/ShareItemView.tsx (Fix 3: 4 render sites)
- src/components/features/trips/TripTabContent.tsx (Fix 3: 3 render sites)

## Database mutations
- UPDATE LODGING SET arrivalTime = '15:00' WHERE arrivalTime IS NULL → 74 rows
- UPDATE LODGING SET departureTime = '11:00' WHERE departureTime IS NULL → 40 rows
- Post-backfill verification: null_arrival = 0, null_departure = 0 ✓

---

## Fix 1 — Cities added to destination-coords.ts

### UK / Ireland (explicit from prompt)
| City | coords [lng, lat] |
|---|---|
| Edinburgh | [-3.1883, 55.9533] |
| Glasgow | [-4.2518, 55.8642] |
| Dublin + "ireland" city alias | [-6.2603, 53.3498] |
| Belfast + "northern ireland" city alias | [-5.9301, 54.5973] |

### Production coverage gaps (from Step 0 inventory)
| City / Entry | Previously | Now |
|---|---|---|
| Athens (2 trips, Greece) | DEFAULT [20,20] | [23.7275, 37.9838] |
| San Diego (2 trips, US) | DEFAULT [20,20] | [-117.1611, 32.7157] |
| Kamakura / Hakone (2+1 trips) | Japan country fallback (Okinawa coords) | [139.5523, 35.3197] |
| Canggu (1 trip) | DEFAULT [20,20] | Bali entry (added to cities[]) |
| Croatia as city (1 trip, null country) | DEFAULT [20,20] | Dubrovnik entry (added "croatia","zagreb" to cities[]) |
| Ireland as city (1 trip, null country) | DEFAULT [20,20] | Dublin entry ("ireland" alias) |
| Kotor / Montenegro (1 trip) | DEFAULT [20,20] | [18.7712, 42.4246] |
| Philippines (1 trip, null country) | DEFAULT [20,20] | [120.9842, 14.5995] |
| Portland (1 trip, US) | DEFAULT [20,20] | [-122.6765, 45.5231] |
| Detroit (1 trip, null country) | DEFAULT [20,20] | [-83.0458, 42.3314] |
| Lombok (1 trip, Indonesia) | Bali coords (via Indonesia country) | [116.2744, -8.7280] |
| Syros (1 trip, Greece) | DEFAULT [20,20] | Athens entry (added "syros" to cities[]) |

### Destinations still covered by country fallback (acceptable, no action)
- Estepona → Spain → Barcelona coords
- Koh Lanta → Thailand → Bangkok coords  
- Tangier → Morocco → Marrakech coords
- Warsaw → Poland → Krakow coords
- Reykjavík (accented) → Iceland country match → Iceland coords
- Ha Long Bay → Vietnam entry ✓

### Destinations remaining at DEFAULT (edge cases)
- Mount Everest (1 trip, null country) — intentional, exotic edge case

---

## Fix 2 — LODGING default times backfill

74 arrivalTime rows and 40 departureTime rows updated. Affects every existing trip's
Itinerary tab visual completeness. Parser-side defaults (arrivalTime: "15:00" on check-in,
departureTime: "11:00" on check-out) shipped in Cluster A (commit 815d4b3).

**Acknowledged fictional precision:** uniform 15:00 / 11:00 may not match every hotel's
actual times. Future workstream (parser re-extraction) can correct individual rows.

---

## Fix 3 — URL validator utility

`src/lib/url-validator.ts` — `safeUrl()` function:
- Strips trailing punctuation (., ;, :, !, ?, ), ])
- Strips leading whitespace/punctuation
- Rejects anything without https?:// scheme
- Validates URL.parse() success
- Rejects localhost / 127.0.0.1

Applied at 7 render sites:

| File | Site | URL source |
|---|---|---|
| ShareItemView.tsx | SavedItemLayout visitUrl | websiteUrl ?? sourceUrl |
| ShareItemView.tsx | ItineraryItemLayout visitUrl | ps?.websiteUrl ?? venueUrl |
| ShareItemView.tsx | ManualActivityLayout visitUrl | item.website |
| ShareItemView.tsx | TourLayout stop link | stop.websiteUrl |
| TripTabContent.tsx | Activity detail "Link →" | localWebsiteUrl |
| TripTabContent.tsx | Activity list "Link →" | item.websiteUrl |
| TripTabContent.tsx | Trip Intelligence rec "Link →" | rec.websiteUrl |

TypeScript compile: clean (no errors after narrowing fix at line 884).

---

## Manual verification (Matt to run, hard refresh required)

- [ ] Matt's Edinburgh trip — map loads centered on Edinburgh, not mid-Atlantic or Seoul
- [ ] Matt's Seoul trip (control) — map still centered on Seoul, not broken
- [ ] Jenifer's Porto trip (control) — map still centered on Portugal, not broken
- [ ] Any trip where destinationCity = "Athens" — map shows Athens
- [ ] Any LODGING card in Itinerary tab — check-in shows "3:00 PM", check-out shows "11:00 AM" where previously blank
- [ ] Share page with a visit website button (e.g., /s/FWE9omRtEhpD) — still renders for valid URL
- [ ] Share page with a malformed URL — no link rendered (no broken anchor)
- [ ] Activity in Trip Intelligence with websiteUrl — Link → renders when valid, absent when invalid

---

## What I'm watching (Discipline 4.16)

1. **Kamakura / Hakone now use Kamakura coords** — Previously these were returned Okinawa coords via Japan country match (Okinawa was first Japan entry). Now Kamakura Pass 1 match returns [139.5523, 35.3197]. This is a regression fix but worth verifying no other Japan-destined trips get the wrong coords.

2. **London entry catches generic UK first** — Pass 2 country match on "UK" or "United Kingdom" hits the London entry first. Edinburgh/Glasgow entries only fire when the city name is explicit in Pass 1, or when country = "Scotland" specifically. This is correct behavior.

3. **Canggu / Seminyak added to Bali entry** — These share Bali's [115.1889, -8.4095] coords (approx 15–25km off). Acceptable for map centering.

4. **safeUrl double-call pattern** — Sites using `{safeUrl(x) && <a href={safeUrl(x)!}>}` call safeUrl twice. For URL strings this is zero-risk (pure function, no side effects, negligible cost). If the URL list grows to hundreds of renders, memoize with `useMemo` or extract to a local variable.

5. **TripTabContent "Edit URL" flow** — When `localWebsiteUrl` is set but fails `safeUrl()`, the condition `safeUrl(localWebsiteUrl) && !editingUrl` is false, so the edit UI shows (neither the "Link →" nor the "Add URL" button). This is the correct safety behavior — malformed stored URL is presented as editable.

6. **Backfill fictional precision** — 74 + 40 rows now have 15:00 / 11:00 defaults. When a user's actual check-in time differs, they'll need to manually correct via the itinerary edit modal. No self-correction path exists today.

7. **Forward chain** — KNOWN_CITIES export (line 103) now includes all new cities, meaning autocomplete and any city-picker powered by KNOWN_CITIES will surface Edinburgh, Dublin, Athens, San Diego, etc. Verify autocomplete input isn't broken by the new set size.

---

## AI surface (Discipline 4.17)

- **A. EXTRACTION** — URL cleaning via safeUrl is rule-based (trailing punctuation strips). The next upgrade is parser-side: when an email body contains a URL with surrounding prose ("Visit us at https://example.com."), the parser should extract the URL without the trailing period. Currently the parser stores the raw extracted URL; safeUrl catches it at render time.

- **B. ENRICHMENT** — destination-coords.ts is a static lookup table. A production-grade alternative is geocoding at trip creation time: `getDestinationCoords` could be replaced by a live Google Maps Geocoding API call, caching the result into `Trip.anchorLat/anchorLng`. This eliminates the table entirely and handles any city worldwide. The table is the right floor; geocoding is the right ceiling.

- **C. GENERATION** — No generation surface in this batch.

- **D. INFERENCE** — destination-coords.ts could be auto-generated from production trip history: cluster all Trip.destinationCity values, geocode any city not in the table, emit a new entry. Running this periodically (e.g., weekly Vercel Cron) would keep coverage current without manual entries.

- **E. AGGREGATION** — The LODGING backfill now surfaces check-in/check-out times to users. When check-in time is 3:00 PM and a same-day flight arrives at 5:00 PM, the itinerary schedule intelligence could detect and flag the conflict. This is a Schedule Intelligence signal now unblocked by the backfill.

- **F. CURATION** — safeUrl removing broken links is a curation improvement: users see only links that resolve. The next level is link freshness: a background job that verifies stored websiteUrls (HEAD request, 200/301 check) and flags or nulls 404s.

---

## Out of scope (next prompt)
- Booking.com URL pattern detection (B-2)
- Booking.com image source (B-2)
- Trip.anchorLat/anchorLng architectural workstream (permanent fix for coords)
- Parser URL extraction improvement (strips trailing punctuation at extraction, not render)
