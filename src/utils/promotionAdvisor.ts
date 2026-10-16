import {
  ShopPromotion,
  DiscountCode,
  DiscountAudience,
  VehicleCategory,
  ServiceBooking,
  SaleTransaction,
} from '../types/bikeShop';
import { CAMPAIGN_GOALS } from './promotionLogistics';
import { suggestWindows, SuggestedWindow, toDateOnly, parseDate, daysBetween, addDays } from './promotionPlanner';
import { seasonalDemand } from './seasonalDemand';
import type { WeatherReport } from './weatherService';
import { buildStrategyContext, type StrategyInputs } from './promotionStrategyContext';
import { monthEvents, assessStrategyAction, type PromotionStrategy, type StrategyActionDetails } from '../../supabase/functions/_shared/promotionStrategy';

/**
 * Turns the shop's live promotions, coupon codes and (optionally) past usage
 * into a compact brief for the AI advisor, plus a deterministic recommendation
 * used as the always-available fallback. Kept pure so it can be unit-tested and
 * so the UI never depends on the network being up.
 */

export interface CampaignPerformance {
  code: string;
  title: string;
  type: DiscountCode['type'];
  value: number;
  timesUsed: number;
  usageLimit?: number;
  /** Redemptions as a share of the limit, 0-100 (undefined when unlimited). */
  redemptionPct?: number;
  status: DiscountCode['status'];
}

/** Normalises coupon codes into a performance table (best first). */
export function campaignPerformance(codes: DiscountCode[] = []): CampaignPerformance[] {
  return codes
    .map((c) => ({
      code: c.code,
      title: c.title,
      type: c.type,
      value: c.value,
      timesUsed: c.timesUsed || 0,
      usageLimit: c.usageLimit || undefined,
      redemptionPct:
        c.usageLimit && c.usageLimit > 0 ? Math.round(((c.timesUsed || 0) / c.usageLimit) * 100) : undefined,
      status: c.status,
    }))
    .sort((a, b) => b.timesUsed - a.timesUsed);
}

/** The best-performing live campaign, or null when nothing has been redeemed. */
export function bestCampaign(perf: CampaignPerformance[]): CampaignPerformance | null {
  const used = perf.filter((p) => p.timesUsed > 0);
  return used.length ? used[0] : null;
}

export interface PromotionBrief {
  strategy: PromotionStrategy;
  today: string;
  liveCampaigns: { title: string; code: string; categories: VehicleCategory[]; startDate: string; endDate: string }[];
  clearWindows: SuggestedWindow[];
  bestCampaign: CampaignPerformance | null;
  codesByUsage: CampaignPerformance[];
  upcomingSeasonalHooks: string[];
  /** Weather/season→demand forecast (always present; deterministic). */
  demandForecast: {
    season: string;
    signals: { id: string; category: VehicleCategory; issue: string; direction: 'up' | 'down'; magnitude: number; estimatedUpliftPct: number; reason: string }[];
    parts: { componentId: string; name: string; offer: string }[];
  };
  /** Signals derived from the shop's own bookings + sales history. */
  shopSignals: {
    topServices: { label: string; count: number }[];
    topCategories: { category: VehicleCategory; count: number }[];
  };
}

/** Counts the shop's own bookings/sales into top services and categories. */
export function deriveShopSignals(
  bookings: ServiceBooking[] = [],
  sales: SaleTransaction[] = []
): PromotionBrief['shopSignals'] {
  const services = new Map<string, number>();
  for (const b of bookings) {
    const label = b.serviceTitle || 'Workshop job';
    services.set(label, (services.get(label) || 0) + 1);
  }
  const categories = new Map<VehicleCategory, number>();
  for (const b of bookings) categories.set(b.vehicleCategory, (categories.get(b.vehicleCategory) || 0) + 1);
  for (const s of sales) {
    for (const item of s.items || []) {
      const label = item.category === 'Labour' ? 'Counter labour' : item.category;
      services.set(label, (services.get(label) || 0) + 1);
    }
  }
  const topServices = [...services.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topCategories = [...categories.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  return { topServices, topCategories };
}

/**
 * A few well-known UK retail moments in the next ~90 days, so the advisor can
 * suggest tying a campaign to a date customers already recognise. Pure date
 * maths — no external calendar.
 */
export function seasonalHooks(today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const cursor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    for (const event of monthEvents(toDateOnly(cursor).slice(0, 7))) {
      if (event.date >= toDateOnly(today)) out.push(`${event.label} (${parseDate(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`);
    }
  }
  return out.slice(0, 4);
}

export function buildPromotionBrief(
  promotions: ShopPromotion[] = [],
  codes: DiscountCode[] = [],
  today: Date = new Date(),
  weather?: WeatherReport | null,
  bookings: ServiceBooking[] = [],
  sales: SaleTransaction[] = [],
  strategyInputs: StrategyInputs = {}
): PromotionBrief {
  const perf = campaignPerformance(codes);
  const demand = seasonalDemand(weather, today);
  const strategy = buildStrategyContext(today, weather, bookings, sales, strategyInputs);
  const monthStart = `${strategy.month}-01`;
  const monthEnd = toDateOnly(new Date(Number(strategy.month.slice(0,4)), Number(strategy.month.slice(5)), 0));
  const start = toDateOnly(today) > monthStart ? toDateOnly(today) : monthStart;
  return {
    strategy,
    today: toDateOnly(today),
    liveCampaigns: promotions
      .filter((p) => p.status !== 'expired')
      .map((p) => ({
        title: p.title,
        code: p.code,
        categories: p.eligibleCategories || [],
        startDate: p.startDate,
        endDate: p.endDate,
      })),
    clearWindows: start > monthEnd ? [] : suggestWindows(promotions, { today: parseDate(start), horizonDays: daysBetween(start, monthEnd), minDays: 1, count: 3 }),
    bestCampaign: bestCampaign(perf),
    codesByUsage: perf.slice(0, 5),
    upcomingSeasonalHooks: strategy.events.filter(e => e.date >= start).map(e => `${e.label} (${e.date})`),
    demandForecast: {
      season: demand.season,
      signals: demand.signals.map((s) => ({
        id: s.id,
        category: s.category,
        issue: s.issue,
        direction: s.direction,
        magnitude: s.magnitude,
        estimatedUpliftPct: s.estimatedUpliftPct,
        reason: s.reason,
      })),
      parts: demand.parts.map((p) => ({ componentId: p.componentId, name: p.name, offer: p.offer })),
    },
    shopSignals: deriveShopSignals(bookings, sales),
  };
}

export interface AdvisorAction extends Partial<StrategyActionDetails> {
  title: string;
  rationale: string;
  discountPercentage?: number;
  discountAmount?: number;
  categories: VehicleCategory[];
  startDate: string;
  endDate: string;
  audience?: DiscountAudience;
  confidence: number;
  provenance?: 'ai' | 'rules';
}

export interface AdvisorResult {
  headline: string;
  actions: AdvisorAction[];
  /** Where the advice came from — the UI shows a badge accordingly. */
  source: 'ai' | 'offline';
  notes?: string;
}

/** A useful offline brief uses the same affordability checks as AI output. */
export function recommendPromotion(brief: PromotionBrief, _today: Date = new Date()): AdvisorResult {
  const window = brief.clearWindows[0];
  if (!window) return { headline: 'No clear dates in this month. Choose another month or review overlapping campaigns.', actions: [], source: 'offline' };
  const startDate = window.startDate;
  const endDate = addDays(startDate, Math.min(6, window.days - 1));
  const strategy = brief.strategy;
  const actions: AdvisorAction[] = [];
  const add = (raw: Record<string, unknown>, categories: VehicleCategory[] = ['cycle']) => {
    const assessed = assessStrategyAction(raw, strategy);
    if (assessed) actions.push({title: String(raw.title), rationale: String(raw.rationale), categories, startDate, endDate, audience: raw.objective === 'growth' ? 'public' : 'member', confidence: 0.4, provenance:'rules', ...assessed});
  };
  const segment = strategy.segments.find(s => s.maxSpendGbp !== null);
  const service = segment && strategy.services.filter(s => (s.scope === 'scooter') === (segment.category === 'electric_scooter') && s.priceGbp <= segment.maxSpendGbp!).sort((a,b) => a.priceGbp - b.priceGbp)[0];
  add({title: service ? `${service.title}: keep a budget bike useful` : 'Small repair, clear quote',
    rationale: service ? 'This catalogue job fits the lowest recorded spending ceiling in this segment. Confirm the fault and parts cost before offering it.' : 'Ask about the bike’s value, intended use and repair budget, then quote only worthwhile work.',
    segmentId: segment?.id, serviceId: service?.id,
    evidence: [strategy.weather.basis === 'forecast' ? 'A fresh local forecast is available; check the relevant dates.' : 'Only seasonal planning assumptions are available.'],
    successMetric: 'Track accepted quotes and completed paid jobs by segment.'}, segment ? [segment.category] : ['cycle']);
  const event = strategy.events.find(e => e.date >= startDate && e.date <= window.endDate);
  add({title: event ? `${event.label}: prepare for the next ride` : 'Reliable everyday riding',
    rationale: event ? event.relevance : 'Discuss the rider’s next journey and prioritise a small useful maintenance job after assessment.',
    evidence: [event ? `${event.date}: ${event.source}` : strategy.weather.summary],
    successMetric: 'Record enquiries, accepted quotes and the revenue from completed jobs.'});
  add({objective:'retention', title:'Invite riders back for a useful check', rationale:'Review completed work and invite customers to discuss a relevant follow-up; use recorded history, not an assumed fault.', successMetric:'Compare repeat paid visits with the prior equal-length period; do not infer causality.'});
  add({objective:'growth', title:'Help a new rider get started', rationale:'Offer a clear assessment and written quote to new customers. Explain the workshop service and ask how they found the shop.', successMetric:'Record new-customer enquiries, accepted quotes, completed paid jobs and acquisition spend.'});
  const product = strategy.products?.slice().sort((a,b) => b.stock - a.stock)[0];
  if (product) add({objective:'stock', productId:product.id, title:`Find the right home for ${product.title}`, rationale:'This item has recorded stock. Check fit and the customer’s purchase budget; stock age and sales velocity are not known.', successMetric:'Track units sold, remaining stock and contribution after costs.'}, []);
  if (brief.bestCampaign) add({objective:'retention', title: 'Review a previously redeemed campaign', rationale: `Code ${brief.bestCampaign.code} recorded ${brief.bestCampaign.timesUsed} uses. Review its actual costs and customer fit before reusing the idea.`, successMetric: 'Compare accepted quotes and net revenue, not redemptions alone.'});
  return { headline: brief.demandForecast.signals.length ? 'Weather-led campaign briefs — check customer budgets and job costs before approval.' : 'Practical campaign briefs — check customer budgets and job costs before approval.', actions, source: 'offline', notes: 'Rules-based ideas, not AI predictions. No campaign has been published.' };
}

/** Renders the brief as compact text for the model's prompt. */
export function briefToPrompt(brief: PromotionBrief): string {
  const lines: string[] = [];
  lines.push(`Today: ${brief.today}`);
  lines.push(`Business objectives: ${Object.values(CAMPAIGN_GOALS).join('; ')}. Balance all four; missing operational data must remain explicit.`);
  lines.push(
    `Live campaigns: ${
      brief.liveCampaigns.length
        ? brief.liveCampaigns.map((c) => `${c.title} [${c.code}] ${c.startDate}→${c.endDate} (${c.categories.join('/') || 'all'})`).join('; ')
        : 'none'
    }`
  );
  lines.push(
    `Clear scheduling windows: ${
      brief.clearWindows.length ? brief.clearWindows.map((w) => `${w.startDate}→${w.endDate} (${w.days}d)`).join('; ') : 'none in horizon'
    }`
  );
  lines.push(
    `Coupon usage (code: uses/limit): ${
      brief.codesByUsage.length
        ? brief.codesByUsage.map((c) => `${c.code}: ${c.timesUsed}${c.usageLimit ? `/${c.usageLimit}` : ''}`).join('; ')
        : 'none yet'
    }`
  );
  lines.push(`Upcoming seasonal hooks: ${brief.upcomingSeasonalHooks.join('; ') || 'none'}`);
  lines.push(
    `Shop history (top services): ${
      brief.shopSignals.topServices.length
        ? brief.shopSignals.topServices.map((s) => `${s.label}×${s.count}`).join('; ')
        : 'no history'
    }`
  );
  lines.push(
    `Shop history (top vehicle categories): ${
      brief.shopSignals.topCategories.length
        ? brief.shopSignals.topCategories.map((c) => `${c.category}×${c.count}`).join('; ')
        : 'none'
    }`
  );
  lines.push('Planning evidence (aggregated; no customer identities): ' + JSON.stringify(brief.strategy));
  return lines.join('\n');
}
