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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_wheels ENABLE ROW LEVEL SECURITY;

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
`;
