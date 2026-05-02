# Backfill artifacts

CSVs of low-confidence rows from backfill scripts that require manual SQL adjudication. These are committed for traceability — the originals live in /tmp and are wiped on reboot.

## destination_backfill_review_chat44.csv

8 rows from Chat 44's destination taxonomy backfill (commit fac62e9).

- Okinawa x4 (trips): genuinely ambiguous prefecture vs island. Adjudicate as ISLAND if user intent is the main island, STATE if the prefecture.
- Scotland x1 (trip): admin-1 country-within-country. Adjudicate as STATE or COUNTRY.
- Ko Phangan x3 (tours): correct placeId ChIJ73cD-pb9VDAR_q95XhqN_dM in CSV but token-match failed. Type should be ISLAND. Apply via SQL UPDATE using the captured placeId.

The Geocoding result fields (placeId, top candidates, types) are in the CSV. Use those values in targeted UPDATE statements; do not re-query Google.
