-- ---------------------------------------------------------------------------
-- Staff accounts: admin-gated creation + role management.
--
-- The app signs customers up with the public anon key, which can never create
-- a staff/admin account: the signup trigger always writes role='customer' and
-- the role column is not client-writable for anyone else. This migration adds
-- two SECURITY DEFINER functions that let an existing ADMIN mint and manage
-- staff logins. They are the only path that can set a non-customer role.
--
-- Apply with the Supabase SQL Editor (or `supabase db push`). Idempotent.
-- ---------------------------------------------------------------------------

-- 1. Admin-gated helper: true when the caller's profile role is 'admin'.
--    `profiles.id` is uuid on the live project (and the app's expected schema),
--    so cast the column to text before comparing — otherwise PostgreSQL has no
--    uuid = text operator. Works whether the column is uuid or text.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id::text = auth.uid()::text),
    false
  );
$$;

-- 2. Create a staff/admin login. Admin only.
--    Inserts the auth user directly (email pre-confirmed) and writes the
--    profile role explicitly, because the signup trigger deliberately never
--    trusts a client-supplied role.
CREATE OR REPLACE FUNCTION public.create_staff_account(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL,
  p_role text DEFAULT 'staff'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_role text := lower(trim(COALESCE(p_role, 'staff')));
  v_name text := NULLIF(trim(COALESCE(p_display_name, '')), '');
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can create staff accounts';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF v_role NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'Role must be staff or admin';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'An account with this email already exists';
  END IF;

  v_id := gen_random_uuid();

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
      'full_name', COALESCE(v_name, split_part(v_email, '@', 1)),
      'role', v_role
    ),
    now(), now()
  );

  -- Ensure the profile exists with the requested role. The signup trigger may
  -- have created it as 'customer' a moment ago; upsert overrides that.
  INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
  VALUES (
    v_id, v_email,
    COALESCE(v_name, split_part(v_email, '@', 1)),
    v_role, 0, 0, 0
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        email = COALESCE(public.profiles.email, EXCLUDED.email);

  RETURN v_id::text;
END;
$$;

-- 3. List staff/admin logins with their profile. Admin only.
CREATE OR REPLACE FUNCTION public.list_staff_accounts()
RETURNS TABLE (
  id text,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id::text, p.email, p.display_name, p.role, p.created_at
  FROM public.profiles p
  WHERE public.is_admin() AND p.role IN ('staff', 'admin')
  ORDER BY p.role DESC, p.display_name ASC;
$$;

-- 4. Change a staff member's role. Admin only. Demoting to 'customer' revokes
--    staff access. Refuses to remove the last remaining admin.
CREATE OR REPLACE FUNCTION public.set_staff_role(
  p_user_id text,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(trim(p_role));
  v_admins int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can change staff roles';
  END IF;
  IF v_role NOT IN ('customer', 'staff', 'admin') THEN
    RAISE EXCEPTION 'Role must be customer, staff or admin';
  END IF;

  IF v_role <> 'admin' THEN
    SELECT count(*) INTO v_admins FROM public.profiles WHERE role = 'admin';
    IF v_admins <= 1 AND EXISTS (SELECT 1 FROM public.profiles WHERE id::text = p_user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;

  UPDATE public.profiles SET role = v_role WHERE id::text = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for %', p_user_id;
  END IF;
  RETURN true;
END;
$$;

-- 5. Grants: authenticated only (anon must never reach these).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_staff_account(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_staff_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_role(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_role(text, text) TO authenticated;
