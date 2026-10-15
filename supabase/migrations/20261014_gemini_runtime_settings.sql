-- Shared Gemini model and intended API tier for every app feature.
-- This table contains no API credentials. Google billing remains controlled by
-- the Google Cloud project associated with the server-side GEMINI_API_KEY.
CREATE TABLE IF NOT EXISTS public.gemini_runtime_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gemini_runtime_settings_model_allowed CHECK (
    model IN ('gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-4-argon')
  ),
  CONSTRAINT gemini_runtime_settings_free_model CHECK (
    tier = 'paid' OR model <> 'gemini-4-argon'
  )
);

INSERT INTO public.gemini_runtime_settings (id, model, tier)
VALUES (TRUE, 'gemini-3.8-flash', 'free')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.gemini_runtime_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gemini_runtime_settings TO anon, authenticated;
GRANT UPDATE ON public.gemini_runtime_settings TO authenticated;

DROP POLICY IF EXISTS gemini_runtime_settings_read ON public.gemini_runtime_settings;
CREATE POLICY gemini_runtime_settings_read ON public.gemini_runtime_settings
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS gemini_runtime_settings_staff_update ON public.gemini_runtime_settings;
CREATE POLICY gemini_runtime_settings_staff_update ON public.gemini_runtime_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = auth.uid()::text AND p.role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = auth.uid()::text AND p.role IN ('staff', 'admin')
  ));

COMMENT ON TABLE public.gemini_runtime_settings IS
  'Non-secret shared Gemini model and intended tier selection; billing is determined by the Google project attached to GEMINI_API_KEY.';
