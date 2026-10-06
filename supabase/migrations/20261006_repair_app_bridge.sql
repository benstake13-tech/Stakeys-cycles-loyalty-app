-- ===========================================================================
-- REPAIR THE APP BRIDGE  (website + customer app  <->  staff + Supabase)
--
-- Symptom this fixes: real loyalty members (rows in public.profiles, created
-- by the website / customer app) cannot sign in and always get
-- "Invalid email or password."
--
-- Why it happens: the app keeps two independent stores that are supposed to be
-- linked by the SAME uuid:
--   * public.profiles  — the loyalty record (stamps, member number, role)
--   * auth.users       — the Supabase Auth login (email + password hash)
-- When the signup confirmation email is broken (project SMTP unset, or
-- `mailer_autoconfirm:false` with no mailer), the auth user is created but is
-- left with `email_confirmed_at = NULL`, so GoTrue refuses every password
-- sign-in. Members who were added at the till or imported from the old system
-- may have a profile but NO auth user at all. Either way the bridge is broken.
--
-- What this script does (idempotent, no data loss):
--   1. Reports the state of both stores (bridge_diagnostics).
--   2. Confirms every unconfirmed login so existing customers can sign in.
--   3. Backfills a confirmed login for every member profile that has none.
--   4. Installs link_member_login() so staff can repair one member at a time.
--   5. Re-asserts the profile<->auth trigger, grants and permissive RLS.
--
-- Run it in the Supabase SQL Editor (Database -> SQL Editor -> paste -> Run).
-- The anon key cannot run DDL, so this hand-off is required.
--
-- Default password used by the bulk backfill: Stakeys123!
-- Tell customers to reset it from the app after their first sign-in.
-- ===========================================================================

-- 0. pgcrypto provides crypt()/gen_salt() for password hashing.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. READ-ONLY BRIDGE REPORT. Safe for the app to call (anon/authenticated).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bridge_diagnostics()
RETURNS TABLE (metric text, total bigint, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'auth_logins'::text, count(*)::bigint,
         'Supabase Auth accounts that can sign in'::text
    FROM auth.users
  UNION ALL
  SELECT 'unconfirmed_logins', count(*)::bigint,
         'Logins blocked until email_confirmed_at is set'::text
    FROM auth.users WHERE email_confirmed_at IS NULL
  UNION ALL
  SELECT 'loyalty_profiles', count(*)::bigint,
         'Loyalty member records'::text
    FROM public.profiles
  UNION ALL
  SELECT 'profiles_without_login', count(*)::bigint,
         'Members with no matching auth login (cannot sign in)'::text
    FROM public.profiles p
   WHERE p.email IS NOT NULL AND p.email <> ''
     AND NOT EXISTS (
       SELECT 1 FROM auth.users u
        WHERE lower(u.email) = lower(p.email) OR u.id::text = p.id::text
     )
  UNION ALL
  SELECT 'logins_without_profile', count(*)::bigint,
         'Auth logins with no loyalty profile row'::text
    FROM auth.users u
   WHERE NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id::text = u.id::text OR lower(p.email) = lower(u.email)
     );
$$;

GRANT EXECUTE ON FUNCTION public.bridge_diagnostics() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. CONFIRM every existing unconfirmed login (no password changes).
--    This is the direct fix for "customers cannot log in" when the project's
--    confirmation email is broken.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_pending_logins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE auth.users
     SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmation_sent_at = COALESCE(confirmation_sent_at, now()),
         updated_at = now()
   WHERE email_confirmed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. LINK ONE MEMBER: give an existing member (or a brand-new one) a working,
--    pre-confirmed login. Staff use this to fix a single account.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_member_login(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL,
  p_membership_number text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_id uuid;
  v_profile_id uuid;
BEGIN
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Already have a login? Confirm it and reset the password.
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE auth.users
       SET encrypted_password = crypt(p_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_id;
    UPDATE public.profiles
       SET email = v_email,
           display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
           membership_number = COALESCE(membership_number, p_membership_number)
     WHERE id = v_id;
    RETURN v_id::text;
  END IF;

  -- Reuse the existing profile's uuid so the two stores line up on id.
  SELECT id INTO v_profile_id
    FROM public.profiles
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_profile_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_profile_id) THEN
    v_id := v_profile_id;
  ELSE
    v_id := gen_random_uuid();
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'full_name', COALESCE(NULLIF(trim(p_display_name), ''), split_part(v_email, '@', 1)),
      'role', 'customer'
    ),
    now(), now()
  );

  INSERT INTO public.profiles (id, email, display_name, role, membership_number, stamps, completed_cards, merit_points)
  VALUES (
    v_id, v_email,
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(v_email, '@', 1)),
    'customer', p_membership_number, 0, 0, 0
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        membership_number = COALESCE(public.profiles.membership_number, EXCLUDED.membership_number);

  RETURN v_id::text;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. BACKFILL: create a confirmed login for every member profile that has
--    none. Uses one shared default password so staff can hand customers a
--    working sign-in immediately; customers reset it afterwards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_member_logins(p_password text DEFAULT 'Stakeys123!')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  n integer := 0;
  v_id uuid;
BEGIN
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  FOR r IN
    SELECT p.id, p.email, p.display_name
      FROM public.profiles p
     WHERE p.email IS NOT NULL AND p.email <> ''
       AND p.id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       AND NOT EXISTS (
         SELECT 1 FROM auth.users u
          WHERE lower(u.email) = lower(p.email) OR u.id::text = p.id::text
       )
  LOOP
    BEGIN
      v_id := r.id::uuid;
      INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        v_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', lower(r.email),
        crypt(p_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object(
          'full_name', COALESCE(r.display_name, split_part(r.email, '@', 1)),
          'role', 'customer'
        ),
        now(), now()
      )
      ON CONFLICT (id) DO NOTHING;
      n := n + 1;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'bridge: skipped % (%)', r.email, SQLERRM;
    END;
  END LOOP;

  RETURN n;
END;
$$;

-- Lock the repair functions down: the SQL Editor (postgres) can call them, and
-- service_role can, but a customer's anon key must never be able to mint logins
-- or reset passwords.
REVOKE ALL ON FUNCTION public.confirm_pending_logins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_member_login(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_member_logins(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. SELF-HEAL the surrounding bridge (trigger, grants, permissive RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
  VALUES (
    new.id,
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
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users;
CREATE TRIGGER on_auth_user_created_loyalty
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_bridge_all'
  ) THEN
    CREATE POLICY profiles_bridge_all ON public.profiles
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. RUN THE REPAIR NOW (so a single paste-and-Run fixes existing customers).
-- ---------------------------------------------------------------------------
SELECT 'confirmed existing unconfirmed logins' AS step,
       public.confirm_pending_logins() AS affected;

SELECT 'backfilled logins for members without one' AS step,
       public.backfill_member_logins() AS affected;

-- ---------------------------------------------------------------------------
-- 7. VERIFY — should show zero members without a login.
-- ---------------------------------------------------------------------------
SELECT * FROM public.bridge_diagnostics();
