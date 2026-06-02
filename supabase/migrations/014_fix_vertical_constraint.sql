-- ============================================================
-- FYP.STUDIO — 014: Fix vertical_type CHECK constraint
-- 004 added: ('food','real_estate','fashion','beauty','barbershop','services','general')
-- 010 migrated data to new groups but never updated the constraint
-- New signups with 'gastro'/'comercio'/'servicios'/'mercados' were failing
-- ============================================================

-- Drop the inline constraint added by 004 (PostgreSQL names it <table>_<col>_check)
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_vertical_type_check;

-- Re-add with all valid values: legacy + new groups
ALTER TABLE businesses
  ADD CONSTRAINT businesses_vertical_type_check
  CHECK (vertical_type IN (
    -- legacy values (kept for any rows that weren't migrated or direct inserts)
    'food', 'real_estate', 'fashion', 'beauty', 'barbershop', 'services', 'general',
    -- new group values introduced in 010
    'gastro', 'comercio', 'servicios', 'mercados'
  ));

-- ============================================================
-- Fix: invitations UNIQUE constraint too broad
-- 013 added UNIQUE(business_id, email) — but this prevents
-- re-inviting someone after their invite was revoked or accepted.
-- Replace with a partial unique index that only applies to
-- active (non-revoked, non-accepted) invitations.
-- ============================================================

ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS uq_active_invitation;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_invitation
  ON invitations(business_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
