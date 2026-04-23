-- ============================================================
-- Trovv RLS Policies
--
-- IMPORTANT: This app uses Prisma with the service_role key,
-- which bypasses RLS. These policies protect against direct
-- DB access (e.g. from Supabase Studio or leaked anon key)
-- but DO NOT affect Prisma queries.
--
-- To make auth.uid() work with Clerk, you must configure
-- Supabase to verify Clerk JWTs:
-- 1. Supabase Dashboard → Authentication → JWT Settings
-- 2. Set JWT Secret to your Clerk JWT public key
-- 3. Then auth.uid() will return the Clerk user ID (sub claim)
-- 4. BUT: clerkId is the Clerk sub, NOT a UUID. You'd need
--    to expose clerkId as a UUID-compatible column.
--
-- ALTERNATIVE (recommended): Keep application-layer security
-- (already implemented correctly via Prisma WHERE clauses)
-- and restrict service_role key access (never expose to client).
-- ============================================================

-- Enable RLS on all user-data tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeclaredInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BehavioralProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripCollaborator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecommendedItem" ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- NOTE: The policies below use auth.uid() which returns the Supabase Auth user UUID.
-- With Clerk, auth.uid() returns null unless Clerk JWTs are configured in Supabase.
-- These policies are a template — they require the JWT configuration step above.

-- User: each user can only see their own record
CREATE POLICY "users_own_data" ON "User"
  FOR ALL USING (auth.uid()::text = "clerkId");

-- FamilyProfile: accessible by the owning user
CREATE POLICY "family_profile_own" ON "FamilyProfile"
  FOR ALL USING (
    "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
  );

-- FamilyMember: accessible via family profile
CREATE POLICY "family_members_own" ON "FamilyMember"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- DeclaredInterest: accessible via family profile
CREATE POLICY "interests_own" ON "DeclaredInterest"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- Trip: owner sees all; public trips readable by authenticated users
CREATE POLICY "trips_own" ON "Trip"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "trips_public_read" ON "Trip"
  FOR SELECT USING ("privacy" = 'PUBLIC' AND auth.uid() IS NOT NULL);

-- SavedItem: scoped to owning family profile
CREATE POLICY "saved_items_own" ON "SavedItem"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- TripCollaborator: accessible by trip owner or collaborator
CREATE POLICY "collaborators_own" ON "TripCollaborator"
  FOR ALL USING (
    "tripId" IN (
      SELECT t.id FROM "Trip" t
      JOIN "FamilyProfile" fp ON t."familyProfileId" = fp.id
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- RecommendedItem: scoped to family profile
CREATE POLICY "recommended_items_own" ON "RecommendedItem"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- BehavioralProfile: scoped to family profile
CREATE POLICY "behavioral_own" ON "BehavioralProfile"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

-- CommunityProfile: readable by all authenticated users, writable by owner
CREATE POLICY "community_read" ON "CommunityProfile"
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "community_own_write" ON "CommunityProfile"
  FOR ALL USING (
    "familyProfileId" IN (
      SELECT fp.id FROM "FamilyProfile" fp
      JOIN "User" u ON fp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );
