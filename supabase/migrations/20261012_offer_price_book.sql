-- 20261012_offer_price_book.sql
--
-- Persist the staff "Sell Your Bike" price book and the condition bands on the
-- shared app_settings row (id = 1), so a price staff set in the terminal reaches
-- every customer's valuation instead of living only on the staff device.
--
-- The app already writes/reads these columns best-effort; until they exist the
-- store silently stays local-only. Run this once in the Supabase SQL Editor.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sell_offerbook_json JSONB,
  ADD COLUMN IF NOT EXISTS sell_condition_bands_json JSONB;

-- Ensure the single settings row exists to update.
INSERT INTO public.app_settings (id) SELECT 1
  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);
