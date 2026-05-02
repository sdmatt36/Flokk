-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('CITY', 'STATE', 'ISLAND', 'COUNTRY', 'REGION');

-- AlterTable: Trip
ALTER TABLE "Trip" ADD COLUMN "destinationType" "DestinationType";
ALTER TABLE "Trip" ADD COLUMN "destinationName" TEXT;
ALTER TABLE "Trip" ADD COLUMN "destinationPlaceId" TEXT;
ALTER TABLE "Trip" ADD COLUMN "destinationStructured" JSONB;
ALTER TABLE "Trip" ADD COLUMN "destinationCenterLat" DOUBLE PRECISION;
ALTER TABLE "Trip" ADD COLUMN "destinationCenterLng" DOUBLE PRECISION;
ALTER TABLE "Trip" ADD COLUMN "destinationViewportNE" JSONB;
ALTER TABLE "Trip" ADD COLUMN "destinationViewportSW" JSONB;

-- CreateIndex: Trip
CREATE INDEX "Trip_destinationPlaceId_idx" ON "Trip"("destinationPlaceId");

-- AlterTable: GeneratedTour
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationType" "DestinationType";
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationName" TEXT;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationPlaceId" TEXT;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationStructured" JSONB;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationCenterLat" DOUBLE PRECISION;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationCenterLng" DOUBLE PRECISION;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationViewportNE" JSONB;
ALTER TABLE "GeneratedTour" ADD COLUMN "destinationViewportSW" JSONB;

-- CreateIndex: GeneratedTour
CREATE INDEX "GeneratedTour_destinationPlaceId_idx" ON "GeneratedTour"("destinationPlaceId");
