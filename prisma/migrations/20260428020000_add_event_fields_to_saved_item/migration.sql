ALTER TABLE "SavedItem"
  ADD COLUMN IF NOT EXISTS "eventDateTime"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eventVenue"            TEXT,
  ADD COLUMN IF NOT EXISTS "eventCategory"         TEXT,
  ADD COLUMN IF NOT EXISTS "eventTicketUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "eventSourceProvider"   TEXT,
  ADD COLUMN IF NOT EXISTS "eventSourceEventId"    TEXT;

CREATE INDEX IF NOT EXISTS "SavedItem_eventSourceProvider_eventSourceEventId_idx"
  ON "SavedItem"("eventSourceProvider", "eventSourceEventId");
