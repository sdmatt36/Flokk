-- Backfill: manual_activity SavedItems are display mirrors with nothing to extract async.
-- They default PENDING from the schema default but should be ENRICHED at create time.
-- This corrects the 53 existing false-positive PENDING rows.
UPDATE "SavedItem"
SET "extractionStatus" = 'ENRICHED'
WHERE "sourceMethod" = 'manual_activity'
  AND "extractionStatus" = 'PENDING';
