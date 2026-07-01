-- Rule A: a manually moved stop stays put. `manuallyPlaced` flips true the moment a user
-- drags/reorders/moves a stop, so its day sorts by sortOrder (manual absolute) instead of
-- being re-derived from clock time. Idempotent + default false: existing rows are already
-- correct (nothing was manually placed under the old behavior), and this is a no-op on any
-- environment where the column already exists (safe against migration-history drift).
ALTER TABLE "SavedItem"     ADD COLUMN IF NOT EXISTS "manuallyPlaced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ManualActivity" ADD COLUMN IF NOT EXISTS "manuallyPlaced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ItineraryItem"  ADD COLUMN IF NOT EXISTS "manuallyPlaced" BOOLEAN NOT NULL DEFAULT false;
