-- Add familyProfileId to FlightBooking (denormalized from trip.familyProfileId)
-- Enables profile-level idempotency: unique (familyProfileId, confirmationCode) partial index
-- prevents duplicate FlightBookings when the same confirmation is re-forwarded.

ALTER TABLE "FlightBooking" ADD COLUMN "familyProfileId" TEXT;

-- Backfill from the parent Trip
UPDATE "FlightBooking" fb
SET "familyProfileId" = t."familyProfileId"
FROM "Trip" t
WHERE fb."tripId" = t.id;

-- Regular index for Prisma-generated queries
CREATE INDEX "FlightBooking_familyProfileId_confirmationCode_idx"
ON "FlightBooking" ("familyProfileId", "confirmationCode");

-- Partial unique index: one (profile, code) pair per profile, null codes excluded
CREATE UNIQUE INDEX "FlightBooking_profile_confirmation_unique"
ON "FlightBooking" ("familyProfileId", "confirmationCode")
WHERE "confirmationCode" IS NOT NULL;
