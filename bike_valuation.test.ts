import { describe, it, expect, beforeEach } from 'vitest';

// The price book mirrors to Supabase in the background; keep it offline.
import { vi } from 'vitest';
vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

import { valueBike, matchOfferEntry, resolveCondition, priceForCondition } from './src/utils/bikeValuation';
import type { OfferPriceEntry } from './src/context/OfferPriceBook';

const book: OfferPriceEntry[] = [
  { id: '1', brand: 'Trek', model: 'Marlin 5', category: 'cycle', basePrice: 200, updatedAt: 'x' },
  { id: '2', brand: 'Trek', model: '', category: 'cycle', basePrice: 150, updatedAt: 'x' },
  { id: '3', brand: '', model: '', category: 'cycle', basePrice: 90, updatedAt: 'x' },
  { id: '4', brand: '', model: '', category: 'ebike', basePrice: 220, updatedAt: 'x' },
];

beforeEach(() => {
  localStorage.clear();
});

describe('matchOfferEntry', () => {
  it('prefers an exact brand+model match', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Trek', model: 'Marlin 5', type: 'cycle' });
    expect(level).toBe('model');
    expect(entry?.basePrice).toBe(200);
  });

  it('falls back to the category price when the exact model is unknown', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Trek', model: 'FX 3', type: 'cycle' });
    expect(level).toBe('category');
    expect(entry?.basePrice).toBe(90);
  });

  it('falls back to the category default for an unknown brand', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Raleigh', model: 'Pioneer', type: 'cycle' });
    expect(level).toBe('category');
    expect(entry?.basePrice).toBe(90);
  });

  it('matches brand and model case- and punctuation-insensitively', () => {
    const { level } = matchOfferEntry(book, { make: 'trek', model: 'marlin-5', type: 'cycle' });
    expect(level).toBe('model');
  });

  it('returns none when the book is empty', () => {
    const { entry, level } = matchOfferEntry([], { make: 'Trek', model: 'Marlin 5', type: 'cycle' });
    expect(level).toBe('none');
    expect(entry).toBeNull();
  });
});

describe('resolveCondition', () => {
  it('maps the AI condition to a customer condition', () => {
    expect(resolveCondition({ overallCondition: 'Critical' })).toBe('poor');
    expect(resolveCondition({ overallCondition: 'Excellent' })).toBe('excellent');
  });

  it('lets a declared condition win over the AI read', () => {
    expect(resolveCondition({ overallCondition: 'Excellent', declaredCondition: 'fair' })).toBe('fair');
  });

  it('defaults to good', () => {
    expect(resolveCondition({})).toBe('good');
  });
});

describe('valueBike', () => {
  it('offers the staff base price for good condition', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'good' }, book);
    expect(v.offer).toBe(200);
    expect(v.basePrice).toBe(200);
    expect(v.matchLevel).toBe('model');
    expect(v.conditionSource).toBe('explicit');
  });

  it('offers nothing when staff have not priced that condition grade', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'excellent' }, book);
    expect(v.offer).toBeNull();
    expect(v.needsStaffReview).toBe(true);
    expect(v.rationale.join(' ')).toMatch(/no staff price/i);
  });

  it('reports faults but never deducts them from the staff price', () => {
    const clean = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'good' }, book);
    const damaged = valueBike(
      {
        make: 'Trek',
        model: 'Marlin 5',
        type: 'cycle',
        declaredCondition: 'good',
        faults: [{ severity: 'High' }, { severity: 'Critical safety risk' }],
      },
      book
    );
    expect(damaged.offer).toBe(clean.offer);
    expect(damaged.adjustments.length).toBeGreaterThan(0);
    expect(damaged.adjustments.every((a) => a.amount === 0)).toBe(true);
  });

  it('returns no offer when the bike cannot be matched', () => {
    const v = valueBike({ make: 'Unknown / To Be Inspected', model: 'Unknown / To Be Inspected', type: 'cycle' }, [
      { id: 'x', brand: 'Trek', model: '', category: 'cycle', basePrice: 150, updatedAt: 'x' },
    ]);
    // Category fallback exists in the real seed book, but not here.
    expect(v.offer).toBeNull();
    expect(v.needsStaffReview).toBe(true);
    expect(v.rationale.join(' ')).toMatch(/price this bike by hand/i);
  });

  it('flags lower-confidence reads for staff review', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', confidence: 0.2, coverage: 0.3 }, book);
    expect(v.confidence).toBeLessThan(0.5);
    expect(v.needsStaffReview).toBe(true);
  });

  it('never lets the AI invent a price from the electric kit', () => {
    const plain = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'good' }, book);
    const electric = valueBike(
      { make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'good', electricKit: { isElectric: true } },
      book
    );
    expect(electric.offer).toBe(plain.offer);
  });
});

describe('condition ladder — staff prices only', () => {
  it('prices only the grades staff have set', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle' }, book);
    const byCondition = Object.fromEntries(v.conditionPrices.map((c) => [c.condition, c.price]));
    // The base price is the good-condition figure; the other grades are unset.
    expect(byCondition.good).toBe(200);
    expect(byCondition.excellent).toBeNull();
    expect(byCondition.fair).toBeNull();
    expect(byCondition.poor).toBeNull();
  });
});

describe('cosmetic findings', () => {
  it('reports blemishes without touching the staff price', () => {
    const v = valueBike(
      {
        make: 'Trek',
        model: 'Marlin 5',
        type: 'cycle',
        declaredCondition: 'good',
        cosmeticIssues: [
          { type: 'Scratch on top tube', severity: 'Moderate' },
          { type: 'Dent in down tube', severity: 'Major' },
        ],
      },
      book
    );
    expect(v.offer).toBe(200);
    expect(v.cosmeticAdjustment).toBe(0);
    expect(v.adjustments.some((a) => /cosmetic/i.test(a.label))).toBe(true);
    expect(v.adjustments.every((a) => a.amount === 0)).toBe(true);
  });

  it('ignores blemishes with no type', () => {
    const v = valueBike(
      { make: 'Trek', model: 'Marlin 5', type: 'cycle', cosmeticIssues: [{ severity: 'Minor' }] },
      book
    );
    expect(v.adjustments.some((a) => /cosmetic/i.test(a.label))).toBe(false);
  });
});

describe('explicit per-condition prices (staff-configurable)', () => {
  // The Carrera Vengeance example from the workshop: poor £10, fair £20, good £30–£40.
  const vengeance: OfferPriceEntry = {
    id: 'vengeance',
    brand: 'Carrera',
    model: 'Vengeance',
    category: 'cycle',
    basePrice: 35,
    conditionPrices: { poor: { price: 10 }, fair: { price: 20 }, good: { price: 30, maxPrice: 40 } },
    updatedAt: 'x',
  };
  const vengeanceBook = [vengeance, ...book];

  it('uses the staff-set price for the resolved grade', () => {
    const poor = valueBike({ make: 'Carrera', model: 'Vengeance', type: 'cycle', declaredCondition: 'poor' }, vengeanceBook);
    expect(poor.offer).toBe(10);
    expect(poor.conditionSource).toBe('explicit');

    const good = valueBike({ make: 'Carrera', model: 'Vengeance', type: 'cycle', declaredCondition: 'good' }, vengeanceBook);
    expect(good.offer).toBe(30);
    expect(good.minOffer).toBe(30);
    expect(good.maxOffer).toBe(40);
  });

  it('shows the explicit price at each set grade and leaves the rest unset', () => {
    const v = valueBike({ make: 'Carrera', model: 'Vengeance', type: 'cycle' }, vengeanceBook);
    const byCondition = Object.fromEntries(v.conditionPrices.map((c) => [c.condition, c]));
    expect(byCondition.poor.price).toBe(10);
    expect(byCondition.fair.price).toBe(20);
    expect(byCondition.good.price).toBe(30);
    expect(byCondition.good.maxPrice).toBe(40);
    expect(byCondition.good.explicit).toBe(true);
    // Excellent was left blank → no staff price, so we show no figure.
    expect(byCondition.excellent.explicit).toBeFalsy();
    expect(byCondition.excellent.price).toBeNull();
  });

  it('does not deduct faults or cosmetic damage from a staff-set price', () => {
    const plain = valueBike({ make: 'Carrera', model: 'Vengeance', type: 'cycle', declaredCondition: 'good' }, vengeanceBook);
    const damaged = valueBike(
      {
        make: 'Carrera',
        model: 'Vengeance',
        type: 'cycle',
        declaredCondition: 'good',
        faults: [{ severity: 'High' }],
        cosmeticIssues: [{ type: 'Dent in down tube', severity: 'Major' }],
      },
      vengeanceBook
    );
    expect(damaged.offer).toBe(plain.offer);
    expect(damaged.offer).toBe(30);
    expect(damaged.adjustments.every((a) => a.amount === 0)).toBe(true);
    expect(damaged.rationale.join(' ')).toMatch(/condition grade/i);
  });

  it('exposes priceForCondition directly', () => {
    expect(priceForCondition(vengeance, 'poor').price).toBe(10);
    expect(priceForCondition(vengeance, 'excellent').explicit).toBeFalsy();
    expect(priceForCondition(vengeance, 'excellent').price).toBeNull();
  });
});
