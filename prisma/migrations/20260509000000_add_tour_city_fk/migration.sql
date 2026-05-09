-- AlterTable
ALTER TABLE "GeneratedTour" ADD COLUMN "cityId" TEXT;

-- AddForeignKey
ALTER TABLE "GeneratedTour" ADD CONSTRAINT "GeneratedTour_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "GeneratedTour_cityId_idx" ON "GeneratedTour"("cityId");
