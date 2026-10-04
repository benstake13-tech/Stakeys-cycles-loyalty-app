-- Stakey's Cycles - Prize Wheel persistence fix
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Safe to re-run: tables use IF NOT EXISTS and columns use ADD COLUMN IF NOT EXISTS.
--
-- This is also included in SUPABASE_SQL_SETUP (src/api/supabaseService.ts), which
-- the in-app "Service Status" badge lets staff copy with one click.

-- Prize wheel configuration (segments, ticket cost, active flag)
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

-- Weekly winner draws
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

-- Won vouchers / perks (discounts, merch, service credit)
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

-- Weekly spin cooldown timestamp on profiles (was only ever stored in localStorage)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at TIMESTAMPTZ;

-- PostgREST role privileges (fixes 401 "permission denied for table")
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prize_wheels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prize_draws TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_vouchers TO anon, authenticated;

-- Row Level Security
ALTER TABLE public.prize_wheels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on prize_wheels" ON public.prize_wheels;
CREATE POLICY "Allow all on prize_wheels" ON public.prize_wheels FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on prize_draws" ON public.prize_draws;
CREATE POLICY "Allow all on prize_draws" ON public.prize_draws FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on service_vouchers" ON public.service_vouchers;
CREATE POLICY "Allow all on service_vouchers" ON public.service_vouchers FOR ALL USING (true);

-- Optional: seed the default wheel so the staff editor has something to edit.
-- The app also seeds this automatically on first load if the table is empty.
INSERT INTO public.prize_wheels (id, title, segments, is_active, ticket_cost)
VALUES (
  'wheel-main-01',
  'Stakey''s Weekly Prize Wheel',
  '[{"id":"seg-stamp-1","label":"+1 Loyalty Stamp","color":"#05C147","probability":0.28,"prizeId":"prize-stamp-1","rewardType":"stamp","stampsAmount":1},{"id":"seg-gear-10","label":"£10 Off Gear","color":"#0284c7","probability":0.18,"prizeId":"prize-gear-10","rewardType":"discount","rewardValue":"£10 Off In-Store Accessories"},{"id":"seg-stamp-2","label":"+2 Stamps","color":"#10b981","probability":0.16,"prizeId":"prize-stamp-2","rewardType":"stamp","stampsAmount":2},{"id":"seg-cleaner","label":"Muc-Off Cleaner","color":"#7c3aed","probability":0.12,"prizeId":"prize-cleaner","rewardType":"merch","rewardValue":"Complimentary Muc-Off Bike Cleaner"},{"id":"seg-stamp-3","label":"+3 Stamps Jackpot!","color":"#d97706","probability":0.08,"prizeId":"prize-stamp-3","rewardType":"stamp","stampsAmount":3},{"id":"seg-tube","label":"Free Inner Tube","color":"#0891b2","probability":0.08,"prizeId":"prize-tube","rewardType":"merch","rewardValue":"Free Presta/Schrader Inner Tube at Till"},{"id":"seg-points-50","label":"+50 Store Points","color":"#db2777","probability":0.05,"prizeId":"prize-points-50","rewardType":"points","rewardValue":"50 Bonus Loyalty Points"},{"id":"seg-espresso","label":"Free Workshop Coffee","color":"#ea580c","probability":0.05,"prizeId":"prize-coffee","rewardType":"service","rewardValue":"Free Barista Coffee while bike is serviced"}]'::jsonb,
  TRUE,
  0
)
ON CONFLICT (id) DO NOTHING;
