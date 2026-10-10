import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPromotionBrief,
  recommendPromotion,
  campaignPerformance,
  bestCampaign,
  seasonalHooks,
  briefToPrompt,
} from './src/utils/promotionAdvisor';
import { ShopPromotion, DiscountCode } from './src/types/bikeShop';

const TODAY = new Date(2026, 5, 15); // 15 Jun 2026

const promo = (over: Partial<ShopPromotion>): ShopPromotion => ({
  id: over.id || Math.random().toString(36).slice(2),
  title: over.title || 'Campaign',
  subtitle: '',
  code: over.code || 'STK-XXX',
  badgeText: '',
  status: over.status || 'active',
  startDate: over.startDate || '2026-06-01',
  endDate: over.endDate || '2026-06-30',
  termsAndConditions: [],
  eligibleCategories: over.eligibleCategories || ['cycle'],
  bgGradient: '',
  discountPercentage: over.discountPercentage ?? 10,
});

const code = (over: Partial<DiscountCode>): DiscountCode => ({
  id: over.id || Math.random().toString(36).slice(2),
  code: over.code || 'STK-10OFF',
  title: over.title || 'Offer',
  type: over.type || 'percent',
  value: over.value ?? 10,
  status: over.status || 'active',
  createdAt: '2026-01-01',
  timesUsed: over.timesUsed ?? 0,
  eligibleCategories: over.eligibleCategories || ['cycle'],
  usageLimit: over.usageLimit,
});

describe('campaignPerformance', () => {
  it('computes redemption share and sorts by usage', () => {
    const perf = campaignPerformance([
      code({ code: 'A', timesUsed: 2, usageLimit: 10 }),
      code({ code: 'B', timesUsed: 8, usageLimit: 10 }),
    ]);
    expect(perf[0].code).toBe('B');
    expect(perf[0].redemptionPct).toBe(80);
    expect(perf[1].redemptionPct).toBe(20);
  });

  it('leaves redemptionPct undefined when unlimited', () => {
    const [p] = campaignPerformance([code({ timesUsed: 5 })]);
    expect(p.redemptionPct).toBeUndefined();
  });
});

describe('bestCampaign', () => {
  it('ignores codes with no redemptions', () => {
    expect(bestCampaign(campaignPerformance([code({ timesUsed: 0 })]))).toBeNull();
    expect(bestCampaign(campaignPerformance([code({ timesUsed: 3 })]))?.timesUsed).toBe(3);
  });
});

describe('seasonalHooks', () => {
  it('returns only upcoming hooks, soonest first', () => {
    const hooks = seasonalHooks(TODAY); // 15 Jun 2026 → solstice 21 Jun is next
    expect(hooks.length).toBeGreaterThan(0);
    expect(hooks[0]).toMatch(/21 Jun/);
  });
});

describe('buildPromotionBrief + briefToPrompt', () => {
  it('summarises live campaigns, windows and coupon usage', () => {
    const brief = buildPromotionBrief(
      [promo({ title: 'Summer Service', code: 'STK-SUM' })],
      [code({ code: 'STK-SUM', timesUsed: 6, usageLimit: 20 })],
      TODAY
    );
    expect(brief.today).toBe('2026-06-15');
    expect(brief.liveCampaigns[0].code).toBe('STK-SUM');
    expect(brief.bestCampaign?.code).toBe('STK-SUM');
    const text = briefToPrompt(brief);
    expect(text).toMatch(/Live campaigns:/);
    expect(text).toMatch(/STK-SUM: 6\/20/);
  });
});

describe('recommendPromotion (deterministic fallback)', () => {
  it('builds actions from the best code and a clear window, offline', () => {
    const brief = buildPromotionBrief(
      [],
      [code({ code: 'STK-BEST', title: 'Best Offer', timesUsed: 9, usageLimit: 10 })],
      TODAY
    );
    const result = recommendPromotion(brief, TODAY);
    expect(result.source).toBe('offline');
    expect(result.actions.length).toBeGreaterThanOrEqual(2);
    // The forecast leads, but the best-performing code is still surfaced as an action.
    expect(result.actions.some((a) => /STK-BEST/.test(a.rationale))).toBe(true);
    // every action has concrete dates
    for (const a of result.actions) {
      expect(a.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('leads with the weather-driven forecast', () => {
    const brief = buildPromotionBrief([], [], TODAY);
    const result = recommendPromotion(brief, TODAY);
    expect(brief.demandForecast.signals.length).toBeGreaterThan(0);
    expect(result.headline).toMatch(/Weather-led/i);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('still offers advice when nothing has redeemed', () => {
    const result = recommendPromotion(buildPromotionBrief([], [], TODAY), TODAY);
    expect(result.actions.length).toBeGreaterThan(0);
    // no best-seller action is fabricated when there are no redemptions
    expect(result.actions.some((a) => /best seller/i.test(a.title))).toBe(false);
  });

  it('folds shop history into the brief', () => {
    const brief = buildPromotionBrief(
      [],
      [],
      TODAY,
      null,
      [
        { serviceTitle: 'Full Service', vehicleCategory: 'cycle' } as any,
        { serviceTitle: 'Full Service', vehicleCategory: 'cycle' } as any,
        { serviceTitle: 'Brake Bleed', vehicleCategory: 'ebike' } as any,
      ],
      []
    );
    expect(brief.shopSignals.topServices[0]).toEqual({ label: 'Full Service', count: 2 });
    expect(brief.shopSignals.topCategories[0]).toEqual({ category: 'cycle', count: 2 });
    expect(briefToPrompt(brief)).toMatch(/Shop history \(top services\):/);
  });
});
