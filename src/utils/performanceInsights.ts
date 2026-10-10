import {
  DiscountCode,
  SaleTransaction,
  ServiceBooking,
  ShopPromotion,
} from '../types/bikeShop';

/**
 * Pure shaping for the Business Stats view. Everything here is deterministic
 * and network-free so the chart maths (timeline alignment, window deltas, ROI
 * attribution) can be unit-tested without the provider APIs being reachable.
 */

export interface MetaPoint {
  date: string; // YYYY-MM-DD
  mediaViews: number;
  uniqueViewers: number;
  engagements: number;
  pageViews: number;
  videoViews: number;
  follows: number;
}

/** The Graph metric name → MetaPoint field mapping we chart. */
export const META_METRIC_FIELDS: Record<string, keyof Omit<MetaPoint, 'date'>> = {
  page_media_view: 'mediaViews',
  page_total_media_view_unique: 'uniqueViewers',
  page_post_engagements: 'engagements',
  page_views_total: 'pageViews',
  page_video_views: 'videoViews',
  page_follows: 'follows',
};

export const META_DAILY_METRICS = Object.keys(META_METRIC_FIELDS).join(',');

/** `end_time` is an ISO timestamp; the chart keys on the calendar day. */
function toDay(endTime: unknown): string {
  const raw = String(endTime || '');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Aligns per-metric Graph series onto a single day-keyed timeline. Graph returns
 * one row per metric, each with its own `values` array; a day missing from one
 * metric is filled with 0 so every chart shares one x-axis.
 */
export function buildMetaTimeline(rows: any[] = []): MetaPoint[] {
  const byDay = new Map<string, MetaPoint>();

  const ensure = (date: string): MetaPoint => {
    let point = byDay.get(date);
    if (!point) {
      point = {
        date,
        mediaViews: 0,
        uniqueViewers: 0,
        engagements: 0,
        pageViews: 0,
        videoViews: 0,
        follows: 0,
      };
      byDay.set(date, point);
    }
    return point;
  };

  rows.forEach((row) => {
    const field = META_METRIC_FIELDS[row?.name];
    if (!field) return;
    (row?.values || []).forEach((v: any) => {
      const date = toDay(v?.end_time);
      if (!date) return;
      const value = Number(v?.value ?? 0);
      if (!Number.isFinite(value)) return;
      ensure(date)[field] = value;
    });
  });

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface WindowTotals {
  mediaViews: number;
  uniqueViewers: number;
  engagements: number;
  pageViews: number;
  videoViews: number;
  follows: number;
  days: number;
}

const EMPTY_TOTALS: WindowTotals = {
  mediaViews: 0,
  uniqueViewers: 0,
  engagements: 0,
  pageViews: 0,
  videoViews: 0,
  follows: 0,
  days: 0,
};

/**
 * Sums the last `days` points, and the `days` before that, so the UI can show a
 * period-over-period delta. `follows` is a running total in Graph, so its window
 * value is the LATEST reading rather than a sum.
 */
export function windowTotals(
  points: MetaPoint[],
  days = 28
): { current: WindowTotals; previous: WindowTotals } {
  if (points.length === 0) return { current: { ...EMPTY_TOTALS }, previous: { ...EMPTY_TOTALS } };

  const currentSlice = points.slice(-days);
  const previousSlice = points.slice(-days * 2, -days);

  const sum = (slice: MetaPoint[]): WindowTotals => {
    if (slice.length === 0) return { ...EMPTY_TOTALS };
    const acc = slice.reduce(
      (a, p) => ({
        mediaViews: a.mediaViews + p.mediaViews,
        uniqueViewers: a.uniqueViewers + p.uniqueViewers,
        engagements: a.engagements + p.engagements,
        pageViews: a.pageViews + p.pageViews,
        videoViews: a.videoViews + p.videoViews,
        follows: 0,
        days: 0,
      }),
      { ...EMPTY_TOTALS }
    );
    acc.days = slice.length;
    acc.follows = slice[slice.length - 1].follows;
    return acc;
  };

  return { current: sum(currentSlice), previous: sum(previousSlice) };
}

/** Percentage change, rounded. Null when there is no baseline to compare. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface CampaignRoi {
  code: string;
  title: string;
  status: DiscountCode['status'];
  timesUsed: number;
  usageLimit?: number;
  redemptionPct: number | null;
  /** Revenue on sales that carried this code. */
  revenue: number;
  /** Total discount given away against this code. */
  discountGiven: number;
  /** Sales count carrying this code. */
  salesCount: number;
}

const saleHasCode = (sale: SaleTransaction, code: string) =>
  (sale.discountCode || '').toUpperCase() === code.toUpperCase();

/**
 * Joins coupon codes to the till ledger so each campaign shows real revenue and
 * discount cost, not just a redemption counter.
 */
export function campaignRoi(
  codes: DiscountCode[] = [],
  sales: SaleTransaction[] = []
): CampaignRoi[] {
  return codes
    .map((c) => {
      const matched = sales.filter((s) => saleHasCode(s, c.code));
      const revenue = matched.reduce((a, s) => a + Number(s.grandTotal || 0), 0);
      const discountGiven = matched.reduce((a, s) => a + Number(s.discount || 0), 0);
      return {
        code: c.code,
        title: c.title,
        status: c.status,
        timesUsed: c.timesUsed || 0,
        usageLimit: c.usageLimit || undefined,
        redemptionPct:
          c.usageLimit && c.usageLimit > 0
            ? Math.round(((c.timesUsed || 0) / c.usageLimit) * 100)
            : null,
        revenue: Math.round(revenue * 100) / 100,
        discountGiven: Math.round(discountGiven * 100) / 100,
        salesCount: matched.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface ShopTotals {
  salesCount: number;
  revenue: number;
  averageOrderValue: number;
  discountTotal: number;
  bookingsTotal: number;
  bookingsByStatus: { status: string; count: number }[];
  topServices: { title: string; count: number; revenue: number }[];
}

/** Shop-side rollup from the till ledger and the booking book. */
export function summarizeShop(
  sales: SaleTransaction[] = [],
  bookings: ServiceBooking[] = []
): ShopTotals {
  const revenue = sales.reduce((a, s) => a + Number(s.grandTotal || 0), 0);
  const discountTotal = sales.reduce((a, s) => a + Number(s.discount || 0), 0);

  const statusMap = new Map<string, number>();
  bookings.forEach((b) => statusMap.set(b.status, (statusMap.get(b.status) || 0) + 1));

  const serviceMap = new Map<string, { count: number; revenue: number }>();
  bookings.forEach((b) => {
    const title = b.serviceTitle || 'Unspecified';
    const entry = serviceMap.get(title) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(b.quotedPrice ?? b.servicePrice ?? 0);
    serviceMap.set(title, entry);
  });

  return {
    salesCount: sales.length,
    revenue: Math.round(revenue * 100) / 100,
    averageOrderValue: sales.length ? Math.round((revenue / sales.length) * 100) / 100 : 0,
    discountTotal: Math.round(discountTotal * 100) / 100,
    bookingsTotal: bookings.length,
    bookingsByStatus: [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    topServices: [...serviceMap.entries()]
      .map(([title, v]) => ({ title, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

/** Active promotions whose window covers today, newest first. */
export function livePromotions(promotions: ShopPromotion[] = [], today = new Date()): ShopPromotion[] {
  const day = today.toISOString().slice(0, 10);
  return promotions
    .filter((p) => p.startDate <= day && p.endDate >= day)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** The discount text a promotion advertises, e.g. "10% off" or "£15 off". */
export function promotionOfferText(promo: ShopPromotion): string {
  if (promo.discountPercentage) return `${promo.discountPercentage}% off`;
  if (promo.discountAmount) return `£${promo.discountAmount} off`;
  return promo.badgeText || 'Special offer';
}
