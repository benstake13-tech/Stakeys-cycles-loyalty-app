-- ============================================================================
-- STAKEY'S CYCLES - HOTFIX: DATABASE PERMISSION OVERRIDES
-- ============================================================================

-- Fix: Ensure all authenticated users can read core tables
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service bookings select policy" ON public.service_bookings;
CREATE POLICY "Service bookings select policy" ON public.service_bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Stamp logs select policy" ON public.stamp_logs;
CREATE POLICY "Stamp logs select policy" ON public.stamp_logs FOR SELECT USING (true);

SELECT 'Hotfix applied. Permissions relaxed to allow authenticated read access.';
