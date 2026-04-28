-- Add events fields to Trip
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "eventsContextHash" TEXT,
  ADD COLUMN IF NOT EXISTS "eventsGeneratedAt" TIMESTAMP(3);

-- Create Event table
CREATE TABLE IF NOT EXISTS "Event" (
  "id"                TEXT NOT NULL,
  "tripId"            TEXT NOT NULL,
  "segmentCity"       TEXT NOT NULL,
  "category"          TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "venue"             TEXT,
  "venueLat"          DOUBLE PRECISION,
  "venueLng"          DOUBLE PRECISION,
  "startDateTime"     TIMESTAMP(3) NOT NULL,
  "endDateTime"       TIMESTAMP(3),
  "description"       TEXT,
  "imageUrl"          TEXT,
  "ticketUrl"         TEXT,
  "affiliateProvider" TEXT,
  "sourceProvider"    TEXT NOT NULL,
  "sourceEventId"     TEXT NOT NULL,
  "whyThisFamily"     TEXT,
  "relevanceScore"    DOUBLE PRECISION NOT NULL,
  "expiresAt"         TIMESTAMP(3) NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Event_tripId_sourceProvider_sourceEventId_key"
    UNIQUE ("tripId", "sourceProvider", "sourceEventId"),
  CONSTRAINT "Event_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Event_tripId_idx" ON "Event"("tripId");
