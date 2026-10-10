import { ShopPromotion, DiscountCode, DiscountAudience, VehicleCategory } from '../types/bikeShop';
import { suggestWindows, SuggestedWindow, toDateOnly } from './promotionPlanner';

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
  today: string;
  liveCampaigns: { title: string; code: string; categories: VehicleCategory[]; startDate: string; endDate: string }[];
  clearWindows: SuggestedWindow[];
  bestCampaign: CampaignPerformance | null;
  codesByUsage: CampaignPerformance[];
  upcomingSeasonalHooks: string[];
}

/**
 * A few well-known UK retail moments in the next ~90 days, so the advisor can
 * suggest tying a campaign to a date customers already recognise. Pure date
 * maths — no external calendar.
 */
export function seasonalHooks(today: Date = new Date()): string[] {
  const hooks: { month: number; day: number; label: string }[] = [
    { month: 0, day: 1, label: "New Year's Day" },
    { month: 1, day: 14, label: "Valentine's Day" },
    { month: 2, day: 17, label: "St. Patrick's Day" },
    { month: 3, day: 1, label: "Easter window" },
    { month: 4, day: 5, label: "May bank holiday" },
    { month: 5, day: 21, label: "Summer solstice / longest day" },
    { month: 8, day: 1, label: 'Back to school' },
    { month: 9, day: 31, label: 'Halloween' },
    { month: 10, day: 28, label: 'Black Friday window' },
    { month: 11, day: 25, label: 'Christmas' },
  ];
  const out: string[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const cursor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    for (const h of hooks) {
      if (h.month !== cursor.getMonth()) continue;
      const date = new Date(today.getFullYear(), h.month, h.day);
      if (date >= today) out.push(`${h.label} (${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`);
    }
  }
  return out.slice(0, 4);
}

export function buildPromotionBrief(
  promotions: ShopPromotion[] = [],
  codes: DiscountCode[] = [],
  today: Date = new Date()
): PromotionBrief {
  const perf = campaignPerformance(codes);
  return {
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
    clearWindows: suggestWindows(promotions, { today, count: 3 }),
    bestCampaign: bestCampaign(perf),
    codesByUsage: perf.slice(0, 5),
    upcomingSeasonalHooks: seasonalHooks(today),
  };
}

export interface AdvisorAction {
  title: string;
  rationale: string;
  discountPercentage?: number;
  discountAmount?: number;
  categories: VehicleCategory[];
  startDate: string;
  endDate: string;
  audience?: DiscountAudience;
  confidence: number;
}

export interface AdvisorResult {
  headline: string;
  actions: AdvisorAction[];
  /** Where the advice came from — the UI shows a badge accordingly. */
  source: 'ai' | 'offline';
  notes?: string;
}

/** A 7-day campaign starting from a given window (or today). */
function weekFrom(window: SuggestedWindow | undefined, today: Date): { startDate: string; endDate: string } {
  const start = window?.startDate || toDateOnly(today);
  const end = window ? window.endDate : toDateOnly(new Date(today.getTime() + 6 * 86400000));
  return { startDate: start, endDate: end };
}

/**
 * The always-available recommendation, derived purely from the brief. Used when
 * the AI is not configured or the quota is exhausted, so the planner never
 * shows a dead end.
 */
export function recommendPromotion(brief: PromotionBrief, today: Date = new Date()): AdvisorResult {
  const actions: AdvisorAction[] = [];
  const best = brief.bestCampaign;
  const window = brief.clearWindows[0];
  const { startDate, endDate } = weekFrom(window, today);

  if (best) {
    actions.push({
      title: `Repeat your best seller: ${best.title}`,
      rationale: `"${best.code}" is your most-redeemed code (${best.timesUsed} uses${
        best.redemptionPct != null ? `, ${best.redemptionPct}% of its limit` : ''
      }). Re-running the same shape in a clear window is the lowest-risk way to lift sales.`,
      discountPercentage: best.type === 'percent' ? best.value : undefined,
      discountAmount: best.type === 'fixed' ? best.value : undefined,
      categories: ['cycle', 'ebike'],
      startDate,
      endDate,
      audience: 'public',
      confidence: 0.7,
    });
  }

  const hook = brief.upcomingSeasonalHooks[0];
  actions.push({
    title: hook ? `Tie a campaign to ${hook.split(' (')[0]}` : 'Run a short, focused weekend offer',
    rationale: hook
      ? `Customers already recognise ${hook.split(' (')[0]}. A 10-15% service offer timed to it converts better than a generic deal.`
      : 'A short, time-boxed offer creates urgency without training customers to wait for discounts.',
    discountPercentage: 12,
    categories: ['cycle', 'ebike', 'electric_scooter'],
    startDate,
    endDate,
    audience: 'member',
    confidence: 0.5,
  });

  if (brief.clearWindows.length > 1) {
    const w2 = weekFrom(brief.clearWindows[1], today);
    actions.push({
      title: 'Fill the next quiet stretch',
      rationale: `Your next clear window runs from ${w2.startDate}. Booking a low-depth loyalty offer here smooths demand without clashing with live campaigns.`,
      discountPercentage: 8,
      categories: ['cycle'],
      startDate: w2.startDate,
      endDate: w2.endDate,
      audience: 'member',
      confidence: 0.45,
    });
  }

  return {
    headline: best
      ? `Start from what works: your best code is "${best.code}", and the next clear window opens ${startDate}.`
      : `No redemptions logged yet — start with a short, clear-window offer from ${startDate} and measure it.`,
    actions,
    source: 'offline',
  };
}

/** Renders the brief as compact text for the model's prompt. */
export function briefToPrompt(brief: PromotionBrief): string {
  const lines: string[] = [];
  lines.push(`Today: ${brief.today}`);
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
  return lines.join('\n');
}
