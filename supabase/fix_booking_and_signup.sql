-- ============================================================================
-- Stakey's Cycles — FIX BOOKING APPROVAL / QUOTES + NEW-SIGNUP LOGIN
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Safe to re-run. This ONLY adds columns, privileges, policies and singleton
-- rows; it never drops a table and never deletes data.
--
-- Why you need it:
--   * Accepting/declining a booking and saving a quote silently failed because
--     the live `service_bookings` table was missing the approval/quote columns
--     (they only existed on `counter_sales`). PostgREST rejects unknown columns,
--     so the write was dropped. Live error was:
--       42703 column service_bookings.approval_status does not exist
--   * A brand-new customer could not sign in after confirming their email
--     because their `profiles` row / privileges were missing.
-- ============================================================================

-- ============================================================================
-- 1. service_bookings — approval + quote columns the app reads and writes.
-- ============================================================================
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_by     TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS declined_at     TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS decline_reason  TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS staff_notes     TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quoted_price    NUMERIC;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_note      TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_at   TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_by   TEXT;

-- Backfill the status of bookings that were approved before these columns
-- existed. (ADD COLUMN with a constant DEFAULT fills existing rows with that
-- default, so we also match the default value, not just NULL.)
UPDATE public.service_bookings
   SET approval_status = 'approved'
 WHERE status = 'confirmed'
   AND (approval_status IS NULL OR approval_status = 'pending_approval');

UPDATE public.service_bookings
   SET approval_status = 'pending_approval'
 WHERE approval_status IS NULL;

-- ============================================================================
-- 2. profiles — columns the loyalty features read (idempotent safety net).
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stamps          INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_cards INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merit_points    INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at    TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_stamped_at TIMESTAMPTZ;

-- ============================================================================
-- 3. app_settings — columns the owner-notification settings read.
-- ============================================================================
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS owner_email                 TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS owner_phone                 TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS email_alerts_enabled        BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS sms_alerts_enabled          BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS business_name               TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS automated_reminders_enabled BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- 4. Schema usage + table privileges (independently guarded so one failure
--    cannot roll back the rest).
-- ============================================================================
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    END IF;
  END LOOP;
END $$;

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

-- ============================================================================
-- 5. Row Level Security: enable + permissive policy on every table.
-- ============================================================================
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

-- ============================================================================
-- 6. Ensure the shared singleton rows exist.
-- ============================================================================
INSERT INTO public.app_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);

INSERT INTO public.app_theme_config (id, theme)
SELECT 1, 'none'
WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);

-- OPTIONAL: set the workshop inbox that should receive owner booking alerts.
-- Replace the address below (it is left unchanged if you do not run this line).
-- UPDATE public.app_settings SET owner_email = 'workshop@stakeyscycles.co.uk', email_alerts_enabled = TRUE WHERE id = 1;

-- ============================================================================
-- 7. Auto-create a profile for every new auth user (so a fresh signup can log
--    in immediately), plus a backfill for existing auth users with no profile.
--    This is the fix for "invalid credentials" right after confirming an email.
-- ============================================================================
DO $outer$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found; skipping signup trigger + backfill';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $body$
    BEGIN
      INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
      VALUES (
        new.id::text,
        new.email,
        COALESCE(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'display_name',
          split_part(new.email, '@', 1),
          'Stakey Rider'
        ),
        'customer', 0, 0, 0
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    END;
    $body$;
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users';
  EXECUTE 'CREATE TRIGGER on_auth_user_created_loyalty
           AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user()';

  EXECUTE $bf$
    INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
    SELECT
      u.id::text,
      u.email,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'display_name',
        split_part(u.email, '@', 1),
        'Stakey Rider'
      ),
      'customer', 0, 0, 0
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id::text
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;
  $bf$;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'signup trigger/backfill skipped: %', SQLERRM;
END $outer$;

-- ============================================================================
-- 8. Realtime for every table (safe if already a member of the publication).
-- ============================================================================
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

-- ============================================================================
-- 9. Verification — should return the new columns and no errors.
-- ============================================================================
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'service_bookings'
   AND column_name IN (
     'approval_status','approved_at','approved_by','declined_at','decline_reason',
     'staff_notes','quoted_price','quote_note','quote_sent_at','quote_sent_by'
   )
 ORDER BY column_name;
