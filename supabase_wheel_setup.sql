-- ============================================================================
-- STAKEY'S CYCLES - TWO-STAGE BICYCLE PRIZE WHEEL
-- Tables and RPC used by src/components/BicycleWheelModal.jsx.
-- Run in the Supabase SQL Editor after supabase_setup.sql / supabase_secure_rls.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wheel_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stage TEXT NOT NULL CHECK (stage IN ('front', 'rear')),
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#059669',
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight >= 0),
  reward_type TEXT NOT NULL DEFAULT 'merch',
  stamps INTEGER NOT NULL DEFAULT 0,
  is_upgrade BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wheel_rewards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  label TEXT NOT NULL,
  reward_type TEXT,
  stamps_awarded INTEGER NOT NULL DEFAULT 0,
  redeemed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.wheel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wheel config select policy" ON public.wheel_config;
DROP POLICY IF EXISTS "Wheel config staff write policy" ON public.wheel_config;
DROP POLICY IF EXISTS "Wheel rewards select policy" ON public.wheel_rewards;
DROP POLICY IF EXISTS "Wheel rewards insert policy" ON public.wheel_rewards;
DROP POLICY IF EXISTS "Wheel rewards staff update policy" ON public.wheel_rewards;

CREATE POLICY "Wheel config select policy" ON public.wheel_config
  FOR SELECT USING (true);

CREATE POLICY "Wheel config staff write policy" ON public.wheel_config
  FOR ALL USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "Wheel rewards select policy" ON public.wheel_rewards
  FOR SELECT USING (user_id = auth.uid()::text OR public.is_staff_or_admin());

CREATE POLICY "Wheel rewards insert policy" ON public.wheel_rewards
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR public.is_staff_or_admin());

CREATE POLICY "Wheel rewards staff update policy" ON public.wheel_rewards
  FOR UPDATE USING (public.is_staff_or_admin());

CREATE OR REPLACE FUNCTION public.award_wheel_stamps(target_user_id TEXT, stamps_to_add INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_stamps INTEGER;
BEGIN
  IF auth.uid()::text IS DISTINCT FROM target_user_id AND NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Not allowed to award stamps to this user';
  END IF;
  IF stamps_to_add IS NULL OR stamps_to_add < 1 OR stamps_to_add > 3 THEN
    RAISE EXCEPTION 'stamps_to_add must be between 1 and 3';
  END IF;

  UPDATE public.profiles
  SET stamps = LEAST(10, COALESCE(stamps, 0) + stamps_to_add),
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = target_user_id
  RETURNING stamps INTO new_stamps;

  RETURN new_stamps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.award_wheel_stamps(TEXT, INTEGER) TO authenticated;

-- Seed default slices (only when the table is empty)
INSERT INTO public.wheel_config (stage, label, color, weight, reward_type, stamps, is_upgrade, sort_order)
SELECT * FROM (VALUES
  ('front', 'Free Inner Tube',        '#0891b2', 30, 'merch',    0, false, 1),
  ('front', '+1 Loyalty Stamp',       '#059669', 35, 'stamp',    1, false, 2),
  ('front', '+50 Store Merits',       '#db2777', 25, 'merit',    0, false, 3),
  ('front', '➡️ REAR WHEEL UNLOCK!',  '#d97706', 10, 'upgrade',  0, true,  4),
  ('rear',  '+3 Stamps Jackpot!',     '#7c3aed', 40, 'stamp',    3, false, 1),
  ('rear',  '£10 Off In-Store Gear',  '#0284c7', 40, 'discount', 0, false, 2),
  ('rear',  'Free Full Tune-Up',      '#dc2626', 20, 'service',  0, false, 3)
) AS v(stage, label, color, weight, reward_type, stamps, is_upgrade, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.wheel_config);
