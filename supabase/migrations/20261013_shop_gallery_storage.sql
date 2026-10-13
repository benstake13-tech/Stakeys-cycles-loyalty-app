-- Run in Supabase SQL Editor to provision a public shop/gallery image bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('shop-gallery','shop-gallery',true,10485760,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "shop_gallery_public_read" ON storage.objects;
CREATE POLICY "shop_gallery_public_read" ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='shop-gallery');
DROP POLICY IF EXISTS "shop_gallery_staff_insert" ON storage.objects;
CREATE POLICY "shop_gallery_staff_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='shop-gallery' AND EXISTS (SELECT 1 FROM public.profiles WHERE id::text=auth.uid()::text AND role IN ('staff','admin')));
DROP POLICY IF EXISTS "shop_gallery_staff_update" ON storage.objects;
CREATE POLICY "shop_gallery_staff_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='shop-gallery' AND EXISTS (SELECT 1 FROM public.profiles WHERE id::text=auth.uid()::text AND role IN ('staff','admin'))) WITH CHECK (bucket_id='shop-gallery' AND EXISTS (SELECT 1 FROM public.profiles WHERE id::text=auth.uid()::text AND role IN ('staff','admin')));
DROP POLICY IF EXISTS "shop_gallery_staff_delete" ON storage.objects;
CREATE POLICY "shop_gallery_staff_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='shop-gallery' AND EXISTS (SELECT 1 FROM public.profiles WHERE id::text=auth.uid()::text AND role IN ('staff','admin')));
