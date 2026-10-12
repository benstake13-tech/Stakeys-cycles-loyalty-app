import type { VehicleCategory } from '../types/bikeShop';
import type { OfferPriceEntry, CustomerCondition, ConditionPricePoint } from '../context/OfferPriceBook';

/**
 * Deterministic "Sell Your Bike" valuation engine.
 *
 * Takes the AI identification of a bike plus the staff offer price book and
 * produces a cash offer with an honest confidence score and a rationale list.
 * It is intentionally pure (no network, no React) so the staff UI, the website
 * widget and the tests all share exactly one pricing brain.
 *
 * PRICING RULE — staff figures only. The offer shown to a customer is always a
 * price a member of staff saved in the price book: the per-condition figure for
 * the bike's grade, or the model's base (good-condition) price. The engine never
 * invents a price from multipliers, fault deductions or cosmetic wear — the AI
 * read only chooses *which* saved grade applies and lists what it saw.
 */

export type { CustomerCondition } from '../context/OfferPriceBook';
export { CONDITION_ORDER } from '../context/OfferPriceBook';

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
  /** Cosmetic blemishes (scratches, dents, scuffs, rust…) the AI spotted. */
  cosmeticIssues?: { type?: string; severity?: string }[];
  electricKit?: { isElectric?: boolean; isAftermarketConversion?: boolean };
}

export interface ValuationAdjustment {
  label: string;
  amount: number;
}

/** What the bike would fetch at each condition grade. */
export interface ConditionPrice {
  condition: CustomerCondition;
  /** The staff-saved price for this grade, or null when staff have not set one. */
  price: number | null;
  /** Upper bound when the grade is a staff-set band (e.g. £30–£40). */
  maxPrice?: number;
  /** True when a member of staff saved this figure in the price book. */
  explicit?: boolean;
}

export interface BikeValuation {
  /** The book price before condition adjustments, or null when unmatched. */
  basePrice: number | null;
  matchedEntry: OfferPriceEntry | null;
  matchLevel: 'model' | 'category' | 'none';
  condition: CustomerCondition;
  /** 'explicit' when staff set this grade's price, else 'derived' (no staff price). */
  conditionSource: 'explicit' | 'derived';
  /** Price at every condition grade, so staff/customers see the whole ladder. */
  conditionPrices: ConditionPrice[];
  /** Cosmetic-damage deduction. Always 0 — the price is a staff figure. */
  cosmeticAdjustment: number;
  adjustments: ValuationAdjustment[];
  /** Final cash offer — a staff-saved figure — or null when none applies yet. */
  offer: number | null;
  minOffer: number | null;
  maxOffer: number | null;
  /** 0-1 combined confidence: AI read × book match × coverage. */
  confidence: number;
  /** True when a human should confirm the figure before it is shown as final. */
  needsStaffReview: boolean;
  rationale: string[];
}

const AI_CONDITION_TO_CUSTOMER: Record<string, CustomerCondition> = {
  excellent: 'excellent',
  good: 'good',
  fair: 'fair',
  poor: 'poor',
  critical: 'poor',
};

const MATCH_WEIGHT: Record<BikeValuation['matchLevel'], number> = {
  model: 1,
  category: 0.6,
  none: 0.3,
};

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
 * The price a member of staff saved for one condition grade. A per-condition
 * figure wins outright; otherwise the model's base price stands as the
 * good-condition figure. When staff have set neither, the grade has no price —
 * we never invent one. This is the single source of truth for both the offer and
 * the on-screen condition ladder.
 */
export function priceForCondition(entry: OfferPriceEntry, condition: CustomerCondition): ConditionPrice {
  const explicit: ConditionPricePoint | undefined = entry.conditionPrices?.[condition];
  if (explicit && Number.isFinite(explicit.price)) {
    const price = Math.max(0, Math.round(explicit.price));
    const maxPrice =
      Number.isFinite(Number(explicit.maxPrice)) && Number(explicit.maxPrice) >= price
        ? Math.round(Number(explicit.maxPrice))
        : undefined;
    return { condition, price, maxPrice, explicit: true };
  }
  if (condition === 'good' && Number.isFinite(entry.basePrice)) {
    return { condition, price: Math.round(entry.basePrice), explicit: true };
  }
  return { condition, price: null, explicit: false };
}

/**
 * Pick the price-book row for an identified bike. Every price is set against a
 * specific brand+model: an exact model match wins, otherwise the category
 * default applies. There is no per-brand price tier.
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

/**
 * Count the AI's cosmetic blemishes for the record. The engine does not price
 * them — the customer offer is a staff-saved figure — but staff still want to
 * see what the photos turned up, so this keeps a plain label list.
 */
export function cosmeticFindings(
  issues: { type?: string; severity?: string }[] | undefined
): { count: number; labels: string[] } {
  const labels: string[] = [];
  for (const issue of issues ?? []) {
    if (!issue?.type) continue;
    labels.push(`${issue.type}${issue.severity ? ` (${issue.severity})` : ''}`);
  }
  return { count: labels.length, labels };
}

export function valueBike(input: ValuationInput, book: OfferPriceEntry[]): BikeValuation {
  const { entry, level } = matchOfferEntry(book, input);
  const condition = resolveCondition(input);
  const rationale: string[] = [];
  const adjustments: ValuationAdjustment[] = [];

  if (!entry) {
    return {
      basePrice: null,
      matchedEntry: null,
      matchLevel: 'none',
      condition,
      conditionSource: 'derived',
      conditionPrices: [],
      cosmeticAdjustment: 0,
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
      : `Used the ${toCategory(input.type)} category default — no model match.`
  );

  // Price at every condition grade from the staff book, so staff and customers
  // see the whole ladder. Only grades staff have actually priced carry a figure.
  const conditionPrices: ConditionPrice[] = (['excellent', 'good', 'fair', 'poor'] as CustomerCondition[]).map((c) =>
    priceForCondition(entry, c)
  );
  const selected = conditionPrices.find((p) => p.condition === condition) ?? conditionPrices[1];
  const conditionSource: 'explicit' | 'derived' = selected.price != null ? 'explicit' : 'derived';

  const aiConfidence = typeof input.confidence === 'number' ? input.confidence : 0.5;
  const coverage = typeof input.coverage === 'number' ? input.coverage : 0.6;
  const confidence = Math.max(0, Math.min(1, aiConfidence * MATCH_WEIGHT[level] * (0.6 + 0.4 * coverage)));

  // Faults and blemishes are reported, never deducted: the price is a staff
  // figure, so the AI read only decides which saved grade applies.
  const highFaults = countSevere(input, ['high', 'critical safety risk', 'critical']);
  const mediumFaults = countSevere(input, ['medium']);
  if (highFaults > 0) {
    adjustments.push({ label: `${highFaults} serious fault${highFaults === 1 ? '' : 's'} (noted)`, amount: 0 });
  }
  if (mediumFaults > 0) {
    adjustments.push({ label: `${mediumFaults} moderate fault${mediumFaults === 1 ? '' : 's'} (noted)`, amount: 0 });
  }
  const cosmetic = cosmeticFindings(input.cosmeticIssues);
  if (cosmetic.count > 0) {
    adjustments.push({ label: `Cosmetic: ${cosmetic.labels.join(', ')} (noted)`, amount: 0 });
  }

  if (selected.price == null) {
    rationale.push(
      `No staff price set for “${condition}” condition on this model — a member of staff will confirm the figure.`
    );
    return {
      basePrice: entry.basePrice,
      matchedEntry: entry,
      matchLevel: level,
      condition,
      conditionSource: 'derived',
      conditionPrices,
      cosmeticAdjustment: 0,
      adjustments,
      offer: null,
      minOffer: null,
      maxOffer: null,
      confidence,
      needsStaffReview: true,
      rationale,
    };
  }

  const finalOffer = selected.price;
  const minOffer = finalOffer;
  const maxOffer = Math.max(selected.maxPrice ?? finalOffer, finalOffer);

  rationale.push(
    `Staff price for “${condition}” condition applied (£${finalOffer}${
      selected.maxPrice ? `–£${selected.maxPrice}` : ''
    }).`
  );
  if (highFaults > 0) rationale.push('Serious faults noted — already accounted for in the condition grade.');
  if (cosmetic.count > 0) {
    rationale.push(`Cosmetic blemishes noted (${cosmetic.labels.join(', ')}) — covered by the condition grade.`);
  }
  const needsStaffReview = level !== 'model' || confidence < 0.5;
  if (needsStaffReview) rationale.push('Flagged for staff review before the offer is final.');

  return {
    basePrice: entry.basePrice,
    matchedEntry: entry,
    matchLevel: level,
    condition,
    conditionSource,
    conditionPrices,
    cosmeticAdjustment: 0,
    adjustments,
    offer: finalOffer,
    minOffer,
    maxOffer,
    confidence,
    needsStaffReview,
    rationale,
  };
}
