-- Add messageId to ExtractionLog for delivery-level audit observability.
-- Nullable: existing rows get null, missing headers write null — no backfill needed.
ALTER TABLE "ExtractionLog" ADD COLUMN "messageId" TEXT;
