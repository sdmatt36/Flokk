-- AlterTable
ALTER TABLE "TripDocument" ADD COLUMN "savedItemId" TEXT;

-- AddForeignKey
ALTER TABLE "TripDocument" ADD CONSTRAINT "TripDocument_savedItemId_fkey" FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TripDocument_savedItemId_idx" ON "TripDocument"("savedItemId");
