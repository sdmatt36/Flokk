-- AlterTable
ALTER TABLE "City" ADD COLUMN IF NOT EXISTS "heroPhotoUrl" TEXT;
ALTER TABLE "City" ADD COLUMN IF NOT EXISTS "heroPhotoAttribution" TEXT;
ALTER TABLE "City" ADD COLUMN IF NOT EXISTS "priorityRank" INTEGER NOT NULL DEFAULT 999;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "City_countryId_priorityRank_idx" ON "City"("countryId", "priorityRank");
