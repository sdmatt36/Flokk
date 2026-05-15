-- AlterTable: add cityId FK to SavedItem referencing City
ALTER TABLE "SavedItem"
  ADD COLUMN IF NOT EXISTS "cityId" TEXT,
  ADD CONSTRAINT "SavedItem_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedItem_cityId_idx" ON "SavedItem"("cityId");
