-- Adds the missing website document while preserving existing settings/content.
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS website_content_json jsonb;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- The inspected live policy allows anonymous updates to every settings field.
DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Website settings public read" ON public.app_settings;
CREATE POLICY "Website settings public read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Website settings staff update" ON public.app_settings;
CREATE POLICY "Website settings staff update" ON public.app_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = (SELECT auth.uid())::text AND p.role IN ('staff','admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = (SELECT auth.uid())::text AND p.role IN ('staff','admin')));
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
