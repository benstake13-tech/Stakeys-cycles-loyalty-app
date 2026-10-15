import { supabase } from '../lib/supabase';

/** Store image bytes separately; published website JSON contains only durable URLs. */
export async function uploadWebsiteImage(file: File, fetcher: typeof fetch = fetch): Promise<string> {
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!extensions[file.type]) throw Error('Choose a JPEG, PNG or WebP image. Export HEIC images as JPEG first.');
  if (!file.size || file.size > 8 * 1024 * 1024) throw Error('Choose an image under 8 MB.');
  const path = `website/${crypto.randomUUID()}.${extensions[file.type]}`;
  const bucket = supabase.storage.from('shop-gallery');
  const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (error) throw Error(`Image upload failed: ${error.message}`);
  const url = bucket.getPublicUrl(path).data.publicUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('The uploaded image is not publicly available yet. Please retry or check gallery storage permissions.');
    try { await response.body?.cancel(); } catch { /* response is already verified */ }
  } finally { clearTimeout(timer); }
  return url;
}
