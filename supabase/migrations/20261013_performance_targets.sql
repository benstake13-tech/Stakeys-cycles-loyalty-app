-- Staff growth scorecard target settings shared between workshop devices.
-- Apply once in the Supabase SQL Editor (or with supabase db push).
-- Only authenticated staff/admin may read or change targets; customers cannot.
-- Counts/progress are calculated live from existing app data and are NOT stored.
CREATE TABLE IF NOT EXISTS public.performance_targets (
  metric_key text PRIMARY KEY CHECK (metric_key IN (
    'requests7d', 'phone7d', 'callConversionPct', 'activeRiders'
  )),
  target_value integer NOT NULL CHECK (target_value BETWEEN 1 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Percentage goals never exceed 100%.
ALTER TABLE public.performance_targets
  DROP CONSTRAINT IF EXISTS performance_targets_pct_range;
ALTER TABLE public.performance_targets
  ADD CONSTRAINT performance_targets_pct_range
    CHECK (metric_key <> 'callConversionPct' OR target_value <= 100);

INSERT INTO public.performance_targets (metric_key, target_value) VALUES
  ('requests7d', 12),
  ('phone7d', 4),
  ('callConversionPct', 70),
  ('activeRiders', 50)
ON CONFLICT (metric_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_manage_performance_targets()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id::text=auth.uid()::text AND role IN ('staff','admin')
    ), false
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_performance_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_performance_targets() TO authenticated;

ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_targets_staff_read" ON public.performance_targets;
CREATE POLICY "performance_targets_staff_read" ON public.performance_targets
  FOR SELECT TO authenticated
  USING (public.can_manage_performance_targets());

DROP POLICY IF EXISTS "performance_targets_staff_insert" ON public.performance_targets;
CREATE POLICY "performance_targets_staff_insert" ON public.performance_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_performance_targets());

DROP POLICY IF EXISTS "performance_targets_staff_update" ON public.performance_targets;
CREATE POLICY "performance_targets_staff_update" ON public.performance_targets
  FOR UPDATE TO authenticated
  USING (public.can_manage_performance_targets())
  WITH CHECK (public.can_manage_performance_targets());

REVOKE ALL ON public.performance_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.performance_targets TO authenticated;

-- Smoke check after applying:
-- SELECT metric_key, target_value, updated_at FROM public.performance_targets ORDER BY metric_key;
