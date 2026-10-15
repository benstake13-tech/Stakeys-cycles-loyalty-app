export const SHOP_GALLERY_BUCKET = 'shop-gallery';

export interface StorageDiagnosticStep {
  id: 'bucket' | 'staff-write' | 'public-read' | 'cleanup';
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
}

export interface StorageDiagnosticReport {
  steps: StorageDiagnosticStep[];
  passed: boolean;
}

interface StorageBucketLike {
  list: (path: string, options?: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: unknown }>;
  upload: (path: string, body: Blob, options: Record<string, unknown>) => Promise<{ error: unknown }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  remove: (paths: string[]) => Promise<{ error: unknown }>;
}

interface StorageClientLike {
  from: (bucket: string) => StorageBucketLike;
}

const errorMessage = (error: unknown) => {
  const value = error as { message?: string; statusCode?: string | number } | null;
  const code = value?.statusCode ? ` (${value.statusCode})` : '';
  return `${value?.message || 'Storage request failed'}${code}`;
};

/** Checks the app's existing shop-gallery bucket and exercises its real staff/public policies. */
export async function runShopGalleryStorageDiagnostics(
  storage: StorageClientLike | null,
  fetcher: typeof fetch = fetch,
  makeId: () => string = () => crypto.randomUUID()
): Promise<StorageDiagnosticReport> {
  const steps: StorageDiagnosticStep[] = [];
  if (!storage?.from) {
    steps.push({ id: 'bucket', label: 'Supabase Storage', status: 'fail', detail: 'Storage is unavailable in this app build.' });
    return { steps, passed: false };
  }

  const bucket = storage.from(SHOP_GALLERY_BUCKET);
  let listed: { data: unknown[] | null; error: unknown };
  try {
    listed = await bucket.list('test-bench', { limit: 1 });
  } catch (error) {
    steps.push({ id: 'bucket', label: 'shop-gallery bucket', status: 'fail', detail: errorMessage(error) });
    return { steps, passed: false };
  }
  if (listed.error) {
    steps.push({ id: 'bucket', label: 'shop-gallery bucket', status: 'fail', detail: errorMessage(listed.error) });
    return { steps, passed: false };
  }
  steps.push({ id: 'bucket', label: 'shop-gallery bucket', status: 'pass', detail: 'Bucket exists and Storage listing is allowed.' });

  const path = `test-bench/${makeId()}.png`;
  // A valid 1x1 PNG so the bucket's image MIME restriction is tested without
  // uploading any user photo or leaving a durable test object behind.
  const png = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
    0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240, 31,
    0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
  let uploaded = false;
  try {
    const upload = await bucket.upload(path, new Blob([png], { type: 'image/png' }), {
      contentType: 'image/png', upsert: false,
    });
    if (upload.error) {
      steps.push({ id: 'staff-write', label: 'Staff upload policy', status: 'fail', detail: errorMessage(upload.error) });
      return { steps, passed: false };
    }
    uploaded = true;
    steps.push({ id: 'staff-write', label: 'Staff upload policy', status: 'pass', detail: 'A temporary image upload was accepted for the signed-in staff account.' });

    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    const publicResponse = await fetcher(publicUrl, { method: 'GET', cache: 'no-store' });
    if (!publicResponse.ok) {
      steps.push({ id: 'public-read', label: 'Public image delivery', status: 'fail', detail: `Public URL returned HTTP ${publicResponse.status}.` });
    } else {
      steps.push({ id: 'public-read', label: 'Public image delivery', status: 'pass', detail: 'The uploaded test image can be fetched through its public URL.' });
    }
    try { await publicResponse.body?.cancel(); } catch { /* body cleanup does not change the public-read result */ }
  } catch (error) {
    steps.push({
      id: uploaded ? 'public-read' : 'staff-write',
      label: uploaded ? 'Public image delivery' : 'Staff upload policy',
      status: 'fail',
      detail: errorMessage(error),
    });
  } finally {
    if (uploaded) {
      try {
        const removed = await bucket.remove([path]);
        steps.push(removed.error
          ? { id: 'cleanup', label: 'Test file cleanup', status: 'fail', detail: errorMessage(removed.error) }
          : { id: 'cleanup', label: 'Test file cleanup', status: 'pass', detail: 'The temporary test image was deleted.' });
      } catch (error) {
        steps.push({ id: 'cleanup', label: 'Test file cleanup', status: 'fail', detail: errorMessage(error) });
      }
    }
  }
  return { steps, passed: steps.every((step) => step.status === 'pass') };
}

export const SHOP_GALLERY_REPAIR_SQL = `-- Stakey's Cycles — shop/gallery storage setup and repair
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-gallery', 'shop-gallery', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "shop_gallery_public_read" ON storage.objects;
CREATE POLICY "shop_gallery_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'shop-gallery');

DROP POLICY IF EXISTS "shop_gallery_staff_insert" ON storage.objects;
CREATE POLICY "shop_gallery_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-gallery' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id::text = auth.uid()::text AND role IN ('staff', 'admin')
  ));

DROP POLICY IF EXISTS "shop_gallery_staff_update" ON storage.objects;
CREATE POLICY "shop_gallery_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-gallery' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id::text = auth.uid()::text AND role IN ('staff', 'admin')
  )) WITH CHECK (bucket_id = 'shop-gallery' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id::text = auth.uid()::text AND role IN ('staff', 'admin')
  ));

DROP POLICY IF EXISTS "shop_gallery_staff_delete" ON storage.objects;
CREATE POLICY "shop_gallery_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-gallery' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id::text = auth.uid()::text AND role IN ('staff', 'admin')
  ));`;
