import { getSupabaseClient } from '../supabase';

export const PUBLIC_IMAGE_BUCKET = 'stakeys-images';
export const PRIVATE_IMAGE_BUCKET = 'stakeys-private';

export type ImageCategory = 'branding' | 'products' | 'services' | 'website' | 'staff' | 'bikes';
export type StoredImage = { id: string; bucket_name: string; storage_path: string; image_category: string; related_entity_id: string | null; alt_text: string | null; uploaded_by: string | null };

function client() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function extension(file: File) {
  const types: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
  const ext = types[file.type];
  if (!ext) throw new Error('Unsupported image format');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image exceeds 10 MB');
  return ext;
}

/** Public assets only. Never pass private paths to this function. */
export function publicImageUrl(path: string): string {
  return client().storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadPublicImage(file: File, category: Exclude<ImageCategory,'bikes'>, altText = '', entityId?: string): Promise<StoredImage> {
  const db = client();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new Error('Sign in to upload images');
  const path = `${category}/${crypto.randomUUID()}.${extension(file)}`;
  const uploaded = await db.storage.from(PUBLIC_IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw uploaded.error;
  const { data, error } = await db.from('app_images').insert({
    bucket_name: PUBLIC_IMAGE_BUCKET, storage_path: path, image_category: category,
    related_entity_id: entityId ?? null, alt_text: altText, uploaded_by: user.id,
  }).select('*').single();
  if (error) {
    await db.storage.from(PUBLIC_IMAGE_BUCKET).remove([path]);
    throw error;
  }
  return data as StoredImage;
}

export async function uploadPrivateBikeImage(file: File, bikeId: string, altText = ''): Promise<StoredImage> {
  const db = client();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new Error('Sign in to upload bike photos');
  const path = `${user.id}/bikes/${crypto.randomUUID()}.${extension(file)}`;
  const uploaded = await db.storage.from(PRIVATE_IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw uploaded.error;
  const { data, error } = await db.from('app_images').insert({
    bucket_name: PRIVATE_IMAGE_BUCKET, storage_path: path, image_category: 'bikes',
    related_entity_id: bikeId, alt_text: altText, uploaded_by: user.id,
  }).select('*').single();
  if (error) {
    await db.storage.from(PRIVATE_IMAGE_BUCKET).remove([path]);
    throw error;
  }
  return data as StoredImage;
}

export async function privateImageSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await client().storage.from(PRIVATE_IMAGE_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function listImages(category: ImageCategory, entityId?: string): Promise<StoredImage[]> {
  let query = client().from('app_images').select('*').eq('image_category', category);
  if (entityId) query = query.eq('related_entity_id', entityId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StoredImage[];
}

/** Resolve the current official logo stored at branding/official-logo.png. */
export function officialLogoUrl(): string {
  return publicImageUrl('branding/official-logo.png');
}
