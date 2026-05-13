-- AlterTable: add intelligence fields to GeneratedTour
ALTER TABLE "GeneratedTour" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "GeneratedTour" ADD COLUMN IF NOT EXISTS "inputGroup" TEXT;
ALTER TABLE "GeneratedTour" ADD COLUMN IF NOT EXISTS "inputVibe" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GeneratedTour" ADD COLUMN IF NOT EXISTS "inputDurationHr" INTEGER;
ALTER TABLE "GeneratedTour" ADD COLUMN IF NOT EXISTS "inputStartPoint" TEXT;
