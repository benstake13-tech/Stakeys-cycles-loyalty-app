-- Expand the staff growth scorecard with customer acquisition and sales goals.
-- Actuals remain calculated from existing app records and are never stored here.
ALTER TABLE public.performance_targets
  DROP CONSTRAINT IF EXISTS performance_targets_metric_key_check;
ALTER TABLE public.performance_targets
  ADD CONSTRAINT performance_targets_metric_key_check CHECK (metric_key IN (
    'requests7d', 'phone7d', 'callConversionPct', 'activeRiders',
    'signups30d', 'sales30dPounds', 'transactions30d', 'repeatCustomers'
  ));

ALTER TABLE public.performance_targets
  DROP CONSTRAINT IF EXISTS performance_targets_target_value_check;
ALTER TABLE public.performance_targets
  ADD CONSTRAINT performance_targets_target_value_check
    CHECK (target_value BETWEEN 1 AND 100000000);

INSERT INTO public.performance_targets (metric_key, target_value) VALUES
  ('signups30d', 20),
  ('sales30dPounds', 5000),
  ('transactions30d', 40),
  ('repeatCustomers', 10)
ON CONFLICT (metric_key) DO NOTHING;

ALTER TABLE public.performance_targets
  DROP CONSTRAINT IF EXISTS performance_targets_pct_range;
ALTER TABLE public.performance_targets
  ADD CONSTRAINT performance_targets_pct_range
    CHECK (metric_key <> 'callConversionPct' OR target_value <= 100);
