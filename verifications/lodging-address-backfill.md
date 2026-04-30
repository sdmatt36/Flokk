# Lodging address backfill from TripDocument

Run date: 2026-04-30

## Summary
Rows affected: 4
Source: TripDocument.content.address copied to ItineraryItem.address
Universal coverage delta: 55/68 → 59/68 LODGING rows with address (81% → 87%)

## Affected ItineraryItems

| id | tripId | title | source_address |
|---|---|---|---|
| cmn74dpar0002728n3fnp3izx | cmmx6428k000004jlxgel7s86 | Check-out: Baymond Hotel | 27, Haeundaehaebyeon-ro 209beonga-gil, 48093 Busan, South Korea |
| cmn74dp5m0001728nv78mxb0w | cmmx6428k000004jlxgel7s86 | Check-in: Baymond Hotel | 27, Haeundaehaebyeon-ro 209beonga-gil, 48093 Busan, South Korea |
| cmn74dpvt0004728ncd1llbep | cmmx6428k000004jlxgel7s86 | Check-out: Moxy Seoul Insadong | 37, Donhwamun-ro 11-gil, Jongno-Gu, Jongno-Gu, 110-320 Seoul |
| cmn74dpql0003728nqu3jfxwy | cmmx6428k000004jlxgel7s86 | Check-in: Moxy Seoul Insadong | 37, Donhwamun-ro 11-gil, Jongno-Gu, Jongno-Gu, 110-320 Seoul |

All 4 rows are from the Greene Seoul trip (cmmx6428k000004jlxgel7s86): 2 Moxy Seoul Insadong rows and 2 Baymond Hotel (Busan) rows. All shared a single TripDocument per hotel (one booking email per hotel, both check-in and check-out referenced the same document).

## Geocode pass status

Not required — all 4 rows already had latitude/longitude populated prior to backfill.

| id | title | latitude | longitude |
|---|---|---|---|
| cmn74dpar0002728n3fnp3izx | Check-out: Baymond Hotel | 35.1595278 | 129.1567185 |
| cmn74dp5m0001728nv78mxb0w | Check-in: Baymond Hotel | 35.1595278 | 129.1567185 |
| cmn74dpql0003728nqu3jfxwy | Check-in: Moxy Seoul Insadong | 37.5723995 | 126.9892209 |
| cmn74dpvt0004728ncd1llbep | Check-out: Moxy Seoul Insadong | 37.5723995 | 126.9892209 |

## Manual verification (Matt to run)

- [ ] https://flokktravel.com/s/46DWFQykCaY6 — Moxy share view: address line "37, Donhwamun-ro 11-gil..." renders below the title. NOTE: Other render gaps (websiteUrl, rating, attribution, formatted date) remain until Trace C rich-render commit lands separately.
- [ ] Greene Seoul trip Itinerary tab → Moxy LODGING modal → Address field populated. Open in Maps button opens correct location.
- [ ] Greene Seoul trip Vault tab → Moxy hotel card already had address from TripDocument; confirm unchanged (no regression).
- [ ] Greene Seoul trip Itinerary tab → Baymond Hotel (Busan leg) LODGING modal → Address field populated.

## Out of scope

- 9 manually-added LODGING items with no email source — no address available anywhere
- Email parser hardening to prevent future ItineraryItem.address / TripDocument.content.address drift (separate workstream)
- Trace C rich render upgrades (websiteUrl, rating, city, attribution, formatted date, description) — next prompt
