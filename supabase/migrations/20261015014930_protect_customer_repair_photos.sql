-- Photos and repair reports must only be readable by their customer and staff.
-- Keep the existing owner/staff policies; remove legacy rules that bypass them.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_bookings'
      AND policyname IN ('service_bookings_select_owner_or_staff', 'service_bookings_update_owner_or_staff', 'service_bookings_insert_owner_or_staff', 'service_bookings_delete_staff_admin')) <> 4 THEN
    RAISE EXCEPTION 'Owner/staff booking policies must exist before removing legacy access';
  END IF;
END $$;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Allow public select service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Allow public update service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Allow public insert service_bookings" ON public.service_bookings;
DROP POLICY IF EXISTS service_bookings_insert_guest ON public.service_bookings;
CREATE POLICY service_bookings_insert_guest ON public.service_bookings
  FOR INSERT TO anon WITH CHECK (customer_id IS NULL);
