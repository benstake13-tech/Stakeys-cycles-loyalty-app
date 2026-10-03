-- Recreates the DRIFTED live Supabase schema so the migration can be tested.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

-- profiles lost most of its columns
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  phone text,
  role text DEFAULT 'customer',
  membership_number text UNIQUE NOT NULL,
  last_spun_at timestamptz
);
-- and had no table grants (default: only owner)

-- stamp_logs kept the "newer" uuid shape
CREATE TABLE public.stamp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text,
  user_id uuid NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'existing@example.com', '{"full_name":"Existing User"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'orphan@example.com', '{"full_name":"Orphan User"}'::jsonb);

-- the existing customer has a profile, the "orphan" has none (pre-trigger signup)
INSERT INTO public.profiles (id, email, display_name, membership_number) VALUES
  ('11111111-1111-1111-1111-111111111111', 'existing@example.com', 'Existing User', 'STK-EXIST');

-- prove the breakage before the migration
DO $$
BEGIN
  BEGIN
    PERFORM stamps FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'EXPECTED profiles.stamps to be missing';
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'PRE-CHECK ok: profiles.stamps is missing';
  END;
  BEGIN
    PERFORM customer_id FROM public.stamp_logs LIMIT 1;
    RAISE EXCEPTION 'EXPECTED stamp_logs.customer_id to be missing';
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'PRE-CHECK ok: stamp_logs.customer_id is missing';
  END;
END $$;
