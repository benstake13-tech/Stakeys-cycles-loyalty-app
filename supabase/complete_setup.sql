-- ============================================================================
-- Stakey's Cycles & Scooter — COMPLETE Supabase setup / repair script
-- ----------------------------------------------------------------------------
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run.
-- It is fully idempotent: re-running it is safe and changes nothing.
--
-- It does two jobs:
--   (a) creates every table the app needs on a fresh project, and
--   (b) repairs a drifted project (missing columns, uuid-vs-text id mismatches,
--       missing GRANTs, missing RLS policies, missing signup trigger).
--
-- Why the app "reverts to 0": the anon role had no table GRANTs (42501), the
-- profiles table was missing `stamps` (42703), and stamp_logs had uuid-typed id
-- and staff_id while the app writes text ids (22P02). This script fixes all of
-- them so the Prize Wheel and Stamp Card persist.
-- ============================================================================

-- 0. Schema usage. Without this the anon/authenticated roles cannot touch
--    anything in `public` even when the tables are granted. Wrapped so that
--    running this on a plain PostgreSQL (no Supabase roles) does not abort.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    ELSE
      RAISE NOTICE 'role % not found; skipping schema usage grant', r;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- 1a. profiles — one row per customer/staff. id is TEXT (the app uses UUID
--     strings and, for local-only users, readable ids). Linked to auth.users
--     by the signup trigger rather than a FK, so the column type stays text.
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  membership_number TEXT,
  stamps INTEGER DEFAULT 0,
  completed_cards INTEGER DEFAULT 0,
  merit_points INTEGER DEFAULT 0,
  last_spun_at TIMESTAMPTZ,
  last_spin_date TEXT,
  last_stamped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. Stamp / reward audit log. Text ids so the app's "log-<ts>-<n>" fits.
CREATE TABLE IF NOT EXISTS public.stamp_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  membership_number TEXT,
  staff_id TEXT,
  staff_name TEXT,
  action TEXT DEFAULT 'add_stamp',
  stamps_before INTEGER,
  stamps_after INTEGER,
  reward_id TEXT,
  note TEXT,
  user_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 1c. Customer bikes (AI identifiers / workshop history).
CREATE TABLE IF NOT EXISTS public.customer_bikes (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  brand TEXT,
  model TEXT,
  year TEXT,
  color TEXT,
  serial_number TEXT,
  category TEXT DEFAULT 'Bicycle',
  stock_specs_scraped BOOLEAN DEFAULT FALSE,
  scraped_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1d. Workshop bookings.
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  membership_number TEXT,
  service_id TEXT,
  service_title TEXT,
  service_price NUMERIC DEFAULT 0,
  vehicle_type TEXT DEFAULT 'Bicycle',
  vehicle_model TEXT,
  preferred_date TEXT,
  preferred_time_slot TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  notifications JSONB DEFAULT '[]'::jsonb,
  repair_stage TEXT DEFAULT 'received',
  progress_events JSONB DEFAULT '[]'::jsonb,
  estimate_ready_at TEXT,
  invoice JSONB,
  approval_status TEXT DEFAULT 'pending_approval',
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  staff_notes TEXT,
  quoted_price NUMERIC,
  quote_note TEXT,
  quote_sent_at TIMESTAMPTZ,
  quote_sent_by TEXT,
  is_sos BOOLEAN DEFAULT FALSE,
  sos_status TEXT,
  sos_location_requested_at TIMESTAMPTZ,
  sos_location_note TEXT,
  sos_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1e. Prize wheel configuration (staff-editable).
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

-- 1f. Weekly winner draws.
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

-- 1g. Vouchers / prizes a customer has won.
CREATE TABLE IF NOT EXISTS public.service_vouchers (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
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

-- 1h. Staff-created discount codes.
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
  audience TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1i. Refer a Friend. One row per customer; the owner shares `code`/`link`,
-- the referred friends and the £5 rewards they have earned are stored as JSONB.
CREATE TABLE IF NOT EXISTS public.referrals (
  id TEXT PRIMARY KEY,
  owner_uid TEXT,
  owner_name TEXT,
  owner_membership TEXT,
  code TEXT NOT NULL,
  link TEXT,
  times_shared INTEGER DEFAULT 0,
  rewards_earned INTEGER DEFAULT 0,
  rewards JSONB DEFAULT '[]'::jsonb,
  referred_friends JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1j. Completed over-the-counter sales.
CREATE TABLE IF NOT EXISTS public.counter_sales (
  id TEXT PRIMARY KEY,
  sale_number TEXT,
  customer_id TEXT,
  membership_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  discount_code TEXT,
  discount_label TEXT,
  discount_source TEXT,
  grand_total NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'unpaid',
  staff_uid TEXT,
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  quoted_amount NUMERIC,
  quote_note TEXT,
  quote_sent_at TIMESTAMPTZ,
  quote_sent_by TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT
);

-- ============================================================================
-- 2. REPAIR DRIFT — add any column a table is missing (fresh CREATE above is a
--    no-op when the table already exists, so list every column again here).
-- ============================================================================

-- 2a. profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stamps INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_cards INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merit_points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_stamped_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- The app creates a profile at login, before a membership code exists.
ALTER TABLE public.profiles ALTER COLUMN membership_number DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
-- Coerce a uuid-typed id to text if an older project created it that way.
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
EXCEPTION WHEN others THEN RAISE NOTICE 'profiles.id left unchanged: %', SQLERRM; END $$;

-- 2b. stamp_logs
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'add_stamp';
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_before INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS stamps_after INTEGER;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS reward_id TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN staff_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN RAISE NOTICE 'stamp_logs.staff_id does not exist'; END $$;
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN action DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
-- Legacy points-ledger columns. Some projects declared these NOT NULL with
-- CHECKs (amount <> 0, source IN ('visit','wheel')); the app writes amount 0 /
-- source 'visit', so relax the NOT NULLs and drop the CHECKs.
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'visit';
ALTER TABLE public.stamp_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN amount DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN source DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN created_at DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
ALTER TABLE public.stamp_logs DROP CONSTRAINT IF EXISTS stamp_logs_amount_check;
ALTER TABLE public.stamp_logs DROP CONSTRAINT IF EXISTS stamp_logs_source_check;
-- The app writes readable text ids ("log-…", "system-wheel"); uuid columns
-- would reject them with 22P02. Convert in place, preserving existing rows.
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN id TYPE TEXT USING id::text;
EXCEPTION WHEN others THEN RAISE NOTICE 'stamp_logs.id left unchanged: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE public.stamp_logs ALTER COLUMN staff_id TYPE TEXT USING staff_id::text;
EXCEPTION WHEN undefined_column THEN NULL;
         WHEN others THEN RAISE NOTICE 'stamp_logs.staff_id left unchanged: %', SQLERRM; END $$;

-- 2c. customer_bikes
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Bicycle';
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS stock_specs_scraped BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS scraped_data JSONB;
ALTER TABLE public.customer_bikes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2d. service_bookings
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS service_price NUMERIC DEFAULT 0;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Bicycle';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS vehicle_model TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS preferred_date TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS preferred_time_slot TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS repair_stage TEXT DEFAULT 'received';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS progress_events JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS estimate_ready_at TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS invoice JSONB;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS staff_notes TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quoted_price NUMERIC;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_note TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS quote_sent_by TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS is_sos BOOLEAN DEFAULT FALSE;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_status TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_location_requested_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_location_note TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2e. prize_wheels
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS segments JSONB;
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS ticket_cost INTEGER DEFAULT 1;
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.prize_wheels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2f. prize_draws
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS prize_description TEXT;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS draw_date TEXT;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS winner_uid TEXT;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS winner_name TEXT;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.prize_draws ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2g. service_vouchers
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'merch';
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;

-- 2h. discount_codes
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'percent';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS assigned_to_uid TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS assigned_to_membership TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS eligible_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS minimum_spend NUMERIC;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS audience TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2h2. referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS owner_uid TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS owner_membership TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS times_shared INTEGER DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS rewards_earned INTEGER DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_friends JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2i. counter_sales
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS sale_number TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS discount_label TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS discount_source TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'unpaid';
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS staff_uid TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2i-quote. counter_sales quote → approval → completion lifecycle (mirrors bookings)
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS quote_note TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS quote_sent_by TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.counter_sales ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- 2j. app_theme_config — one shared row (id = 1) holding the season theme that
--     every account reads, so a theme applied once applies everywhere.
CREATE TABLE IF NOT EXISTS public.app_theme_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  theme TEXT DEFAULT 'none',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_theme_config ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'none';
ALTER TABLE public.app_theme_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Guarantee the single shared row exists so reads/upserts never 404.
INSERT INTO public.app_theme_config (id, theme)
SELECT 1, 'none'
WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);

-- Some earlier revisions of this table used `active_theme` instead of `theme`.
-- Copy any such value across so an applied seasonal theme is not lost. Guarded
-- because the column will not exist on a project created by this script.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_theme_config' AND column_name = 'active_theme'
  ) THEN
    EXECUTE 'UPDATE public.app_theme_config SET theme = active_theme
             WHERE (theme IS NULL OR theme = ''none'') AND active_theme IS NOT NULL AND active_theme <> ''none''';
  END IF;
END $$;

-- 2k. staff_members — the workshop roster (staff-editable). Rows the app writes
--     survive reloads instead of living only in component state.
CREATE TABLE IF NOT EXISTS public.staff_members (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Mechanic',
  status TEXT DEFAULT 'Active',
  joined_date TEXT,
  certification_level TEXT,
  avatar_color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Mechanic';
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS joined_date TEXT;
-- Rename the legacy certification column, preserving any existing values.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='staff_members' AND column_name='cytech_level')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='staff_members' AND column_name='certification_level') THEN
    ALTER TABLE public.staff_members RENAME COLUMN cytech_level TO certification_level;
  END IF;
END $$;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS certification_level TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2l. promotions — shop promotions managed by staff.
CREATE TABLE IF NOT EXISTS public.promotions (
  id TEXT PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  code TEXT,
  discount_percentage NUMERIC,
  discount_amount NUMERIC,
  badge_text TEXT,
  status TEXT DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  terms_and_conditions JSONB DEFAULT '[]'::jsonb,
  eligible_categories JSONB DEFAULT '[]'::jsonb,
  bg_gradient TEXT,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS badge_text TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS terms_and_conditions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS eligible_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS bg_gradient TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2m. app_settings — one shared row (id = 1) holding workshop-wide settings
--     such as notification recipients and automated reminder state.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  owner_email TEXT,
  owner_phone TEXT,
  email_alerts_enabled BOOLEAN DEFAULT FALSE,
  sms_alerts_enabled BOOLEAN DEFAULT FALSE,
  business_name TEXT,
  automated_reminders_enabled BOOLEAN DEFAULT TRUE,
  reminders_push_only BOOLEAN DEFAULT TRUE,
  reminder_owner_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS sms_alerts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS automated_reminders_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS reminders_push_only BOOLEAN DEFAULT TRUE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS reminder_owner_email TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO public.app_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);

-- ============================================================================
-- 3. GRANTS — without these every read/write fails with 42501.
--    Guarded so a missing optional table can never abort the script.
-- ============================================================================
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'referrals', 'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'anon/authenticated roles not found; skipping table grants';
    RETURN;
  END IF;
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'grants: skipping missing public.%', t;
      CONTINUE;
    END IF;
    -- Each grant is independently guarded: one failing table can never stop the
    -- others (previously a single failure left profiles/customer_bikes/
    -- service_bookings un-granted while newer tables succeeded).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      BEGIN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'grant anon on public.% failed: %', t, SQLERRM;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      BEGIN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'grant authenticated on public.% failed: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY — re-runnable (DROP then CREATE) and skipped for
--    missing tables.
-- ============================================================================
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'referrals', 'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      'Allow all on ' || t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 5. AUTO-CREATE A PROFILE FOR EVERY NEW AUTH USER
--    (so a fresh signup can log in immediately), plus backfill for existing
--    auth users that have no profile row.
-- ============================================================================
DO $outer$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found; skipping signup trigger + backfill';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $body$
    BEGIN
      INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
      VALUES (
        new.id::text,
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
    $body$;
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users';
  EXECUTE 'CREATE TRIGGER on_auth_user_created_loyalty
           AFTER INSERT ON auth.users
           FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user()';

  -- Backfill any existing auth user without a profile.
  EXECUTE $bf$
    INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)
    SELECT
      u.id::text,
      u.email,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'display_name',
        split_part(u.email, '@', 1),
        'Stakey Rider'
      ),
      'customer', 0, 0, 0
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id::text
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;
  $bf$;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'signup trigger/backfill skipped: %', SQLERRM;
END $outer$;

-- ============================================================================
-- 6. SEED THE DEFAULT PRIZE WHEEL (only when the table is empty)
-- ============================================================================
INSERT INTO public.prize_wheels (id, title, description, segments, is_active, ticket_cost)
SELECT
  'wheel-main-01',
  'Stakey''s Weekly Prize Wheel',
  'Spin once a week for a chance to win loyalty stamps, merch and service rewards.',
  '[
    {"id":"seg-stamp-1","label":"+1 Loyalty Stamp","color":"#05C147","probability":0.28,"prizeId":"prize-stamp-1","rewardType":"stamp","stampsAmount":1},
    {"id":"seg-gear-10","label":"£10 Off Gear","color":"#0284c7","probability":0.18,"prizeId":"prize-gear-10","rewardType":"discount","rewardValue":"£10 Off In-Store Accessories"},
    {"id":"seg-stamp-2","label":"+2 Stamps","color":"#10b981","probability":0.16,"prizeId":"prize-stamp-2","rewardType":"stamp","stampsAmount":2},
    {"id":"seg-cleaner","label":"Muc-Off Cleaner","color":"#7c3aed","probability":0.12,"prizeId":"prize-cleaner","rewardType":"merch","rewardValue":"Complimentary Muc-Off Bike Cleaner"},
    {"id":"seg-stamp-3","label":"+3 Stamps Jackpot!","color":"#d97706","probability":0.08,"prizeId":"prize-stamp-3","rewardType":"stamp","stampsAmount":3},
    {"id":"seg-tube","label":"Free Inner Tube","color":"#0891b2","probability":0.08,"prizeId":"prize-tube","rewardType":"merch","rewardValue":"Free Presta/Schrader Inner Tube at Till"},
    {"id":"seg-points-50","label":"+50 Store Points","color":"#db2777","probability":0.05,"prizeId":"prize-points-50","rewardType":"points","rewardValue":"50 Bonus Loyalty Points"},
    {"id":"seg-espresso","label":"Free Workshop Coffee","color":"#ea580c","probability":0.05,"prizeId":"prize-coffee","rewardType":"service","rewardValue":"Free Coffee while bike is serviced"}
  ]'::jsonb,
  TRUE,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.prize_wheels);

-- ============================================================================
-- 7. REALTIME — let the app receive live updates (guard against a missing
--    publication on plain Postgres).
-- ============================================================================
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'profiles', 'stamp_logs', 'customer_bikes', 'service_bookings',
    'prize_wheels', 'prize_draws', 'service_vouchers', 'discount_codes', 'counter_sales',
    'referrals', 'app_theme_config', 'staff_members', 'promotions', 'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication not found; skipped';
      WHEN others THEN RAISE NOTICE 'realtime add skipped for %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
