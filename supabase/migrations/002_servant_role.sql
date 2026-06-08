-- Migration 002: Add servant role and servant_id relationship
-- Run in Supabase SQL Editor

-- 1. Add servant_id to profiles (nullable — only Sunday School students have this)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS servant_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Extend the role check to include 'servant'
--    (If you used a CHECK constraint, update it; if it's just a text column, no change needed)
--    Check current constraint:
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('congregant', 'servant', 'priest', 'admin'));

-- 3. Index for servant lookups (servant sees students where servant_id = their id)
CREATE INDEX IF NOT EXISTS idx_profiles_servant_id ON profiles(servant_id);

-- 4. RLS: servants can read profiles of their students
CREATE POLICY IF NOT EXISTS "Servants can read their students"
  ON profiles FOR SELECT
  USING (servant_id = auth.uid());

-- 5. Servants can read spiritual_canons they assigned (priest_id = their id)
--    This already works if canons use priest_id — servants use the same column.
--    No new policy needed if the existing priest policy uses priest_id.

-- 6. Servants can insert/update spiritual_canons for their students
--    Check if existing canon policy covers this; if not, add:
CREATE POLICY IF NOT EXISTS "Servants can assign canons to their students"
  ON spiritual_canons FOR INSERT
  WITH CHECK (
    priest_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = spiritual_canons.user_id AND servant_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Servants can read canons they assigned"
  ON spiritual_canons FOR SELECT
  USING (priest_id = auth.uid());
