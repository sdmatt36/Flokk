ALTER TABLE "CommunitySpot" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "CommunitySpot" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "CommunitySpot_shareToken_key" ON "CommunitySpot"("shareToken");
