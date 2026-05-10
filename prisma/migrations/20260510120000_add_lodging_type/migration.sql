-- AddColumn lodgingType to SavedItem and ItineraryItem
ALTER TABLE "SavedItem" ADD COLUMN IF NOT EXISTS "lodgingType" TEXT;
ALTER TABLE "ItineraryItem" ADD COLUMN IF NOT EXISTS "lodgingType" TEXT;
