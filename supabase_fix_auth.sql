-- ============================================================================
-- STAKEY'S CYCLES - FIX AUTH/RLS PERMISSION ISSUES
-- Ensure the anon user can access the profiles table to be able to authenticate/identify themselves
-- ============================================================================

-- Allow public read access to profiles (needed for initial login/lookup)
CREATE POLICY "Allow public select profiles" ON public.profiles
  FOR SELECT
  USING (true);

-- Ensure authenticated users can access their own data
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles
  FOR SELECT
  USING (
    auth.uid()::text = id OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );
