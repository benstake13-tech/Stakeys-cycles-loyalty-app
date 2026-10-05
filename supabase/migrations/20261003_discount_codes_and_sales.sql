-- ============================================================================
-- Stakey's Cycles — Discount Codes & Counter Sales
-- ============================================================================
-- Run this in the Supabase SQL Editor (or `supabase db push`) to enable the
-- discount-code system and the counter-sale (till) history.
--
-- Lifecycle:
--   1. Staff create a discount code in Staff Portal → Discount Codes.
--   2. The code is upserted into `discount_codes` and becomes scannable.
--   3. At the till, scanning the code (or a member barcode) auto-applies the
--      discount; the basket total is recalculated before payment.
--   4. Completing the sale writes a row to `counter_sales` and bumps
--      `discount_codes.times_used`.
-- ============================================================================

-- 1. Discount codes -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'percent',          -- 'percent' | 'fixed'
  value NUMERIC DEFAULT 0,              -- percent (0-100) or £ amount
  status TEXT DEFAULT 'active',         -- 'active' | 'disabled' | 'expired'
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,                  -- NULL = unlimited
  times_used INTEGER DEFAULT 0,
  assigned_to_uid TEXT,                 -- NULL = open to all customers
  assigned_to_membership TEXT,
  assigned_to_name TEXT,
  eligible_categories JSONB DEFAULT '[]'::jsonb,  -- [] = all categories
  minimum_spend NUMERIC,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive uniqueness so 'stk-10' and 'STK-10' can't both exist.
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_unique
  ON public.discount_codes (UPPER(code));

-- 2. Counter sales ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counter_sales (
  id TEXT PRIMARY KEY,
  sale_number TEXT,
  customer_id TEXT,
  membership_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL,                 -- array of SaleLineItem
  subtotal NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  discount_code TEXT,
  discount_label TEXT,
  grand_total NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'unpaid', -- 'card' | 'cash' | 'online' | 'unpaid'
  staff_uid TEXT,
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS counter_sales_created_at_idx
  ON public.counter_sales (created_at DESC);

-- 3. Grants (matching the rest of this project's anon-key access model) --------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.counter_sales TO anon, authenticated;

-- 4. Row Level Security -------------------------------------------------------
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on discount_codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Allow all on counter_sales" ON public.counter_sales;
CREATE POLICY "Allow all on discount_codes" ON public.discount_codes FOR ALL USING (true);
CREATE POLICY "Allow all on counter_sales" ON public.counter_sales FOR ALL USING (true);

-- 5. Realtime (optional — the app also polls every 4s) ------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discount_codes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discount_codes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'counter_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.counter_sales;
  END IF;
END $$;
