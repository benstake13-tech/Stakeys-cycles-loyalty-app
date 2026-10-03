-- ============================================================================
-- Stakey's Cycles — FINISH SETUP (grants, RLS, signup trigger, realtime)
-- ----------------------------------------------------------------------------
-- The schema/data portion already ran. This is the REMAINDER of that script
-- (everything from the permissions block onward). Short on purpose: it loops
-- over the tables dynamically, so there is no long list to get truncated.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run. Never drops tables, never deletes rows.
-- ============================================================================

-- 1. GRANTS — every table in `public` gets read/write for anon + authenticated,
--    plus schema USAGE. Without these, reads/writes fail with 42501.
DO $$
DECLARE t record; r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    END IF;
  END LOOP;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t.tablename);
      EXCEPTION WHEN others THEN RAISE NOTICE 'grant anon on public.% failed: %', t.tablename, SQLERRM; END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
      EXCEPTION WHEN others THEN RAISE NOTICE 'grant authenticated on public.% failed: %', t.tablename, SQLERRM; END;
    END IF;
  END LOOP;
END $$;

-- 2. ROW LEVEL SECURITY — enable + permissive policy on every table.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t.tablename, t.tablename);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                     'Allow all on ' || t.tablename, t.tablename);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'rls public.% failed: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. AUTO-CREATE A PROFILE FOR EVERY NEW AUTH USER + backfill existing users.
--    Fixes a fresh signup being unable to log in after confirming their email.
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
  RAISE NOTICE 'signup trigger/backfill skipped: %', SQLERRM;
END $outer$;

-- 4. ENSURE THE SHARED SINGLETON ROWS EXIST.
INSERT INTO public.app_settings (id)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);

INSERT INTO public.app_theme_config (id, theme)
SELECT 1, 'none' WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);

-- 5. REALTIME — add every table to the publication (ignore "already member").
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t.tablename);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication not found; skipped';
      WHEN others THEN RAISE NOTICE 'realtime add skipped for %: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- 6. VERIFY — expect 13 tables with 4 privileges each for anon, and 13 policies.
SELECT table_name, count(*) AS anon_privileges
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee = 'anon'
 GROUP BY table_name ORDER BY table_name;

SELECT count(*) AS policies_created FROM pg_policies WHERE schemaname = 'public';
