-- Customer avatar persistence.
-- The avatar creator writes profiles.avatar_color, but the column was missing
-- from the schema, so the UPDATE silently failed and the avatar reverted on the
-- next profile reload. Idempotent and non-destructive.
--
-- Run this once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_color TEXT;

-- staff_members already carries the column on fresh installs; re-assert it so a
-- database created before the roster existed is repaired too.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS avatar_color TEXT;

-- Verify
SELECT id, display_name, avatar_color
FROM public.profiles
ORDER BY updated_at DESC NULLS LAST
LIMIT 20;
