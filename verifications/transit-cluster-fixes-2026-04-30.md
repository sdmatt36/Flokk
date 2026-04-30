# Transit cluster fixes — directions render mechanism universal repair

Run date: 2026-04-30

## Files modified
- src/components/features/trips/TripTabContent.tsx (Fixes 1, 3, 4)

## Database mutations
- UPDATE ItineraryItem SET latitude/longitude/arrivalLat/arrivalLng for HND→OKA repair item (1 row)
- Verification: all four columns confirmed = 26.1958 / 127.6461 (OKA airport coords)

---

## Fix 1 — Render-side AIRPORT_COORDS fallback for prev-FLIGHT with null arrivalLat/Lng

**Cause:** Repair-inserted FLIGHT items (and any manually-created flight bypassing the parser) have
null arrivalLat/arrivalLng. Mechanism 2's fromCoords derivation read only those DB columns, found
null, fell back to getCoords(item).lat/lng which is also null. Result: no transit card rendered
after the flight, e.g. HND→OKA (Day 0) followed by THE NEST NAHA had no directions between them.

**Fix:** Added `flightArrivalFallback` that reads `AIRPORT_COORDS[prevIt.toAirport]` when prev item
is FLIGHT and DB coords are null. Mirrors the existing symmetry for next-FLIGHT (line 3153 already
uses AIRPORT_COORDS[fromAirport] for departure). OKA is present in AIRPORT_COORDS.

**Universal:** Applies to every trip, every prev-FLIGHT item with null DB coords.

Before:
```tsx
const fromCoords = (prevIt && (prevIt.type === "TRAIN" || prevIt.type === "FLIGHT") && isVTC(prevIt.arrivalLat, prevIt.arrivalLng))
  ? { lat: prevIt.arrivalLat!, lng: prevIt.arrivalLng! }
  : getCoords(item);
```

After:
```tsx
const flightArrivalFallback = (prevIt?.type === "FLIGHT" && prevIt.toAirport)
  ? AIRPORT_COORDS[prevIt.toAirport.toUpperCase().trim()] ?? null
  : null;
const fromCoords = (prevIt && (prevIt.type === "TRAIN" || prevIt.type === "FLIGHT") && isVTC(prevIt.arrivalLat, prevIt.arrivalLng))
  ? { lat: prevIt.arrivalLat!, lng: prevIt.arrivalLng! }
  : (flightArrivalFallback ?? getCoords(item));
```

---

## Fix 2 — HND→OKA repair item backfill

1 row updated (id: iti_okinawa_outbound_repair_56453748). All four lat/lng columns now populated
with OKA airport coords. This also fixes the map pin for the flight: the arrival airport marker
now renders on the day map.

---

## Fix 3 — 50 km gate assessment (no gate existed; dead code removed)

**Finding:** The `distanceBetweenItems` variable was computed but NEVER used as a render gate.
The Mechanism 2 render gate is `prevHasCoords && nextHasCoords` only — no distance check.
CLAUDE.md referenced a 50 km gate that was not present in the current code.

**Action:** Removed the dead `distanceBetweenItems` variable (3-line dead code block). No
behavioral change — current behavior already renders transit for any pair with valid coords,
regardless of distance. Jenifer's Porto→Lisbon (~274 km) and Lisbon→Algarve (~177 km) LODGING
transitions already rendered (or didn't render due to a different cause); the gate was never
the blocker.

---

## Fix 4 — Mechanism 1 firstWithCoords filter refined

**Original filter:** Excluded ALL LODGING items from being eligible as the day's first
reference target. This prevented hotel check-in items (the actual destination when traveling
between hotels) from serving as the target of the "From [prev hotel] · Directions →" header.

**Problem with full LODGING removal (prompt's original suggestion):** If firstWithCoords
were allowed to be a LODGING check-OUT, it would produce "From [Hotel A] → [Hotel A]"
self-directed links (check-out is at the same location as the active lodging). Not useful.

**Implemented refinement:** Keep CHECK-OUT LODGING items excluded; allow CHECK-IN LODGING
items as valid targets. This produces "From Porto Deluxe → Príncipe Real" (correct) rather
than "From Porto Deluxe → Porto Deluxe" (wrong).

Before:
```tsx
const firstWithCoords = allDayItems.find(it =>
  isVTCq(it.lat, it.lng) &&
  !(it.itemType === "itinerary" && it.itineraryItem?.type === "LODGING")
);
```

After:
```tsx
const firstWithCoords = allDayItems.find(it =>
  isVTCq(it.lat, it.lng) &&
  !(it.itemType === "itinerary" && it.itineraryItem?.type === "LODGING" && /^check-out:/i.test(it.itineraryItem?.title ?? ""))
);
```

**Universal:** Every trip where a day consists solely of hotel check-in (travel day, transition
day) now shows "From [prev hotel] · Directions →" pointing to the new hotel.

---

## Manual verification (Matt to run after hard refresh)

- [ ] Greene Okinawa Day 0 — HND→OKA flight followed by THE NEST NAHA: "Drive · ~X · Directions →" renders between them
- [ ] Greene Okinawa Day 0 map — OKA airport pin now renders (coords backfilled)
- [ ] Greene Okinawa Day 1 — existing inline transit cards still render correctly (regression check)
- [ ] Jenifer Portugal Day 3 — "From Porto Deluxe Apartments · Directions →" header points to Príncipe Real (Lisbon), not Porto Deluxe itself
- [ ] Jenifer Portugal Day 6 — "From Príncipe Real Guest House · Directions →" header points to Algarve property
- [ ] Any trip where Day 1 is an arrival day with no prior hotel — NO header renders (Day 1 preserved)
- [ ] Activity-only day on any trip — existing "From [hotel]" header still renders (not broken by Fix 4)

---

## Out of scope
- Day 1 "Where are you coming from?" user-input prompt (next prompt, separate)
- Hyatt double-room consolidation (separate prompt)
- Real driving-time computation via Google/Mapbox APIs (future)
- TRAIN station fallback table (no current evidence of need)

---

## What I'm watching (Discipline 4.16)

1. **Jenifer Portugal inline transit (Mechanism 2)** — Porto check-out and Lisbon check-in on the
   same day (dayIndex 3) are consecutive in allDayItems and both have lat/lng. The inline transit
   should already render as "Drive · ~4 hr 40 min · Directions →" regardless of these fixes (no
   gate was blocking it). If it's NOT rendering in practice, the cause is something else — possibly
   a sort-order issue or the items rendering on different day tabs. Needs live verification.

2. **Mechanism 1 self-direction edge case** — If activeLodging and the day's firstWithCoords are
   at the same address (same hotel, different rooms), the header renders a 0-distance link. Extremely
   unlikely in normal usage (no confirmed case) but structurally possible.

3. **FLIGHT items on Day 1 (first-day FLIGHT suppression)** — The existing suppression at lines
   3110-3115 checks if the first item of the day is a FLIGHT departing from a different city. After
   Fix 4, a LODGING check-in now qualifies as firstWithCoords, which means the FLIGHT suppression
   logic no longer applies on days where check-in is before a departure flight. Verify on any trip
   where the user checks in AND departs on the same day.

4. **AIRPORT_COORDS coverage** — The fallback only works for airports in the static table (currently
   ~70 entries). Any FLIGHT repair item with an unlisted arrival airport still produces null fromCoords.
   The parser-side geocode (which writes arrivalLat/Lng correctly) remains the authoritative path.

5. **Hyatt duplicate check-in items** — Two identical Hyatt Seragaki check-in items (dayIndex 1,
   sortOrder 2 and 3) produce a ~0 km transit card between them. Visually harmless but a data quality
   issue. Separate cleanup needed.

6. **Forward chain: share view** — Transit cards are a card-only render (TripTabContent.tsx). They
   do not currently appear in share view (ShareItemView.tsx). Whether share views should show transit
   is a product question, not a bug.

---

## AI surface (Discipline 4.17)

- **A. Extraction** — The parser already correctly geocodes arrival airports from IATA codes via the
  Google Maps Geocoding API at parse time. The AIRPORT_COORDS fallback is belt-and-suspenders for
  repair items only. No extraction gap for normally-processed emails.

- **B. Enrichment** — AIRPORT_COORDS is a static ~70-entry lookup. Production trips may include
  airports outside this set (regional airports, smaller hubs). The permanent fix is to geocode the
  arrival airport at parse time using `AIRPORT_COORDS[code] ?? geocode(code)` and store in the DB —
  already the parser's behavior for normally-created items.

- **C. Generation** — `computeTransit()` returns haversine estimates (km / assumed speed). A generation
  upgrade: replace or supplement with actual Mapbox Directions API calls at render time, showing real
  road time and route. Particularly valuable for island trips (OKA: road time vs. straight-line is
  meaningfully different near coastal roads) and for suggesting transit mode alternatives.

- **D. Inference** — The transit-mode choice (Walk < 1 km, Drive or transit 1–20 km, Drive >20 km)
  is a static threshold. Inference from user behavior (do they always drive? prefer transit? have
  children requiring car seats?) could personalize the mode suggestion. A family with young children
  should not see "Walk · ~30 min" for a 2 km trip.

- **E. Aggregation** — Not applicable at this surface.

- **F. Curation** — The three-surface rule: transit cards render on day cards only. Share views don't
  show transit. A future curation pass should audit which itinerary surface features (transit, times,
  confirmation codes) should propagate to share view to give collaborators and guests full trip context.
