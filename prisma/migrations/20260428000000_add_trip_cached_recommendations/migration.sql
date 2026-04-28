-- AddColumn
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "cachedRecommendations" JSONB;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "cachedRecommendationsGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "cachedRecommendationsContextHash" TEXT;
