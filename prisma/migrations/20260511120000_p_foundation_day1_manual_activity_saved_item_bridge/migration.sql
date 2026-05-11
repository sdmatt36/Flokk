-- P-Foundation Day 1: Add savedItemId bridge from ManualActivity to SavedItem
-- One-to-one: each ManualActivity optionally pairs with a SavedItem.
-- onDelete: SetNull so deleting the SavedItem doesn't cascade-delete the activity.

ALTER TABLE "ManualActivity" ADD COLUMN "savedItemId" TEXT UNIQUE;

ALTER TABLE "ManualActivity" ADD CONSTRAINT "ManualActivity_savedItemId_fkey"
  FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE SET NULL;

CREATE INDEX "ManualActivity_savedItemId_idx" ON "ManualActivity"("savedItemId");
