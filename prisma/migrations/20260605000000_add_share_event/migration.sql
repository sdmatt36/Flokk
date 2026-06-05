CREATE TABLE "ShareEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "token" TEXT,
    "channel" TEXT,
    "sharedByUserId" TEXT,
    "sharedByFamilyProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShareEvent_sharedByFamilyProfileId_idx" ON "ShareEvent"("sharedByFamilyProfileId");
CREATE INDEX "ShareEvent_sharedByUserId_idx" ON "ShareEvent"("sharedByUserId");
CREATE INDEX "ShareEvent_entityType_idx" ON "ShareEvent"("entityType");
CREATE INDEX "ShareEvent_createdAt_idx" ON "ShareEvent"("createdAt");
