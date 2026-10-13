-- Apply in Supabase SQL Editor. Reporting ledger is not automatically populated:
-- app must record completed paid sales/repairs and free services exactly once.
CREATE TABLE IF NOT EXISTS public.business_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_date timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('retail_sales','bike_repairs','ebike_repairs','scooter_repairs','servicing','diagnostics','bike_builds','accessories','other_paid_services','free_services')),
  service_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_free boolean NOT NULL DEFAULT false,
  revenue_gbp numeric(12,2) NOT NULL DEFAULT 0 CHECK (revenue_gbp >= 0),
  cost_gbp numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_gbp >= 0),
  estimated_free_value_gbp numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_free_value_gbp >= 0),
  minutes_spent integer NOT NULL DEFAULT 0 CHECK (minutes_spent >= 0),
  people_helped integer NOT NULL DEFAULT 0 CHECK (people_helped >= 0),
  source_type text,
  source_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_free AND category='free_services' AND revenue_gbp=0) OR
         (NOT is_free AND category<>'free_services' AND estimated_free_value_gbp=0)),
  CHECK ((source_type IS NULL AND source_id IS NULL) OR (source_type IS NOT NULL AND source_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS business_activity_source_unique ON public.business_activity(source_type,source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_activity_date_idx ON public.business_activity(activity_date DESC);
CREATE TABLE IF NOT EXISTS public.business_kpi_targets (
  target_month date NOT NULL,
  metric_key text NOT NULL CHECK (metric_key IN ('revenue_gbp','profit_gbp','retail_sales_gbp','repair_revenue_gbp','service_revenue_gbp','repair_jobs','free_services','people_helped','community_value_gbp')),
  target_value numeric(12,2) NOT NULL CHECK (target_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_month,metric_key),
  CHECK (target_month=date_trunc('month',target_month::timestamp)::date)
);
CREATE OR REPLACE FUNCTION public.can_manage_business_kpis()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id::text=auth.uid()::text AND role IN ('staff','admin'));
$$;
REVOKE ALL ON FUNCTION public.can_manage_business_kpis() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business_kpis() TO authenticated;
ALTER TABLE public.business_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_kpi_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_activity_staff_access ON public.business_activity;
CREATE POLICY business_activity_staff_access ON public.business_activity FOR ALL TO authenticated
  USING (public.can_manage_business_kpis()) WITH CHECK (public.can_manage_business_kpis());
DROP POLICY IF EXISTS business_targets_staff_access ON public.business_kpi_targets;
CREATE POLICY business_targets_staff_access ON public.business_kpi_targets FOR ALL TO authenticated
  USING (public.can_manage_business_kpis()) WITH CHECK (public.can_manage_business_kpis());
REVOKE ALL ON public.business_activity,public.business_kpi_targets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_activity,public.business_kpi_targets TO authenticated;
CREATE OR REPLACE VIEW public.business_monthly_summary WITH (security_invoker=true) AS
WITH aggregate AS (
  SELECT date_trunc('month',activity_date)::date AS month,
    SUM(revenue_gbp) AS revenue_gbp,
    SUM(revenue_gbp-cost_gbp) AS profit_gbp,
    SUM(revenue_gbp) FILTER (WHERE category IN ('retail_sales','accessories')) AS retail_sales_gbp,
    SUM(revenue_gbp) FILTER (WHERE category IN ('bike_repairs','ebike_repairs','scooter_repairs')) AS repair_revenue_gbp,
    SUM(revenue_gbp) FILTER (WHERE category IN ('servicing','diagnostics','bike_builds','other_paid_services')) AS service_revenue_gbp,
    SUM(quantity) FILTER (WHERE category IN ('bike_repairs','ebike_repairs','scooter_repairs')) AS repair_jobs,
    SUM(quantity) FILTER (WHERE is_free) AS free_services,
    SUM(people_helped) FILTER (WHERE is_free) AS people_helped,
    SUM(estimated_free_value_gbp) FILTER (WHERE is_free) AS community_value_gbp
  FROM public.business_activity GROUP BY 1
), months AS (
  SELECT generate_series(
    date_trunc('month',LEAST(COALESCE((SELECT MIN(month) FROM aggregate),current_date),current_date)::timestamp),
    date_trunc('month',current_date)::timestamp,interval '1 month')::date AS month
)
SELECT months.month,
  COALESCE(a.revenue_gbp,0)::numeric(12,2) AS revenue_gbp,
  COALESCE(a.profit_gbp,0)::numeric(12,2) AS profit_gbp,
  COALESCE(a.retail_sales_gbp,0)::numeric(12,2) AS retail_sales_gbp,
  COALESCE(a.repair_revenue_gbp,0)::numeric(12,2) AS repair_revenue_gbp,
  COALESCE(a.service_revenue_gbp,0)::numeric(12,2) AS service_revenue_gbp,
  COALESCE(a.repair_jobs,0)::bigint AS repair_jobs,
  COALESCE(a.free_services,0)::bigint AS free_services,
  COALESCE(a.people_helped,0)::bigint AS people_helped,
  COALESCE(a.community_value_gbp,0)::numeric(12,2) AS community_value_gbp
FROM months LEFT JOIN aggregate a USING(month);
REVOKE ALL ON public.business_monthly_summary FROM PUBLIC,anon;
GRANT SELECT ON public.business_monthly_summary TO authenticated;
INSERT INTO public.business_kpi_targets(target_month,metric_key,target_value)
VALUES
(date_trunc('month',now())::date,'revenue_gbp',5000),
(date_trunc('month',now())::date,'profit_gbp',2500),
(date_trunc('month',now())::date,'retail_sales_gbp',1500),
(date_trunc('month',now())::date,'repair_revenue_gbp',2500),
(date_trunc('month',now())::date,'service_revenue_gbp',1000),
(date_trunc('month',now())::date,'repair_jobs',50),
(date_trunc('month',now())::date,'free_services',20),
(date_trunc('month',now())::date,'people_helped',20),
(date_trunc('month',now())::date,'community_value_gbp',300)
ON CONFLICT DO NOTHING;
