-- AlterTable: Trip
ALTER TABLE "Trip" ADD COLUMN "tourViewportNE" JSONB;
ALTER TABLE "Trip" ADD COLUMN "tourViewportSW" JSONB;

-- AlterTable: GeneratedTour
ALTER TABLE "GeneratedTour" ADD COLUMN "tourViewportNE" JSONB;
ALTER TABLE "GeneratedTour" ADD COLUMN "tourViewportSW" JSONB;
