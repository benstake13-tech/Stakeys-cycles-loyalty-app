import { describe, expect, it } from 'vitest';
import { evaluatePromotionsExpiry } from './src/utils/promotionUtils';
import type { ShopPromotion } from './src/types/bikeShop';

const promo = (over: Partial<ShopPromotion>): ShopPromotion =>
  ({
    id: 'p1',
    title: 'Deal',
    status: 'active',
    endDate: '',
    ...over,
  }) as ShopPromotion;

describe('evaluatePromotionsExpiry', () => {
  it('keeps the same array identity when nothing has expired', () => {
    const promos = [promo({ endDate: '2999-01-01' }), promo({ id: 'p2', endDate: '' })];
    // The 60s monitor calls this every tick; an unchanged result must not hand
    // the context a new array or every consumer re-renders for nothing.
    expect(evaluatePromotionsExpiry(promos)).toBe(promos);
  });

  it('marks a past end date as expired', () => {
    const promos = [promo({ endDate: '2000-01-01' })];
    const result = evaluatePromotionsExpiry(promos);
    expect(result).not.toBe(promos);
    expect(result[0].status).toBe('expired');
  });

  it('leaves already-expired promotions alone but still reports the change once', () => {
    const promos = [promo({ status: 'expired', endDate: '2000-01-01' })];
    expect(evaluatePromotionsExpiry(promos)).toBe(promos);
  });
});
