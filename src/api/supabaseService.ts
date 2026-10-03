import { getSupabaseClient, getStoredSupabaseUrl, getStoredSupabaseAnonKey, saveSupabaseConfig } from '../supabase';
import { UserProfile, CustomerBike, ServiceBooking, StampLog, PrizeWheel, PrizeDraw } from '../types/bikeShop';

export interface SupabaseHealthStatus {
  isConfigured: boolean;
  isOnline: boolean;
  url: string;
  hasAnonKey: boolean;
  latencyMs?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  checkedAt: string;
}

export async function checkSupabaseHealth(customUrl?: string, customAnonKey?: string): Promise<SupabaseHealthStatus> {
  const url = (customUrl || getStoredSupabaseUrl()).replace(/\/+$/, '');
  const anonKey = customAnonKey !== undefined ? customAnonKey.trim() : getStoredSupabaseAnonKey();

  if (!anonKey) {
    return {
      isConfigured: false,
      isOnline: false,
      url,
      hasAnonKey: false,
      error: 'Supabase URL is linked, but Anon Public API Key is required.',
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }

  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Verify Anon Key against Supabase Auth gateway
    const res = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok || res.status === 200) {
      // Check if schema tables are initialized
      let schemaNote = '';
      try {
        const tableCheck = await fetch(`${url}/rest/v1/profiles?select=count`, {
          method: 'GET',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });
        if (tableCheck.status === 404) {
          schemaNote = ' (Tables pending setup: run SQL script in Supabase SQL Editor)';
        } else if (tableCheck.ok) {
          schemaNote = ' (Database tables ready)';
        }
      } catch {}

      return {
        isConfigured: true,
        isOnline: true,
        url,
        hasAnonKey: true,
        latencyMs,
        statusCode: res.status,
        message: `Supabase Cloud is ONLINE & authenticated (${latencyMs}ms)${schemaNote}`,
        checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    }

    let errDetail = `HTTP ${res.status}: ${res.statusText}`;
    if (res.status === 401) {
      errDetail = 'Invalid Anon API Key. Please verify your Project API Key from Supabase Settings -> API.';
    }

    return {
      isConfigured: true,
      isOnline: false,
      url,
      hasAnonKey: true,
      latencyMs,
      statusCode: res.status,
      error: errDetail,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      isConfigured: true,
      isOnline: false,
      url,
      hasAnonKey: true,
      latencyMs,
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot reach Supabase host'),
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}

export const SUPABASE_SQL_SETUP = `-- STAKEY'S CYCLES & SCOOTER - SUPABASE DATABASE SCHEMA
-- Paste this script into Supabase SQL Editor and click "Run" to configure all tables

-- 1. Create Profiles Table (Synced with Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  membership_number TEXT UNIQUE,
  stamps INTEGER DEFAULT 0,
  completed_cards INTEGER DEFAULT 0,
  merit_points INTEGER DEFAULT 0,
  last_spin_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Customer Bikes Table
CREATE TABLE IF NOT EXISTS public.customer_bikes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year TEXT,
  color TEXT,
  serial_number TEXT,
  category TEXT DEFAULT 'Bicycle',
  stock_specs_scraped BOOLEAN DEFAULT FALSE,
  scraped_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Workshop Bookings Table
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  membership_number TEXT,
  service_id TEXT NOT NULL,
  service_title TEXT NOT NULL,
  service_price NUMERIC DEFAULT 0,
  vehicle_type TEXT DEFAULT 'Bicycle',
  vehicle_model TEXT,
  preferred_date TEXT NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Stamp & Reward Audit Logs Table
CREATE TABLE IF NOT EXISTS public.stamp_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  membership_number TEXT,
  staff_id TEXT,
  staff_name TEXT,
  action TEXT NOT NULL,
  stamps_before INTEGER,
  stamps_after INTEGER,
  reward_id TEXT,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Prize Wheels Table
CREATE TABLE IF NOT EXISTS public.prize_wheels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  segments JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  ticket_cost INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5a. Create Prize Draws Table (weekly winner draws)
CREATE TABLE IF NOT EXISTS public.prize_draws (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prize_description TEXT,
  draw_date TEXT,
  status TEXT DEFAULT 'upcoming',
  winner_uid TEXT,
  winner_name TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5b. Create Service Vouchers / rewards table
CREATE TABLE IF NOT EXISTS public.service_vouchers (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC DEFAULT 0,
  type TEXT DEFAULT 'merch',
  terms TEXT,
  status TEXT DEFAULT 'available',
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ
);

-- 5c. Create Discount Codes table (staff-managed till discounts)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'percent',
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  assigned_to_uid TEXT,
  assigned_to_membership TEXT,
  assigned_to_name TEXT,
  eligible_categories JSONB DEFAULT '[]'::jsonb,
  minimum_spend NUMERIC,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5d. Create Counter Sales table (completed over-the-counter till sales)
CREATE TABLE IF NOT EXISTS public.counter_sales (
  id TEXT PRIMARY KEY,
  sale_number TEXT,
  customer_id TEXT,
  membership_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  discount_code TEXT,
  discount_label TEXT,
  grand_total NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'unpaid',
  staff_uid TEXT,
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5e. Give existing profiles the columns newer builds expect (safe on re-run)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_stamped_at TIMESTAMPTZ;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;

-- 5f. Add the columns the app writes to stamp_logs (older projects only had a
-- subset, which silently broke the audit trail / stamp card history).
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'add_stamp';
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_before INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_after INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS reward_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.stamp_logs ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE public.stamp_logs ALTER COLUMN action DROP NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.stamp_logs TO anon, authenticated;

-- 5g. Keep profiles.membership_number nullable (the app creates a profile the
-- moment a customer logs in, before a membership code has been minted).
ALTER TABLE public.profiles ALTER COLUMN membership_number DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- 5h. Auto-create a profile whenever an auth user is created (idempotent).
CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Stakey Rider'),
    'customer',
    0, 0, 0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users;
CREATE TRIGGER on_auth_user_created_loyalty
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user();

GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prize_wheels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prize_draws TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_vouchers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.counter_sales TO anon, authenticated;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_wheels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_sales ENABLE ROW LEVEL SECURITY;

-- 7. Public Read & Write Policies for Shop Staff & Registered Customers
CREATE POLICY "Allow public read on profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow read on bikes" ON public.customer_bikes FOR SELECT USING (true);
CREATE POLICY "Allow insert on bikes" ON public.customer_bikes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on bikes" ON public.customer_bikes FOR UPDATE USING (true);
CREATE POLICY "Allow delete on bikes" ON public.customer_bikes FOR DELETE USING (true);

CREATE POLICY "Allow read on bookings" ON public.service_bookings FOR SELECT USING (true);
CREATE POLICY "Allow insert on bookings" ON public.service_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on bookings" ON public.service_bookings FOR UPDATE USING (true);

CREATE POLICY "Allow all on stamp_logs" ON public.stamp_logs FOR ALL USING (true);
CREATE POLICY "Allow all on prize_wheels" ON public.prize_wheels FOR ALL USING (true);
CREATE POLICY "Allow all on prize_draws" ON public.prize_draws FOR ALL USING (true);
CREATE POLICY "Allow all on service_vouchers" ON public.service_vouchers FOR ALL USING (true);
CREATE POLICY "Allow all on discount_codes" ON public.discount_codes FOR ALL USING (true);
CREATE POLICY "Allow all on counter_sales" ON public.counter_sales FOR ALL USING (true);
`;
