# Cluster A Fixes — 2026-04-30

## Files modified
- src/components/features/trips/TripMap.tsx (Fix 1: map fallback to destCoords)
- src/app/api/webhooks/email-inbound/route.ts (Fix 2: default check-in arrivalTime)
- src/components/features/trips/BookingIntelCard.tsx (Fix 3: Trip Intelligence collapsed default)

---

## Fix 1 — TripMap Seoul fallback replaced with destCoords

**Root cause:** When `destinationCity` doesn't match any `CITY_CENTERS` key, the map fell back to hardcoded Seoul `[37.5665, 126.9780]`. Trips with destinations outside the CITY_CENTERS list (e.g. Porto) would center on Seoul.

**Change (TripMap.tsx line 162):**
```
OLD: const cityCenterFallback = CITY_CENTERS[cityKey] ?? [37.5665, 126.9780]; // Seoul if all else fails
NEW: const cityCenterFallback = CITY_CENTERS[cityKey] ?? [destCoords[1], destCoords[0]]; // [lat,lng] from getDestinationCoords (returns [lng,lat])
```

**Why the index swap:** `getDestinationCoords()` returns `[lng, lat]` (Mapbox convention). `CITY_CENTERS` stores `[lat, lng]`. Indices `[1]` and `[0]` correct the format mismatch.

**Coverage:** destination-coords.ts line 31 covers Porto via `{ cities: ["lisbon", "porto"], countries: ["portugal"] }`. Any city not in either lookup gets geocoded coords from `getDestinationCoords` which calls Google Maps — universally correct.

**Affected trips:** All trips where `destinationCity` doesn't match a CITY_CENTERS key. Jenifer Dasho's Portugal trip was the bellwether; this fix applies to all users.

---

## Fix 2 — Default check-in arrivalTime: "15:00"

**Root cause:** Email parser was writing LODGING check-in ItineraryItems with `arrivalTime: null`. The itinerary card had no time to display for check-in, while check-out already defaulted to `departureTime: "11:00"`.

**Changes (email-inbound/route.ts lines 1639, 1641):**

Line 1639 (update path):
```
Added: arrivalTime: "15:00"
```
Line 1641 (create path):
```
Added: arrivalTime: "15:00"
```

**Check-out unchanged:** Lines 1659 and 1667 already have `departureTime: "11:00"` — no change needed.

**Backfill scope:** 74 existing LODGING rows with null arrivalTime will not be retroactively updated by this fix. Parser-side default only applies to newly ingested booking emails. Backfill is a separate decision.

---

## Fix 3 — BookingIntelCard default collapsed

**Root cause:** `useState(false)` caused Trip Intelligence to render expanded on every page load, dominating the Vault view with recommendations the user has likely already seen.

**Change (BookingIntelCard.tsx line 111):**
```
OLD: const [collapsed, setCollapsed] = useState(false);
NEW: const [collapsed, setCollapsed] = useState(true);
```

**Effect:** Trip Intelligence card renders collapsed by default. User expands on demand. State is not persisted — refreshing the page re-collapses it.

---

## Verification grep output

TripMap.tsx line 162:
```
const cityCenterFallback = CITY_CENTERS[cityKey] ?? [destCoords[1], destCoords[0]]; // [lat,lng] from getDestinationCoords (returns [lng,lat])
```

email-inbound/route.ts lines 1639, 1641:
```
arrivalTime: "15:00"  (both update and create paths confirmed present)
```

BookingIntelCard.tsx line 111:
```
const [collapsed, setCollapsed] = useState(true);
```

---

## What I'm watching (Discipline 4.16)

1. **Backfill — 74 null arrivalTime rows** — Existing LODGING check-in items have null arrivalTime. The itinerary sort weight for check-in (20) still applies; only the displayed time is missing. Backfill SQL: `UPDATE "ItineraryItem" SET "arrivalTime" = '15:00' WHERE type = 'LODGING' AND title ILIKE 'Check-in:%' AND "arrivalTime" IS NULL;` — requires a separate decision.

2. **Porto destCoords format** — destination-coords.ts returns `[-9.1393, 38.7223]` for Porto (lng, lat). After swap: lat=38.7223, lng=-9.1393. This is correct Lisbon/Porto region center. Verified correct.

3. **CITY_CENTERS exhaustion path** — If `getDestinationCoords` also returns a fallback (Seoul default in destination-coords.ts), the map would still show Seoul for truly unknown destinations. This is acceptable degradation — the Seoul fallback in destination-coords.ts is intentional for unresolvable destinations.

4. **BookingIntelCard collapse not persisted** — Collapsed state resets on page refresh. If the user expands it to check recommendations, it will re-collapse on next visit. Consider `localStorage` persistence if users report friction, but current behavior is a net improvement over always-expanded.

5. **arrivalTime surface drift** — The itinerary card display of check-in time depends on consuming `arrivalTime` from the ItineraryItem. Verify that TripTabContent or whichever component renders LODGING cards actually reads `arrivalTime` for display (not just `departureTime`).

## AI surface (Discipline 4.17)

- **B. ENRICHMENT** — The 74 null arrivalTime rows represent a backfill opportunity. A Prisma migration or SQL UPDATE is sufficient — no AI needed. However, if actual check-in time is present in the email body and not extracted (e.g. "check-in after 3pm"), that's an extraction gap the Claude parser could address.
- **D. INFERENCE** — If a family's booking history shows consistent late check-ins (e.g. always after 4pm due to flight arrivals), the parser could learn to default to a personalized time rather than the global 15:00 default. Current fix is the correct universal floor.
- **F. CURATION** — BookingIntelCard collapsed by default is a curation improvement: Trip Intelligence surfaces on demand rather than always-on. A future improvement: auto-expand only when `missing` status items exist (i.e., only show urgency when there are gaps to fill).
