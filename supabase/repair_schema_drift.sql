-- ============================================================================
-- Stakey's Cycles — repair live schema drift
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent: safe to re-run. Never drops tables or deletes rows.
--
-- Fixes, in order:
--   1. stamp_logs.id / staff_id -> text, add reward_id, relax user_id
--   2. customer_bikes.id -> text
--   3. profiles.last_spin_date (missing column aborts every profile upsert)
--   4. service_bookings NOT NULL columns blocking app bookings
--   5. discount_codes type CHECK to allow 'service_credit'
--   6. auto-create public.profiles on new auth.users + backfill
--   7. app_settings singleton row
--   8. grants + RLS on every public table
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. stamp_logs — the app writes text ids like 'log-1727...-482' and staff ids
--    like 'staff-1234', but the live columns are uuid, so every insert 22P02s.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.stamp_logs') IS NULL THEN
    RAISE NOTICE 'stamp_logs missing; skipping'; RETURN;
  END IF;

  -- id: uuid -> text
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stamp_logs'
                AND column_name='id' AND data_type='uuid') THEN
    ALTER TABLE public.stamp_logs ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.stamp_logs ALTER COLUMN id TYPE text USING id::text;
    RAISE NOTICE 'stamp_logs.id converted to text';
  END IF;

  -- staff_id: uuid -> text (app sends 'staff-1234')
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stamp_logs'
                AND column_name='staff_id' AND data_type='uuid') THEN
    ALTER TABLE public.stamp_logs ALTER COLUMN staff_id TYPE text USING staff_id::text;
    RAISE NOTICE 'stamp_logs.staff_id converted to text';
  END IF;

  -- customer_id: uuid -> text (app sends membership codes too)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stamp_logs'
                AND column_name='customer_id' AND data_type='uuid') THEN
    ALTER TABLE public.stamp_logs ALTER COLUMN customer_id TYPE text USING customer_id::text;
    RAISE NOTICE 'stamp_logs.customer_id converted to text';
  END IF;

  -- the app's primary payload includes reward_id
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS reward_id text;

  -- legacy NOT NULL user_id blocks the app's primary payload
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stamp_logs'
                AND column_name='user_id' AND is_nullable='NO') THEN
    ALTER TABLE public.stamp_logs ALTER COLUMN user_id DROP NOT NULL;
    RAISE NOTICE 'stamp_logs.user_id made nullable';
  END IF;

  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS note text;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS action text;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_name text;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS staff_name text;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_before int;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_after int;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now();

  -- Legacy points-ledger columns. On some projects these are NOT NULL with
  -- CHECKs (amount <> 0, source IN ('visit','wheel')). The app writes amount 0
  -- / source 'visit' for every history row, so the NOT NULLs and CHECKs must go
  -- or the insert fails with 23502 / 23514 and nothing persists.
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'visit';
  ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  ALTER TABLE public.stamp_logs ALTER COLUMN amount DROP NOT NULL;
  ALTER TABLE public.stamp_logs ALTER COLUMN source DROP NOT NULL;
  ALTER TABLE public.stamp_logs ALTER COLUMN created_at DROP NOT NULL;
  ALTER TABLE public.stamp_logs DROP CONSTRAINT IF EXISTS stamp_logs_amount_check;
  ALTER TABLE public.stamp_logs DROP CONSTRAINT IF EXISTS stamp_logs_source_check;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'stamp_logs repair skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 2. customer_bikes — the app writes text ids like 'bike-1727...'.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.customer_bikes') IS NULL THEN
    RAISE NOTICE 'customer_bikes missing; skipping'; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='customer_bikes'
                AND column_name='id' AND data_type='uuid') THEN
    ALTER TABLE public.customer_bikes ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.customer_bikes ALTER COLUMN id TYPE text USING id::text;
    RAISE NOTICE 'customer_bikes.id converted to text';
  END IF;
  ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS scraped_data jsonb;
  ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS stock_specs_scraped boolean DEFAULT false;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_bikes repair skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 3. profiles — last_spin_date is written by the app but does not exist, which
--    makes the whole upsert fail (PGRST204). Both date columns are read.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tickets int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_number text;

-- ---------------------------------------------------------------------------
-- 4. service_bookings — these NOT NULL columns have no defaults and the app
--    sends nulls, so online bookings never persist.
-- ---------------------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  IF to_regclass('public.service_bookings') IS NULL THEN
    RAISE NOTICE 'service_bookings missing; skipping'; RETURN;
  END IF;
  FOREACH c IN ARRAY ARRAY['customer_phone','service_id','service_title','preferred_time_slot'] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.service_bookings ALTER COLUMN %I DROP NOT NULL', c);
    EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN
      RAISE NOTICE 'service_bookings.% : %', c, SQLERRM;
    END;
  END LOOP;
  BEGIN
    ALTER TABLE public.service_bookings ALTER COLUMN preferred_date DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN NULL; END;

  -- Approval / quote lifecycle columns (already present on most projects).
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approval_status text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_at timestamptz;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_by text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS declined_at timestamptz;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS decline_reason text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS staff_notes text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quoted_price numeric;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_note text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_by text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS repair_stage text;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS progress_events jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS estimate_ready_at timestamptz;
  ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean DEFAULT false;
END $$;

-- ---------------------------------------------------------------------------
-- 5. discount_codes — allow 'service_credit' (voucher -> discount conversion).
-- ---------------------------------------------------------------------------
DO $$
DECLARE conname text;
BEGIN
  IF to_regclass('public.discount_codes') IS NULL THEN
    RAISE NOTICE 'discount_codes missing; skipping'; RETURN;
  END IF;
  FOR conname IN
    SELECT c.conname FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname='public' AND t.relname='discount_codes'
       AND c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.discount_codes DROP CONSTRAINT %I', conname);
    RAISE NOTICE 'dropped discount_codes constraint %', conname;
  END LOOP;
  ALTER TABLE public.discount_codes DROP CONSTRAINT IF EXISTS discount_codes_type_check;
  ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_type_check
    CHECK (type IN ('percent','fixed','service_credit'));
  RAISE NOTICE 'discount_codes_type_check recreated';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'discount_codes type constraint skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Auto-create a profiles row for every new auth user, and backfill.
--    profiles.id has an FK to auth.users, so this must run AFTER auth insert.
-- ---------------------------------------------------------------------------
DO $outer$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found; skipping profile trigger'; RETURN;
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
        COALESCE(new.raw_user_meta_data->>'full_name',
                 new.raw_user_meta_data->>'display_name',
                 split_part(new.email, '@', 1),
                 'Stakey Rider'),
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
    SELECT u.id::text, u.email,
           COALESCE(u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'display_name',
                    split_part(u.email, '@', 1),
                    'Stakey Rider'),
           'customer', 0, 0, 0
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id::text
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;
  $bf$;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'profile trigger/backfill skipped: %', SQLERRM;
END $outer$;

-- ---------------------------------------------------------------------------
-- 7. app_settings singleton row (owner_email must be set for email alerts).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN RETURN; END IF;
  INSERT INTO public.app_settings (id) SELECT 1
   WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);
  -- Uncomment and set the real workshop address to enable owner email alerts:
  -- UPDATE public.app_settings
  --    SET owner_email = 'workshop@stakeyscycles.co.uk',
  --        email_alerts_enabled = true
  --  WHERE id = 1;
END $$;

INSERT INTO public.app_theme_config (id, theme)
SELECT 1, 'none' WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);

-- ---------------------------------------------------------------------------
-- 8. Grants + permissive RLS on every public table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record; r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    END IF;
  END LOOP;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t.tablename);
      EXCEPTION WHEN others THEN RAISE NOTICE 'grant anon % failed: %', t.tablename, SQLERRM; END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
      EXCEPTION WHEN others THEN RAISE NOTICE 'grant authenticated % failed: %', t.tablename, SQLERRM; END;
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t.tablename, t.tablename);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                     'Allow all on ' || t.tablename, t.tablename);
    EXCEPTION WHEN others THEN RAISE NOTICE 'rls % failed: %', t.tablename, SQLERRM; END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 9. Realtime — ensure every table is published.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t.tablename);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication not found'; RETURN;
      WHEN others THEN RAISE NOTICE 'realtime add % skipped: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 9b. Bike identity & e-bike conversion details (jsonb)
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS bike_details jsonb;
ALTER TABLE public.customer_bikes  ADD COLUMN IF NOT EXISTS bike_details jsonb;

-- ---------------------------------------------------------------------------
-- 10. Verify
-- ---------------------------------------------------------------------------
SELECT table_name, grantee, count(*) AS privs
  FROM information_schema.role_table_grants
 WHERE table_schema='public' AND grantee IN ('anon','authenticated')
 GROUP BY table_name, grantee ORDER BY table_name;

SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename;

SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND column_name='id'
   AND table_name IN ('stamp_logs','customer_bikes','profiles');

SELECT u.id, u.email FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id::text WHERE p.id IS NULL;
