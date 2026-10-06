-- Discount code audiences (loyalty members vs website visitors).
-- Idempotent and non-destructive: only adds the column and its constraint.
--
-- Run this once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.
-- Until it is applied the app still works: `upsertDiscountCodeToDb` retries
-- without the `audience` column, so codes save (minus their audience tag).

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS audience text;

-- 'member' = loyalty-member set, 'public' = unregistered website set.
-- NULL / anything else is treated as open to everyone.
ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_audience_check;
ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_audience_check
  CHECK (audience IS NULL OR audience IN ('member', 'public'));

-- Verify
SELECT id, code, title, audience, status
FROM public.discount_codes
ORDER BY created_at DESC
LIMIT 20;

-- Seed the two curated sets. ON CONFLICT DO NOTHING keeps any staff edits.
-- Loyalty member set (better discounts).
INSERT INTO public.discount_codes
  (id, code, title, description, type, value, status, eligible_categories, minimum_spend, audience, created_by)
VALUES
  ('disc-mem-15off',    'MEM-15OFF',    'Members 15% off labour', 'Loyalty member rate on workshop labour.',      'percent', 15, 'active', '["cycle","ebike"]'::jsonb, NULL, 'member', 'Discount set generator'),
  ('disc-mem-20off',    'MEM-20OFF',    'Members 20% off parts',  'Loyalty member rate on second-hand parts.',    'percent', 20, 'active', '[]'::jsonb,                NULL, 'member', 'Discount set generator'),
  ('disc-mem-10credit', 'MEM-10CREDIT', 'Members £10 credit',     '£10 loyalty credit on a £40+ basket.',         'fixed',   10, 'active', '[]'::jsonb,                40,   'member', 'Discount set generator')
ON CONFLICT (id) DO NOTHING;

-- Website visitor set (lighter welcome offers).
INSERT INTO public.discount_codes
  (id, code, title, description, type, value, status, eligible_categories, minimum_spend, audience, created_by)
VALUES
  ('disc-web-5off',    'WEB-5OFF',    'Welcome 5% off',   'First-order welcome offer for website visitors.', 'percent', 5, 'active', '[]'::jsonb, NULL, 'public', 'Discount set generator'),
  ('disc-web-5credit', 'WEB-5CREDIT', 'Welcome £5 off',   '£5 off a £30+ click & collect order.',            'fixed',   5, 'active', '[]'::jsonb, 30,   'public', 'Discount set generator')
ON CONFLICT (id) DO NOTHING;

SELECT audience, count(*) AS codes FROM public.discount_codes GROUP BY audience ORDER BY audience;

-- Store the code a website order redeemed (for reporting). Optional but
-- recommended; the checkout retries without it if the column is absent.
-- Guarded: some projects do not have an ecommerce_orders table yet.
DO $$
BEGIN
  IF to_regclass('public.ecommerce_orders') IS NOT NULL THEN
    ALTER TABLE public.ecommerce_orders ADD COLUMN IF NOT EXISTS discount_code text;
  END IF;
END $$;
