/**
 * Stakey's Cycles - Promotions Cloud Sync Service
 * Persists the staff Promotions Manager to the shared Supabase `promotions`
 * table so the public website picks up changes automatically.
 */
import { getSupabaseClient } from '../lib/supabase';
import { ShopPromotion, VehicleCategory } from '../types/bikeShop';

const TABLE = 'promotions';

const SELECT =
  'id,title,subtitle,code,badge_text,status,start_date,end_date,discount_percentage,discount_amount,terms_and_conditions,eligible_categories,bg_gradient,featured';

function mapRowToPromotion(row: any): ShopPromotion {
  return {
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    code: row.code || '',
    discountPercentage: row.discount_percentage ?? undefined,
    discountAmount: row.discount_amount ?? undefined,
    badgeText: row.badge_text || '',
    status: (row.status as ShopPromotion['status']) || 'active',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    termsAndConditions: Array.isArray(row.terms_and_conditions) ? row.terms_and_conditions : [],
    eligibleCategories: (Array.isArray(row.eligible_categories)
      ? row.eligible_categories
      : []) as VehicleCategory[],
    bgGradient: row.bg_gradient || '',
    featured: Boolean(row.featured),
  };
}

function toPayload(promo: ShopPromotion) {
  return {
    id: promo.id,
    title: promo.title,
    subtitle: promo.subtitle,
    code: promo.code,
    badge_text: promo.badgeText,
    status: promo.status,
    start_date: promo.startDate || null,
    end_date: promo.endDate || null,
    discount_percentage: promo.discountPercentage ?? null,
    discount_amount: promo.discountAmount ?? null,
    terms_and_conditions: promo.termsAndConditions || [],
    eligible_categories: promo.eligibleCategories || [],
    bg_gradient: promo.bgGradient,
    featured: Boolean(promo.featured),
  };
}

export async function fetchPromotionsFromDb(): Promise<ShopPromotion[]> {
  const supabase = getSupabaseClient();
  console.log('[SUPABASE NET] SELECT promotions');
  try {
    const { data, error } = await supabase.from(TABLE).select(SELECT).order('start_date', {
      ascending: false,
    });
    if (error) {
      console.error('[SUPABASE NET ERROR] SELECT promotions failed:', error.message);
      return [];
    }
    console.log(`[SUPABASE NET SUCCESS] SELECT promotions returned ${data?.length || 0} rows`);
    return (data || []).map(mapRowToPromotion);
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] fetchPromotionsFromDb:', err);
    return [];
  }
}

export async function upsertPromotionToDb(promo: ShopPromotion): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] UPSERT promotions id=${promo.id}`);
  try {
    const { error } = await supabase.from(TABLE).upsert(toPayload(promo), { onConflict: 'id' });
    if (error) {
      console.error('[SUPABASE NET ERROR] UPSERT promotions failed:', error.message);
      return false;
    }
    console.log(`[SUPABASE NET SUCCESS] UPSERT promotions id=${promo.id}`);
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] upsertPromotionToDb:', err);
    return false;
  }
}

export async function deletePromotionFromDb(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] DELETE promotions id=${id}`);
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      console.error('[SUPABASE NET ERROR] DELETE promotions failed:', error.message);
      return false;
    }
    console.log(`[SUPABASE NET SUCCESS] DELETE promotions id=${id}`);
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] deletePromotionFromDb:', err);
    return false;
  }
}

/**
 * Push local promotions to the cloud, deleting rows the staff removed. Used
 * once to publish any promotions created before cloud sync existed.
 */
export async function syncPromotionsToDb(promos: ShopPromotion[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log(`[SUPABASE NET] SYNC promotions (${promos.length} local)`);
  try {
    const { data, error } = await supabase.from(TABLE).select('id');
    if (error) {
      console.error('[SUPABASE NET ERROR] SYNC promotions read failed:', error.message);
      return false;
    }
    const remoteIds: string[] = (data || []).map((r: any) => r.id);
    const localIds = new Set(promos.map((p) => p.id));
    const staleIds = remoteIds.filter((id) => !localIds.has(id));

    for (const promo of promos) {
      const ok = await upsertPromotionToDb(promo);
      if (!ok) return false;
    }
    for (const id of staleIds) {
      await deletePromotionFromDb(id);
    }
    console.log(`[SUPABASE NET SUCCESS] SYNC promotions complete (removed ${staleIds.length})`);
    return true;
  } catch (err) {
    console.error('[SUPABASE NET EXCEPTION] syncPromotionsToDb:', err);
    return false;
  }
}

export function subscribeToPromotionChanges(onChanged: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('stakeys-promotions-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
      console.log('[SUPABASE REALTIME] Change detected on promotions');
      onChanged();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
