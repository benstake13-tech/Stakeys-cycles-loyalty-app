import type { VehicleCategory } from '../types/bikeShop';
import type { OfferPriceEntry } from '../context/OfferPriceBook';

/**
 * Deterministic "Sell Your Bike" valuation engine.
 *
 * Takes the AI identification of a bike plus the staff offer price book and
 * produces a cash offer with an honest confidence score and a rationale list.
 * It is intentionally pure (no network, no React) so the staff UI, the website
 * widget and the tests all share exactly one pricing brain.
 */

export type CustomerCondition = 'excellent' | 'good' | 'fair' | 'poor';

export interface ValuationInput {
  make?: string;
  model?: string;
  type?: string;
  year?: string;
  /** AI overall condition (Excellent | Good | Fair | Poor | Critical). */
  overallCondition?: string;
  /** Customer-declared condition, used when the AI did not assess one. */
  declaredCondition?: CustomerCondition;
  confidence?: number;
  coverage?: number;
  faults?: { severity?: string }[];
  obviousProblems?: { severity?: string }[];
  electricKit?: { isElectric?: boolean; isAftermarketConversion?: boolean };
}

export interface ValuationAdjustment {
  label: string;
  amount: number;
}

export interface BikeValuation {
  /** The book price before condition/fault adjustments, or null when unmatched. */
  basePrice: number | null;
  matchedEntry: OfferPriceEntry | null;
  matchLevel: 'model' | 'brand' | 'category' | 'none';
  condition: CustomerCondition;
  conditionMultiplier: number;
  adjustments: ValuationAdjustment[];
  /** Final recommended cash offer, or null when we cannot price it yet. */
  offer: number | null;
  minOffer: number | null;
  maxOffer: number | null;
  /** 0-1 combined confidence: AI read × book match × coverage. */
  confidence: number;
  /** True when a human should confirm the figure before it is shown as final. */
  needsStaffReview: boolean;
  rationale: string[];
}

const CONDITION_MULTIPLIER: Record<CustomerCondition, number> = {
  excellent: 1.15,
  good: 1.0,
  fair: 0.8,
  poor: 0.55,
};

const AI_CONDITION_TO_CUSTOMER: Record<string, CustomerCondition> = {
  excellent: 'excellent',
  good: 'good',
  fair: 'fair',
  poor: 'poor',
  critical: 'poor',
};

const MATCH_WEIGHT: Record<BikeValuation['matchLevel'], number> = {
  model: 1,
  brand: 0.85,
  category: 0.6,
  none: 0.3,
};

const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

const norm = (v?: string) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function toCategory(type?: string): VehicleCategory {
  if (type === 'ebike' || type === 'electric_scooter' || type === 'cargo') return type;
  return 'cycle';
}

export function resolveCondition(input: ValuationInput): CustomerCondition {
  if (input.declaredCondition) return input.declaredCondition;
  const ai = AI_CONDITION_TO_CUSTOMER[String(input.overallCondition ?? '').toLowerCase()];
  return ai ?? 'good';
}

/**
 * Pick the most specific price-book row for an identified bike. Order of
 * precedence: exact brand+model → brand-wide → category fallback.
 */
export function matchOfferEntry(
  book: OfferPriceEntry[],
  input: ValuationInput
): { entry: OfferPriceEntry | null; level: BikeValuation['matchLevel'] } {
  const brand = norm(input.make);
  const model = norm(input.model);
  const category = toCategory(input.type);

  const usable = book.filter((e) => Number.isFinite(e.basePrice));

  const byModel = usable.find((e) => norm(e.brand) === brand && model && norm(e.model) === model);
  if (byModel) return { entry: byModel, level: 'model' };

  const byBrand = usable.find((e) => brand && norm(e.brand) === brand && !norm(e.model));
  if (byBrand) return { entry: byBrand, level: 'brand' };

  const byCategory = usable.find((e) => !norm(e.brand) && !norm(e.model) && (!e.category || e.category === category));
  if (byCategory) return { entry: byCategory, level: 'category' };

  return { entry: null, level: 'none' };
}

/** Count faults/problems at or above a severity threshold. */
function countSevere(input: ValuationInput, severities: string[]): number {
  const set = new Set(severities.map((s) => s.toLowerCase()));
  const fromFaults = (input.faults ?? []).filter((f) => set.has(String(f.severity ?? '').toLowerCase())).length;
  const fromProblems = (input.obviousProblems ?? []).filter((p) => set.has(String(p.severity ?? '').toLowerCase())).length;
  return fromFaults + fromProblems;
}

export function valueBike(input: ValuationInput, book: OfferPriceEntry[]): BikeValuation {
  const { entry, level } = matchOfferEntry(book, input);
  const condition = resolveCondition(input);
  const conditionMultiplier = CONDITION_MULTIPLIER[condition];
  const rationale: string[] = [];
  const adjustments: ValuationAdjustment[] = [];

  if (!entry) {
    return {
      basePrice: null,
      matchedEntry: null,
      matchLevel: 'none',
      condition,
      conditionMultiplier,
      adjustments: [],
      offer: null,
      minOffer: null,
      maxOffer: null,
      confidence: 0,
      needsStaffReview: true,
      rationale: ['No price-book match — a member of staff will price this bike by hand.'],
    };
  }

  rationale.push(
    level === 'model'
      ? `Matched ${entry.brand} ${entry.model} in the price book.`
      : level === 'brand'
      ? `Matched the brand-wide ${entry.brand} price.`
      : `Used the ${toCategory(input.type)} category default — no brand match.`
  );

  let offer = entry.basePrice * conditionMultiplier;
  rationale.push(`Condition “${condition}” applied (×${conditionMultiplier.toFixed(2)}).`);

  const highFaults = countSevere(input, ['high', 'critical safety risk', 'critical']);
  if (highFaults > 0) {
    const deduction = Math.min(offer * 0.35, highFaults * 40);
    offer -= deduction;
    adjustments.push({ label: `${highFaults} serious fault${highFaults === 1 ? '' : 's'}`, amount: -Math.round(deduction) });
    rationale.push(`${highFaults} serious fault${highFaults === 1 ? '' : 's'} found — offer reduced.`);
  }

  const mediumFaults = countSevere(input, ['medium']);
  if (mediumFaults > 0) {
    const deduction = Math.min(offer * 0.15, mediumFaults * 20);
    offer -= deduction;
    adjustments.push({ label: `${mediumFaults} moderate fault${mediumFaults === 1 ? '' : 's'}`, amount: -Math.round(deduction) });
  }

  if (input.electricKit?.isElectric && toCategory(input.type) === 'cycle') {
    offer += 40;
    adjustments.push({ label: 'Electric kit detected', amount: 40 });
    rationale.push('Electric kit detected — small uplift added.');
  }
  if (input.electricKit?.isAftermarketConversion) {
    rationale.push('Aftermarket conversion — resale value is limited; staff should verify the battery.');
  }

  const finalOffer = round5(offer);
  const minOffer = entry.minPrice ?? round5(finalOffer * 0.9);
  const maxOffer = entry.maxPrice ?? round5(finalOffer * 1.1);

  const aiConfidence = typeof input.confidence === 'number' ? input.confidence : 0.5;
  const coverage = typeof input.coverage === 'number' ? input.coverage : 0.6;
  const confidence = Math.max(0, Math.min(1, aiConfidence * MATCH_WEIGHT[level] * (0.6 + 0.4 * coverage)));

  const needsStaffReview = level !== 'model' || confidence < 0.5 || highFaults > 0;
  if (needsStaffReview) rationale.push('Flagged for staff review before the offer is final.');

  return {
    basePrice: entry.basePrice,
    matchedEntry: entry,
    matchLevel: level,
    condition,
    conditionMultiplier,
    adjustments,
    offer: finalOffer,
    minOffer,
    maxOffer: Math.max(maxOffer, finalOffer),
    confidence,
    needsStaffReview,
    rationale,
  };
}
