-- Stakey's Cycles - Loyalty schema sync (stamp card + prize wheel hardening)
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.
--
-- Background: the live project had drifted from the app's schema:
--   * profiles was missing the `stamps` / `merit_points` / `last_spun_at` columns
--     and was missing table-level GRANTs, so every stamp / spin write hit
--     42501 "permission denied for table profiles" and 42703 "column does not
--     exist". Nothing persisted and the login profile load failed.
--   * stamp_logs was created from an older schema (a NOT NULL `user_id`, no
--     `customer_id` / `action` / `stamps_before` columns), so the history write
--     failed with PGRST204.
--   * there was no `on auth.users` trigger, so a fresh signup had no profile row
--     and could not log in ("could not load profile").

-- 1. Profiles: restore every column the app reads/writes.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stamps INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_cards INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merit_points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_stamped_at TIMESTAMPTZ;
ALTER TABLE public.profiles ALTER COLUMN membership_number DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- 2. Stamp logs: add the columns the app writes.
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'add_stamp';
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_before INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_after INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS reward_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.stamp_logs ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE public.stamp_logs ALTER COLUMN action DROP NOT NULL;
ALTER TABLE public.stamp_logs ALTER COLUMN user_id DROP NOT NULL;
-- The app generates readable text ids ("log-<ts>-<n>"); some projects declared
-- stamp_logs.id as uuid, which rejected every history write with 22P02.
ALTER TABLE public.stamp_logs ALTER COLUMN id TYPE TEXT USING id::text;

-- 3. Table privileges (this is what produced the 401/42501 errors).
--    Guarded so a missing/optional table can never abort the whole migration.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
DO $$
DECLARE
  t text;
  tables_grants text[] := ARRAY[
    'profiles', 'stamp_logs', 'prize_wheels', 'prize_draws',
    'service_vouchers', 'discount_codes', 'counter_sales'
  ];
  tables_delete text[] := ARRAY['discount_codes'];
BEGIN
  FOREACH t IN ARRAY tables_grants LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skipping grants: public.% does not exist', t;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon, authenticated', t);
    IF t = ANY (tables_delete) THEN
      EXECUTE format('GRANT DELETE ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 4. Row Level Security policies.
DO $$
DECLARE
  t text;
  tables_rls text[] := ARRAY[
    'profiles', 'stamp_logs', 'prize_wheels', 'prize_draws',
    'service_vouchers', 'discount_codes', 'counter_sales'
  ];
BEGIN
  FOREACH t IN ARRAY tables_rls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      'Allow all on ' || t, t
    );
  END LOOP;
END $$;

-- 5. Auto-create a profile for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Stakey Rider'),
    'customer',
    0, 0, 0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users;
CREATE TRIGGER on_auth_user_created_loyalty
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user();

-- 6. Backfill profiles for any existing auth users that have none.
INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
SELECT u.id,
       u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Stakey Rider'),
       'customer', 0, 0, 0
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id::text
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
