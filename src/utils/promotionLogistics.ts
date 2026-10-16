import type { AdvisorAction } from './promotionAdvisor';
import type { ShopPromotion } from '../types/bikeShop';
import type { WebProduct, WebPriceItem } from '../types/websiteContent';
import { catalogueServices } from './promotionStrategyContext';
import { validDay } from '../../supabase/functions/_shared/promotionStrategy';

export const CAMPAIGN_GOALS = {
  workshop: 'Fill quiet workshop slots',
  stock: 'Sell available stock',
  retention: 'Encourage repeat visits',
  growth: 'Reach new customers',
} as const;
export type CampaignGoal = keyof typeof CAMPAIGN_GOALS;

/** Deliberately session-only: supplier costs must never enter public promotions. */
export interface LogisticsInputs {
  quantity?: number;
  available?: number;
  unitCostGbp?: number;
  campaignCostGbp?: number;
  minimumContributionGbp?: number;
  vatPct?: number;
  reviewed: boolean;
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const positiveInteger = (n: unknown): n is number => nonnegative(n) && n > 0 && Number.isSafeInteger(n);

export function evaluatePromotionLogistics(action: AdvisorAction, dates: {startDate: string; endDate: string}, input: LogisticsInputs, products: WebProduct[], promotions: ShopPromotion[], today: string, priceList?: WebPriceItem[]) {
  const blockers: string[] = [];
  const goal = action.objective || 'workshop';
  const product = action.productId ? products.find(p => p.id === action.productId) : undefined;
  const price = action.offerPriceGbp;
  if (!validDay(dates.startDate) || !validDay(dates.endDate) || dates.endDate < dates.startDate || dates.startDate < today) blockers.push('Choose valid campaign dates on or after today.');
  if (promotions.some(p => p.status !== 'expired' && p.startDate <= dates.endDate && p.endDate >= dates.startDate && (!p.eligibleCategories.length || !action.categories.length || p.eligibleCategories.some(c => action.categories.includes(c))))) blockers.push('Resolve the overlapping campaign for this audience before approval.');
  if (!positiveInteger(input.quantity)) blockers.push('Enter a whole-number uptake limit above zero.');
  if (!positiveInteger(input.available)) blockers.push('Confirm available slots or units for these exact dates.');
  if (positiveInteger(input.quantity) && positiveInteger(input.available) && input.quantity > input.available) blockers.push('Planned uptake exceeds confirmed availability.');
  if (action.serviceId && priceList) {
    const service = catalogueServices(priceList).find(s => s.id === action.serviceId);
    if (!service || money(service.priceGbp * (1 - (action.discountPercentage || 0) / 100)) !== price) blockers.push('The service price changed or is unavailable. Generate a fresh brief.');
  }
  if (goal === 'stock') {
    if (!product || !Number.isSafeInteger(product.stock) || product.stock <= 0) blockers.push('Select a product with recorded stock before approving a stock campaign.');
    else {
      if (positiveInteger(input.quantity) && input.quantity > product.stock) blockers.push('Planned uptake exceeds current recorded stock.');
      if (nonnegative(input.available) && input.available > product.stock) blockers.push('Confirmed units exceed current recorded stock.');
      const currentPrice = money(product.price * (1 - (action.discountPercentage || 0) / 100));
      if (price !== currentPrice) blockers.push('The product price changed. Generate a fresh brief.');
    }
  }
  let unitContributionGbp: number | undefined;
  let campaignContributionGbp: number | undefined;
  let breakEvenUnits: number | undefined;
  if (price !== undefined) {
    if (!nonnegative(price)) blockers.push('The catalogue price is invalid. Generate a fresh brief.');
    if (!nonnegative(input.vatPct) || input.vatPct > 100) blockers.push('Confirm the VAT rate included in the selling price.');
    if (!nonnegative(input.unitCostGbp)) blockers.push('Enter the full unit cost: labour, parts, fees and other variable costs.');
    if (!nonnegative(input.campaignCostGbp)) blockers.push('Enter the fixed campaign spend, including zero if none.');
    if (!nonnegative(input.minimumContributionGbp)) blockers.push('Set the minimum contribution per redemption.');
    if (nonnegative(price) && nonnegative(input.vatPct) && input.vatPct <= 100 && nonnegative(input.unitCostGbp)) {
      unitContributionGbp = money(price / (1 + input.vatPct / 100) - input.unitCostGbp);
      if (unitContributionGbp <= 0) blockers.push('This offer does not cover its variable costs.');
      if (nonnegative(input.minimumContributionGbp) && unitContributionGbp < input.minimumContributionGbp) blockers.push('Contribution is below your minimum.');
      if (nonnegative(input.campaignCostGbp) && unitContributionGbp > 0) {
        breakEvenUnits = Math.ceil(input.campaignCostGbp / unitContributionGbp);
        if (positiveInteger(input.quantity)) {
          campaignContributionGbp = money(unitContributionGbp * input.quantity - input.campaignCostGbp);
          if (campaignContributionGbp < 0) blockers.push('Planned uptake cannot cover the fixed campaign spend.');
        }
      }
    }
  }
  if (!input.reviewed) blockers.push('Staff must confirm audience fit, costs, availability and the quote process.');
  return {ready: blockers.length === 0, blockers, unitContributionGbp, campaignContributionGbp, breakEvenUnits, quoteOnly: true as const};
}

/** Public-safe brief. No identities, supplier costs or private staff notes. */
export interface PromotionCampaignBrief {
  version: 1;
  objective: CampaignGoal;
  serviceId?: string;
  productId?: string;
  segmentId: string;
  audienceDescription: string;
  audience: 'public' | 'member';
  requiresQuote: true;
  uptakeLimit: number;
  successMetric: string;
  approvedAt: string;
}

export function campaignBrief(action: AdvisorAction, uptakeLimit: number): PromotionCampaignBrief {
  return {version: 1, objective: action.objective || 'workshop', serviceId: action.serviceId, productId: action.productId, segmentId: action.segmentId || 'quote-first', audience: action.audience || 'public', audienceDescription: action.audienceDescription || 'Confirm customer needs and budget', requiresQuote: true, uptakeLimit, successMetric: action.successMetric || 'Record enquiries and completed paid work', approvedAt: new Date().toISOString()};
}

export function campaignTerms(action: AdvisorAction, limit: number): string[] {
  return [
    'Staff-reviewed campaign brief. An individual written quote and availability check are required; no automatic discount applies.',
    action.audience === 'member' ? 'For loyalty members only; staff must confirm membership before quoting.' : 'Open to customers who meet the stated audience and suitability requirements.',
    `Audience: ${action.audienceDescription || 'Confirm customer needs and budget'}.`,
    action.priceBasis || 'Confirm the complete price before agreeing any work or purchase.',
    `Campaign uptake limit: ${limit}. Staff must check remaining places or stock before accepting each quote.`,
    ...(action.spendCeilingGbp !== undefined ? [`Total planning ceiling: £${action.spendCeilingGbp.toFixed(2)} including parts; the customer’s lower agreed budget takes priority.`] : []),
    'Cannot combine with other offers.',
  ];
}
