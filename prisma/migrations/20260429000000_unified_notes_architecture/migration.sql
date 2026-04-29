-- Unified Notes Architecture: TripNote.dayIndex + Json content (Tiptap)
-- Applied via Supabase MCP in three phases; this file records the full DDL for history.

-- Phase 1: add new columns
ALTER TABLE "TripNote"
  ADD COLUMN IF NOT EXISTS "dayIndex" INTEGER,
  ADD COLUMN IF NOT EXISTS "content_json" JSONB;

-- Phase 2: backfill content_json from legacy String content
UPDATE "TripNote"
SET "content_json" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', CASE
        WHEN content IS NULL OR content = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object('type', 'text', 'text', content))
      END
    )
  )
)
WHERE "content_json" IS NULL;

-- Phase 3: drop old String column, rename jsonb column to content, enforce NOT NULL
ALTER TABLE "TripNote" DROP COLUMN content;
ALTER TABLE "TripNote" RENAME COLUMN content_json TO content;
ALTER TABLE "TripNote" ALTER COLUMN content SET NOT NULL;

-- Phase 4: composite index for day-scoped queries
CREATE INDEX IF NOT EXISTS "TripNote_tripId_dayIndex_idx" ON "TripNote"("tripId", "dayIndex");
