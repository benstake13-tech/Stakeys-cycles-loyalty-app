-- ============================================================================
-- STAKEY'S CYCLES & SCOOTER - SUPABASE DATABASE SCHEMA & RLS SETUP
-- Run this SQL in your Supabase SQL Editor to ensure full cross-device connectivity
-- ============================================================================

-- 1. PROFILES TABLE (Customers & Staff)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  membership_number TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  stamps INTEGER DEFAULT 0,
  completed_cards INTEGER DEFAULT 0,
  merit_points INTEGER DEFAULT 0,
  last_spin_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. CUSTOMER BIKES TABLE (Garage)
CREATE TABLE IF NOT EXISTS public.customer_bikes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  serial_number TEXT,
  category TEXT DEFAULT 'cycle',
  stock_specs_scraped BOOLEAN DEFAULT false,
  scraped_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. SERVICE BOOKINGS TABLE (Workshop Appointments)
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  membership_number TEXT,
  service_id TEXT NOT NULL,
  service_title TEXT NOT NULL,
  service_price NUMERIC(10,2) DEFAULT 0,
  vehicle_type TEXT DEFAULT 'cycle',
  vehicle_model TEXT,
  preferred_date TEXT NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  approval_status TEXT DEFAULT 'pending_approval',
  approved_at TEXT,
  approved_by TEXT,
  decline_reason TEXT,
  staff_notes TEXT,
  reminder_24h_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. STAMP LOGS TABLE (Visit Stamp Audit Trail)
CREATE TABLE IF NOT EXISTS public.stamp_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  membership_number TEXT,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  action TEXT NOT NULL,
  stamps_before INTEGER,
  stamps_after INTEGER,
  reward_id TEXT,
  note TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Restrict access to authenticated owners and server-authorized staff.
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
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

-- Staff access must be granted in auth.users app_metadata by a trusted server/admin,
-- never via a client-editable profile role.
CREATE POLICY "Customer read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));
CREATE POLICY "Customer create own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text AND role = 'customer');
CREATE POLICY "Customer update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'))
  WITH CHECK (id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));

CREATE POLICY "Customer read own bikes" ON public.customer_bikes FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));
CREATE POLICY "Customer add own bikes" ON public.customer_bikes FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid()::text);
CREATE POLICY "Customer update own bikes" ON public.customer_bikes FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()::text) WITH CHECK (customer_id = auth.uid()::text);
CREATE POLICY "Customer delete own bikes" ON public.customer_bikes FOR DELETE TO authenticated
  USING (customer_id = auth.uid()::text);

CREATE POLICY "Customer read own bookings" ON public.service_bookings FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));
CREATE POLICY "Customer create own bookings" ON public.service_bookings FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid()::text);
CREATE POLICY "Staff update bookings" ON public.service_bookings FOR UPDATE TO authenticated
  USING (auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'))
  WITH CHECK (auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));

CREATE POLICY "Customer read own stamp logs" ON public.stamp_logs FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text OR auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));
CREATE POLICY "Staff create stamp logs" ON public.stamp_logs FOR INSERT TO authenticated
  WITH CHECK (auth.jwt()->'app_metadata'->>'role' IN ('staff','admin'));

-- Enable Realtime publications for instant cross-device sync
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_bikes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_bikes;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_bookings;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stamp_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stamp_logs;
  END IF;
END $$;
