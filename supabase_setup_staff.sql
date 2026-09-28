-- ============================================================================
-- STAKEY'S CYCLES - SETUP STAFF ACCOUNT
-- ============================================================================

-- 1. Insert a staff user into auth.users (if not already there, Supabase handles this via Auth API, 
--    but we need the record in public.profiles to link them)

-- 2. Ensure your staff account exists in profiles
INSERT INTO public.profiles (id, email, display_name, role)
VALUES 
  ('ben-uid-placeholder', 'ben@stakeyscycles.com', 'Ben Stakey', 'admin'),
  ('chloe-uid-placeholder', 'chloe@stakeyscycles.com', 'Chloe Stakey', 'staff')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- NOTE: You MUST use the actual Auth UID from the Supabase Authentication table 
-- in place of 'ben-uid-placeholder' and 'chloe-uid-placeholder'.
-- 1. Go to Supabase Auth -> Users
-- 2. Create the user (or find existing)
-- 3. Copy their UUID
-- 4. Replace the placeholder in this script and run it.
