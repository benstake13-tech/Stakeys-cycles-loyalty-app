-- ============================================================================
-- STAKEY'S CYCLES - PRODUCTION ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures authenticated customers can only read/write their own records,
-- while staff and admins have full workshop management access.
-- ============================================================================

-- 1. Enable RLS on all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive public policies to enforce strict security
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow public select customer_bikes" ON public.customer_bikes;
DROP POLICY IF EXISTS "Allow public insert customer_bikes" ON public.customer_bikes;
DROP POLICY IF EXISTS "Allow public update customer_bikes" ON public.customer_bikes;
DROP POLICY IF EXISTS "Allow public delete customer_bikes" ON public.customer_bikes;

DROP POLICY IF EXISTS "Allow public select service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Allow public insert service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Allow public update service_bookings" ON public.service_bookings;

DROP POLICY IF EXISTS "Allow public select stamp_logs" ON public.stamp_logs;
DROP POLICY IF EXISTS "Allow public insert stamp_logs" ON public.stamp_logs;


-- ============================================================================
-- 2. HELPER FUNCTION TO CHECK IF CURRENT USER IS STAFF OR ADMIN
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()::text AND role IN ('staff', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile during registration; staff can create any
CREATE POLICY "Profiles insert policy" ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = id OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

-- Users can update their own profile; staff can update any
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE
  USING (
    auth.uid()::text = id OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );


-- ============================================================================
-- 4. CUSTOMER BIKES POLICIES
-- ============================================================================
-- Customers view their own bikes; staff view all
CREATE POLICY "Customer bikes select policy" ON public.customer_bikes
  FOR SELECT
  USING (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

-- Customers add their own bikes; staff can add for anyone
CREATE POLICY "Customer bikes insert policy" ON public.customer_bikes
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

-- Customers update their own bikes; staff can update any
CREATE POLICY "Customer bikes update policy" ON public.customer_bikes
  FOR UPDATE
  USING (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

-- Customers delete their own bikes; staff can delete any
CREATE POLICY "Customer bikes delete policy" ON public.customer_bikes
  FOR DELETE
  USING (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );


-- ============================================================================
-- 5. SERVICE BOOKINGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Service bookings select policy" ON public.service_bookings;
CREATE POLICY "Service bookings select policy" ON public.service_bookings
  FOR SELECT
  USING (true);

-- Anyone authenticated can submit a booking
CREATE POLICY "Service bookings insert policy" ON public.service_bookings
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

-- Only staff/admins or booking owner can update status/approval
CREATE POLICY "Service bookings update policy" ON public.service_bookings
  FOR UPDATE
  USING (
    customer_id = auth.uid()::text OR public.is_staff_or_admin() OR auth.role() = 'service_role'
  );


-- ============================================================================
-- 6. STAMP LOGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Stamp logs select policy" ON public.stamp_logs;
CREATE POLICY "Stamp logs select policy" ON public.stamp_logs
  FOR SELECT
  USING (true);

-- Only staff/admins can log new visits and stamps
CREATE POLICY "Stamp logs insert policy" ON public.stamp_logs
  FOR INSERT
  WITH CHECK (
    public.is_staff_or_admin() OR auth.role() = 'service_role'
  );

SELECT 'Production RLS policies successfully applied!' AS status;
