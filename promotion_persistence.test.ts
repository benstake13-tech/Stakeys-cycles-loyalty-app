import {beforeEach, describe, expect, it, vi} from 'vitest';
const db = vi.hoisted(() => ({upsert:vi.fn(),order:vi.fn()}));
vi.mock('./src/lib/supabase', () => ({getSupabaseClient: () => ({from: () => ({upsert:db.upsert, select: () => ({order:db.order})})})}));
import {fetchPromotionsFromDb,upsertPromotionToDb} from './src/api/backendDataService';
import {campaignBrief} from './src/utils/promotionLogistics';
import type {ShopPromotion} from './src/types/bikeShop';
const brief = campaignBrief({title:'Check',rationale:'Useful',categories:['cycle'],startDate:'2026-10-20',endDate:'2026-10-25',confidence:0.4,serviceId:'small-check',segmentId:'budget-commuters',audience:'member'},3);
const promo:ShopPromotion={id:'test',title:'Check',subtitle:'Quote required',code:'QUOTE',discountPercentage:0,status:'upcoming',startDate:'2026-10-20',endDate:'2026-10-25',badgeText:'Quote required',termsAndConditions:['Written quote required'],eligibleCategories:['cycle'],bgGradient:'',campaignBrief:brief};
beforeEach(() => vi.clearAllMocks());
describe('promotion scope persistence', () => {
  it('writes the public campaign scope and reloads the same service and segment restrictions', async () => {
    db.upsert.mockResolvedValue({error:null});
    expect(await upsertPromotionToDb(promo)).toBe(true);
    const payload=db.upsert.mock.calls[0][0];
    expect(payload.campaign_brief).toEqual(brief);
    db.order.mockResolvedValue({data:[payload],error:null});
    const loaded=await fetchPromotionsFromDb();
    expect(loaded[0].campaignBrief).toEqual(brief);
    expect(loaded[0].termsAndConditions).toEqual(promo.termsAndConditions);
  });
  it('reports database rejection instead of claiming publication', async () => {
    db.upsert.mockResolvedValue({error:{message:'staff access required'}});
    expect(await upsertPromotionToDb(promo)).toBe(false);
  });
});
