-- AddColumn Trip.sourceTripId for steal/clone lineage tracking
ALTER TABLE "Trip" ADD COLUMN "sourceTripId" TEXT;

-- FK: sourceTripId → Trip.id (self-referential, "StolenFrom")
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_sourceTripId_fkey"
  FOREIGN KEY ("sourceTripId") REFERENCES "Trip"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for reverse lookup (stolenCopies)
CREATE INDEX "Trip_sourceTripId_idx" ON "Trip"("sourceTripId");
