-- ============================================================================
-- Stakey's Cycles — FOCUSED REPAIR (grants + shared rows + theme column)
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run. This only ADDS privileges/policies and inserts missing
-- singleton rows; it never drops tables or revokes access.
--
-- Use this when complete_setup.sql reported "Success" but some tables still
-- return 401 / 42501 (permission denied) to the app — typically the tables
-- that already existed (profiles, customer_bikes, service_bookings).
-- ============================================================================

-- ============================================================================

-- 0. Repair service_bookings columns the app reads/writes but that were never
--    created on pre-existing tables. Without these, approving a booking or
--    saving a quote silently fails to persist (PostgREST rejects the column).
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS staff_notes TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quoted_price NUMERIC;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_note TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_by TEXT;

-- 1. Schema usage (prerequisite for any table privilege).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    END IF;
  END LOOP;
END $$;

-- 2. Table privileges. Each grant is independently guarded so one failure can
--    never roll back the rest. Applied to anon AND authenticated.
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip missing table public.%', t;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t);
      EXCEPTION WHEN others THEN RAISE NOTICE 'anon grant public.% failed: %', t, SQLERRM; END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXCEPTION WHEN others THEN RAISE NOTICE 'authenticated grant public.% failed: %', t, SQLERRM; END;
    END IF;
  END LOOP;
END $$;

-- 3. Row Level Security: enable + permissive policy on every table.
DO $$
DECLARE t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                     'Allow all on ' || t, t);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'rls public.% failed: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Ensure the shared singleton rows exist.
INSERT INTO public.app_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);

INSERT INTO public.app_theme_config (id, theme)
SELECT 1, 'none'
WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);

-- 5. Migrate a legacy `active_theme` column into the `theme` column the app reads.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_theme_config' AND column_name = 'active_theme'
  ) THEN
    EXECUTE 'UPDATE public.app_theme_config SET theme = active_theme
             WHERE (theme IS NULL OR theme = ''none'') AND active_theme IS NOT NULL AND active_theme <> ''none''';
  END IF;
END $$;

-- 6. Realtime for every table (safe if already a member of the publication).
DO $$
DECLARE t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN others THEN RAISE NOTICE 'realtime public.% skipped: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
