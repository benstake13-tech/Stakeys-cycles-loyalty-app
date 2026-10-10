import { describe, it, expect } from 'vitest';
import {
  buildMetaTimeline,
  windowTotals,
  pctChange,
  campaignRoi,
  summarizeShop,
  livePromotions,
  promotionOfferText,
} from './src/utils/performanceInsights';
import type { DiscountCode, SaleTransaction, ServiceBooking, ShopPromotion } from './src/types/bikeShop';

/**
 * The Business Stats view is built from these pure helpers. They are exercised
 * here against the exact shapes Graph returns and the shop writes, so the chart
 * totals and ROI attribution can't silently drift.
 */

const promo = (over: Partial<ShopPromotion>): ShopPromotion =>
  ({
    id: 'p1',
    title: 'Autumn Tune-Up',
    subtitle: 'Keep rolling',
    code: 'AUTUMN10',
    badgeText: '10% off',
    status: 'active',
    startDate: '2026-10-01',
    endDate: '2026-11-30',
    termsAndConditions: [],
    eligibleCategories: [],
    bgGradient: '',
    ...over,
  }) as ShopPromotion;

describe('buildMetaTimeline', () => {
  it('aligns per-metric Graph series onto one day-keyed timeline', () => {
    const rows = [
      {
        name: 'page_media_view',
        values: [
          { value: 3, end_time: '2026-10-08T07:00:00+0000' },
          { value: 9, end_time: '2026-10-09T07:00:00+0000' },
        ],
      },
      {
        name: 'page_views_total',
        values: [{ value: 5, end_time: '2026-10-09T07:00:00+0000' }],
      },
    ];
    const tl = buildMetaTimeline(rows);
    expect(tl.map((p) => p.date)).toEqual(['2026-10-08', '2026-10-09']);
    expect(tl[0].mediaViews).toBe(3);
    // A day missing from a metric is filled with 0 so charts share one x-axis.
    expect(tl[0].pageViews).toBe(0);
    expect(tl[1]).toMatchObject({ mediaViews: 9, pageViews: 5 });
  });

  it('ignores unknown metrics and non-numeric values', () => {
    const tl = buildMetaTimeline([
      { name: 'page_impressions_retired', values: [{ value: 99, end_time: '2026-10-09T07:00:00+0000' }] },
      { name: 'page_media_view', values: [{ value: 'nope', end_time: '2026-10-09T07:00:00+0000' }] },
      { name: 'page_views_total', values: [{ value: 4, end_time: '2026-10-09T07:00:00+0000' }] },
    ]);
    // Unknown metric contributes nothing; the invalid media_view value is
    // dropped, while the valid page_views row still creates the day.
    expect(tl).toHaveLength(1);
    expect(tl[0].date).toBe('2026-10-09');
    expect(tl[0].mediaViews).toBe(0);
    expect(tl[0].pageViews).toBe(4);
  });

  it('returns an empty timeline for no rows', () => {
    expect(buildMetaTimeline([])).toEqual([]);
  });
});

describe('windowTotals', () => {
  it('sums the last window and the window before it', () => {
    const points = Array.from({ length: 56 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      mediaViews: i + 1,
      uniqueViewers: 0,
      engagements: 0,
      pageViews: 0,
      videoViews: 0,
      follows: i + 1,
    }));
    const { current, previous } = windowTotals(points, 28);
    // Current window is the last 28 points (indices 28..55) → values 29..56.
    expect(current.mediaViews).toBe((29 + 56) * 28 / 2);
    expect(previous.mediaViews).toBe((1 + 28) * 28 / 2);
    // Follows is a running total: take the latest reading, not a sum.
    expect(current.follows).toBe(56);
  });

  it('handles an empty timeline', () => {
    const { current, previous } = windowTotals([], 28);
    expect(current.mediaViews).toBe(0);
    expect(previous.mediaViews).toBe(0);
  });
});

describe('pctChange', () => {
  it('rounds and handles a zero baseline', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe('campaignRoi', () => {
  const codes = [
    { id: 'c1', code: 'AUTUMN10', title: 'Autumn', type: 'percent', value: 10, status: 'active', timesUsed: 3, usageLimit: 10, eligibleCategories: [], createdAt: null },
    { id: 'c2', code: 'WINTER5', title: 'Winter', type: 'fixed', value: 5, status: 'active', timesUsed: 0, eligibleCategories: [], createdAt: null },
  ] as unknown as DiscountCode[];

  const sales = [
    { id: 's1', discountCode: 'AUTUMN10', grandTotal: 120, discount: 12 },
    { id: 's2', discountCode: 'autumn10', grandTotal: 80, discount: 8 },
    { id: 's3', discountCode: 'OTHER', grandTotal: 50, discount: 5 },
  ] as unknown as SaleTransaction[];

  it('attributes revenue and discount to the matching code, case-insensitively', () => {
    const roi = campaignRoi(codes, sales);
    const autumn = roi.find((r) => r.code === 'AUTUMN10')!;
    expect(autumn.revenue).toBe(200);
    expect(autumn.discountGiven).toBe(20);
    expect(autumn.salesCount).toBe(2);
    expect(autumn.redemptionPct).toBe(30);
  });

  it('sorts by revenue and leaves unused codes at zero', () => {
    const roi = campaignRoi(codes, sales);
    expect(roi[0].code).toBe('AUTUMN10');
    const winter = roi.find((r) => r.code === 'WINTER5')!;
    expect(winter.revenue).toBe(0);
    expect(winter.redemptionPct).toBeNull();
  });
});

describe('summarizeShop', () => {
  it('rolls up takings, average order and the booking pipeline', () => {
    const sales = [
      { id: 's1', grandTotal: 100, discount: 10 },
      { id: 's2', grandTotal: 50, discount: 0 },
    ] as unknown as SaleTransaction[];
    const bookings = [
      { id: 'b1', serviceTitle: 'Full Service', servicePrice: 60, status: 'completed' },
      { id: 'b2', serviceTitle: 'Full Service', servicePrice: 60, status: 'pending' },
      { id: 'b3', serviceTitle: 'Puncture', servicePrice: 15, status: 'pending' },
    ] as unknown as ServiceBooking[];

    const s = summarizeShop(sales, bookings);
    expect(s.revenue).toBe(150);
    expect(s.averageOrderValue).toBe(75);
    expect(s.discountTotal).toBe(10);
    expect(s.bookingsTotal).toBe(3);
    expect(s.bookingsByStatus[0]).toEqual({ status: 'pending', count: 2 });
    expect(s.topServices[0]).toMatchObject({ title: 'Full Service', count: 2, revenue: 120 });
  });
});

describe('livePromotions & offer text', () => {
  it('keeps only promotions whose window covers today', () => {
    const today = new Date('2026-10-15T00:00:00Z');
    const live = livePromotions(
      [
        promo({ id: 'a', startDate: '2026-10-01', endDate: '2026-11-30' }),
        promo({ id: 'b', startDate: '2026-12-01', endDate: '2026-12-31' }),
        promo({ id: 'c', startDate: '2026-08-01', endDate: '2026-09-01' }),
      ],
      today
    );
    expect(live.map((p) => p.id)).toEqual(['a']);
  });

  it('prefers percentage, then amount, then badge text', () => {
    expect(promotionOfferText(promo({ discountPercentage: 10 }))).toBe('10% off');
    expect(promotionOfferText(promo({ discountPercentage: undefined, discountAmount: 15 }))).toBe('£15 off');
    expect(
      promotionOfferText(promo({ discountPercentage: undefined, discountAmount: undefined, badgeText: 'Free Coffee' }))
    ).toBe('Free Coffee');
  });
});
