# Flokk Backlog

Items deferred from active sprints. Each entry has enough context to implement cold.

---

## ORPHAN-01 — Unmatched Bookings Inbox

**Priority:** Post-demo  
**Status:** Backlog  
**Source:** P3 Beta User Email Forwarding sprint

### Problem

`ItineraryItem` rows with `tripId=null` are currently invisible to users. They exist in the DB — correctly extracted from forwarded emails — but surface nowhere in the UI. Root causes:

1. Email forwarded for a trip with `endDate=null` → `dateInTripRange` returns false → no trip matched → `tripId=null` (fixed in P3 by Option 3 dateInTripRange patch, but historical rows remain)
2. Sonnet extraction produced no `scheduledDate` or location → no match possible → `tripId=null`

**Known affected items as of 2026-05-13:**
- Caroline Weiner: SJ train item (`cmoj9z005000004jocwi91i1n`) — no Sweden/Norway trip in account
- Caroline Weiner: Flåmsbrygga restaurant item (`cmoj7175b000004i8g0mzrva0`) — no Norway trip in account

### Required behavior

**Inbox surface:**
- Location: `/trips` page (preferred) or `/saves` — inbox-style strip above the trip list
- Show when: user has ≥1 `ItineraryItem` with `tripId=null` AND `familyProfileId` matches the logged-in user's profile
- Each row shows: item type icon, title, confirmation code (if present), source subject line (from linked ExtractionLog.subject), scheduled date (if extracted)
- Empty state: hide the strip entirely (no "You have 0 unmatched bookings" noise)

**Per-item affordances:**
1. **Attach to trip** — dropdown of user's existing trips (ordered by startDate desc), selecting one sets `ItineraryItem.tripId`
2. **Create new trip** — redirects to `/trip/new?prefill=...` with destination/date pre-filled from item if available

**Nav badge:**
- Count badge on the nav item that links to `/trips` (or `/saves`, wherever the inbox lands)
- Label: "1 unmatched booking" / "N unmatched bookings"
- Disappears when count reaches 0
- Badge data: fetch count of `ItineraryItem` rows where `tripId=null` and `familyProfileId` matches user — lightweight count query, can be cached for 60s

### Data queries needed

```typescript
// Count for nav badge
db.itineraryItem.count({
  where: { tripId: null, familyProfileId: userFamilyProfileId }
})

// Inbox rows (with source subject from ExtractionLog)
db.itineraryItem.findMany({
  where: { tripId: null, familyProfileId: userFamilyProfileId },
  select: {
    id, type, title, confirmationCode, scheduledDate, sourceType,
    // subject requires join to ExtractionLog via itineraryItemIds (array FK, awkward)
    // Option A: add extractionLogId FK to ItineraryItem (clean)
    // Option B: raw query — SELECT * FROM ExtractionLog WHERE id = ANY(itineraryItemIds) AND subject ...
    // Option C: store subject on ItineraryItem at extraction time (denormalized, simple)
  }
})
```

**Note on ExtractionLog join:** ExtractionLog stores `itineraryItemIds` as a text array (item→log direction is inverted). Recommend Option C: at webhook write time, store `el.subject` into a new nullable `ItineraryItem.sourceEmailSubject` column. Avoids the awkward reverse-array join at render time.

### Attach-to-trip action

```
PATCH /api/itinerary-items/[id]/assign-trip
body: { tripId: string }
```

- Sets `ItineraryItem.tripId`
- Recomputes `dayIndex` based on `scheduledDate` vs trip `startDate` (same logic as existing item creation)
- Returns updated item
- On success: remove item from orphan inbox, refresh badge count

### Schema changes required

- `ItineraryItem.sourceEmailSubject TEXT` — nullable, populated at extraction time
- Optionally: `ExtractionLog.extractionLogId` FK on ItineraryItem (if Option A chosen above)

### Notes

- Do NOT auto-attach orphans server-side without user confirmation — user must explicitly choose the trip
- If user dismisses an orphan without attaching ("I don't recognize this"), add a `dismissed` boolean or soft-delete the item
- The `familyProfileId` on `ItineraryItem` is already set at extraction time — use this (not userId) for the query, consistent with the rest of the item model

---

## CLEANUP-01 — Remove redundant mapbox CSS import from TourResults

**Priority:** Low / housekeeping  
**File:** `src/components/TourResults.tsx` line 7  
**Change:** Remove `import "mapbox-gl/dist/mapbox-gl.css"` — now owned by `TourMapBlock.tsx` directly  
**Risk:** Zero — TourMapBlock imports it unconditionally  

---
