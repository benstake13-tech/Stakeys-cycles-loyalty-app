import type { VehicleCategory } from '../types/bikeShop';
import type { OfferPriceEntry, CustomerCondition, ConditionPricePoint } from '../context/OfferPriceBook';

/**
 * Deterministic "Sell Your Bike" valuation engine.
 *
 * Takes the AI identification of a bike plus the staff offer price book and
 * produces a cash offer with an honest confidence score and a rationale list.
 * It is intentionally pure (no network, no React) so the staff UI, the website
 * widget and the tests all share exactly one pricing brain.
 */

export type { CustomerCondition } from '../context/OfferPriceBook';
export { CONDITION_ORDER } from '../context/OfferPriceBook';

/** Per-condition price multipliers — what we pay at each grade vs. the good base. */
export interface OfferConditionBands {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

/** Sensible starting bands staff can tune from the price-book editor. */
export const DEFAULT_CONDITION_BANDS: OfferConditionBands = {
  excellent: 1.15,
  good: 1.0,
  fair: 0.8,
  poor: 0.55,
};

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
  /** Staff-tuned condition multipliers; falls back to DEFAULT_CONDITION_BANDS. */
  conditionBands?: OfferConditionBands;
}

export interface ValuationAdjustment {
  label: string;
  amount: number;
}

/** What the bike would fetch at each condition grade, before fault deductions. */
export interface ConditionPrice {
  condition: CustomerCondition;
  multiplier: number;
  price: number;
  /** Upper bound when the grade is a staff-set band (e.g. £30–£40). */
  maxPrice?: number;
  /** True when this price came from a staff-set per-condition figure. */
  explicit?: boolean;
}

export interface BikeValuation {
  /** The book price before condition/fault adjustments, or null when unmatched. */
  basePrice: number | null;
  matchedEntry: OfferPriceEntry | null;
  matchLevel: 'model' | 'brand' | 'category' | 'none';
  condition: CustomerCondition;
  conditionMultiplier: number;
  /** 'explicit' when staff set this grade's price, else 'derived' from basePrice. */
  conditionSource: 'explicit' | 'derived';
  /** Price at every condition grade, so staff/customers see the whole ladder. */
  conditionPrices: ConditionPrice[];
  /** Cosmetic-damage deduction (scratches/dents/rust…), 0 when none detected. */
  cosmeticAdjustment: number;
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

/** Cosmetic blemish keywords → the fraction knocked off the condition price. */
const COSMETIC_WEIGHTS: { match: RegExp; weight: number; label: string }[] = [
  { match: /crack|fracture|dent|buckle|bent|snapped|broken/i, weight: 0.15, label: 'structural damage' },
  { match: /rust|corrosion|pitting/i, weight: 0.1, label: 'rust / corrosion' },
  { match: /scratch|scuff|scrape|mark|chip|paint/i, weight: 0.05, label: 'scratches / scuffs' },
];

/** Severity → a multiplier on the cosmetic weight. */
const COSMETIC_SEVERITY: Record<string, number> = {
  minor: 0.6,
  low: 0.6,
  moderate: 1,
  medium: 1,
  major: 1.5,
  high: 1.5,
  severe: 1.8,
  critical: 1.8,
};

const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

const norm = (v?: string) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function toCategory(type?: string): VehicleCategory {
  if (type === 'ebike' || type === 'electric_scooter' || type === 'cargo') return type;
  return 'cycle';
}

/** Resolve the condition bands, falling back to (and clamping) the defaults. */
function resolveBands(input: ValuationInput): OfferConditionBands {
  const b = input.conditionBands;
  const pick = (v: number | undefined, fallback: number) =>
    Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
  return {
    excellent: pick(b?.excellent, DEFAULT_CONDITION_BANDS.excellent),
    good: pick(b?.good, DEFAULT_CONDITION_BANDS.good),
    fair: pick(b?.fair, DEFAULT_CONDITION_BANDS.fair),
    poor: pick(b?.poor, DEFAULT_CONDITION_BANDS.poor),
  };
}

export function resolveCondition(input: ValuationInput): CustomerCondition {
  if (input.declaredCondition) return input.declaredCondition;
  const ai = AI_CONDITION_TO_CUSTOMER[String(input.overallCondition ?? '').toLowerCase()];
  return ai ?? 'good';
}

/**
 * Resolve the price for one condition grade. A staff-set per-condition figure
 * wins outright; otherwise the grade is derived from the base price and the
 * global condition band (rounded to £5). This is the single source of truth for
 * both the offer and the on-screen condition ladder.
 */
export function priceForCondition(
  entry: OfferPriceEntry,
  condition: CustomerCondition,
  bands: OfferConditionBands
): ConditionPrice {
  const explicit: ConditionPricePoint | undefined = entry.conditionPrices?.[condition];
  if (explicit && Number.isFinite(explicit.price)) {
    const price = Math.max(0, Math.round(explicit.price));
    const maxPrice =
      Number.isFinite(Number(explicit.maxPrice)) && Number(explicit.maxPrice) >= price
        ? Math.round(Number(explicit.maxPrice))
        : undefined;
    return { condition, multiplier: bands[condition], price, maxPrice, explicit: true };
  }
  return { condition, multiplier: bands[condition], price: round5(entry.basePrice * bands[condition]) };
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

/**
 * Turn the AI's cosmetic blemishes (scratches, dents, rust…) into one deduction,
 * as a fraction of the condition price. Summed and capped so a scuffed bike is
 * still worth something, and the individual blemishes stay visible in the UI.
 */
export function cosmeticDeduction(
  issues: { type?: string; severity?: string }[] | undefined,
  price: number
): { amount: number; fraction: number; labels: string[] } {
  const labels: string[] = [];
  let fraction = 0;
  for (const issue of issues ?? []) {
    const text = `${issue.type ?? ''}`;
    const hit = COSMETIC_WEIGHTS.find((w) => w.match.test(text));
    if (!hit) continue;
    const sev = COSMETIC_SEVERITY[String(issue.severity ?? '').toLowerCase()] ?? 1;
    fraction += hit.weight * sev;
    labels.push(`${issue.type}${issue.severity ? ` (${issue.severity})` : ''}`);
  }
  fraction = Math.min(fraction, 0.5);
  return { amount: Math.round(price * fraction), fraction, labels };
}

export function valueBike(input: ValuationInput, book: OfferPriceEntry[]): BikeValuation {
  const { entry, level } = matchOfferEntry(book, input);
  const condition = resolveCondition(input);
  const bands = resolveBands(input);
  const conditionMultiplier = bands[condition];
  const rationale: string[] = [];
  const adjustments: ValuationAdjustment[] = [];

  if (!entry) {
    return {
      basePrice: null,
      matchedEntry: null,
      matchLevel: 'none',
      condition,
      conditionMultiplier,
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
      : level === 'brand'
      ? `Matched the brand-wide ${entry.brand} price.`
      : `Used the ${toCategory(input.type)} category default — no brand match.`
  );

  // Price at every condition grade, so staff and customers see the whole ladder.
  // A staff-set per-condition figure is authoritative; otherwise it is derived.
  const conditionPrices: ConditionPrice[] = (['excellent', 'good', 'fair', 'poor'] as CustomerCondition[]).map((c) =>
    priceForCondition(entry, c, bands)
  );
  const selected = conditionPrices.find((p) => p.condition === condition) ?? conditionPrices[1];
  const conditionSource: 'explicit' | 'derived' = selected.explicit ? 'explicit' : 'derived';

  const cosmetic = cosmeticDeduction(input.cosmeticIssues, selected.price);

  // A staff-set condition price already reflects the bike's wear, so it stands
  // as-is; fault and cosmetic findings are reported but not deducted from it.
  if (conditionSource === 'explicit') {
    rationale.push(
      `Staff price for “${condition}” condition applied (£${selected.price}${
        selected.maxPrice ? `–£${selected.maxPrice}` : ''
      }).`
    );
    const highFaults = countSevere(input, ['high', 'critical safety risk', 'critical']);
    const mediumFaults = countSevere(input, ['medium']);
    if (highFaults > 0) {
      adjustments.push({ label: `${highFaults} serious fault${highFaults === 1 ? '' : 's'} (noted)`, amount: 0 });
      rationale.push('Serious faults noted — already accounted for in the condition grade.');
    }
    if (mediumFaults > 0) {
      adjustments.push({ label: `${mediumFaults} moderate fault${mediumFaults === 1 ? '' : 's'} (noted)`, amount: 0 });
    }
    if (cosmetic.amount > 0) {
      adjustments.push({ label: `Cosmetic: ${cosmetic.labels.join(', ')} (noted)`, amount: 0 });
      rationale.push(`Cosmetic blemishes noted (${cosmetic.labels.join(', ')}) — covered by the condition grade.`);
    }

    const finalOffer = selected.price;
    const minOffer = finalOffer;
    const maxOffer = Math.max(selected.maxPrice ?? finalOffer, finalOffer);

    const aiConfidence = typeof input.confidence === 'number' ? input.confidence : 0.5;
    const coverage = typeof input.coverage === 'number' ? input.coverage : 0.6;
    const confidence = Math.max(0, Math.min(1, aiConfidence * MATCH_WEIGHT[level] * (0.6 + 0.4 * coverage)));
    const needsStaffReview = level !== 'model' || confidence < 0.5;
    if (needsStaffReview) rationale.push('Flagged for staff review before the offer is final.');

    return {
      basePrice: entry.basePrice,
      matchedEntry: entry,
      matchLevel: level,
      condition,
      conditionMultiplier,
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

  let offer = selected.price;
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

  // Cosmetic blemishes the AI spotted (scratches, dents, rust…) — separate from
  // mechanical faults so the customer sees exactly what cost them money.
  if (cosmetic.amount > 0) {
    offer -= cosmetic.amount;
    adjustments.push({ label: `Cosmetic: ${cosmetic.labels.join(', ')}`, amount: -cosmetic.amount });
    rationale.push(
      `Cosmetic blemishes found (${cosmetic.labels.join(', ')}) — £${cosmetic.amount} off.`
    );
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

  const needsStaffReview =
    level !== 'model' || confidence < 0.5 || highFaults > 0 || cosmetic.amount > 0;
  if (needsStaffReview) rationale.push('Flagged for staff review before the offer is final.');

  return {
    basePrice: entry.basePrice,
    matchedEntry: entry,
    matchLevel: level,
    condition,
    conditionMultiplier,
    conditionSource,
    conditionPrices,
    cosmeticAdjustment: cosmetic.amount,
    adjustments,
    offer: finalOffer,
    minOffer,
    maxOffer: Math.max(maxOffer, finalOffer),
    confidence,
    needsStaffReview,
    rationale,
  };
}
